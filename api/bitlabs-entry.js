import crypto from 'node:crypto';

const bitlabsToken = process.env.BITLABS_OFFERWALL_TOKEN;
const bitlabsSecret = process.env.BITLABS_APP_SECRET;
const bitlabsWidgetUrl = process.env.BITLABS_WIDGET_URL || 'https://web.bitlabs.ai/';
const bitlabsDisplayMode = process.env.BITLABS_DISPLAY_MODE;
const bitlabsTheme = process.env.BITLABS_THEME;

function getSingleParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function appendOptionalParam(url, key, value) {
  if (value) {
    url.searchParams.set(key, value);
  }
}

export default async function handler(request, response) {
  const uid = getSingleParam(request.query?.uid) || getSingleParam(request.query?.user_id);
  const username = getSingleParam(request.query?.username);

  if (!bitlabsToken) {
    return sendJson(response, 500, {
      ok: false,
      error: 'BITLABS_OFFERWALL_TOKEN não configurado no servidor.',
    });
  }

  if (!uid) {
    return sendJson(response, 400, {
      ok: false,
      error: 'Informe uid para abrir a BitLabs.',
    });
  }

  const url = new URL(bitlabsWidgetUrl);
  url.searchParams.set('uid', uid);
  url.searchParams.set('token', bitlabsToken);
  appendOptionalParam(url, 'display_mode', bitlabsDisplayMode);
  appendOptionalParam(url, 'theme', bitlabsTheme);
  appendOptionalParam(url, 'username', username);
  url.searchParams.set('sdk', 'TAB');

  if (bitlabsSecret) {
    const unsignedUrl = url.toString();
    const hash = crypto.createHmac('sha1', bitlabsSecret).update(unsignedUrl).digest('hex');
    url.searchParams.set('hash', hash);
  }

  response.writeHead(302, {
    Location: url.toString(),
    'Cache-Control': 'no-store',
  });
  response.end();
}
