-- Add registration opening/closing dates and early bird limits to runtime_registration_settings
ALTER TABLE public.runtime_registration_settings
  ADD COLUMN IF NOT EXISTS registration_start_date date,
  ADD COLUMN IF NOT EXISTS registration_end_date date,
  ADD COLUMN IF NOT EXISTS early_bird_interstate_limit integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS early_bird_vic_limit integer NOT NULL DEFAULT 250;

-- Update claim_early_bird_slot function to check configured limits and dates
CREATE OR REPLACE FUNCTION public.claim_early_bird_slot(
  p_state public.australian_state,
  p_interstate_limit integer DEFAULT NULL,
  p_vic_limit integer DEFAULT NULL
)
RETURNS public.early_bird_slot
LANGUAGE plpgsql
AS $$
DECLARE
  v_settings public.runtime_registration_settings%ROWTYPE;
  v_interstate_limit integer;
  v_vic_limit integer;
  v_count integer;
BEGIN
  SELECT * INTO v_settings FROM public.runtime_registration_settings WHERE id = true;

  v_interstate_limit := COALESCE(p_interstate_limit, v_settings.early_bird_interstate_limit, 200);
  v_vic_limit := COALESCE(p_vic_limit, v_settings.early_bird_vic_limit, 250);

  IF v_settings.early_bird_start IS NOT NULL AND v_settings.early_bird_end IS NOT NULL THEN
    IF current_date < v_settings.early_bird_start OR current_date > v_settings.early_bird_end THEN
      RETURN 'none';
    END IF;
  END IF;

  IF p_state = 'VIC' THEN
    SELECT count(*) INTO v_count FROM public.registrations WHERE is_early_bird = true AND state = 'VIC';
    IF v_count < v_vic_limit THEN
      RETURN 'melbourne';
    END IF;
  ELSE
    SELECT count(*) INTO v_count FROM public.registrations WHERE is_early_bird = true AND state != 'VIC';
    IF v_count < v_interstate_limit THEN
      RETURN 'interstate';
    END IF;
  END IF;

  RETURN 'none';
END;
$$;
