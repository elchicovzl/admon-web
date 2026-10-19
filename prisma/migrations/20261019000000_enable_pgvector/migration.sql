-- Enables pgvector for the WhatsApp assistant knowledge base.
-- Requires a Postgres image that ships the extension (pgvector/pgvector:0.8.7-pg18-trixie).
CREATE EXTENSION IF NOT EXISTS vector;
