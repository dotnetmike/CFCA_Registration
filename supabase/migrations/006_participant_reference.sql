-- Unique participant payment reference: {STATE}_{SURNAME}_{3-digit counter}

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS participant_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_participant_reference
  ON public.registrations (participant_reference)
  WHERE participant_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_participant_reference(
  p_state public.australian_state,
  p_surname text
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_surname text;
  prefix text;
  next_num integer;
  candidate text;
BEGIN
  normalized_surname := upper(regexp_replace(trim(p_surname), '[^A-Za-z]', '', 'g'));
  IF normalized_surname = '' THEN
    normalized_surname := 'UNKNOWN';
  END IF;

  prefix := p_state::text || '_' || normalized_surname || '_';

  SELECT COALESCE(MAX(
    substring(participant_reference from length(prefix) + 1)::integer
  ), 0) + 1
  INTO next_num
  FROM public.registrations
  WHERE participant_reference LIKE prefix || '%'
    AND length(participant_reference) = length(prefix) + 3
    AND substring(participant_reference from length(prefix) + 1) ~ '^[0-9]{3}$';

  LOOP
    candidate := prefix || lpad(next_num::text, 3, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.registrations WHERE participant_reference = candidate
    );
    next_num := next_num + 1;
  END LOOP;

  RETURN candidate;
END;
$$;
