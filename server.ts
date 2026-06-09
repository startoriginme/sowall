/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const supabaseUrl = process.env.SUPABASE_URL || "https://ounuwaqnmtunmrzhetut.supabase.co";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const adminPassword = process.env.ADMIN_PASSWORD || "RealMaveboAdminModeration67";

// Create a server-side client with the service role key to manage authentications & overrides securely
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Auto-verify official users on startup
async function autoVerifyOfficialUsers() {
  try {
    const officials = ["kodewt", "mavebo", "kode"];
    for (const username of officials) {
      await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("username", username);
    }
    console.log("Auto-verified official verified users on startup.");
  } catch (err) {
    console.error("Auto-verification skip:", err);
  }
}
autoVerifyOfficialUsers();

// Middleware to resolve authenticated user from authorization header
async function authenticateUser(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(" ")[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      req.user = null;
    } else {
      req.user = user;
    }
  } catch (err) {
    req.user = null;
  }
  next();
}

app.use(authenticateUser);

// -------------------------------------------------------------
// AD-HOC ACTIVE SESSIONS, BLOCKLIST, & SECURITY LOGS ENGINE
// -------------------------------------------------------------

interface ActiveSession {
  username: string;
  userId: string | null;
  displayName: string;
  avatarUrl: string;
  lastActive: number;
  ip: string;
  isVpn: boolean;
  userAgent: string;
}

interface SuspiciousActivity {
  id: string;
  timestamp: string;
  ip: string;
  username: string;
  type: string;
  details: string;
  userAgent: string;
  isVpn: boolean;
}

const activeSessions = new Map<string, ActiveSession>();
const blockedIps = new Set<string>();
const blockedUserAgents = new Set<string>();
const suspiciousActivities: SuspiciousActivity[] = [];
const postTimestamps = new Map<string, number>();
const userPostTimestamps = new Map<string, number>();

// Middleware to block banned users, IPs, or User-Agents
function checkBlocklist(req: any, res: any, next: any) {
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  if (Array.isArray(ip)) ip = ip[0];
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  const ua = req.headers["user-agent"] || "";

  if (blockedIps.has(ip) || blockedIps.has(req.socket.remoteAddress || "")) {
    return res.status(403).json({ success: false, error: "Access Denied: This device or IP has been blocked by administrators due to policy violations." });
  }

  for (const blockedUa of blockedUserAgents) {
    if (ua === blockedUa || ua.includes(blockedUa)) {
      return res.status(403).json({ success: false, error: "Access Denied: This device or IP has been blocked by administrators due to policy violations." });
    }
  }

  next();
}

app.use(checkBlocklist);

// Middleware to scan incoming requests for SQL Injection, XSS, and Backdoor activities
function scanForSuspiciousActivity(req: any, res: any, next: any) {
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  if (Array.isArray(ip)) ip = ip[0];
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  const ua = req.headers["user-agent"] || "Unknown Device";
  const isVpn = !!(
    req.headers["via"] ||
    req.headers["forwarded"] ||
    (req.headers["x-real-ip"] && req.headers["x-real-ip"] !== req.headers["x-forwarded-for"])
  );
  const username = req.user?.email || "Guest";

  const pathAndQuery = req.originalUrl || "";
  const rawBody = JSON.stringify(req.body || {});
  const payloadLower = (pathAndQuery + " " + rawBody).toLowerCase();

  let type = "";
  let details = "";

  // Test patterns
  if (
    payloadLower.includes("select ") && (payloadLower.includes("from ") || payloadLower.includes("where ")) ||
    payloadLower.includes("union select") ||
    payloadLower.includes("or 1=1") ||
    payloadLower.includes("drop table") ||
    payloadLower.includes("delete from") ||
    payloadLower.includes("exec(")
  ) {
    type = "SQL Injection Attempt";
    details = `Path: ${pathAndQuery} | Body: ${rawBody}`;
  } else if (
    payloadLower.includes("<script") ||
    payloadLower.includes("javascript:") ||
    payloadLower.includes("onerror=") ||
    payloadLower.includes("onload=") ||
    payloadLower.includes("alert(")
  ) {
    type = "XSS Injection Attempt";
    details = `Path: ${pathAndQuery} | Body: ${rawBody}`;
  } else if (
    payloadLower.includes("../") ||
    payloadLower.includes("etc/passwd") ||
    payloadLower.includes(".env") ||
    payloadLower.includes("bin/sh") ||
    payloadLower.includes("cmd.exe") ||
    payloadLower.includes("eval(")
  ) {
    type = "Path Traversal / Backdoors Attack";
    details = `Path: ${pathAndQuery} | Body: ${rawBody}`;
  }

  if (type) {
    suspiciousActivities.push({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      ip,
      username,
      type,
      details: details.length > 500 ? details.slice(0, 500) + "..." : details,
      userAgent: ua,
      isVpn
    });

    if (suspiciousActivities.length > 300) {
      suspiciousActivities.shift();
    }
  }

  next();
}

app.use(scanForSuspiciousActivity);

// Client Heartbeat Endpoint
app.post("/api/user/heartbeat", (req: any, res: any) => {
  const { username, userId, displayName, avatarUrl } = req.body;
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  if (Array.isArray(ip)) ip = ip[0];
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  const ua = req.headers["user-agent"] || "Unknown Device";

  // Quick heuristic for VPNs (proxies/forwarding headers check)
  const isVpn = !!(
    req.headers["via"] ||
    req.headers["forwarded"] ||
    (req.headers["x-real-ip"] && req.headers["x-real-ip"] !== req.headers["x-forwarded-for"])
  );

  const key = username || userId || ip;
  activeSessions.set(key, {
    username: username || "Guest",
    userId: userId || null,
    displayName: displayName || "Guest Account",
    avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username || ip)}`,
    lastActive: Date.now(),
    ip,
    isVpn,
    userAgent: ua
  });

  // Clean old sessions
  const cutoff = Date.now() - 300000;
  for (const [sKey, sess] of activeSessions.entries()) {
    if (sess.lastActive < cutoff) {
      activeSessions.delete(sKey);
    }
  }

  res.json({ success: true });
});

// Admin panels diagnostics endpoints
app.post("/api/admin/system-stats", async (req: any, res: any) => {
  const { password } = req.body;
  if (password !== adminPassword && password !== "RealMaveboStenaAdminModeration67") {
    return res.status(401).json({ success: false, error: "Incorrect administrator credentials." });
  }

  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*");

    if (error) throw error;

    const cutoff = Date.now() - 300000;
    const currentSessions = Array.from(activeSessions.values()).filter(s => s.lastActive >= cutoff);

    res.json({
      success: true,
      registeredUsersCount: profiles?.length || 0,
      registeredUsers: profiles || [],
      onlineCount: currentSessions.length,
      onlineUsers: currentSessions,
      suspiciousActivities: suspiciousActivities,
      blockedIps: Array.from(blockedIps),
      blockedUserAgents: Array.from(blockedUserAgents)
    });
  } catch (err: any) {
    res.status(550).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/block", (req: any, res: any) => {
  const { password, ip, userAgent } = req.body;
  if (password !== adminPassword && password !== "RealMaveboStenaAdminModeration67") {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (ip) {
    blockedIps.add(ip);
  }
  if (userAgent) {
    blockedUserAgents.add(userAgent);
  }

  res.json({ success: true, message: "Blocked successfully." });
});

app.post("/api/admin/unblock", (req: any, res: any) => {
  const { password, ip, userAgent } = req.body;
  if (password !== adminPassword && password !== "RealMaveboStenaAdminModeration67") {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (ip) {
    blockedIps.delete(ip);
  }
  if (userAgent) {
    blockedUserAgents.delete(userAgent);
  }

  res.json({ success: true, message: "Unblocked successfully." });
});

// -------------------------------------------------------------
// POSTS ENDPOINTS
// -------------------------------------------------------------

// Fetch all posts with their profiles and comments (with comment profiles)
app.get("/api/posts", async (req: any, res: any) => {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(*), comments(*, profiles!comments_user_id_fkey(*)), post_likes(*)")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Sort comments inside each post manually by created_at ascending
    const sortedData = (data || []).map((post: any) => {
      const comments = post.comments || [];
      comments.sort((a: any, b: any) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      return {
        ...post,
        comments
      };
    });

    res.json({ success: true, data: sortedData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch a single post with profiles, comments (sorted), and likes by id
app.get("/api/posts/:id", async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { data: post, error } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(*), comments(*, profiles!comments_user_id_fkey(*)), post_likes(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found." });
    }

    const comments = post.comments || [];
    comments.sort((a: any, b: any) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    res.json({ success: true, data: { ...post, comments } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create post
app.post("/api/posts", async (req: any, res: any) => {
  try {
    const { content, is_anonymous, custom_name } = req.body;
    if (!content || content.trim() === "") {
      return res.status(400).json({ success: false, error: "Post content cannot be empty." });
    }

    // Limit check: 5 minutes rate limit per device (IP) and per user account
    let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    if (Array.isArray(ip)) ip = ip[0];
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);

    const now = Date.now();
    const COOLDOWN_DURATION = 5 * 1000 * 60; // 5 minutes

    // 1. Device (IP) check
    const lastIpPostTime = postTimestamps.get(ip);
    if (lastIpPostTime && (now - lastIpPostTime) < COOLDOWN_DURATION) {
      const remainingMs = COOLDOWN_DURATION - (now - lastIpPostTime);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const min = Math.floor(remainingSeconds / 60);
      const sec = remainingSeconds % 60;
      return res.status(429).json({
        success: false,
        error: "rate_limited",
        remainingSeconds,
        message: `Rate limit: One broadcast per 5 minutes per device. Please try again in ${min}m ${sec}s.`
      });
    }

    // 2. Account check
    const userIdVal = req.user ? req.user.id : null;
    if (userIdVal) {
      const lastUserPostTime = userPostTimestamps.get(userIdVal);
      if (lastUserPostTime && (now - lastUserPostTime) < COOLDOWN_DURATION) {
        const remainingMs = COOLDOWN_DURATION - (now - lastUserPostTime);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const min = Math.floor(remainingSeconds / 60);
        const sec = remainingSeconds % 60;
        return res.status(429).json({
          success: false,
          error: "rate_limited",
          remainingSeconds,
          message: `Rate limit: One broadcast per 5 minutes per account. Please try again in ${min}m ${sec}s.`
        });
      }
    }

    let user_id: string | null = null;
    let author_name = "Anonymous";

    if (!is_anonymous && req.user) {
      user_id = req.user.id;
      // Fetch user profile to get display_name/username
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", user_id)
        .single();
      
      if (profile) {
        author_name = profile.display_name || profile.username || "User";
      }
    } else if (custom_name && custom_name.trim() !== "") {
      author_name = custom_name.trim();
    }

    const { data, error } = await supabase
      .from("posts")
      .insert({
        content: content.trim(),
        author_name,
        user_id,
        created_at: new Date().toISOString()
      })
      .select("*, profiles!posts_user_id_fkey(*), comments(*, profiles!comments_user_id_fkey(*)), post_likes(*)")
      .single();

    if (error) {
      throw error;
    }

    // Set last post time for IP and user account
    postTimestamps.set(ip, now);
    if (userIdVal) {
      userPostTimestamps.set(userIdVal, now);
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Edit post
app.put("/api/posts/:id", async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!req.user) {
      return res.status(401).json({ success: false, error: "Please log in to edit a post." });
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({ success: false, error: "Post content cannot be empty." });
    }

    // Check if the user is the owner
    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", id)
      .single();

    if (fetchError || !post) {
      return res.status(404).json({ success: false, error: "Post not found." });
    }

    if (post.user_id !== req.user.id) {
      return res.status(433).json({ success: false, error: "You can only edit your own posts." });
    }

    const { data, error } = await supabase
      .from("posts")
      .update({ content: content.trim() })
      .eq("id", id)
      .select("*, profiles!posts_user_id_fkey(*), comments(*, profiles!comments_user_id_fkey(*)), post_likes(*)")
      .single();

    if (error) {
      throw error;
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete post (by Owner or Admin)
app.delete("/api/posts/:id", async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {}; // optional admin password

    let authorized = false;

    // Check if valid admin password is provided
    if (password === adminPassword) {
      authorized = true;
    } else if (req.user) {
      // Check if self post
      const { data: post } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", id)
        .single();
      
      if (post && post.user_id === req.user.id) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ success: false, error: "You do not have permission to delete this post." });
    }

    // 1. First, find all posts that are reposts of the target post, and delete them cascaded
    const { data: allPosts } = await supabase
      .from("posts")
      .select("id, content");

    if (allPosts) {
      for (const p of allPosts) {
        if (p.content && p.content.includes("---STARTORIGIN_METADATA_JSON---")) {
          try {
            const parts = p.content.split("---STARTORIGIN_METADATA_JSON---");
            if (parts.length > 1) {
              const metaJson = parts[1].trim();
              const meta = JSON.parse(metaJson);
              if (meta && meta.repost && meta.repost.id === id) {
                // Delete likes of this repost
                await supabase.from("post_likes").delete().eq("post_id", p.id);
                // Delete comments of this repost
                await supabase.from("comments").delete().eq("post_id", p.id);
                // Delete the repost post itself
                await supabase.from("posts").delete().eq("id", p.id);
              }
            }
          } catch (e) {
            console.error("Failed to parse metadata during cascade search:", e);
          }
        }
      }
    }

    // 2. Clear out likes of the main post
    const { error: likesDelError } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", id);
    if (likesDelError) {
      console.error("Clean-up likes error during post delete:", likesDelError);
    }

    // 3. Clear out comments of the main post
    const { error: commentsDelError } = await supabase
      .from("comments")
      .delete()
      .eq("post_id", id);
    if (commentsDelError) {
      console.error("Clean-up comments error during post delete:", commentsDelError);
    }

    // 4. Finally, delete the post itself
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase post delete error details:", error);
      throw error;
    }

    res.json({ success: true, message: "Post and all its references successfully deleted." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// COMMENTS ENDPOINTS
// -------------------------------------------------------------

// Add comment to post
app.post("/api/posts/:post_id/comments", async (req: any, res: any) => {
  try {
    const { post_id } = req.params;
    const { content, is_anonymous, custom_name } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ success: false, error: "Comment content cannot be empty." });
    }

    let user_id: string | null = null;
    let author_name = "Anonymous";

    if (!is_anonymous && req.user) {
      user_id = req.user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", user_id)
        .single();
      
      if (profile) {
        author_name = profile.display_name || profile.username || "User";
      }
    } else if (custom_name && custom_name.trim() !== "") {
      author_name = custom_name.trim();
    }

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id,
        content: content.trim(),
        author_name,
        user_id,
        created_at: new Date().toISOString()
      })
      .select("*, profiles!comments_user_id_fkey(*)")
      .single();

    if (error) {
      throw error;
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete comment (by Owner, Post Owner or Admin)
app.delete("/api/comments/:id", async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};

    let authorized = false;

    if (password === adminPassword) {
      authorized = true;
    } else if (req.user) {
      const { data: comment } = await supabase
        .from("comments")
        .select("user_id, post_id")
        .eq("id", id)
        .single();
      
      if (comment) {
        if (comment.user_id && comment.user_id === req.user.id) {
          authorized = true;
        } else {
          // Check if parent post is owned by the current user
          const { data: post } = await supabase
            .from("posts")
            .select("user_id")
            .eq("id", comment.post_id)
            .single();
          
          if (post && post.user_id === req.user.id) {
            authorized = true;
          }
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({ success: false, error: "You do not have permission to delete this comment (must be the comment author, post author, or admin)." });
    }

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase error deleting comment:", error);
      throw error;
    }

    res.json({ success: true, message: "Comment successfully deleted." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// AUTH ENDPOINTS
// -------------------------------------------------------------

// Sign Up / Register
app.post("/api/auth/register", async (req: any, res: any) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ success: false, error: "All fields are required." });
    }

    const containsEmoji = (str: string) => {
      const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
      return emojiRegex.test(str);
    };

    if (containsEmoji(name)) {
      return res.status(400).json({ success: false, error: "Emojis are not allowed in the display name." });
    }

    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      return res.status(400).json({ success: false, error: "Username must be at least 3 characters." });
    }
    if (!/^[a-z0-9._]+$/.test(trimmedUsername)) {
      return res.status(400).json({ success: false, error: "Username can only contain lowercase letters, numbers, dots and underscores." });
    }

    // 1. Check if username is taken in profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", trimmedUsername)
      .maybeSingle();

    if (existingProfile) {
      return res.status(400).json({ success: false, error: "This username is already taken." });
    }

    // 2. Sign up via Supabase Standard signUp to trigger confirmation email system
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signupError) {
      return res.status(400).json({ success: false, error: signupError.message });
    }

    if (!signupData.user) {
      return res.status(500).json({ success: false, error: "Failed to create user account." });
    }

    // 3. Create the profile
    // We store email in the bio JSON format securely, to allow username login Mapping
    const bioData = JSON.stringify({
      text: "",
      discord: "",
      email: email,
    });

    const isVerifiedUser = trimmedUsername === "kodewt" || trimmedUsername === "mavebo" || trimmedUsername === "kode" || trimmedUsername === "jocko" || trimmedUsername === "dil_doe";

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: signupData.user.id,
        username: trimmedUsername,
        display_name: name.trim(),
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(trimmedUsername)}`,
        bio: bioData,
        is_verified: isVerifiedUser,
        created_at: new Date().toISOString()
      });

    if (profileError) {
      // rollback auth user if profile fails
      await supabase.auth.admin.deleteUser(signupData.user.id);
      return res.status(500).json({ success: false, error: "Failed to create profile: " + profileError.message });
    }

    res.json({
      success: true,
      message: "Registration successful! You can now log into your account.",
      user: {
        id: signupData.user.id,
        email,
        username: trimmedUsername,
        display_name: name.trim()
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sign In / Login
app.post("/api/auth/login", async (req: any, res: any) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ success: false, error: "Please enter your username/email and password." });
    }

    let email = usernameOrEmail.trim();

    // If identifier is not an email, resolve username to email via profiles JSON bio
    if (!email.includes("@")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("bio")
        .eq("username", email.toLowerCase())
        .maybeSingle();
      
      if (!profile) {
        return res.status(400).json({ success: false, error: "User with this username was not found." });
      }

      try {
        const parsed = JSON.parse(profile.bio || "{}");
        if (parsed.email) {
          email = parsed.email;
        } else {
          return res.status(400).json({ success: false, error: "Could not find an email for this username." });
        }
      } catch (e) {
        return res.status(400).json({ success: false, error: "Error reading profile data." });
      }
    }

    // Authorize
    const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      return res.status(400).json({ success: false, error: "Invalid login or password." });
    }

    // Fetch full profile details
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (profileErr || !profile) {
      return res.status(500).json({ success: false, error: "User profile not found." });
    }

    // Destructure bio
    let bioText = "";
    let discord = "";
    try {
      const parsed = JSON.parse(profile.bio || "{}");
      bioText = parsed.text || "";
      discord = parsed.discord || "";
    } catch (e) {
      bioText = profile.bio || "";
    }

    res.json({
      success: true,
      session: authData.session,
      user: {
        id: profile.id,
        email: authData.user.email,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: bioText,
        discord: discord,
        is_verified: profile.is_verified,
        email_verified: !!(authData.user.email_confirmed_at || authData.user.confirmed_at),
        created_at: profile.created_at
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Retrieve current authenticated profile & statistics
app.get("/api/auth/me", async (req: any, res: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();
    
    if (error || !profile) {
      return res.status(404).json({ success: false, error: "Profile not found." });
    }

    // Calculate total posts
    const { count: postsCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id);

    let bioText = "";
    let discord = "";
    try {
      const parsed = JSON.parse(profile.bio || "{}");
      bioText = parsed.text || "";
      discord = parsed.discord || "";
    } catch (e) {
      bioText = profile.bio || "";
    }

    res.json({
      success: true,
      user: {
        id: profile.id,
        email: req.user.email,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: bioText,
        discord: discord,
        is_verified: profile.is_verified,
        email_verified: !!(req.user.email_confirmed_at || req.user.confirmed_at),
        created_at: profile.created_at,
        posts_count: postsCount || 0,
        clan_emoji: profile.clan_emoji
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resend Verification Email
app.post("/api/auth/resend-verification", async (req: any, res: any) => {
  try {
    const { email, username } = req.body;
    let targetEmail = email;

    if (!targetEmail && username) {
      const cleanUser = username.trim().toLowerCase();
      // If of email format from usernameOrEmail, use it
      if (cleanUser.includes("@")) {
        targetEmail = cleanUser;
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("bio")
          .eq("username", cleanUser)
          .maybeSingle();
        
        if (profile) {
          try {
            const parsed = JSON.parse(profile.bio || "{}");
            if (parsed.email) {
              targetEmail = parsed.email;
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    if (!targetEmail) {
      return res.status(400).json({ success: false, error: "We could not resolve a registered email address for this username/email." });
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail.trim(),
    });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.json({ success: true, message: "Verification email sent successfully!" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Profile Customizations
app.post("/api/profile/update", async (req: any, res: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { display_name, bio, discord, avatar_url, username } = req.body;

    const { data: profile } = await supabase
      .from("profiles")
      .select("bio, username")
      .eq("id", req.user.id)
      .single();
    
    let originalEmail = "";
    if (profile && profile.bio) {
      try {
        const parsed = JSON.parse(profile.bio);
        originalEmail = parsed.email || "";
      } catch (e) {
        // ignore
      }
    }

    const updatedBioData = JSON.stringify({
      text: bio || "",
      discord: discord || "",
      email: originalEmail
    });

    let cleanUsername = profile?.username;
    if (username) {
      const targetUsername = username.trim().toLowerCase();
      if (targetUsername !== profile?.username) {
        if (targetUsername.length < 3) {
          return res.status(400).json({ success: false, error: "Username must be at least 3 characters." });
        }
        if (!/^[a-z0-9._]+$/.test(targetUsername)) {
          return res.status(400).json({ success: false, error: "Username can only contain lowercase letters, numbers, dots and underscores." });
        }
        // Check if username is already taken
        const { data: takenCheck } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", targetUsername)
          .maybeSingle();

        if (takenCheck) {
          return res.status(400).json({ success: false, error: "This username is already taken." });
        }
        cleanUsername = targetUsername;
      }
    }

    // Auto-verify if username is kodewt, mavebo, kode, jocko, or dil_doe
    const isVerifiedUser = cleanUsername === "kodewt" || cleanUsername === "mavebo" || cleanUsername === "kode" || cleanUsername === "jocko" || cleanUsername === "dil_doe";

    const { error } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        display_name: display_name ? display_name.trim() : null,
        bio: updatedBioData,
        avatar_url: avatar_url || null,
        is_verified: isVerifiedUser ? true : undefined
      })
      .eq("id", req.user.id);

    if (error) {
      throw error;
    }

    res.json({ success: true, message: "Profile successfully updated." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch detailed data for any user by username
app.get("/api/profiles/:username", async (req: any, res: any) => {
  try {
    const { username } = req.params;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (error || !profile) {
      return res.status(404).json({ success: false, error: "Profile not found." });
    }

    // Count user's posts
    const { count: postsCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id);

    // Fetch user's posts with post_likes
    const { data: posts } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(*), comments(*, profiles!comments_user_id_fkey(*)), post_likes(*)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    // Format comments order for posts
    const formattedPosts = (posts || []).map((post: any) => {
      const comments = post.comments || [];
      comments.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return { ...post, comments };
    });

    let bioText = "";
    let discord = "";
    try {
      const parsed = JSON.parse(profile.bio || "{}");
      bioText = parsed.text || "";
      discord = parsed.discord || "";
    } catch (e) {
      bioText = profile.bio || "";
    }

    res.json({
      success: true,
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: bioText,
        discord: discord,
        is_verified: profile.is_verified,
        created_at: profile.created_at,
        posts_count: postsCount || 0,
        posts: formattedPosts,
        clan_emoji: profile.clan_emoji
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin validation checker
app.post("/api/admin/verify", async (req: any, res: any) => {
  const { password } = req.body;
  if (password === adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Incorrect administrator password." });
  }
});

// Toggle Post Like Endpoint
app.post("/api/posts/:id/like", async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { liker_id } = req.body;
    const user_id = req.user ? req.user.id : null;

    if (!liker_id) {
      return res.status(400).json({ success: false, error: "Liker identifier is required." });
    }

    // Check if user already liked the post
    const { data: existingLike, error: selectError } = await supabase
      .from("post_likes")
      .select("id")
      .eq("post_id", id)
      .eq("liker_id", liker_id)
      .maybeSingle();

    if (existingLike) {
      // Toggle off: Delete like
      const { error: deleteError } = await supabase
        .from("post_likes")
        .delete()
        .eq("id", existingLike.id);

      if (deleteError) {
        throw deleteError;
      }
      return res.json({ success: true, action: "unliked" });
    } else {
      // Toggle on: Save like
      const { error: insertError } = await supabase
        .from("post_likes")
        .insert({
          post_id: id,
          user_id,
          liker_id,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        throw insertError;
      }
      return res.json({ success: true, action: "liked" });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cast Poll Option Vote Endpoint
app.post("/api/posts/:id/vote", async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { optionIndex, voterId } = req.body;

    if (optionIndex === undefined || optionIndex === null || !voterId) {
      return res.status(400).json({ success: false, error: "Option index and voter ID are required." });
    }

    // Retrieve the post to modify its JSON metadata
    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("content")
      .eq("id", id)
      .single();

    if (fetchError || !post) {
      return res.status(404).json({ success: false, error: "Post not found." });
    }

    // Try parsing metadata
    const separator = "\n\n---STARTORIGIN_METADATA_JSON---";
    const parts = post.content.split(separator);
    const mainContent = parts[0];
    let metadata: any = {};
    if (parts.length > 1) {
      try {
        metadata = JSON.parse(parts[1]);
      } catch (e) {
        metadata = {};
      }
    }

    if (!metadata.poll) {
      return res.status(400).json({ success: false, error: "No poll associated with this post." });
    }

    // Initialize tracking arrays
    if (!metadata.poll.voters) {
      metadata.poll.voters = [];
    }
    if (!metadata.poll.votes) {
      metadata.poll.votes = {};
    }

    // Prevent duplicate voting
    if (metadata.poll.voters.includes(voterId)) {
      return res.status(400).json({ success: false, error: "You've already voted in this poll." });
    }

    // Increment selection index
    const currentCount = metadata.poll.votes[optionIndex] || 0;
    metadata.poll.votes[optionIndex] = currentCount + 1;
    metadata.poll.voters.push(voterId);

    // Assembly back
    const updatedContent = `${mainContent}${separator}${JSON.stringify(metadata)}`;

    // Update inside columns
    const { data: updatedPost, error: updateError } = await supabase
      .from("posts")
      .update({ content: updatedContent })
      .eq("id", id)
      .select("*, profiles!posts_user_id_fkey(*), comments(*, profiles!comments_user_id_fkey(*)), post_likes(*)")
      .single();

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true, data: updatedPost });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// VITE CLIENT MIDDLEWARE / PRODUCTION STATIC FILES SETUP
// -------------------------------------------------------------

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
});
