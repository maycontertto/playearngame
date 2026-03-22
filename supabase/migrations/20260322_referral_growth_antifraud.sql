alter table public.profiles add column if not exists risk_score integer not null default 0;
alter table public.profiles add column if not exists risk_level text not null default 'low';
alter table public.profiles add column if not exists withdrawal_blocked boolean not null default false;

alter table public.withdraw_requests add column if not exists risk_score integer not null default 0;
alter table public.withdraw_requests add column if not exists risk_level text not null default 'low';
alter table public.withdraw_requests add column if not exists fraud_hold boolean not null default false;

alter table public.revenue_events add column if not exists referral_level integer not null default 0;

create table if not exists public.user_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  device_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_activity_logs_user_created_at_idx
  on public.user_activity_logs (user_id, created_at desc);
create index if not exists user_activity_logs_device_idx
  on public.user_activity_logs (device_fingerprint, created_at desc);

alter table public.user_activity_logs enable row level security;

drop policy if exists user_activity_logs_select_self on public.user_activity_logs;
create policy user_activity_logs_select_self
on public.user_activity_logs
for select
using (auth.uid() = user_id);

revoke all on table public.user_activity_logs from anon, authenticated;
grant select on table public.user_activity_logs to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_risk_level_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_risk_level_check;
  end if;
end $$;

alter table public.profiles
  add constraint profiles_risk_level_check
  check (risk_level in ('low', 'medium', 'high'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'withdraw_requests_risk_level_check'
      and conrelid = 'public.withdraw_requests'::regclass
  ) then
    alter table public.withdraw_requests drop constraint withdraw_requests_risk_level_check;
  end if;
end $$;

alter table public.withdraw_requests
  add constraint withdraw_requests_risk_level_check
  check (risk_level in ('low', 'medium', 'high'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'revenue_events_referral_level_check'
      and conrelid = 'public.revenue_events'::regclass
  ) then
    alter table public.revenue_events drop constraint revenue_events_referral_level_check;
  end if;
end $$;

alter table public.revenue_events
  add constraint revenue_events_referral_level_check
  check (referral_level in (0, 1, 2));

create or replace function public.log_user_activity(
  p_event_type text,
  p_device_fingerprint text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_user_id uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  if p_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  insert into public.user_activity_logs (user_id, event_type, device_fingerprint, metadata)
  values (p_user_id, p_event_type, nullif(trim(coalesce(p_device_fingerprint, '')), ''), coalesce(p_metadata, '{}'::jsonb))
  returning id into v_log_id;

  return v_log_id;
end;
$$;

create or replace function public.evaluate_user_risk(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_device text;
  v_same_device_accounts integer := 0;
  v_recent_task_count integer := 0;
  v_has_early_withdrawal boolean := false;
  v_account_age_hours numeric := 0;
  v_score integer := 0;
  v_level text := 'low';
  v_blocked boolean := false;
  v_same_device_as_referrer boolean := false;
begin
  if p_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  perform public.ensure_profile_row(p_user_id);

  select * into v_profile
  from public.profiles
  where id = p_user_id;

  select device_fingerprint
  into v_device
  from public.user_activity_logs
  where user_id = p_user_id
    and device_fingerprint is not null
  order by created_at desc
  limit 1;

  if v_device is not null then
    select count(distinct user_id)
    into v_same_device_accounts
    from public.user_activity_logs
    where device_fingerprint = v_device
      and created_at >= timezone('utc', now()) - interval '90 days';
  end if;

  select count(*)
  into v_recent_task_count
  from public.user_activity_logs
  where user_id = p_user_id
    and event_type = 'task_completion'
    and created_at >= timezone('utc', now()) - interval '20 minutes';

  select exists (
    select 1
    from public.withdraw_requests
    where user_id = p_user_id
      and created_at <= (select created_at from public.profiles where id = p_user_id) + interval '24 hours'
  )
  into v_has_early_withdrawal;

  v_account_age_hours := greatest(extract(epoch from (timezone('utc', now()) - v_profile.created_at)) / 3600, 0);

  if v_same_device_accounts >= 3 then
    v_score := v_score + 55;
  elsif v_same_device_accounts = 2 then
    v_score := v_score + 25;
  end if;

  if v_profile.referred_by_code is not null and v_account_age_hours < 24 and v_profile.tasks_completed >= 3 then
    v_score := v_score + 20;
  end if;

  if v_recent_task_count >= 6 then
    v_score := v_score + 15;
  end if;

  if v_has_early_withdrawal then
    v_score := v_score + 35;
  end if;

  if v_device is not null and exists (
    select 1
    from public.profiles referrer
    join public.user_activity_logs activity on activity.user_id = referrer.id
    where referrer.referral_code = v_profile.referred_by_code
      and activity.device_fingerprint = v_device
  ) then
    v_same_device_as_referrer := true;
    v_score := v_score + 50;
  end if;

  if v_score >= 70 then
    v_level := 'high';
    v_blocked := true;
  elsif v_score >= 35 then
    v_level := 'medium';
    v_blocked := false;
  end if;

  perform set_config('app.bypass_financial_guard', 'on', true);

  update public.profiles
  set
    risk_score = v_score,
    risk_level = v_level,
    withdrawal_blocked = v_blocked
  where id = p_user_id;

  return jsonb_build_object(
    'risk_score', v_score,
    'risk_level', v_level,
    'withdrawal_blocked', v_blocked,
    'same_device_accounts', v_same_device_accounts,
    'same_device_as_referrer', v_same_device_as_referrer,
    'recent_task_count', v_recent_task_count
  );
end;
$$;

create or replace function public.get_top_referrers(p_limit integer default 8)
returns table (
  user_id uuid,
  user_name text,
  user_avatar text,
  referral_count integer,
  total_referral_earnings_cents integer,
  available_referral_earnings_cents integer,
  risk_level text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    coalesce(p.display_name, 'Jogador') as user_name,
    coalesce(p.avatar, '🎮') as user_avatar,
    coalesce(p.referral_count, 0) as referral_count,
    coalesce(p.referral_earnings_cents, 0) as total_referral_earnings_cents,
    coalesce(p.available_referral_earnings_cents, 0) as available_referral_earnings_cents,
    p.risk_level
  from public.profiles p
  where coalesce(p.referral_count, 0) > 0 or coalesce(p.referral_earnings_cents, 0) > 0
  order by coalesce(p.referral_earnings_cents, 0) desc, coalesce(p.referral_count, 0) desc, p.created_at asc
  limit greatest(coalesce(p_limit, 8), 1);
$$;

create or replace function public.apply_referral_code(
  p_referral_code text,
  p_device_fingerprint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_profile public.profiles;
  v_referrer_profile public.profiles;
  v_code text := upper(trim(coalesce(p_referral_code, '')));
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if v_code = '' then
    raise exception 'Informe um código de indicação válido.';
  end if;

  perform public.ensure_profile_row(v_user_id);
  perform public.log_user_activity('referral_apply_attempt', p_device_fingerprint, jsonb_build_object('referral_code', v_code), v_user_id);

  select * into v_current_profile
  from public.profiles
  where id = v_user_id
  for update;

  if v_current_profile.referred_by_user_id is not null then
    raise exception 'Sua conta já está vinculada a um indicador.';
  end if;

  if v_current_profile.tasks_completed > 0 or v_current_profile.games_played > 0 or v_current_profile.qualified_revenue_cents > 0 then
    raise exception 'O código de indicação só pode ser aplicado antes de começar a produzir no app.';
  end if;

  if v_current_profile.referral_code = v_code then
    raise exception 'Você não pode usar o próprio código de indicação.';
  end if;

  select * into v_referrer_profile
  from public.profiles
  where referral_code = v_code
  limit 1;

  if not found then
    raise exception 'Código de indicação não encontrado.';
  end if;

  if nullif(trim(coalesce(p_device_fingerprint, '')), '') is not null and exists (
    select 1
    from public.user_activity_logs activity
    where activity.user_id = v_referrer_profile.id
      and activity.device_fingerprint = nullif(trim(coalesce(p_device_fingerprint, '')), '')
  ) then
    raise exception 'Esse dispositivo já foi usado pelo indicador. Vinculação bloqueada por segurança.';
  end if;

  perform set_config('app.bypass_financial_guard', 'on', true);

  update public.profiles
  set
    referred_by_user_id = v_referrer_profile.id,
    referred_by_code = v_referrer_profile.referral_code
  where id = v_user_id;

  perform public.log_user_activity('referral_applied', p_device_fingerprint, jsonb_build_object('referrer_user_id', v_referrer_profile.id), v_user_id);
  perform public.sync_financial_snapshot(v_referrer_profile.id);
  perform public.sync_financial_snapshot(v_user_id);
  perform public.evaluate_user_risk(v_user_id);

  return jsonb_build_object(
    'message', format('Código %s aplicado com sucesso. Seu indicador recebe 3%% e o indicador dele recebe 1%%, sempre financiados pela margem do site.', v_referrer_profile.referral_code),
    'referrerUserId', v_referrer_profile.id,
    'referrerCode', v_referrer_profile.referral_code
  );
end;
$$;

create or replace function public.complete_task_secure(
  p_task_id text,
  p_device_fingerprint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.task_catalog;
  v_completion public.task_completions;
  v_profile public.profiles;
  v_revenue_event public.revenue_events;
  v_direct_referral_event public.revenue_events;
  v_indirect_referral_event public.revenue_events;
  v_direct_referrer_id uuid;
  v_indirect_referrer_id uuid;
  v_user_share integer := 0;
  v_direct_referral_share integer := 0;
  v_indirect_referral_share integer := 0;
  v_site_share integer := 0;
  v_operator_share integer := 0;
  v_reserve_share integer := 0;
  v_device text := nullif(trim(coalesce(p_device_fingerprint, '')), '');
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select * into v_task
  from public.task_catalog
  where id = p_task_id
    and is_active = true;

  if not found then
    raise exception 'Tarefa inválida ou inativa.';
  end if;

  perform public.ensure_profile_row(v_user_id);
  perform public.settle_pending_revenue(v_user_id);

  select referred_by_user_id
  into v_direct_referrer_id
  from public.profiles
  where id = v_user_id;

  if v_direct_referrer_id is not null then
    select referred_by_user_id
    into v_indirect_referrer_id
    from public.profiles
    where id = v_direct_referrer_id;
  end if;

  insert into public.task_completions (
    user_id,
    task_id,
    task_type,
    title,
    estimated_revenue_cents,
    earned_points
  )
  values (
    v_user_id,
    v_task.id,
    v_task.type,
    v_task.title,
    v_task.estimated_revenue_cents,
    v_task.points
  )
  on conflict (user_id, task_id, completed_on) do nothing
  returning * into v_completion;

  if v_completion.id is null then
    raise exception 'Essa tarefa já foi concluída hoje.';
  end if;

  v_user_share := round(v_task.estimated_revenue_cents * 0.80);

  if v_direct_referrer_id is not null and v_task.estimated_revenue_cents > 0 and not exists (
    select 1
    from public.user_activity_logs activity
    where activity.user_id = v_direct_referrer_id
      and activity.device_fingerprint = v_device
      and v_device is not null
  ) then
    v_direct_referral_share := round(v_task.estimated_revenue_cents * 0.03);
  end if;

  if v_indirect_referrer_id is not null and v_indirect_referrer_id <> v_direct_referrer_id and v_indirect_referrer_id <> v_user_id and v_task.estimated_revenue_cents > 0 and not exists (
    select 1
    from public.user_activity_logs activity
    where activity.user_id = v_indirect_referrer_id
      and activity.device_fingerprint = v_device
      and v_device is not null
  ) then
    v_indirect_referral_share := round(v_task.estimated_revenue_cents * 0.01);
  end if;

  v_site_share := greatest(v_task.estimated_revenue_cents - v_user_share - v_direct_referral_share - v_indirect_referral_share, 0);
  v_operator_share := round(v_site_share * 0.60);
  v_reserve_share := greatest(v_site_share - v_operator_share, 0);

  if v_task.estimated_revenue_cents > 0 then
    insert into public.revenue_events (
      user_id,
      event_kind,
      referral_level,
      origin_user_id,
      source_id,
      source_type,
      title,
      qualified_revenue_cents,
      user_share_cents,
      operator_share_cents,
      reserve_share_cents,
      status,
      available_at,
      payout_model_version
    )
    values (
      v_user_id,
      'task',
      0,
      null,
      v_task.id,
      v_task.type,
      v_task.title,
      v_task.estimated_revenue_cents,
      v_user_share,
      v_operator_share,
      v_reserve_share,
      'pending',
      timezone('utc', now()) + interval '7 days',
      'v4-80-3-1-antifraud'
    )
    returning * into v_revenue_event;
  end if;

  if v_direct_referral_share > 0 then
    insert into public.revenue_events (
      user_id,
      event_kind,
      referral_level,
      origin_user_id,
      source_id,
      source_type,
      title,
      qualified_revenue_cents,
      user_share_cents,
      operator_share_cents,
      reserve_share_cents,
      status,
      available_at,
      payout_model_version
    )
    values (
      v_direct_referrer_id,
      'referral',
      1,
      v_user_id,
      v_task.id,
      v_task.type,
      'Comissão de indicação direta',
      0,
      v_direct_referral_share,
      0,
      0,
      'pending',
      timezone('utc', now()) + interval '7 days',
      'v4-80-3-1-antifraud'
    )
    returning * into v_direct_referral_event;

    perform public.sync_financial_snapshot(v_direct_referrer_id);
    perform public.evaluate_user_risk(v_direct_referrer_id);
  end if;

  if v_indirect_referral_share > 0 then
    insert into public.revenue_events (
      user_id,
      event_kind,
      referral_level,
      origin_user_id,
      source_id,
      source_type,
      title,
      qualified_revenue_cents,
      user_share_cents,
      operator_share_cents,
      reserve_share_cents,
      status,
      available_at,
      payout_model_version
    )
    values (
      v_indirect_referrer_id,
      'referral',
      2,
      v_user_id,
      v_task.id,
      v_task.type,
      'Comissão de indicação indireta',
      0,
      v_indirect_referral_share,
      0,
      0,
      'pending',
      timezone('utc', now()) + interval '7 days',
      'v4-80-3-1-antifraud'
    )
    returning * into v_indirect_referral_event;

    perform public.sync_financial_snapshot(v_indirect_referrer_id);
    perform public.evaluate_user_risk(v_indirect_referrer_id);
  end if;

  update public.profiles
  set
    points = points + v_task.points,
    tasks_completed = tasks_completed + 1,
    daily_tasks_completed = daily_tasks_completed + 1,
    daily_ad_views = case when v_task.type = 'ad' then daily_ad_views + 1 else daily_ad_views end
  where id = v_user_id;

  perform public.log_user_activity('task_completion', p_device_fingerprint, jsonb_build_object('task_id', v_task.id, 'estimated_revenue_cents', v_task.estimated_revenue_cents), v_user_id);
  perform public.evaluate_user_risk(v_user_id);

  select * into v_profile
  from public.sync_financial_snapshot(v_user_id);

  return jsonb_build_object(
    'message', 'Tarefa registrada com segurança.',
    'taskId', v_task.id,
    'earnedPoints', v_task.points,
    'pendingCashPoints', v_user_share,
    'directReferralCashPoints', v_direct_referral_share,
    'indirectReferralCashPoints', v_indirect_referral_share,
    'profile', to_jsonb(v_profile),
    'revenueEvent', case when v_revenue_event.id is not null then to_jsonb(v_revenue_event) else null end,
    'directReferralEvent', case when v_direct_referral_event.id is not null then to_jsonb(v_direct_referral_event) else null end,
    'indirectReferralEvent', case when v_indirect_referral_event.id is not null then to_jsonb(v_indirect_referral_event) else null end
  );
end;
$$;

drop function if exists public.get_admin_withdrawal_queue();

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
  locked_events_count integer,
  risk_score integer,
  risk_level text,
  fraud_hold boolean
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
    coalesce(wr.admin_note, case when wr.fraud_hold then 'Conta marcada automaticamente para revisão antifraude.' else null end) as admin_note,
    coalesce(sum(case when re.status = 'locked' and re.withdraw_request_id = wr.id then re.user_share_cents else 0 end), 0)::integer as locked_revenue_points,
    coalesce(sum(case when re.status = 'locked' and re.withdraw_request_id = wr.id then 1 else 0 end), 0)::integer as locked_events_count,
    wr.risk_score,
    wr.risk_level,
    wr.fraud_hold
  from public.withdraw_requests wr
  left join public.profiles p on p.id = wr.user_id
  left join public.revenue_events re on re.withdraw_request_id = wr.id
  where public.is_admin(auth.uid())
  group by wr.id, wr.user_id, p.display_name, p.avatar, wr.pix_key, wr.amount_brl, wr.points_used, wr.status, wr.created_at, wr.processed_at, wr.admin_note, wr.risk_score, wr.risk_level, wr.fraud_hold
  order by
    case wr.status
      when 'pending' then 1
      when 'approved' then 2
      when 'paid' then 3
      when 'rejected' then 4
      else 5
    end,
    wr.fraud_hold desc,
    wr.created_at desc;
$$;

create or replace function public.request_withdrawal_secure(
  p_pix_key text,
  p_device_fingerprint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_request public.withdraw_requests;
  v_risk jsonb;
  v_pix_key text := btrim(coalesce(p_pix_key, ''));
  v_pending_count integer := 0;
  v_today_count integer := 0;
  v_points integer := 0;
  v_amount numeric(12,2) := 0;
  v_risk_score integer := 0;
  v_risk_level text := 'low';
  v_fraud_hold boolean := false;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not public.is_valid_pix_key(v_pix_key) then
    raise exception 'Use uma chave Pix válida: e-mail, celular, CPF, CNPJ ou chave aleatória.';
  end if;

  perform public.ensure_profile_row(v_user_id);
  perform public.settle_pending_revenue(v_user_id);
  perform public.log_user_activity('withdraw_request_attempt', p_device_fingerprint, jsonb_build_object('pix_key_masked', left(v_pix_key, 4)), v_user_id);

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

  v_risk := public.evaluate_user_risk(v_user_id);
  v_risk_score := coalesce((v_risk ->> 'risk_score')::integer, 0);
  v_risk_level := coalesce(v_risk ->> 'risk_level', 'low');
  v_fraud_hold := coalesce((v_risk ->> 'withdrawal_blocked')::boolean, false);

  v_points := v_profile.withdrawable_points;
  v_amount := round(v_points::numeric / 100, 2);

  insert into public.withdraw_requests (
    user_id,
    pix_key,
    points_used,
    amount_brl,
    status,
    admin_note,
    risk_score,
    risk_level,
    fraud_hold
  )
  values (
    v_user_id,
    v_pix_key,
    v_points,
    v_amount,
    'pending',
    case when v_fraud_hold then 'Conta marcada automaticamente para revisão antifraude.' else null end,
    v_risk_score,
    v_risk_level,
    v_fraud_hold
  )
  returning * into v_request;

  update public.revenue_events
  set
    status = 'locked',
    withdraw_request_id = v_request.id
  where user_id = v_user_id
    and status = 'available';

  perform public.log_user_activity('withdraw_request_created', p_device_fingerprint, jsonb_build_object('request_id', v_request.id, 'fraud_hold', v_fraud_hold), v_user_id);
  perform public.sync_financial_snapshot(v_user_id);

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    v_user_id,
    'request_withdrawal',
    'withdraw_requests',
    v_request.id::text,
    jsonb_build_object('amount_brl', v_request.amount_brl, 'points_used', v_request.points_used, 'risk_level', v_risk_level, 'fraud_hold', v_fraud_hold)
  );

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  return jsonb_build_object(
    'message', case when v_fraud_hold then format('Solicitação enviada para revisão reforçada. Risco %s detectado.', v_risk_level) else format('Solicitação de saque de R$ %s enviada para análise.', to_char(v_amount, 'FM999999990.00')) end,
    'withdrawRequestId', v_request.id,
    'amount', v_request.amount_brl,
    'pointsUsed', v_request.points_used,
    'riskLevel', v_risk_level,
    'fraudHold', v_fraud_hold,
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
  v_admin_note text := nullif(trim(coalesce(p_admin_note, '')), '');
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

  if v_request.fraud_hold and v_action = 'pay' and v_admin_note is null then
    raise exception 'Para pagar um saque em risco alto, informe uma justificativa administrativa.';
  end if;

  if v_action = 'approve' then
    if v_request.status <> 'pending' then
      raise exception 'Só saques pendentes podem ser aprovados.';
    end if;

    update public.withdraw_requests
    set
      status = 'approved',
      admin_note = v_admin_note,
      processed_at = timezone('utc', now())
    where id = p_request_id;
  elsif v_action = 'pay' then
    if v_request.status not in ('pending', 'approved') then
      raise exception 'Só saques pendentes ou aprovados podem ser pagos.';
    end if;

    update public.withdraw_requests
    set
      status = 'paid',
      admin_note = v_admin_note,
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
      admin_note = v_admin_note,
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
  perform public.evaluate_user_risk(v_request.user_id);

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
      'admin_note', v_admin_note,
      'user_id', v_request.user_id,
      'status_before', v_request.status,
      'status_after', (select status from public.withdraw_requests where id = p_request_id),
      'risk_level', v_request.risk_level,
      'fraud_hold', v_request.fraud_hold,
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

grant execute on function public.log_user_activity(text, text, jsonb, uuid) to authenticated;
grant execute on function public.evaluate_user_risk(uuid) to authenticated;
grant execute on function public.get_top_referrers(integer) to authenticated;
grant execute on function public.apply_referral_code(text, text) to authenticated;
grant execute on function public.complete_task_secure(text, text) to authenticated;
grant execute on function public.get_admin_withdrawal_queue() to authenticated;
grant execute on function public.request_withdrawal_secure(text, text) to authenticated;
grant execute on function public.review_withdrawal_request(uuid, text, text) to authenticated;
