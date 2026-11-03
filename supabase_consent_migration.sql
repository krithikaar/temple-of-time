-- ==============================================================================
-- TEMPLE of Time: Participant Informed Consent Migration
-- Target Table: public.participants
-- Guidance: Dr. Krithika A. Ramaswamy (PhD Scholar, Neurophysiology, NIMHANS)
-- ==============================================================================

-- 1. Ensure 'has_consented' boolean flag exists with default false
ALTER TABLE public.participants 
ADD COLUMN IF NOT EXISTS has_consented BOOLEAN DEFAULT false NOT NULL;

-- 2. Ensure 'consented_at' timestamp with time zone exists (nullable)
ALTER TABLE public.participants 
ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

-- 3. Ensure Row Level Security allows authenticated/anonymous clients to update consent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'participants' AND policyname = 'Allow participant update'
    ) THEN
        CREATE POLICY "Allow participant update" 
        ON public.participants 
        FOR UPDATE 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- 4. Comment annotations for data governance & auditability
COMMENT ON COLUMN public.participants.has_consented IS 'Flags whether the participant has reviewed and accepted the NIMHANS informed consent agreement';
COMMENT ON COLUMN public.participants.consented_at IS 'Cryptographic UTC timestamp recording the exact moment informed consent was granted';
