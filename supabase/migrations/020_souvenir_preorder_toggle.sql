-- Admin toggle for the public "Souvenir pre-order" form section (default off)
ALTER TABLE public.runtime_registration_settings
  ADD COLUMN IF NOT EXISTS souvenir_preorder_enabled boolean NOT NULL DEFAULT false;
