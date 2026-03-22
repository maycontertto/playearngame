const cpxAppId = process.env.VITE_CPX_APP_ID;
const cpxWidgetUrl = process.env.VITE_CPX_WIDGET_URL || 'https://offers.cpx-research.com/index.php';

function getSingleParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  const extUserId = getSingleParam(request.query?.ext_user_id) || getSingleParam(request.query?.user_id);
  const subid1 = getSingleParam(request.query?.subid_1) || extUserId;
  const subid2 = getSingleParam(request.query?.subid_2) || 'playgame-web';

  if (!cpxAppId) {
    return sendJson(response, 500, {
      ok: false,
      error: 'VITE_CPX_APP_ID não configurado no servidor.',
    });
  }

  if (!extUserId) {
    return sendJson(response, 400, {
      ok: false,
      error: 'Informe ext_user_id para abrir a CPX.',
    });
  }

  const url = new URL(cpxWidgetUrl);
  url.searchParams.set('app_id', cpxAppId);
  url.searchParams.set('ext_user_id', extUserId);
  url.searchParams.set('subid_1', subid1);
  url.searchParams.set('subid_2', subid2);

  response.writeHead(302, {
    Location: url.toString(),
    'Cache-Control': 'no-store',
  });
  response.end();
}