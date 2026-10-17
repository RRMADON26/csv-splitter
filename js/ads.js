/* Google AdSense loader.
   Does nothing until a real publisher ID is set (run tools/configure.py). Then it loads the
   AdSense script once and fills each .ad-slot the first time it becomes visible, which matters
   in this single-page app because slots inside hidden tool views have no width yet.
   Ads are never placed inside the loading sheet or next to download buttons. */
(function () {
  'use strict';

  // Ad unit IDs from your AdSense account (Ads > By ad unit). Leave a value empty to skip that
  // placement; Auto ads, if you turn them on in AdSense, still work with only the client ID.
  const SLOTS = {
    overview: 'SLOT_OVERVIEW',
    tool: 'SLOT_TOOL',
    article: 'SLOT_ARTICLE',
  };

  const meta = document.querySelector('meta[name="google-adsense-account"]');
  const client = meta ? meta.content.trim() : '';
  const configured = /^ca-pub-\d{10,20}$/.test(client);
  window.CSVAds = { configured, client };
  if (!configured) return;
  // only now is it true that the page shows ads: say so wherever the privacy copy mentions it
  const notes = () => {
    document.querySelectorAll('[data-ads-note]').forEach(e => { e.hidden = false; });
    document.querySelectorAll('[data-noads-note]').forEach(e => { e.hidden = true; });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', notes); else notes();

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);

  const slotId = name => { const v = SLOTS[name] || ''; return /^\d{6,}$/.test(v) ? v : ''; };

  function fill(el) {
    if (el.dataset.filled) return;
    const id = slotId(el.dataset.adSlot);
    if (!id || el.offsetWidth === 0) return;
    el.dataset.filled = '1';
    el.hidden = false;
    el.innerHTML = '<span class="ad-label">Advertisement</span>';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', client);
    ins.setAttribute('data-ad-slot', id);
    ins.setAttribute('data-ad-format', el.dataset.adFormat || 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    el.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* blocked or not ready */ }
  }

  // reveal slots that have an ID configured, then fill them once they are actually on screen
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { fill(en.target); if (en.target.dataset.filled) io.unobserve(en.target); } });
  }, { rootMargin: '200px' }) : null;

  function scan(root) {
    (root || document).querySelectorAll('.ad-slot:not([data-watched])').forEach(el => {
      if (!slotId(el.dataset.adSlot)) return;
      el.dataset.watched = '1';
      el.hidden = false;
      if (io) io.observe(el); else fill(el);
    });
  }
  window.CSVAds.scan = scan;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan());
  else scan();
  // the app adds slots when a tool is opened for the first time
  new MutationObserver(() => scan()).observe(document.documentElement, { childList: true, subtree: true });
})();
