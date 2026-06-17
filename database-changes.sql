-- SQL Script for following/followers system and user interests configuration.
-- Execute this on your Supabase Database SQL Editor.

-- 1. Create columns for interests array on profiles if not already present
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';

-- 2. Create follows relationships table
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- 3. Security policies for follows table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'follows' AND policyname = 'Allow read access to follows for authenticated users'
    ) THEN
        CREATE POLICY "Allow read access to follows for authenticated users"
        ON follows FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'follows' AND policyname = 'Allow insert of follow to users themselves'
    ) THEN
        CREATE POLICY "Allow insert of follow to users themselves"
        ON follows FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = follower_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'follows' AND policyname = 'Allow delete of follow to users themselves'
    ) THEN
        CREATE POLICY "Allow delete of follow to users themselves"
        ON follows FOR DELETE
        TO authenticated
        USING (auth.uid() = follower_id);
    END IF;
END
$$;
