/* Old Santa Box addresses (play.inzeniths.com/santa-box/...) → the new ones (/santa/...). Links already sent keep working.
 *
 * Without the variable SANTA_PUBLIC_URL the visitor stays on the same domain. Set it on the Pages project to
 * https://inzeniths.com/santa once the company site passes /santa on, and old links move to the company domain.
 */
const RENAMED = { sender: 'wrap', tree: '' };

export function onRequest({ request, env }) {
  const url = new URL(request.url);
  let rest = url.pathname.slice('/santa-box'.length).replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
  const box = /^b\/([A-Za-z0-9]{4,64})$/.exec(rest);
  if (box) rest = `box-${box[1]}`;
  else if (Object.hasOwn(RENAMED, rest)) rest = RENAMED[rest];
  else if (rest.includes('/')) rest = '';
  const home = String(env.SANTA_PUBLIC_URL || `${url.origin}/santa`).replace(/\/+$/, '');
  // 302 while the move is new: a permanent redirect would stay in browsers even if we had to undo it
  return new Response(null, { status: 302, headers: { location: home + (rest ? `/${rest}` : '') + url.search } });
}
