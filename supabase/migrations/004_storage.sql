-- Storage bucket for bank statements (create via SQL if supported, otherwise manual in dashboard)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;
