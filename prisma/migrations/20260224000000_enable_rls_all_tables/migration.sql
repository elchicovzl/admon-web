-- Enable Row Level Security on all public tables
-- This protects tables from PostgREST (anon/authenticated) access via Supabase API.
-- Prisma connects as postgres superuser and bypasses RLS automatically.
-- No permissive policies needed since this app uses server-side Prisma only.
-- RLS enabled with no policies = implicit "deny all" for PostgREST roles.

-- Auth & session tables (most sensitive)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Client management tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_additional_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_representatives ENABLE ROW LEVEL SECURITY;

-- Disability module tables
ALTER TABLE public.disabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disability_observations ENABLE ROW LEVEL SECURITY;

-- Affiliation module tables
ALTER TABLE public.affiliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliation_subprocesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliation_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliation_status_logs ENABLE ROW LEVEL SECURITY;
