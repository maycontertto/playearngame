import crypto from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const bitlabsSecret = process.env.BITLABS_APP_SECRET;
const bitlabsAmountMode = String(process.env.BITLABS_AMOUNT_MODE || '').trim().toLowerCase();
const bitlabsUsdToBrlRate = Number(String(process.env.BITLABS_USD_TO_BRL_RATE || '0').replace(',', '.')) || 0;

function getSingleParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getParam(params, ...names) {
  for (const name of names) {
    const value = getSingleParam(params?.[name]);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
}

function parseDecimal(value) {
  if (!value) return 0;
  const normalized = String(value).replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function getAbsoluteUrl(request) {
  const protocol = getSingleParam(request.headers['x-forwarded-proto']) || 'https';
  const host = getSingleParam(request.headers['x-forwarded-host']) || getSingleParam(request.headers.host);
  return `${protocol}://${host}${request.url}`;
}

function isValidHash(request, providedHash) {
  if (!bitlabsSecret) return true;
  if (!providedHash) return false;

  const absoluteUrl = getAbsoluteUrl(request);
  const separator = absoluteUrl.includes('&hash=') ? '&hash=' : absoluteUrl.includes('?hash=') ? '?hash=' : null;

  if (!separator) return false;

  const [unsignedUrl, hashFromUrl] = absoluteUrl.split(separator);
  const expectedHash = crypto.createHmac('sha1', bitlabsSecret).update(unsignedUrl).digest('hex');
  return expectedHash === hashFromUrl;
}

function getPayload(params) {
  return {
    uid: getParam(params, 'uid', 'UID', 'user_id'),
    tx: getParam(params, 'tx', 'TX', 'transaction_id'),
    val: parseDecimal(getParam(params, 'val', 'VAL', 'value_currency')),
    usd: parseDecimal(getParam(params, 'usd', 'USD', 'value_usd')),
    raw: getParam(params, 'raw', 'RAW'),
    type: getParam(params, 'type', 'TYPE', 'activity_type') || 'complete',
    hash: getParam(params, 'hash', 'HASH'),
    offerId: getParam(params, 'offer_id', 'OFFER_ID', 'offerId', 'task_id', 'TASK_ID', 'survey_id', 'SURVEY_ID'),
    offerName: getParam(params, 'offer_name', 'OFFER_NAME'),
    taskName: getParam(params, 'task_name', 'TASK_NAME'),
    ipAddress: getParam(params, 'ip_address', 'IP_ADDRESS', 'user_ip'),
    appToken: getParam(params, 'app_token', 'APP_TOKEN'),
    ref: getParam(params, 'ref', 'REF'),
  };
}

function resolveAmountLocal(payload) {
  if (bitlabsAmountMode === 'usd') {
    return payload.usd * (bitlabsUsdToBrlRate || 0);
  }

  if (!bitlabsAmountMode && bitlabsUsdToBrlRate > 0 && payload.usd > 0) {
    return payload.usd * bitlabsUsdToBrlRate;
  }

  return payload.val;
}

export default async function handler(request, response) {
  try {
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

    if (!payload.uid || !payload.tx) {
      return sendJson(response, 400, {
        ok: false,
        error: 'Parâmetros obrigatórios ausentes: uid e tx.',
      });
    }

    if (!isValidHash(request, payload.hash)) {
      return sendJson(response, 401, {
        ok: false,
        error: 'Hash BitLabs inválido.',
      });
    }

    const amountLocal = resolveAmountLocal(payload);

    if (amountLocal <= 0 && payload.usd <= 0 && payload.val <= 0) {
      return sendJson(response, 200, {
        ok: true,
        provider: 'bitlabs',
        result: {
          status: 'ignored_zero_value',
          tx: payload.tx,
          uid: payload.uid,
        },
      });
    }

    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/process_partner_postback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        p_partner_name: 'bitlabs',
        p_trans_id: payload.tx,
        p_user_id: payload.uid,
        p_status: 1,
        p_amount_local: amountLocal,
        p_amount_usd: payload.usd,
        p_event_type: payload.type,
        p_offer_id: payload.offerId || payload.tx,
        p_subid_1: payload.uid,
        p_subid_2: 'playgame-web',
        p_ip_click: payload.ipAddress,
        p_raw_payload: {
          ...params,
          _bitlabs_amount_mode: bitlabsAmountMode || (bitlabsUsdToBrlRate > 0 ? 'usd' : 'currency'),
          _effective_amount_local: amountLocal,
          _offer_name: payload.offerName,
          _task_name: payload.taskName,
          _app_token: payload.appToken,
          _ref: payload.ref,
          _raw_macro: payload.raw,
        },
      }),
    });

    const result = await rpcResponse.json().catch(() => null);

    if (!rpcResponse.ok) {
      return sendJson(response, 500, {
        ok: false,
        error: 'Falha ao processar o postback da BitLabs no Supabase.',
        details: result,
      });
    }

    return sendJson(response, 200, {
      ok: true,
      provider: 'bitlabs',
      result,
    });
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Falha inesperada no endpoint da BitLabs.',
    });
  }
}
