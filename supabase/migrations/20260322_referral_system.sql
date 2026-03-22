alter table public.profiles add column if not exists referred_by_user_id uuid references auth.users (id) on delete set null;
alter table public.profiles add column if not exists referred_by_code text;
alter table public.profiles add column if not exists referral_earnings_cents integer not null default 0;
alter table public.profiles add column if not exists pending_referral_earnings_cents integer not null default 0;
alter table public.profiles add column if not exists available_referral_earnings_cents integer not null default 0;

alter table public.revenue_events add column if not exists event_kind text;
alter table public.revenue_events add column if not exists origin_user_id uuid references auth.users (id) on delete set null;

update public.revenue_events
set event_kind = 'task'
where event_kind is null;

alter table public.revenue_events alter column event_kind set default 'task';
alter table public.revenue_events alter column event_kind set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'revenue_events_event_kind_check'
      and conrelid = 'public.revenue_events'::regclass
  ) then
    alter table public.revenue_events drop constraint revenue_events_event_kind_check;
  end if;
end $$;

alter table public.revenue_events
  add constraint revenue_events_event_kind_check
  check (event_kind in ('task', 'referral'));

create or replace function public.generate_unique_referral_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  loop
    v_code := 'TASK' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (
      select 1
      from public.profiles
      where referral_code = v_code
    );
  end loop;

  return v_code;
end;
$$;

do $$
declare
  v_profile record;
begin
  for v_profile in
    select id
    from public.profiles
    where referral_code is null
  loop
    perform set_config('app.bypass_financial_guard', 'on', true);
    update public.profiles
    set referral_code = public.generate_unique_referral_code()
    where id = v_profile.id;
  end loop;

  for v_profile in
    with duplicates as (
      select id,
             row_number() over (partition by referral_code order by created_at nulls first, id) as rn
      from public.profiles
      where referral_code is not null
    )
    select id
    from duplicates
    where rn > 1
  loop
    perform set_config('app.bypass_financial_guard', 'on', true);
    update public.profiles
    set referral_code = public.generate_unique_referral_code()
    where id = v_profile.id;
  end loop;
end $$;

create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code);

revoke update (referral_code, referral_count) on public.profiles from authenticated;

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
  values (p_user_id, 'Jogador', '🎮', public.generate_unique_referral_code())
  on conflict (id) do nothing;

  update public.profiles
  set referral_code = coalesce(referral_code, public.generate_unique_referral_code())
  where id = p_user_id
    and referral_code is null;

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
  v_referral_total integer := 0;
  v_referral_pending integer := 0;
  v_referral_available integer := 0;
begin
  if p_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  perform public.ensure_profile_row(p_user_id);

  select
    coalesce(sum(case when status = 'available' then user_share_cents else 0 end), 0),
    coalesce(sum(case when status = 'pending' then user_share_cents else 0 end), 0),
    coalesce(sum(case when status = 'withdrawn' then user_share_cents else 0 end), 0),
    coalesce(sum(case when event_kind = 'task' then qualified_revenue_cents else 0 end), 0),
    coalesce(sum(case when event_kind = 'task' then user_share_cents else 0 end), 0),
    coalesce(sum(case when event_kind = 'task' then operator_share_cents else 0 end), 0),
    coalesce(sum(case when event_kind = 'task' then reserve_share_cents else 0 end), 0),
    coalesce(sum(case when event_kind = 'referral' then user_share_cents else 0 end), 0),
    coalesce(sum(case when event_kind = 'referral' and status = 'pending' then user_share_cents else 0 end), 0),
    coalesce(sum(case when event_kind = 'referral' and status = 'available' then user_share_cents else 0 end), 0)
  into
    v_available,
    v_pending,
    v_withdrawn,
    v_qualified,
    v_user,
    v_operator,
    v_reserve,
    v_referral_total,
    v_referral_pending,
    v_referral_available
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
    reserve_share_cents = v_reserve,
    referral_earnings_cents = v_referral_total,
    pending_referral_earnings_cents = v_referral_pending,
    available_referral_earnings_cents = v_referral_available,
    referral_count = (
      select count(*)
      from public.profiles referred
      where referred.referred_by_user_id = p_user_id
    )
  where id = p_user_id;

  select * into v_profile
  from public.profiles
  where id = p_user_id;

  return v_profile;
end;
$$;

create or replace function public.apply_referral_code(p_referral_code text)
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

  select * into v_current_profile
  from public.profiles
  where id = v_user_id
  for update;

  if v_current_profile.referred_by_user_id is not null then
    raise exception 'Sua conta já está vinculada a um indicador.';
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

  perform set_config('app.bypass_financial_guard', 'on', true);

  update public.profiles
  set
    referred_by_user_id = v_referrer_profile.id,
    referred_by_code = v_referrer_profile.referral_code
  where id = v_user_id;

  perform public.sync_financial_snapshot(v_referrer_profile.id);
  perform public.sync_financial_snapshot(v_user_id);

  return jsonb_build_object(
    'message', format('Código %s aplicado com sucesso. Seu indicador vai receber 3%% da sua produção qualificada.', v_referrer_profile.referral_code),
    'referrerUserId', v_referrer_profile.id,
    'referrerCode', v_referrer_profile.referral_code
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
  v_referral_event public.revenue_events;
  v_referred_by_user_id uuid;
  v_user_share integer := 0;
  v_referral_share integer := 0;
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

  select referred_by_user_id
  into v_referred_by_user_id
  from public.profiles
  where id = v_user_id;

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
  v_referral_share := case
    when v_referred_by_user_id is not null and v_task.estimated_revenue_cents > 0 then round(v_task.estimated_revenue_cents * 0.03)
    else 0
  end;
  v_site_share := greatest(v_task.estimated_revenue_cents - v_user_share - v_referral_share, 0);
  v_operator_share := round(v_site_share * 0.60);
  v_reserve_share := greatest(v_site_share - v_operator_share, 0);

  if v_task.estimated_revenue_cents > 0 then
    insert into public.revenue_events (
      user_id,
      event_kind,
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
      'v3-80-3-referral'
    )
    returning * into v_revenue_event;
  end if;

  if v_referral_share > 0 then
    insert into public.revenue_events (
      user_id,
      event_kind,
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
      v_referred_by_user_id,
      'referral',
      v_user_id,
      v_task.id,
      v_task.type,
      'Comissão de indicação direta',
      0,
      v_referral_share,
      0,
      0,
      'pending',
      timezone('utc', now()) + interval '7 days',
      'v3-80-3-referral'
    )
    returning * into v_referral_event;

    perform public.sync_financial_snapshot(v_referred_by_user_id);
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
    'referralCashPoints', v_referral_share,
    'profile', to_jsonb(v_profile),
    'revenueEvent', case when v_revenue_event.id is not null then to_jsonb(v_revenue_event) else null end,
    'referralEvent', case when v_referral_event.id is not null then to_jsonb(v_referral_event) else null end
  );
end;
$$;

grant execute on function public.generate_unique_referral_code() to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.ensure_profile_row(uuid) to authenticated;
grant execute on function public.sync_financial_snapshot(uuid) to authenticated;
grant execute on function public.complete_task_secure(text) to authenticated;
