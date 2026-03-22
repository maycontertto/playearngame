import crypto from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const cpxPostbackSecret = process.env.CPX_POSTBACK_SECRET;

function getSingleParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDecimal(value) {
  if (!value) return 0;
  const normalized = String(value).replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPayload(params) {
  return {
    status: Number(getSingleParam(params.status) || '0'),
    transId: getSingleParam(params.trans_id),
    userId: getSingleParam(params.user_id),
    subid1: getSingleParam(params.subid_1) || getSingleParam(params.sub_id_1),
    subid2: getSingleParam(params.subid_2) || getSingleParam(params.sub_id_2),
    amountLocal: parseDecimal(getSingleParam(params.amount_local)),
    amountUsd: parseDecimal(getSingleParam(params.amount_usd)),
    offerId: getSingleParam(params.offer_id) || getSingleParam(params.offer_ID),
    hash: getSingleParam(params.hash) || getSingleParam(params.secure_hash),
    ipClick: getSingleParam(params.ip_click),
    type: getSingleParam(params.type) || 'complete',
  };
}

function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return sendJson(response, 500, {
      ok: false,
      error: 'Supabase não configurado no servidor.',
    });
  }

  const params = request.method === 'POST'
    ? { ...(request.query || {}), ...(request.body || {}) }
    : (request.query || {});

  const payload = getPayload(params);

  if (!payload.transId || !payload.userId || ![1, 2].includes(payload.status)) {
    return sendJson(response, 400, {
      ok: false,
      error: 'Parâmetros obrigatórios ausentes: status, trans_id e user_id.',
    });
  }

  if (cpxPostbackSecret && payload.hash) {
    const expectedHash = crypto
      .createHash('md5')
      .update(`${payload.transId}-${cpxPostbackSecret}`)
      .digest('hex');

    if (expectedHash !== payload.hash) {
      return sendJson(response, 401, {
        ok: false,
        error: 'Hash de segurança inválido.',
      });
    }
  }

  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/process_partner_postback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      p_partner_name: 'cpx_research',
      p_trans_id: payload.transId,
      p_user_id: payload.userId,
      p_status: payload.status,
      p_amount_local: payload.amountLocal,
      p_amount_usd: payload.amountUsd,
      p_event_type: payload.type,
      p_offer_id: payload.offerId,
      p_subid_1: payload.subid1,
      p_subid_2: payload.subid2,
      p_ip_click: payload.ipClick,
      p_raw_payload: params,
    }),
  });

  const result = await rpcResponse.json().catch(() => null);

  if (!rpcResponse.ok) {
    return sendJson(response, 500, {
      ok: false,
      error: 'Falha ao processar o postback no Supabase.',
      details: result,
    });
  }

  return sendJson(response, 200, {
    ok: true,
    provider: 'cpx_research',
    result,
  });
}