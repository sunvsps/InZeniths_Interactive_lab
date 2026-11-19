/* Santa Box ↔ IN ZENITHS Interactive API (interactive/api).
 * Where the API lives: <meta name="santa-api" content="https://api.inzeniths.com"> in each page.
 * Empty = prototype mode: the pages run on their own with sample data, as before.
 * For local testing add ?api=http://localhost:3100 to the page address once (remembered for the tab). */
window.SantaAPI = (function () {
  var meta = document.querySelector('meta[name="santa-api"]');
  var base = (meta && meta.content) || '';
  try {
    var q = new URLSearchParams(location.search).get('api');
    if (q) sessionStorage.setItem('santaApi', q);
    base = sessionStorage.getItem('santaApi') || base;
  } catch (e) {}
  base = base.replace(/\/+$/, '');

  function call(method, path, body, headers) {
    var h = Object.assign({}, headers || {});
    if (body) h['Content-Type'] = 'application/json';
    return fetch(base + '/v1/santa-box' + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok) return j;
        var err = new Error((j.error && j.error.message) || 'HTTP ' + r.status);
        err.code = j.error && j.error.code;
        err.status = r.status;
        throw err;
      });
    });
  }

  /** Asks for a file slot, then sends the file straight to storage. Returns the key for the gift. */
  function upload(kind, blob) {
    var type = (blob.type || '').split(';')[0];
    return call('POST', '/uploads', { kind: kind, contentType: type, bytes: blob.size }).then(function (t) {
      return fetch(t.upload.url, { method: 'PUT', headers: t.upload.headers, body: blob }).then(function (r) {
        if (!r.ok) throw new Error('upload failed (' + r.status + ')');
        return t.key;
      });
    });
  }

  /** Sender tokens stay on this device only: they let the sender pay for and check their own boxes. */
  var SENT = 'santaSent';
  function remember(slug, data) {
    try {
      var all = JSON.parse(localStorage.getItem(SENT) || '{}');
      all[slug] = Object.assign(all[slug] || {}, data);
      localStorage.setItem(SENT, JSON.stringify(all));
    } catch (e) {}
  }
  function recall(slug) {
    try { return JSON.parse(localStorage.getItem(SENT) || '{}')[slug] || null; } catch (e) { return null; }
  }

  /** The box id in the recipient's link: /b/<slug> or ?b=<slug>. */
  function slugFromUrl() {
    var m = location.pathname.match(/\/b\/([a-z0-9]{6,40})\/?$/);
    if (m) return m[1];
    try { return new URLSearchParams(location.search).get('b'); } catch (e) { return null; }
  }

  return {
    enabled: !!base,
    base: base,
    stats: function () { return call('GET', '/stats'); },
    /** The shared Christmas tree: total boxes and the look of the newest ones (no names or links). */
    tree: function () { return call('GET', '/tree'); },
    upload: upload,
    send: function (body) { return call('POST', '/gifts', body); },
    get: function (slug) { return call('GET', '/gifts/' + slug); },
    open: function (slug) { return call('POST', '/gifts/' + slug + '/open'); },
    manage: function (slug, token) { return call('GET', '/gifts/' + slug + '/manage', null, { 'X-Sender-Token': token }); },
    checkout: function (slug, body, token) { return call('POST', '/gifts/' + slug + '/checkout', body, token ? { 'X-Sender-Token': token } : null); },
    download: function (slug) { return call('GET', '/gifts/' + slug + '/download'); },
    /** Check a discount code for a plan; returns the price after it. */
    promo: function (code, plan) { return call('POST', '/promo', { code: code, plan: plan }); },
    remember: remember,
    recall: recall,
    slugFromUrl: slugFromUrl,
  };
})();
