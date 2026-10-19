-- Ministry Roles "Area Coordinator" (reuses the original, previously unused value) and "Music Coordinator".

ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'area_coordinator';
ALTER TYPE public.cfca_position ADD VALUE IF NOT EXISTS 'music_coordinator';
