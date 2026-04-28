create policy "operators update own account tasks"
on public.tasks
for update
to authenticated
using (
  exists (
    select 1 from public.user_account_access
    where user_id = auth.uid()
      and ml_account_id = tasks.ml_account_id
      and access_type = 'operator'
  )
);
