/* Pure CSV helpers (no DOM). Usable in the browser (window.CSV) and in Node for tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CSV = factory();
})(this, function () {
  'use strict';

  /** Split a raw record (optionally ending in \n or \r\n) into fields. Quote-aware. */
  function parseRecord(rec, d) {
    let end = rec.length;
    if (end && rec.charCodeAt(end - 1) === 10) end--;
    if (end && rec.charCodeAt(end - 1) === 13) end--;
    if (rec.indexOf('"') === -1) return (end === rec.length ? rec : rec.slice(0, end)).split(d);
    const out = [];
    let i = 0;
    for (;;) {
      if (i < end && rec.charCodeAt(i) === 34) {
        let j = i + 1, val = '';
        for (;;) {
          const q = rec.indexOf('"', j);
          if (q === -1 || q >= end) { val += rec.slice(j, end); i = end; break; }
          val += rec.slice(j, q);
          if (q + 1 < end && rec.charCodeAt(q + 1) === 34) { val += '"'; j = q + 2; continue; }
          let k = rec.indexOf(d, q + 1);
          if (k === -1 || k > end) k = end;
          val += rec.slice(q + 1, k);
          i = k; break;
        }
        out.push(val);
      } else {
        const k = rec.indexOf(d, i);
        if (k === -1 || k >= end) { out.push(rec.slice(i, end)); i = end; }
        else { out.push(rec.slice(i, k)); i = k; }
      }
      if (i >= end) break;
      i++;
      if (i >= end) { out.push(''); break; }
    }
    return out;
  }

  function needsQuote(v, d) {
    return v.indexOf(d) !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1 || v.indexOf('\r') !== -1;
  }
  function formatField(v, d, quoteAll) {
    if (v == null) v = '';
    else if (typeof v !== 'string') v = String(v);
    return quoteAll || needsQuote(v, d) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  /** Fields -> one CSV line WITHOUT the line ending. */
  function formatRecord(fields, d, quoteAll) {
    let out = '';
    for (let i = 0; i < fields.length; i++) out += (i ? d : '') + formatField(fields[i], d, quoteAll);
    return out;
  }

  /** Quote-aware split of a text into raw records (each keeps its line ending). */
  function splitRecords(text, max) {
    const out = [];
    let start = 0, inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c === 34) inQ = !inQ;
      else if (c === 10 && !inQ) {
        out.push(text.slice(start, i + 1)); start = i + 1;
        if (max && out.length >= max) return out;
      }
    }
    if (start < text.length) out.push(text.slice(start));
    return out;
  }

  function countOutsideQuotes(rec, ch) {
    let n = 0, inQ = false;
    for (let i = 0; i < rec.length; i++) {
      const c = rec[i];
      if (c === '"') inQ = !inQ;
      else if (!inQ && c === ch) n++;
    }
    return n;
  }

  /** Guess the delimiter from a text sample. */
  function detectDelimiter(text) {
    const recs = splitRecords(text, 20).filter(r => r.trim() !== '');
    if (!recs.length) return ',';
    let best = ',', bestScore = -1;
    for (const c of [',', ';', '\t', '|']) {
      const counts = recs.map(r => countOutsideQuotes(r, c));
      const freq = new Map();
      counts.forEach(n => freq.set(n, (freq.get(n) || 0) + 1));
      let mode = 0, modeFreq = 0;
      freq.forEach((f, n) => { if (n > 0 && (f > modeFreq || (f === modeFreq && n > mode))) { mode = n; modeFreq = f; } });
      if (!mode) continue;
      const score = (modeFreq / recs.length) * 1000 + mode;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  /** Number of bytes `s` takes in UTF-8. */
  function utf8len(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xD800 && c < 0xDC00) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  return { parseRecord, formatField, formatRecord, splitRecords, detectDelimiter, utf8len };
});
