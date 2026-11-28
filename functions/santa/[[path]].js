/* Cloudflare Pages Function for every Santa Box address. The public addresses are on the company domain
 * (inzeniths.com/santa...; the company site passes them on to this project), the files stay in apps/santa-box/.
 *
 *   /santa                  the shared Christmas tree (home page)
 *   /santa/wrap             wrap a box (sender)
 *   /santa/box-<id>         a box, for the recipient
 *   /santa/<name>-<code>    a box whose sender chose the link name (sun-to-mom-k7p2)
 *   /santa/privacy          privacy notice
 *   /santa/recipient        recipient page without a box (the sender's preview)
 *
 * A box link also fills in the link preview (LINE, Messenger, iMessage ...) with who the box is from, so the
 * recipient sees "🎁 Mali sent you a gift box" instead of a bare link. Only the sender's name is used: never the
 * recipient's name, the message, or anything inside the box. If the API is slow, down, or the box is unknown,
 * the page is served exactly as the static file (generic preview).
 */
const API_DEFAULT = 'https://api.inzeniths.com';
const PUBLIC_DEFAULT = 'https://inzeniths.com/santa';
const PAGES = { '': 'tree', wrap: 'sender', privacy: 'privacy', recipient: 'recipient' };
const FILES = new Set(['i18n.js', 'santa-api.js', 'og.png']);
const BOX = /^box-([a-z0-9]{6,40})$/;
const NAMED = /^(?!box-)[a-z0-9]+(?:-[a-z0-9]+)*-[a-z2-9]{4}$/;

async function senderName(ref, env) {
  const base = String(env.SANTA_API_URL || API_DEFAULT).replace(/\/+$/, '');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 1500);
  try {
    const r = await fetch(`${base}/v1/santa-box/gifts/${encodeURIComponent(ref)}`, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) return '';
    const j = await r.json();
    return typeof j.senderName === 'string' ? j.senderName.trim().slice(0, 40) : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

/** A file from apps/santa-box/. Pages serves file.html at /file (no .html), so pages are asked for without it. */
async function asset(file, request, env) {
  const url = new URL(`/santa-box/${file}`, request.url);
  let r = await env.ASSETS.fetch(new Request(url, { method: request.method, headers: request.headers }));
  // Pages may answer an extensionless path with a redirect: follow it once, inside the asset store
  if (r.status >= 300 && r.status < 400 && r.headers.get('location')) r = await env.ASSETS.fetch(new Request(new URL(r.headers.get('location'), url)));
  return r;
}

async function boxPage(ref, path, request, env) {
  const res = await asset('recipient', request, env);
  // the API knows a box by its slug (the part after "box-") or by its chosen name
  const name = res.ok ? await senderName(ref, env) : '';
  if (!name) return res;

  const title = `🎁 ${name} ส่งกล่องของขวัญมาให้คุณ · A gift box from ${name}`;
  const desc = 'การ์ดและเสียงอวยพรรออยู่ในกล่อง กดเปิดดูได้เลย · A card and a voice message are waiting inside · Santa Box by IN ZENITHS';
  const home = String(env.SANTA_PUBLIC_URL || PUBLIC_DEFAULT).replace(/\/+$/, '');
  const set = (value) => ({ element: (el) => el.setAttribute('content', value) });
  return new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', set(desc))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(desc))
    .on('meta[property="og:url"]', set(`${home}/${path}`))
    .transform(res);
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  const to = (pathname) => new Response(null, { status: 302, headers: { location: pathname + url.search } });
  const rest = url.pathname.slice('/santa'.length).replace(/^\//, '');

  // one address per page: no trailing slash
  if (url.pathname.endsWith('/')) return to(url.pathname.replace(/\/+$/, '') || '/santa');
  if (Object.hasOwn(PAGES, rest)) return asset(PAGES[rest], request, env);
  if (FILES.has(rest)) {
    const r = await asset(rest, request, env);
    if (!rest.endsWith('.js')) return r;
    // scripts change with the pages: make browsers re-check them on every visit (unchanged = a cheap 304)
    const out = new Response(r.body, r);
    out.headers.set('cache-control', 'public, max-age=0, must-revalidate');
    return out;
  }

  const lower = rest.toLowerCase();
  const box = BOX.exec(lower);
  if (box) return boxPage(box[1], lower, request, env);
  if (NAMED.test(lower)) return boxPage(lower, lower, request, env);
  return to('/santa');
}
