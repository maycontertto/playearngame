create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar text default '🎮',
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  xp_to_next integer not null default 100 check (xp_to_next > 0),
  points integer not null default 0 check (points >= 0),
  withdrawable_points integer not null default 0 check (withdrawable_points >= 0),
  pending_withdrawable_points integer not null default 0 check (pending_withdrawable_points >= 0),
  total_withdrawn_points integer not null default 0 check (total_withdrawn_points >= 0),
  balance numeric(12,2) not null default 0,
  streak integer not null default 1 check (streak >= 0),
  tasks_completed integer not null default 0 check (tasks_completed >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  referral_code text,
  referral_count integer not null default 0 check (referral_count >= 0),
  daily_bonus_claimed boolean not null default false,
  daily_tasks_completed integer not null default 0 check (daily_tasks_completed >= 0),
  daily_ad_views integer not null default 0 check (daily_ad_views >= 0),
  daily_games_played integer not null default 0 check (daily_games_played >= 0),
  roulette_spins_left integer not null default 3 check (roulette_spins_left >= 0),
  qualified_revenue_cents integer not null default 0 check (qualified_revenue_cents >= 0),
  user_share_cents integer not null default 0 check (user_share_cents >= 0),
  operator_share_cents integer not null default 0 check (operator_share_cents >= 0),
  reserve_share_cents integer not null default 0 check (reserve_share_cents >= 0),
  last_login_date date not null default current_date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists withdrawable_points integer not null default 0;
alter table public.profiles add column if not exists pending_withdrawable_points integer not null default 0;
alter table public.profiles add column if not exists total_withdrawn_points integer not null default 0;
alter table public.profiles add column if not exists qualified_revenue_cents integer not null default 0;
alter table public.profiles add column if not exists user_share_cents integer not null default 0;
alter table public.profiles add column if not exists operator_share_cents integer not null default 0;
alter table public.profiles add column if not exists reserve_share_cents integer not null default 0;
alter table public.profiles add column if not exists balance numeric(12,2) not null default 0;

create table if not exists public.task_catalog (
  id text primary key,
  title text not null,
  description text not null,
  points integer not null check (points > 0),
  type text not null check (type in ('ad', 'link', 'interact', 'mission')),
  icon text not null,
  estimated_revenue_cents integer not null default 0 check (estimated_revenue_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null references public.task_catalog (id) on delete restrict,
  task_type text not null check (task_type in ('ad', 'link', 'interact', 'mission')),
  title text not null,
  estimated_revenue_cents integer not null default 0 check (estimated_revenue_cents >= 0),
  earned_points integer not null default 0 check (earned_points >= 0),
  completed_on date not null default current_date,
  completed_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists task_completions_user_task_day_key
  on public.task_completions (user_id, task_id, completed_on);
create index if not exists task_completions_user_completed_at_idx
  on public.task_completions (user_id, completed_at desc);

create table if not exists public.withdraw_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pix_key text not null,
  points_used integer not null check (points_used > 0),
  amount_brl numeric(12,2) not null check (amount_brl > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  admin_note text,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

create index if not exists withdraw_requests_user_created_at_idx
  on public.withdraw_requests (user_id, created_at desc);
create index if not exists withdraw_requests_status_idx
  on public.withdraw_requests (status);

create table if not exists public.revenue_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id text,
  source_type text not null check (source_type in ('ad', 'link', 'interact', 'mission')),
  title text not null,
  qualified_revenue_cents integer not null default 0 check (qualified_revenue_cents >= 0),
  user_share_cents integer not null default 0 check (user_share_cents >= 0),
  operator_share_cents integer not null default 0 check (operator_share_cents >= 0),
  reserve_share_cents integer not null default 0 check (reserve_share_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'available', 'withdrawn')),
  withdraw_request_id uuid references public.withdraw_requests (id) on delete set null,
  payout_model_version text not null default 'v2-80-20-settlement',
  created_at timestamptz not null default timezone('utc', now()),
  available_at timestamptz not null,
  withdrawn_at timestamptz
);

create index if not exists revenue_events_user_status_idx
  on public.revenue_events (user_id, status, available_at);
create index if not exists revenue_events_withdraw_request_idx
  on public.revenue_events (withdraw_request_id);

insert into public.task_catalog (id, title, description, points, type, icon, estimated_revenue_cents)
values
  ('1', 'Assistir anúncio qualificado', 'Vídeo curto com receita rastreada e payout variável.', 18, 'ad', '📺', 30),
  ('2', 'Visitar página do parceiro', 'Acesse a landing page do parceiro e mantenha engajamento real.', 10, 'link', '🔗', 16),
  ('3', 'Assistir anúncio premium', 'Formato com remuneração maior para inventário premium.', 24, 'ad', '🎬', 40),
  ('4', 'Interagir com conteúdo', 'Concluir a missão do patrocinador com permanência mínima.', 20, 'interact', '💬', 32),
  ('5', 'Clicar no link validado', 'Clique com verificação básica anti-fraude e permanência.', 8, 'link', '👆', 12),
  ('6', 'Missão patrocinada', 'Tutorial ou fluxo patrocinado com maior valor por conclusão.', 30, 'ad', '📖', 50)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  points = excluded.points,
  type = excluded.type,
  icon = excluded.icon,
  estimated_revenue_cents = excluded.estimated_revenue_cents,
  is_active = true,
  updated_at = timezone('utc', now());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.generate_referral_code()
returns text
language sql
as $$
  select 'TASK' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

create or replace function public.guard_profile_financial_fields()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.bypass_financial_guard', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.withdrawable_points = 0;
    new.pending_withdrawable_points = 0;
    new.total_withdrawn_points = 0;
    new.balance = 0;
    new.qualified_revenue_cents = 0;
    new.user_share_cents = 0;
    new.operator_share_cents = 0;
    new.reserve_share_cents = 0;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.withdrawable_points is distinct from old.withdrawable_points
      or new.pending_withdrawable_points is distinct from old.pending_withdrawable_points
      or new.total_withdrawn_points is distinct from old.total_withdrawn_points
      or new.balance is distinct from old.balance
      or new.qualified_revenue_cents is distinct from old.qualified_revenue_cents
      or new.user_share_cents is distinct from old.user_share_cents
      or new.operator_share_cents is distinct from old.operator_share_cents
      or new.reserve_share_cents is distinct from old.reserve_share_cents then
      raise exception 'Campos financeiros são gerenciados apenas pelo backend seguro do Supabase.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.is_valid_pix_key(p_pix_key text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_key text := btrim(coalesce(p_pix_key, ''));
  v_digits text := regexp_replace(v_key, '\D', '', 'g');
begin
  if v_key = '' then
    return false;
  end if;

  return v_key ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    or v_digits ~ '^\d{10,13}$'
    or v_digits ~ '^\d{11}$'
    or v_digits ~ '^\d{14}$'
    or v_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
end;
$$;

create or replace function public.ensure_profile_row(p_user_id uuid default auth.uid())
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if p_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  perform set_config('app.bypass_financial_guard', 'on', true);

  insert into public.profiles (id, display_name, avatar, referral_code)
  values (p_user_id, 'Jogador', '🎮', public.generate_referral_code())
  on conflict (id) do nothing;

  select * into v_profile
  from public.profiles
  where id = p_user_id;

  return v_profile;
end;
$$;

create or replace function public.sync_financial_snapshot(p_user_id uuid default auth.uid())
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_available integer := 0;
  v_pending integer := 0;
  v_withdrawn integer := 0;
  v_qualified integer := 0;
  v_user integer := 0;
  v_operator integer := 0;
  v_reserve integer := 0;
begin
  if p_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  perform public.ensure_profile_row(p_user_id);

  select
    coalesce(sum(case when status = 'available' then user_share_cents else 0 end), 0),
    coalesce(sum(case when status = 'pending' then user_share_cents else 0 end), 0),
    coalesce(sum(case when status = 'withdrawn' then user_share_cents else 0 end), 0),
    coalesce(sum(qualified_revenue_cents), 0),
    coalesce(sum(user_share_cents), 0),
    coalesce(sum(operator_share_cents), 0),
    coalesce(sum(reserve_share_cents), 0)
  into
    v_available,
    v_pending,
    v_withdrawn,
    v_qualified,
    v_user,
    v_operator,
    v_reserve
  from public.revenue_events
  where user_id = p_user_id;

  perform set_config('app.bypass_financial_guard', 'on', true);

  update public.profiles
  set
    withdrawable_points = v_available,
    pending_withdrawable_points = v_pending,
    total_withdrawn_points = v_withdrawn,
    balance = round(v_available::numeric / 100, 2),
    qualified_revenue_cents = v_qualified,
    user_share_cents = v_user,
    operator_share_cents = v_operator,
    reserve_share_cents = v_reserve
  where id = p_user_id;

  select * into v_profile
  from public.profiles
  where id = p_user_id;

  return v_profile;
end;
$$;

create or replace function public.settle_pending_revenue(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if p_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  perform public.ensure_profile_row(p_user_id);

  update public.revenue_events
  set status = 'available'
  where user_id = p_user_id
    and status = 'pending'
    and available_at <= timezone('utc', now());

  select * into v_profile
  from public.sync_financial_snapshot(p_user_id);

  return jsonb_build_object(
    'withdrawablePoints', v_profile.withdrawable_points,
    'pendingWithdrawablePoints', v_profile.pending_withdrawable_points,
    'totalWithdrawnPoints', v_profile.total_withdrawn_points,
    'balance', v_profile.balance
  );
end;
$$;

create or replace function public.complete_task_secure(p_task_id text)
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
  v_user_share integer := 0;
  v_site_share integer := 0;
  v_operator_share integer := 0;
  v_reserve_share integer := 0;
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
  v_site_share := greatest(v_task.estimated_revenue_cents - v_user_share, 0);
  v_operator_share := round(v_site_share * 0.60);
  v_reserve_share := greatest(v_site_share - v_operator_share, 0);

  if v_task.estimated_revenue_cents > 0 then
    insert into public.revenue_events (
      user_id,
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
      v_task.id,
      v_task.type,
      v_task.title,
      v_task.estimated_revenue_cents,
      v_user_share,
      v_operator_share,
      v_reserve_share,
      'pending',
      timezone('utc', now()) + interval '7 days',
      'v2-80-20-settlement'
    )
    returning * into v_revenue_event;
  end if;

  update public.profiles
  set
    points = points + v_task.points,
    tasks_completed = tasks_completed + 1,
    daily_tasks_completed = daily_tasks_completed + 1,
    daily_ad_views = case when v_task.type = 'ad' then daily_ad_views + 1 else daily_ad_views end
  where id = v_user_id;

  select * into v_profile
  from public.sync_financial_snapshot(v_user_id);

  return jsonb_build_object(
    'message', 'Tarefa registrada com segurança.',
    'taskId', v_task.id,
    'earnedPoints', v_task.points,
    'pendingCashPoints', v_user_share,
    'profile', to_jsonb(v_profile),
    'revenueEvent', case when v_revenue_event.id is not null then to_jsonb(v_revenue_event) else null end
  );
end;
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
    and status = 'pending';

  if v_pending_count >= 1 then
    raise exception 'Já existe um saque pendente para este usuário.';
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
    status = 'withdrawn',
    withdrawn_at = timezone('utc', now()),
    withdraw_request_id = v_request.id
  where user_id = v_user_id
    and status = 'available';

  select * into v_profile
  from public.sync_financial_snapshot(v_user_id);

  return jsonb_build_object(
    'message', format('Solicitação de saque de R$ %s enviada para análise.', to_char(v_amount, 'FM999999990.00')),
    'withdrawRequestId', v_request.id,
    'amount', v_request.amount_brl,
    'pointsUsed', v_request.points_used,
    'profile', to_jsonb(v_profile)
  );
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists task_catalog_set_updated_at on public.task_catalog;
create trigger task_catalog_set_updated_at
before update on public.task_catalog
for each row
execute function public.set_updated_at();

drop trigger if exists profiles_guard_financial_fields on public.profiles;
create trigger profiles_guard_financial_fields
before insert or update on public.profiles
for each row
execute function public.guard_profile_financial_fields();

alter table public.profiles enable row level security;
alter table public.task_catalog enable row level security;
alter table public.task_completions enable row level security;
alter table public.revenue_events enable row level security;
alter table public.withdraw_requests enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists task_catalog_read_all on public.task_catalog;
create policy task_catalog_read_all
on public.task_catalog
for select
using (true);

drop policy if exists task_completions_select_own on public.task_completions;
create policy task_completions_select_own
on public.task_completions
for select
using (auth.uid() = user_id);

drop policy if exists revenue_events_select_own on public.revenue_events;
create policy revenue_events_select_own
on public.revenue_events
for select
using (auth.uid() = user_id);

drop policy if exists withdraw_requests_select_own on public.withdraw_requests;
create policy withdraw_requests_select_own
on public.withdraw_requests
for select
using (auth.uid() = user_id);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.task_catalog from anon, authenticated;
revoke all on table public.task_completions from anon, authenticated;
revoke all on table public.revenue_events from anon, authenticated;
revoke all on table public.withdraw_requests from anon, authenticated;

grant select on table public.profiles to authenticated;
grant insert on table public.profiles to authenticated;
grant update (
  display_name,
  avatar,
  level,
  xp,
  xp_to_next,
  points,
  streak,
  tasks_completed,
  games_played,
  referral_code,
  referral_count,
  daily_bonus_claimed,
  daily_tasks_completed,
  daily_ad_views,
  daily_games_played,
  roulette_spins_left,
  last_login_date
) on public.profiles to authenticated;

grant select on table public.task_catalog to anon, authenticated;
grant select on table public.task_completions to authenticated;
grant select on table public.revenue_events to authenticated;
grant select on table public.withdraw_requests to authenticated;

grant execute on function public.ensure_profile_row(uuid) to authenticated;
grant execute on function public.sync_financial_snapshot(uuid) to authenticated;
grant execute on function public.settle_pending_revenue(uuid) to authenticated;
grant execute on function public.complete_task_secure(text) to authenticated;
grant execute on function public.request_withdrawal_secure(text) to authenticated;
