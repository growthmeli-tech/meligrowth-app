-- 0009: allow equipo interno Meli Growth to read/write company-scoped paths in bucket client-files
-- (first path segment = companies.id, not legacy clients.id)

create policy "internal team all client-files storage"
  on storage.objects
  for all
  using (bucket_id = 'client-files' and public.is_meli_growth_team())
  with check (bucket_id = 'client-files' and public.is_meli_growth_team());

comment on policy "internal team all client-files storage" on storage.objects is
  'Meli Growth interno: sube y lista archivos bajo {company_id}/ en client-files.';
