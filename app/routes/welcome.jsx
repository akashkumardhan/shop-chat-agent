import { resolveWelcome } from '../services/welcome.server.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function loader({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const url = new URL(request.url);
  const pageType = url.searchParams.get('page_type') || 'unknown';
  const packId = url.searchParams.get('pack_id') || 'jewelry';
  const hasPriorConvo = url.searchParams.get('has_prior_convo') === '1';

  let pageContext = {};
  const ctxRaw = url.searchParams.get('page_context');
  if (ctxRaw) {
    try {
      pageContext = JSON.parse(ctxRaw);
    } catch {
      pageContext = {};
    }
  }

  const welcome = resolveWelcome({ pageType, packId, pageContext, hasPriorConvo });
  return new Response(JSON.stringify(welcome), { headers: CORS_HEADERS });
}
