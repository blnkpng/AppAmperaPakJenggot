/* APJ API V18 FOUNDATION - wrapper multi endpoint Apps Script */
(function () {
  'use strict';

  function cfg() { return window.APJ_CONFIG || {}; }
  function endpoint(nameOrOptions) {
    var c = cfg();
    if (nameOrOptions && typeof nameOrOptions === 'object' && nameOrOptions.url) return nameOrOptions.url;
    var name = typeof nameOrOptions === 'string' ? nameOrOptions : (nameOrOptions && (nameOrOptions.api || nameOrOptions.module));
    if (!name) return c.coreApiUrl || (c.apis && c.apis.core);
    if (name === 'core') return c.coreApiUrl || (c.apis && c.apis.core);
    if (name === 'inventory') return c.inventoryApiUrl || (c.apis && c.apis.inventory);
    if (name === 'absensi') return c.absensiApiUrl || (c.apis && c.apis.absensi);
    return (c.apis && c.apis[name]) || c.coreApiUrl;
  }
  function clean(params) {
    var out = {};
    Object.keys(params || {}).forEach(function (key) {
      var v = params[key];
      if (v !== undefined && v !== null) out[key] = v;
    });
    return out;
  }
  async function request(action, payload, options) {
    var url = endpoint(options || 'core');
    if (!url) throw new Error('URL API APJ belum diatur untuk request: ' + action);
    var body = Object.assign({}, clean(payload || {}), { action: action });
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify(body)
    });
    var text = await response.text();
    var json;
    try { json = JSON.parse(text); }
    catch (error) { throw new Error('Respons API bukan JSON valid: ' + text.slice(0, 220)); }
    return json;
  }
  async function get(action, params, options) {
    var urlText = endpoint(options || 'core');
    if (!urlText) throw new Error('URL API APJ belum diatur untuk GET: ' + action);
    var url = new URL(urlText);
    url.searchParams.set('action', action);
    Object.keys(params || {}).forEach(function (key) {
      var v = params[key];
      if (v !== undefined && v !== null) url.searchParams.set(key, v);
    });
    var response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    return response.json();
  }
  function withToken(payload) {
    payload = payload || {};
    if (!payload.sessionToken) payload.sessionToken = localStorage.getItem('APJ_SESSION_TOKEN') || '';
    return payload;
  }
  async function core(action, payload) { return request(action, withToken(payload || {}), { api:'core' }); }
  async function inventory(action, payload) { return request(action, withToken(payload || {}), { api:'inventory' }); }
  async function absensi(action, payload) { return request(action, withToken(payload || {}), { api:'absensi' }); }

  window.APJApi = {
    endpoint: endpoint,
    request: request,
    get: get,
    core: core,
    inventory: inventory,
    absensi: absensi,
    login: function (username, password, appName) {
      return request('login', { username:username, password:password, appName: appName || (cfg().appName || 'APJ Central') }, { api:'core' });
    },
    logout: function () { return core('logout', {}); },
    getModuleAccess: function () { return core('getModuleAccess', {}); },
    getOutlets: function () { return core('getOutlets', {}); },
    getTodayBirthdays: function () { return core('getTodayBirthdays', {}); }
  };
})();
