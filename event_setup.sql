-- ========================================================================
--                       STARTORIGIN EVENTS SETUP SCRIPT
-- ========================================================================
-- This SQL script helps manage school end celebratory events and metrics.
-- Run these statements in your Supabase SQL Editor.
-- 
-- Since we use a highly flexible JSON-serialized structures inside the 'bio' 
-- field of the 'profiles' database table to store custom icons, configurations,
-- and scores, you DO NOT need to alter your database tables physically! 
-- 
-- However, if you prefer physical columns for better indexing or direct querying,
-- you can run the following ALTER script:

-- 1. Create columns to track user event milestones inside profiles table:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS event_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS event_score INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS event_icon_hidden BOOLEAN DEFAULT FALSE;

-- 2. Add an elegant helper index to query active participants with high scores:
CREATE INDEX IF NOT EXISTS idx_profiles_event_participation 
ON profiles (event_completed, event_score) 
WHERE event_completed = TRUE;

-- 3. Example query to retrieve users who earned the Graduation 🎓 badge:
-- SELECT id, username, display_name, event_score 
-- FROM profiles 
-- WHERE event_completed = TRUE AND event_icon_hidden = FALSE;
