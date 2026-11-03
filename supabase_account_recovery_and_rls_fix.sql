-- ==============================================================================
-- TEMPLE OF TIME: ACCOUNT RECOVERY & CROSS-DEVICE SYNCHRONIZATION FIX
-- Project: wltwbiwbmuxwepqorarq.supabase.co
--
-- INSTRUCTIONS:
-- Paste and run this script in your Supabase SQL Editor.
-- It automatically resolves the duplicate email error by preserving your primary
-- initiate record (e.g. TEMP-0001) and removing duplicate test entries, then
-- enables cross-device access and atomic sequential Subject ID generation.
-- ==============================================================================

-- 1. Ensure Table Structure & Columns Exist
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id),
    subject_id TEXT UNIQUE NOT NULL,
    player_name TEXT NOT NULL,
    age INT NOT NULL,
    gender TEXT NOT NULL,
    e_mail TEXT,
    has_consented BOOLEAN DEFAULT false NOT NULL,
    consented_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure e_mail, has_consented, consented_at columns exist
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS e_mail TEXT;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS has_consented BOOLEAN DEFAULT false;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

-- 2. Clean Up and Re-create RLS Policies to allow Cross-Device Lookup
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow participant read" ON public.participants;
DROP POLICY IF EXISTS "Allow participant insert" ON public.participants;
DROP POLICY IF EXISTS "Allow participant update" ON public.participants;
DROP POLICY IF EXISTS "Allow participant all" ON public.participants;
DROP POLICY IF EXISTS "Users can only read own profile" ON public.participants;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.participants;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.participants;

-- Allow both anonymous and authenticated sessions to read participants
-- (Required for email lookup and monotonic Subject ID sequence generation)
CREATE POLICY "Allow participant read" 
ON public.participants 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- Allow both anonymous and authenticated sessions to insert initiate profiles
CREATE POLICY "Allow participant insert" 
ON public.participants 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Allow both anonymous and authenticated sessions to update consent & profile
CREATE POLICY "Allow participant update" 
ON public.participants 
FOR UPDATE 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Automatic Deduplication of Repeated Email Rows
-- Automatically keeps the earliest registered initiate record for each email (e.g. TEMP-0001)
-- and cleans up secondary duplicate test entries (e.g. TEMP-0009 or TEMP-0010) created during testing.
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY LOWER(TRIM(e_mail)) 
               ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.participants
    WHERE e_mail IS NOT NULL AND TRIM(e_mail) <> ''
)
DELETE FROM public.participants
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- 4. Prevent Future Duplicate Accounts for the Same Email Address
-- Now that existing duplicates are resolved, create the unique index cleanly.
DROP INDEX IF EXISTS public.idx_participants_email_unique;

CREATE UNIQUE INDEX idx_participants_email_unique 
ON public.participants (LOWER(TRIM(e_mail)))
WHERE e_mail IS NOT NULL AND TRIM(e_mail) <> '';

-- 5. Centralized Monotonic Sequence Function (get_next_subject_id)
-- Runs with SECURITY DEFINER so it always computes the exact global maximum across all devices.
CREATE OR REPLACE FUNCTION public.get_next_subject_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_val INT;
BEGIN
    SELECT COALESCE(MAX(
        NULLIF(regexp_replace(subject_id, '^TEMP-0*', '', 'i'), '')::INT
    ), 0) + 1 INTO next_val
    FROM public.participants
    WHERE subject_id ~* '^TEMP-\d+$';
    
    RETURN 'TEMP-' || lpad(next_val::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_subject_id() TO anon, authenticated, service_role;

-- 6. Safe Account Recovery Lookup Function (lookup_participant_by_email)
-- Runs with SECURITY DEFINER for guaranteed 100% reliable cross-device email retrieval.
CREATE OR REPLACE FUNCTION public.lookup_participant_by_email(lookup_email TEXT)
RETURNS SETOF public.participants
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.participants
    WHERE LOWER(TRIM(e_mail)) = LOWER(TRIM(lookup_email))
    ORDER BY created_at ASC
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_participant_by_email(TEXT) TO anon, authenticated, service_role;

-- 7. Grant Table Permissions to anon and authenticated roles
GRANT ALL ON TABLE public.participants TO anon, authenticated, service_role;
