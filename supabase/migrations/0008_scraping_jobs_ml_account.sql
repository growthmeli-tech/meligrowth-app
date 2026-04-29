-- scraping_jobs: permitir jobs asociados a ml_accounts (v2) sin fila legacy en clients.
-- Antes: client_id FK obligatoria a clients → el pipeline pasaba company_id y rompía FK o no insertaba.

alter table public.scraping_jobs
  alter column client_id drop not null;

alter table public.scraping_jobs
  add column if not exists ml_account_id uuid references public.ml_accounts(id) on delete set null;

create index if not exists idx_scraping_jobs_ml_account
  on public.scraping_jobs (ml_account_id, tipo, created_at desc);

alter table public.scraping_jobs
  add constraint scraping_jobs_client_or_ml_account_chk
  check (client_id is not null or ml_account_id is not null);
