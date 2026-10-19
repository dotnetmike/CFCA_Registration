-- Rename Ministry Role values to match their labels. RENAME VALUE updates existing rows in place.

DO $$
DECLARE
  rename_pair text[];
BEGIN
  FOREACH rename_pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['sector_leader_national_coordinator', 'sector_leader'],
    ARRAY['lia_area_coordinator', 'lia_coordinator'],
    ARRAY['pcs_area_coordinator', 'pcs_coordinator'],
    ARRAY['comms_area_coordinator', 'comms_coordinator']
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'cfca_position' AND e.enumlabel = rename_pair[1]
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'cfca_position' AND e.enumlabel = rename_pair[2]
    ) THEN
      EXECUTE format('ALTER TYPE public.cfca_position RENAME VALUE %L TO %L', rename_pair[1], rename_pair[2]);
    END IF;
  END LOOP;
END $$;
