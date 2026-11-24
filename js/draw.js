/* draw.js — Dibuja botellas, latas, packs y licores en SVG (o usa la foto si existe). */
var Draw = (function () {
  var uid = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function shade(h, a) {
    var n = parseInt(String(h || '#888888').slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + a)), g = Math.max(0, Math.min(255, (n >> 8 & 255) + a)), b = Math.max(0, Math.min(255, (n & 255) + a));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function light(h) { var n = parseInt(String(h).slice(1), 16); return ((n >> 16) * .3 + (n >> 8 & 255) * .59 + (n & 255) * .11) > 170; }
  function lbl(p) { return esc((p.etiqueta || String(p.nombre || '').split(' ')[0] || '').toUpperCase().slice(0, 9)); }
  function t(x, y, s, size, w, fill, rot) {
    var long = s.length > 6 ? ' textLength="' + w + '" lengthAdjust="spacingAndGlyphs"' : '';
    return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" fill="' + fill + '"' + long + (rot ? ' transform="rotate(-90 ' + x + ' ' + y + ')"' : '') + '>' + s + '</text>';
  }
  function grad(id, c) {
    return '<linearGradient id="' + id + '" x1="0" x2="1"><stop offset="0" stop-color="' + shade(c, -45) + '"/><stop offset=".3" stop-color="' + shade(c, 35) + '"/><stop offset=".55" stop-color="' + c + '"/><stop offset="1" stop-color="' + shade(c, -60) + '"/></linearGradient>';
  }
  var drops = '<g fill="#fff" opacity=".55"><circle cx="20" cy="120" r="1.3"/><circle cx="38" cy="96" r="1"/><circle cx="24" cy="140" r=".9"/><circle cx="41" cy="132" r="1.4"/><circle cx="31" cy="150" r="1"/></g>';

  function botella(p, id) {
    var g = p.vidrio || '#5a2a0b', c = p.color, tc = light(c) ? '#1a1a1a' : '#fff';
    return '<defs>' + grad('g' + id, g) + '</defs>' +
      '<rect x="23.5" y="3" width="13" height="7" rx="1.5" fill="' + shade(c, 20) + '"/>' +
      '<path d="M25 10h10v20c0 10 13 17 13 33v87a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V63c0-16 13-23 13-33z" fill="url(#g' + id + ')"/>' +
      '<rect x="25" y="34" width="10" height="13" rx="1" fill="' + c + '"/>' +
      '<rect x="12" y="84" width="36" height="44" rx="3" fill="' + c + '"/>' +
      '<rect x="12" y="84" width="36" height="5" fill="' + shade(c, 40) + '" opacity=".6"/>' +
      t(30, 110, lbl(p), 8, 31, tc) +
      '<rect x="16" y="56" width="3.5" height="96" rx="1.7" fill="#fff" opacity=".28"/>' + drops;
  }
  function lata(p, id) {
    var c = p.color, tc = light(c) ? '#1a1a1a' : '#fff';
    return '<defs>' + grad('g' + id, c) + '<linearGradient id="m' + id + '" x1="0" x2="1"><stop offset="0" stop-color="#8b9399"/><stop offset=".4" stop-color="#f1f4f6"/><stop offset="1" stop-color="#6d757b"/></linearGradient></defs>' +
      '<path d="M12 56c0-4 4-6 6-6h24c2 0 6 2 6 6v94c0 4-4 7-6 7H18c-2 0-6-3-6-7z" fill="url(#g' + id + ')"/>' +
      '<path d="M14 50q16-7 32 0v6H14z" fill="url(#m' + id + ')"/><ellipse cx="30" cy="50" rx="15" ry="3.2" fill="#d5dade"/>' +
      '<rect x="12" y="148" width="36" height="6" fill="url(#m' + id + ')" opacity=".9"/>' +
      t(32, 104, lbl(p), 10, 70, tc, true) +
      '<rect x="17" y="60" width="3" height="84" rx="1.5" fill="#fff" opacity=".3"/>' + drops;
  }
  function pack(p, id) {
    var c = p.color, tc = light(c) ? '#1a1a1a' : '#fff', n = esc((p.etiqueta || 'x6').slice(0, 4));
    var cans = '';
    for (var i = 0; i < 3; i++) cans += '<rect x="' + (7 + i * 16) + '" y="66" width="14" height="22" rx="3" fill="url(#m' + id + ')"/><ellipse cx="' + (14 + i * 16) + '" cy="66" rx="7" ry="2" fill="#e3e7ea"/>';
    return '<defs>' + grad('g' + id, c) + '<linearGradient id="m' + id + '" x1="0" x2="1"><stop offset="0" stop-color="#8b9399"/><stop offset=".45" stop-color="#f1f4f6"/><stop offset="1" stop-color="#6d757b"/></linearGradient></defs>' +
      cans + '<path d="M3 84h54v66a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z" fill="url(#g' + id + ')"/>' +
      '<rect x="3" y="84" width="54" height="9" fill="' + shade(c, -30) + '"/>' +
      '<rect x="21" y="86" width="18" height="5" rx="2.5" fill="#000" opacity=".35"/>' +
      t(30, 128, n, 20, 40, tc) + t(30, 145, lbl(p), 7, 42, tc);
  }
  function licor(p, id) {
    var liq = p.color, glass = p.vidrio || '#cfe6ee', dark = !light(liq);
    return '<defs><linearGradient id="g' + id + '" x1="0" x2="1"><stop offset="0" stop-color="' + shade(liq, -40) + '"/><stop offset=".35" stop-color="' + shade(liq, 30) + '"/><stop offset="1" stop-color="' + shade(liq, -55) + '"/></linearGradient></defs>' +
      '<rect x="24" y="2" width="12" height="14" rx="2" fill="#1b1b1b"/>' +
      '<path d="M25.5 16h9v22c0 6 14 10 14 20v92a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V58c0-10 13.5-14 13.5-20z" fill="' + glass + '" opacity=".5"/>' +
      '<path d="M13 66h34v84a7 7 0 0 1-7 7H20a7 7 0 0 1-7-7z" fill="url(#g' + id + ')" opacity="' + (dark ? '.95' : '.75') + '"/>' +
      '<rect x="15" y="88" width="30" height="38" rx="2" fill="#f4efe2"/><rect x="15" y="88" width="30" height="4" fill="#b08a3a"/>' +
      t(30, 112, lbl(p), 7, 26, '#2a1b0e') +
      '<rect x="16" y="58" width="3" height="94" rx="1.5" fill="#fff" opacity=".35"/>';
  }
  function otro(p, id) {
    var c = p.color, tc = light(c) ? '#0d2233' : '#fff';
    return '<defs>' + grad('g' + id, c) + '</defs>' +
      '<path d="M14 40q16-10 32 0l4 104q0 12-12 12H22q-12 0-12-12z" fill="url(#g' + id + ')" opacity=".92"/>' +
      '<path d="M22 32h16l-2 10H24z" fill="' + shade(c, -40) + '"/>' +
      t(30, 104, lbl(p), 9, 30, tc) +
      '<rect x="17" y="52" width="3" height="90" rx="1.5" fill="#fff" opacity=".35"/>' + drops;
  }
  var F = { botella: botella, lata: lata, pack: pack, licor: licor, otro: otro };

  function product(p, cls) {
    if (p.imagen) return '<img class="' + (cls || '') + '" src="' + esc(p.imagen) + '" alt="' + esc(p.nombre) + '" loading="lazy" decoding="async">';
    var id = 'd' + (++uid);
    return '<svg class="' + (cls || '') + '" viewBox="0 0 60 160" role="img" aria-label="' + esc(p.nombre) + '">' + (F[p.forma] || botella)(p, id) + '</svg>';
  }

  return { product: product, esc: esc };
})();
