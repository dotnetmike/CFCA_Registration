-- Optional Love In Action t-shirt souvenir pre-orders (size + quantity lines)

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS souvenir_orders jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.registrations.souvenir_orders IS
  'Array of { size: S|M|L|XL|2XL, quantity: number } for Love In Action t-shirt pre-orders at $30 each';
