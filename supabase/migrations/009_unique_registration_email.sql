-- Unique registrant email (case-insensitive, non-empty)

-- Resolve existing duplicates so the unique index can be created.
-- Keep the newest / submitted row; rename older duplicate emails.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(email)
      ORDER BY
        (submitted_at IS NOT NULL) DESC,
        updated_at DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM public.registrations
  WHERE email IS NOT NULL AND trim(email) <> ''
)
UPDATE public.registrations r
SET email = r.email || '+dup-' || left(r.id::text, 8),
    updated_at = now()
FROM ranked
WHERE r.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_email_unique
  ON public.registrations (lower(email))
  WHERE email IS NOT NULL AND trim(email) <> '';
