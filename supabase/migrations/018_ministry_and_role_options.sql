-- Add the current ministry and ministry role values.

ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'household_leader';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'hold';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'sold';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'family_ministry_area_leader';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'family_ministry_coordinator';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'cluster_leader';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'sector_leader_national_coordinator';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'lia_area_coordinator';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'pcs_area_coordinator';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'comms_area_coordinator';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'national_director';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'national_council_member';