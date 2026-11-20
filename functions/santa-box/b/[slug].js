/* Cloudflare Pages Function for a box link: play.inzeniths.com/santa-box/b/<id>
 *
 * It serves the same static recipient page as before, but fills in the link preview (LINE, Messenger, iMessage ...)
 * with who the box is from, so the recipient sees "🎁 Mali sent you a gift box" instead of a bare link.
 * Only the sender's name is used: never the recipient's name, the message, or anything inside the box.
 * If the API is slow, down, or the box is unknown, the page is served exactly as the static file (generic preview).
 */
const API_DEFAULT = 'https://api.inzeniths.com';
const SLUG = /^[A-Za-z0-9_-]{4,64}$/;

async function senderName(slug, env) {
  const base = String(env.SANTA_API_URL || API_DEFAULT).replace(/\/+$/, '');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 1500);
  try {
    const r = await fetch(`${base}/v1/santa-box/gifts/${encodeURIComponent(slug)}`, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) return '';
    const j = await r.json();
    return typeof j.senderName === 'string' ? j.senderName.trim().slice(0, 40) : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function page(request, env) {
  const url = new URL('/santa-box/recipient', request.url);
  let r = await env.ASSETS.fetch(new Request(url, { headers: request.headers }));
  // Pages may answer an extensionless path with a redirect: follow it once, inside the asset store
  if (r.status >= 300 && r.status < 400 && r.headers.get('location')) r = await env.ASSETS.fetch(new Request(new URL(r.headers.get('location'), url)));
  return r;
}

export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const res = await page(request, env);
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  if (!res.ok || !SLUG.test(slug || '')) return res;

  const name = await senderName(slug, env);
  if (!name) return res;

  const title = `🎁 ${name} ส่งกล่องของขวัญมาให้คุณ · A gift box from ${name}`;
  const desc = 'การ์ดและเสียงอวยพรรออยู่ในกล่อง กดเปิดดูได้เลย · A card and a voice message are waiting inside · Santa Box by IN ZENITHS';
  const set = (value) => ({ element: (el) => el.setAttribute('content', value) });
  return new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', set(desc))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(desc))
    .on('meta[property="og:url"]', set(new URL(`/santa-box/b/${slug}`, request.url).href))
    .transform(res);
}
