-- Prevent ML invite completion from granting account access across companies.
-- complete_ml_account_invite_connection previously attached any email-matching
-- user (including an existing client of another company) via user_account_access,
-- which is enough for can_access_ml_account() RLS.

create or replace function public.complete_ml_account_invite_connection(
  p_state uuid,
  p_invite_id uuid,
  p_user_id uuid,
  p_session_email text,
  p_seller_id text,
  p_account_name text,
  p_account_url text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state record;
  v_invite record;
  v_account record;
  v_user record;
begin
  select state, ml_account_id, invite_id, expires_at
    into v_state
  from public.ml_oauth_states
  where state = p_state
  for update;

  if not found then
    return 'invalid_state';
  end if;

  if v_state.expires_at < now() then
    delete from public.ml_oauth_states where state = p_state;
    return 'expired_state';
  end if;

  if v_state.invite_id is null or v_state.invite_id <> p_invite_id then
    delete from public.ml_oauth_states where state = p_state;
    return 'invalid_invite';
  end if;

  select id, ml_account_id, client_email, status, expires_at
    into v_invite
  from public.ml_account_invites
  where id = p_invite_id
  for update;

  if not found then
    delete from public.ml_oauth_states where state = p_state;
    return 'invalid_invite';
  end if;

  if v_invite.status <> 'pending' then
    delete from public.ml_oauth_states where state = p_state;
    return 'invalid_invite';
  end if;

  if v_invite.expires_at < now() then
    update public.ml_account_invites
      set status = 'expired'
    where id = p_invite_id
      and status = 'pending';
    delete from public.ml_oauth_states where state = p_state;
    return 'expired_invite';
  end if;

  if v_invite.ml_account_id <> v_state.ml_account_id then
    delete from public.ml_oauth_states where state = p_state;
    return 'invalid_invite';
  end if;

  if lower(trim(coalesce(p_session_email, ''))) <> lower(trim(v_invite.client_email)) then
    delete from public.ml_oauth_states where state = p_state;
    return 'invite_email_mismatch';
  end if;

  select id, company_id, seller_id
    into v_account
  from public.ml_accounts
  where id = v_state.ml_account_id
  for update;

  if not found then
    delete from public.ml_oauth_states where state = p_state;
    return 'invalid_ml_account';
  end if;

  select id, company_id
    into v_user
  from public.users_v2
  where id = p_user_id
  for update;

  if not found then
    delete from public.ml_oauth_states where state = p_state;
    return 'invalid_user';
  end if;

  if v_user.company_id is not null and v_user.company_id <> v_account.company_id then
    delete from public.ml_oauth_states where state = p_state;
    return 'invite_company_mismatch';
  end if;

  if v_account.seller_id is not null and v_account.seller_id <> p_seller_id then
    delete from public.ml_oauth_states where state = p_state;
    return 'invalid_ml_account';
  end if;

  if exists (
    select 1
    from public.ml_accounts
    where company_id = v_account.company_id
      and seller_id = p_seller_id
      and id <> v_account.id
  ) then
    delete from public.ml_oauth_states where state = p_state;
    return 'duplicate_seller';
  end if;

  update public.ml_accounts
    set seller_id = p_seller_id,
        account_name = p_account_name,
        meli_account_url = p_account_url,
        active = true
  where id = v_account.id;

  update public.ml_account_invites
    set status = 'connected',
        used_at = now()
  where id = p_invite_id;

  insert into public.user_account_access (
    user_id,
    ml_account_id,
    access_type,
    ops_access_enabled
  )
  values (
    p_user_id,
    v_account.id,
    'manager',
    false
  )
  on conflict (user_id, ml_account_id, access_type)
  do update set ops_access_enabled = excluded.ops_access_enabled;

  update public.users_v2
    set company_id = v_account.company_id
  where id = p_user_id
    and company_id is null;

  delete from public.ml_oauth_states where state = p_state;
  return 'ok';
exception
  when unique_violation then
    delete from public.ml_oauth_states where state = p_state;
    return 'duplicate_seller';
end;
$$;

comment on function public.complete_ml_account_invite_connection is
  'Atomically validates OAuth state and invite, enforces same-company tenant boundary, updates ml_accounts/access, and deletes state. Token storage is app-owned post-commit.';
