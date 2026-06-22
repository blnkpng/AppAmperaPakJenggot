/* APJ API V18 - wrapper request Apps Script */
(function () {
  'use strict';

  function getConfig() {
    return window.APJ_CONFIG || {};
  }

  function normalizeParams(params) {
    const out = {};
    Object.keys(params || {}).forEach(function (key) {
      const value = params[key];
      if (value !== undefined && value !== null) out[key] = value;
    });
    return out;
  }

  async function request(action, payload, options) {
    const cfg = getConfig();
    const url = (options && options.url) || cfg.coreApiUrl;
    if (!url) throw new Error('APJ Core API URL belum diatur.');

    const body = Object.assign({}, normalizeParams(payload || {}), { action: action });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error('Respons API bukan JSON valid: ' + text.slice(0, 180));
    }
    return json;
  }

  async function get(action, params, options) {
    const cfg = getConfig();
    const url = new URL((options && options.url) || cfg.coreApiUrl);
    url.searchParams.set('action', action);
    Object.keys(params || {}).forEach(function (key) {
      const value = params[key];
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });
    const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    return response.json();
  }

  async function login(username, password, appName) {
    return request('login', {
      username: username,
      password: password,
      appName: appName || (getConfig().appName || 'APJ Central')
    });
  }

  async function getModuleAccess() {
    return request('getModuleAccess', {});
  }

  async function getOutlets() {
    return request('getOutlets', {});
  }

  async function getTodayBirthdays() {
    return request('getTodayBirthdays', {});
  }

  window.APJApi = {
    request: request,
    get: get,
    login: login,
    getModuleAccess: getModuleAccess,
    getOutlets: getOutlets,
    getTodayBirthdays: getTodayBirthdays
  };
})();
