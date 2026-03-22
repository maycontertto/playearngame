create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'finance', 'support')),
  label text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  target_table text not null,
  target_id text not null,
  payload jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_users enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists admin_users_select_self on public.admin_users;
create policy admin_users_select_self
on public.admin_users
for select
using (auth.uid() = user_id);

drop policy if exists admin_audit_logs_none on public.admin_audit_logs;
create policy admin_audit_logs_none
on public.admin_audit_logs
for select
using (false);

revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.admin_audit_logs from anon, authenticated;
grant select on table public.admin_users to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'revenue_events_status_check'
      and conrelid = 'public.revenue_events'::regclass
  ) then
    alter table public.revenue_events drop constraint revenue_events_status_check;
  end if;
end $$;

alter table public.revenue_events
  add constraint revenue_events_status_check
  check (status in ('pending', 'available', 'locked', 'withdrawn'));

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.get_my_admin_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'is_admin', exists(select 1 from public.admin_users where user_id = auth.uid()),
    'role', (select role from public.admin_users where user_id = auth.uid())
  );
$$;

create or replace function public.get_admin_withdrawal_queue()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  user_avatar text,
  pix_key text,
  amount_brl numeric,
  points_used integer,
  status text,
  created_at timestamptz,
  processed_at timestamptz,
  admin_note text,
  locked_revenue_points integer,
  locked_events_count integer
)
language sql
security definer
set search_path = public
as $$
  select
    wr.id,
    wr.user_id,
    coalesce(p.display_name, 'Jogador') as user_name,
    coalesce(p.avatar, '🎮') as user_avatar,
    wr.pix_key,
    wr.amount_brl,
    wr.points_used,
    wr.status,
    wr.created_at,
    wr.processed_at,
    wr.admin_note,
    coalesce(sum(case when re.status = 'locked' and re.withdraw_request_id = wr.id then re.user_share_cents else 0 end), 0)::integer as locked_revenue_points,
    coalesce(sum(case when re.status = 'locked' and re.withdraw_request_id = wr.id then 1 else 0 end), 0)::integer as locked_events_count
  from public.withdraw_requests wr
  left join public.profiles p on p.id = wr.user_id
  left join public.revenue_events re on re.withdraw_request_id = wr.id
  where public.is_admin(auth.uid())
  group by wr.id, wr.user_id, p.display_name, p.avatar, wr.pix_key, wr.amount_brl, wr.points_used, wr.status, wr.created_at, wr.processed_at, wr.admin_note
  order by
    case wr.status
      when 'pending' then 1
      when 'approved' then 2
      when 'paid' then 3
      when 'rejected' then 4
      else 5
    end,
    wr.created_at desc;
$$;

create or replace function public.request_withdrawal_secure(p_pix_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_request public.withdraw_requests;
  v_pix_key text := btrim(coalesce(p_pix_key, ''));
  v_pending_count integer := 0;
  v_today_count integer := 0;
  v_points integer := 0;
  v_amount numeric(12,2) := 0;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_valid_pix_key(v_pix_key) then
    raise exception 'Use uma chave Pix válida: e-mail, celular, CPF, CNPJ ou chave aleatória.';
  end if;

  perform public.ensure_profile_row(v_user_id);
  perform public.settle_pending_revenue(v_user_id);

  select * into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  select count(*) into v_pending_count
  from public.withdraw_requests
  where user_id = v_user_id
    and status in ('pending', 'approved');

  if v_pending_count >= 1 then
    raise exception 'Já existe um saque pendente ou aprovado aguardando pagamento.';
  end if;

  select count(*) into v_today_count
  from public.withdraw_requests
  where user_id = v_user_id
    and created_at::date = current_date;

  if v_today_count >= 1 then
    raise exception 'Limite diário de saque atingido.';
  end if;

  if v_profile.withdrawable_points < 1000 then
    raise exception 'O mínimo para saque é R$ 10,00.';
  end if;

  v_points := v_profile.withdrawable_points;
  v_amount := round(v_points::numeric / 100, 2);

  insert into public.withdraw_requests (
    user_id,
    pix_key,
    points_used,
    amount_brl,
    status
  )
  values (
    v_user_id,
    v_pix_key,
    v_points,
    v_amount,
    'pending'
  )
  returning * into v_request;

  update public.revenue_events
  set
    status = 'locked',
    withdraw_request_id = v_request.id
  where user_id = v_user_id
    and status = 'available';

  perform public.sync_financial_snapshot(v_user_id);

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    v_user_id,
    'request_withdrawal',
    'withdraw_requests',
    v_request.id::text,
    jsonb_build_object('amount_brl', v_request.amount_brl, 'points_used', v_request.points_used)
  );

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  return jsonb_build_object(
    'message', format('Solicitação de saque de R$ %s enviada para análise.', to_char(v_amount, 'FM999999990.00')),
    'withdrawRequestId', v_request.id,
    'amount', v_request.amount_brl,
    'pointsUsed', v_request.points_used,
    'profile', to_jsonb(v_profile)
  );
end;
$$;

create or replace function public.review_withdrawal_request(
  p_request_id uuid,
  p_action text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_request public.withdraw_requests;
  v_profile public.profiles;
  v_action text := lower(trim(coalesce(p_action, '')));
begin
  if v_admin_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_admin(v_admin_id) then
    raise exception 'Acesso negado ao painel administrativo.';
  end if;

  if v_action not in ('approve', 'pay', 'reject') then
    raise exception 'Ação inválida. Use approve, pay ou reject.';
  end if;

  select * into v_request
  from public.withdraw_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  if v_action = 'approve' then
    if v_request.status <> 'pending' then
      raise exception 'Só saques pendentes podem ser aprovados.';
    end if;

    update public.withdraw_requests
    set
      status = 'approved',
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      processed_at = timezone('utc', now())
    where id = p_request_id;
  elsif v_action = 'pay' then
    if v_request.status not in ('pending', 'approved') then
      raise exception 'Só saques pendentes ou aprovados podem ser pagos.';
    end if;

    update public.withdraw_requests
    set
      status = 'paid',
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      processed_at = timezone('utc', now())
    where id = p_request_id;

    update public.revenue_events
    set
      status = 'withdrawn',
      withdrawn_at = timezone('utc', now())
    where withdraw_request_id = p_request_id
      and status = 'locked';
  else
    if v_request.status not in ('pending', 'approved') then
      raise exception 'Só saques pendentes ou aprovados podem ser rejeitados.';
    end if;

    update public.withdraw_requests
    set
      status = 'rejected',
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      processed_at = timezone('utc', now())
    where id = p_request_id;

    update public.revenue_events
    set
      status = 'available',
      withdraw_request_id = null,
      withdrawn_at = null
    where withdraw_request_id = p_request_id
      and status = 'locked';
  end if;

  perform public.sync_financial_snapshot(v_request.user_id);

  select * into v_profile
  from public.profiles
  where id = v_request.user_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    v_admin_id,
    v_action,
    'withdraw_requests',
    p_request_id::text,
    jsonb_build_object(
      'admin_note', nullif(trim(coalesce(p_admin_note, '')), ''),
      'user_id', v_request.user_id,
      'status_before', v_request.status,
      'status_after', (select status from public.withdraw_requests where id = p_request_id),
      'profile_balance', v_profile.balance
    )
  );

  return jsonb_build_object(
    'message', case v_action
      when 'approve' then 'Saque aprovado com sucesso.'
      when 'pay' then 'Saque marcado como pago.'
      else 'Saque rejeitado e saldo devolvido ao usuário.'
    end,
    'requestId', p_request_id,
    'action', v_action,
    'profile', to_jsonb(v_profile)
  );
end;
$$;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.get_my_admin_status() to authenticated;
grant execute on function public.get_admin_withdrawal_queue() to authenticated;
grant execute on function public.review_withdrawal_request(uuid, text, text) to authenticated;
grant execute on function public.request_withdrawal_secure(text) to authenticated;
