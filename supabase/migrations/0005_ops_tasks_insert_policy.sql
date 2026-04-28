-- Permite que client_operator cree tareas solo en cuentas ML con acceso explícito.
create policy "operators insert own account tasks"
  on public.tasks for insert
  with check (
    public.get_user_role_v2() = 'client_operator'
    and exists (
      select 1
      from public.user_account_access uaa
      where uaa.user_id = auth.uid()
        and uaa.ml_account_id = tasks.ml_account_id
        and uaa.access_type = 'operator'
    )
  );

-- Permite registrar eventos de tarea para tareas que el operador puede ver.
create policy "operators insert task events"
  on public.task_events for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.tasks t
      where t.id = task_events.task_id
        and public.can_access_ml_account(t.ml_account_id)
    )
  );
