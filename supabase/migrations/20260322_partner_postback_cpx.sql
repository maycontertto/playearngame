create table if not exists public.partner_postback_events (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  trans_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_id text,
  subid_1 text,
  subid_2 text,
  event_type text not null default 'complete',
  status integer not null default 1,
  amount_local numeric(12,4) not null default 0,
  amount_usd numeric(12,4) not null default 0,
  currency_code text not null default 'BRL',
  qualified_revenue_cents integer not null default 0,
  reward_points integer not null default 0,
  task_revenue_event_id uuid references public.revenue_events (id) on delete set null,
  direct_referral_event_id uuid references public.revenue_events (id) on delete set null,
  indirect_referral_event_id uuid references public.revenue_events (id) on delete set null,
  reversed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint partner_postback_events_status_check check (status in (1, 2))
);

create unique index if not exists partner_postback_events_partner_trans_key
  on public.partner_postback_events (partner_name, trans_id);

create index if not exists partner_postback_events_user_created_at_idx
  on public.partner_postback_events (user_id, created_at desc);

create or replace function public.calculate_partner_reward_points(p_qualified_revenue_cents integer)
returns integer
language sql
immutable
as $$
  select greatest(5, round(greatest(coalesce(p_qualified_revenue_cents, 0), 0) * 0.60))::integer;
$$;

create or replace function public.process_partner_postback(
  p_partner_name text,
  p_trans_id text,
  p_user_id uuid,
  p_status integer,
  p_amount_local numeric default 0,
  p_amount_usd numeric default 0,
  p_event_type text default 'complete',
  p_offer_id text default null,
  p_subid_1 text default null,
  p_subid_2 text default null,
  p_ip_click text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_name text := lower(trim(coalesce(p_partner_name, 'cpx_research')));
  v_trans_id text := trim(coalesce(p_trans_id, ''));
  v_event_type text := lower(trim(coalesce(p_event_type, 'complete')));
  v_existing public.partner_postback_events;
  v_existing_found boolean := false;
  v_profile public.profiles;
  v_direct_referrer_id uuid;
  v_indirect_referrer_id uuid;
  v_task_event public.revenue_events;
  v_direct_referral_event public.revenue_events;
  v_indirect_referral_event public.revenue_events;
  v_qualified_revenue_cents integer := greatest(round(coalesce(p_amount_local, 0) * 100), 0)::integer;
  v_reward_points integer := 0;
  v_user_share integer := 0;
  v_direct_referral_share integer := 0;
  v_indirect_referral_share integer := 0;
  v_site_share integer := 0;
  v_operator_share integer := 0;
  v_reserve_share integer := 0;
  v_withdrawn_already boolean := false;
begin
  if v_trans_id = '' then
    raise exception 'Transação externa inválida.';
  end if;

  if p_user_id is null then
    raise exception 'Usuário do parceiro não informado.';
  end if;

  if p_status not in (1, 2) then
    raise exception 'Status do parceiro inválido. Use 1 ou 2.';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_user_id
  ) then
    raise exception 'Usuário informado pelo parceiro não existe.';
  end if;

  select * into v_existing
  from public.partner_postback_events
  where partner_name = v_partner_name
    and trans_id = v_trans_id
  for update;

  v_existing_found := found;

  if p_status = 1 then
    if v_existing_found and v_existing.task_revenue_event_id is not null and v_existing.reversed_at is null then
      return jsonb_build_object(
        'ok', true,
        'status', 'already_processed',
        'transId', v_trans_id,
        'partner', v_partner_name
      );
    end if;

    perform public.ensure_profile_row(p_user_id);

    select * into v_profile
    from public.profiles
    where id = p_user_id;

    select referred_by_user_id
    into v_direct_referrer_id
    from public.profiles
    where id = p_user_id;

    if v_direct_referrer_id is not null then
      select referred_by_user_id
      into v_indirect_referrer_id
      from public.profiles
      where id = v_direct_referrer_id;
    end if;

    v_reward_points := public.calculate_partner_reward_points(v_qualified_revenue_cents);
    v_user_share := round(v_qualified_revenue_cents * 0.80);

    if v_direct_referrer_id is not null and v_qualified_revenue_cents > 0 then
      v_direct_referral_share := round(v_qualified_revenue_cents * 0.03);
    end if;

    if v_indirect_referrer_id is not null
      and v_indirect_referrer_id <> v_direct_referrer_id
      and v_indirect_referrer_id <> p_user_id
      and v_qualified_revenue_cents > 0 then
      v_indirect_referral_share := round(v_qualified_revenue_cents * 0.01);
    end if;

    v_site_share := greatest(v_qualified_revenue_cents - v_user_share - v_direct_referral_share - v_indirect_referral_share, 0);
    v_operator_share := round(v_site_share * 0.60);
    v_reserve_share := greatest(v_site_share - v_operator_share, 0);

    if v_qualified_revenue_cents > 0 then
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
        p_user_id,
        'task',
        0,
        null,
        v_trans_id,
        'ad',
        'CPX Research • Conversão aprovada',
        v_qualified_revenue_cents,
        v_user_share,
        v_operator_share,
        v_reserve_share,
        'pending',
        timezone('utc', now()) + interval '7 days',
        'partner-cpx-v1'
      )
      returning * into v_task_event;
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
        p_user_id,
        v_trans_id,
        'ad',
        'Comissão de indicação direta • parceiro CPX',
        0,
        v_direct_referral_share,
        0,
        0,
        'pending',
        timezone('utc', now()) + interval '7 days',
        'partner-cpx-v1'
      )
      returning * into v_direct_referral_event;
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
        p_user_id,
        v_trans_id,
        'ad',
        'Comissão de indicação indireta • parceiro CPX',
        0,
        v_indirect_referral_share,
        0,
        0,
        'pending',
        timezone('utc', now()) + interval '7 days',
        'partner-cpx-v1'
      )
      returning * into v_indirect_referral_event;
    end if;

    perform set_config('app.bypass_financial_guard', 'on', true);

    update public.profiles
    set
      points = points + v_reward_points,
      tasks_completed = tasks_completed + 1,
      daily_tasks_completed = daily_tasks_completed + 1,
      daily_ad_views = daily_ad_views + 1
    where id = p_user_id;

    perform public.log_user_activity(
      'partner_postback_complete',
      null,
      jsonb_build_object(
        'partner', v_partner_name,
        'trans_id', v_trans_id,
        'offer_id', p_offer_id,
        'amount_local', p_amount_local,
        'amount_usd', p_amount_usd,
        'ip_click', p_ip_click,
        'event_type', v_event_type
      ),
      p_user_id
    );

    if v_existing_found then
      update public.partner_postback_events
      set
        user_id = p_user_id,
        offer_id = p_offer_id,
        subid_1 = p_subid_1,
        subid_2 = p_subid_2,
        event_type = v_event_type,
        status = 1,
        amount_local = coalesce(p_amount_local, 0),
        amount_usd = coalesce(p_amount_usd, 0),
        qualified_revenue_cents = v_qualified_revenue_cents,
        reward_points = v_reward_points,
        task_revenue_event_id = v_task_event.id,
        direct_referral_event_id = v_direct_referral_event.id,
        indirect_referral_event_id = v_indirect_referral_event.id,
        reversed_at = null,
        raw_payload = coalesce(p_raw_payload, '{}'::jsonb),
        updated_at = timezone('utc', now())
      where id = v_existing.id;
    else
      insert into public.partner_postback_events (
        partner_name,
        trans_id,
        user_id,
        offer_id,
        subid_1,
        subid_2,
        event_type,
        status,
        amount_local,
        amount_usd,
        qualified_revenue_cents,
        reward_points,
        task_revenue_event_id,
        direct_referral_event_id,
        indirect_referral_event_id,
        raw_payload
      )
      values (
        v_partner_name,
        v_trans_id,
        p_user_id,
        p_offer_id,
        p_subid_1,
        p_subid_2,
        v_event_type,
        1,
        coalesce(p_amount_local, 0),
        coalesce(p_amount_usd, 0),
        v_qualified_revenue_cents,
        v_reward_points,
        v_task_event.id,
        v_direct_referral_event.id,
        v_indirect_referral_event.id,
        coalesce(p_raw_payload, '{}'::jsonb)
      );
    end if;

    perform public.sync_financial_snapshot(p_user_id);

    if v_direct_referrer_id is not null then
      perform public.sync_financial_snapshot(v_direct_referrer_id);
    end if;

    if v_indirect_referrer_id is not null then
      perform public.sync_financial_snapshot(v_indirect_referrer_id);
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', 'credited',
      'transId', v_trans_id,
      'partner', v_partner_name,
      'userId', p_user_id,
      'qualifiedRevenueCents', v_qualified_revenue_cents,
      'rewardPoints', v_reward_points,
      'userShareCents', v_user_share
    );
  end if;

  if not v_existing_found then
    insert into public.partner_postback_events (
      partner_name,
      trans_id,
      user_id,
      offer_id,
      subid_1,
      subid_2,
      event_type,
      status,
      amount_local,
      amount_usd,
      reversed_at,
      raw_payload
    )
    values (
      v_partner_name,
      v_trans_id,
      p_user_id,
      p_offer_id,
      p_subid_1,
      p_subid_2,
      v_event_type,
      2,
      coalesce(p_amount_local, 0),
      coalesce(p_amount_usd, 0),
      timezone('utc', now()),
      coalesce(p_raw_payload, '{}'::jsonb)
    )
    on conflict (partner_name, trans_id) do nothing;

    return jsonb_build_object(
      'ok', true,
      'status', 'reversal_logged_without_match',
      'transId', v_trans_id,
      'partner', v_partner_name
    );
  end if;

  if v_existing.reversed_at is not null or v_existing.status = 2 then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_reversed',
      'transId', v_trans_id,
      'partner', v_partner_name
    );
  end if;

  if v_existing.task_revenue_event_id is not null then
    select status = 'withdrawn'
    into v_withdrawn_already
    from public.revenue_events
    where id = v_existing.task_revenue_event_id;
  end if;

  update public.partner_postback_events
  set
    status = 2,
    reversed_at = timezone('utc', now()),
    raw_payload = coalesce(raw_payload, '{}'::jsonb) || coalesce(p_raw_payload, '{}'::jsonb),
    updated_at = timezone('utc', now())
  where id = v_existing.id;

  if v_withdrawn_already then
    perform set_config('app.bypass_financial_guard', 'on', true);

    update public.profiles
    set
      risk_score = greatest(risk_score, 85),
      risk_level = 'high',
      withdrawal_blocked = true
    where id = v_existing.user_id;

    perform public.log_user_activity(
      'partner_postback_reversal_after_withdraw',
      null,
      jsonb_build_object(
        'partner', v_partner_name,
        'trans_id', v_trans_id,
        'offer_id', v_existing.offer_id
      ),
      v_existing.user_id
    );

    return jsonb_build_object(
      'ok', true,
      'status', 'reversal_requires_manual_review',
      'transId', v_trans_id,
      'partner', v_partner_name
    );
  end if;

  if v_existing.task_revenue_event_id is not null then
    update public.revenue_events
    set
      qualified_revenue_cents = 0,
      user_share_cents = 0,
      operator_share_cents = 0,
      reserve_share_cents = 0
    where id = v_existing.task_revenue_event_id;
  end if;

  if v_existing.direct_referral_event_id is not null then
    update public.revenue_events
    set user_share_cents = 0
    where id = v_existing.direct_referral_event_id;
  end if;

  if v_existing.indirect_referral_event_id is not null then
    update public.revenue_events
    set user_share_cents = 0
    where id = v_existing.indirect_referral_event_id;
  end if;

  perform set_config('app.bypass_financial_guard', 'on', true);

  update public.profiles
  set
    points = greatest(points - coalesce(v_existing.reward_points, 0), 0),
    tasks_completed = greatest(tasks_completed - 1, 0)
  where id = v_existing.user_id;

  perform public.log_user_activity(
    'partner_postback_reversal',
    null,
    jsonb_build_object(
      'partner', v_partner_name,
      'trans_id', v_trans_id,
      'offer_id', v_existing.offer_id
    ),
    v_existing.user_id
  );

  perform public.sync_financial_snapshot(v_existing.user_id);

  select referred_by_user_id
  into v_direct_referrer_id
  from public.profiles
  where id = v_existing.user_id;

  if v_direct_referrer_id is not null then
    perform public.sync_financial_snapshot(v_direct_referrer_id);

    select referred_by_user_id
    into v_indirect_referrer_id
    from public.profiles
    where id = v_direct_referrer_id;
  end if;

  if v_indirect_referrer_id is not null then
    perform public.sync_financial_snapshot(v_indirect_referrer_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'reversed',
    'transId', v_trans_id,
    'partner', v_partner_name
  );
end;
$$;

grant execute on function public.calculate_partner_reward_points(integer) to anon, authenticated;
grant execute on function public.process_partner_postback(text, text, uuid, integer, numeric, numeric, text, text, text, text, text, jsonb) to anon, authenticated;
