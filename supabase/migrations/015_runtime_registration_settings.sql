-- Runtime registration settings controlled from admin UI

CREATE TABLE IF NOT EXISTS public.runtime_registration_settings (
  id boolean PRIMARY KEY DEFAULT true,
  registration_open boolean NOT NULL DEFAULT true,
  early_bird_start date NOT NULL DEFAULT '2026-08-01',
  early_bird_end date NOT NULL DEFAULT '2027-02-28',
  adult_early_bird numeric(10,2) NOT NULL DEFAULT 220,
  adult_regular numeric(10,2) NOT NULL DEFAULT 240,
  age_12_plus numeric(10,2) NOT NULL DEFAULT 175,
  age_2_to_12 numeric(10,2) NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT runtime_registration_settings_singleton CHECK (id = true),
  CONSTRAINT runtime_registration_settings_early_bird_window CHECK (early_bird_start <= early_bird_end),
  CONSTRAINT runtime_registration_settings_non_negative CHECK (
    adult_early_bird >= 0 AND
    adult_regular >= 0 AND
    age_12_plus >= 0 AND
    age_2_to_12 >= 0
  )
);

INSERT INTO public.runtime_registration_settings (
  id,
  registration_open,
  early_bird_start,
  early_bird_end,
  adult_early_bird,
  adult_regular,
  age_12_plus,
  age_2_to_12
) VALUES (
  true,
  true,
  '2026-08-01',
  '2027-02-28',
  220,
  240,
  175,
  100
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.runtime_registration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runtime_registration_settings FORCE ROW LEVEL SECURITY;
