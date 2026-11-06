/* Game saves stay on this device; analytics uses a separate, narrow destination. */
(() => {
  'use strict';
  const allowed = (input, method = 'GET') => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    const verb = String(method).toUpperCase();
    if (url.origin === location.origin) return ['GET', 'HEAD'].includes(verb);
    if (['GET','POST'].includes(verb) && ['https://www.google-analytics.com','https://region1.google-analytics.com'].includes(url.origin) && url.pathname === '/g/collect' && url.searchParams.get('tid') === 'G-QXB7CHLEDT') return true;
    return verb === 'GET' && url.origin === 'https://vps.kodub.com' &&
      (/^\/v6\/trackOfTheWeek$/.test(url.pathname) || /^\/v6\/trackOfTheWeek\/(track|image)\/[a-f0-9]{64}$/.test(url.pathname));
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => allowed(input, init?.method || input?.method || 'GET')
    ? originalFetch(input, {...init, credentials: 'omit', referrerPolicy: 'no-referrer'})
    : Promise.reject(new Error('PolyTrack Lab keeps scores local. This network request is disabled.'));
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (!allowed(url, method)) throw new Error('PolyTrack Lab: only public weekly-track downloads are allowed.');
    return originalOpen.call(this, method, url, ...args);
  };
  window.WebSocket = class { constructor() { throw new Error('Online multiplayer is disabled in PolyTrack Lab.'); } };
  window.EventSource = class { constructor() { throw new Error('Cloud connections are disabled in PolyTrack Lab.'); } };
  const originalBeacon=navigator.sendBeacon?.bind(navigator);
  navigator.sendBeacon = (url,data) => {
    try { const target=new URL(url,location.href); return target.origin!==location.origin && allowed(target,'POST') && originalBeacon ? originalBeacon(url,data) : false; }
    catch { return false; }
  };
})();

/* The local finish ledger never rides along with a page measurement. */
