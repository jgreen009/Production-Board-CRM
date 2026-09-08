-- Fix for a warning the security advisor raised right after the customers
-- migration: pg_trgm was installed in the `public` schema (the default
-- when no schema is named), which the linter flags — extensions should
-- live in a dedicated schema, not alongside application tables. Moving it
-- drops and recreates the trigram indexes (CASCADE), schema-qualified this
-- time so they don't depend on `extensions` being on the search_path.

drop extension pg_trgm cascade;
create extension if not exists pg_trgm with schema extensions;

create index customers_name_trgm on customers using gin (name extensions.gin_trgm_ops);
create index customers_company_trgm on customers using gin (company extensions.gin_trgm_ops);
create index customers_email_trgm on customers using gin (email extensions.gin_trgm_ops);
create index customers_phone_trgm on customers using gin (phone extensions.gin_trgm_ops);
