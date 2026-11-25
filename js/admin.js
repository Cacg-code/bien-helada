/* admin.js — Panel del negocio: resumen del mes, pedidos (con verificación de Yape), productos y ajustes. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = Draw.esc, VENTA = Core.VENTA;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var money = function (n) { return 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var money0 = function (n) { return 'S/ ' + Math.round(n || 0).toLocaleString('es-PE'); };
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  var MESL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var DIAL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var EST = { pendiente: 'Pendiente', pagado: 'Pagado', entregado: 'Entregado', cancelado: 'Cancelado' };
  var now0 = new Date();
  var S = { token: sessionStorage.getItem('bh_admin') || '', data: null, desde: '', tab: 'resumen', mes: new Date(now0.getFullYear(), now0.getMonth(), 1),
    pv: 'atender', hf: 'todos', q: '', shown: 40, pf: 'todos', pq: '', lastPend: null, anim: true };

  function toast(m, undo) {
    var t = $('#toast'); t.innerHTML = '<span>' + esc(m) + '</span>' + (undo ? '<button id="tUndo">Deshacer</button>' : '');
    t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, undo ? 5000 : 2200);
    if (undo) $('#tUndo').onclick = function () { t.classList.remove('on'); undo(); };
  }
  function call(a, d) {
    return API.call(a, Object.assign({ token: S.token }, d || {})).catch(function (e) {
      if (String(e.message) === 'AUTH') { logout(); throw new Error('Tu sesión venció, vuelve a entrar.'); }
      throw e;
    });
  }

  /* ---------- login ---------- */
  if (API.demo) $('#loginHint').innerHTML = 'Modo demo · clave: <b>admin123</b>';
  $('#loginForm').onsubmit = function (e) {
    e.preventDefault();
    var b = $('#loginForm button'); b.disabled = true; $('#loginErr').hidden = true;
    API.call('login', { clave: $('#pass').value }).then(function (r) {
      S.token = r.token; sessionStorage.setItem('bh_admin', r.token); start();
    }).catch(function (x) { $('#loginErr').textContent = x.message; $('#loginErr').hidden = false; $('#loginForm').classList.remove('shake'); void $('#loginForm').offsetWidth; $('#loginForm').classList.add('shake'); })
      .then(function () { b.disabled = false; });
  };
  function logout() { sessionStorage.removeItem('bh_admin'); S.token = ''; $('#app').hidden = true; $('#login').hidden = false; }
  $('#logout').onclick = logout;

  function start() {
    $('#login').hidden = true; $('#app').hidden = false; $('#demoBanner').hidden = !API.demo;
    fetchData().catch(function (e) { toast(e.message); });
    setInterval(function () { if (!document.hidden && S.token) fetchData(true); }, 60000);
  }

  /* ---------- fechas ---------- */
  function iso(d) { return d.toISOString(); }
  function day0(d) { d = new Date(d); d.setHours(0, 0, 0, 0); return d; }
  function addD(d, n) { d = new Date(d); d.setDate(d.getDate() + n); return d; }
  function mStart(d, k) { return new Date(d.getFullYear(), d.getMonth() + (k || 0), 1); }
  function fmtD(d) { return d.getDate() + ' ' + MES[d.getMonth()]; }
  function hora(d) { return new Date(d).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?a\.?\s?m\.?/i, ' am').replace(/\s?p\.?\s?m\.?/i, ' pm'); }
  function hl(h) { return (h % 12 || 12) + (h < 12 ? ' am' : ' pm'); }
  function ago(f) {
    var m = Math.round((Date.now() - new Date(f)) / 60000), d = new Date(f);
    if (m < 60) return 'hace ' + Math.max(1, m) + ' min';
    if (m < 60 * 12) return 'hace ' + Math.round(m / 60) + ' h';
    return DIA[d.getDay()] + ' ' + fmtD(d) + ', ' + hora(d);
  }

  /* ---------- datos ---------- */
  function isOpen(o) { return o.estado === 'pendiente' || o.estado === 'pagado'; }
  function needsYape(o) { return o.pago === 'yape' && o.estado === 'pendiente'; }
  function fetchData(silent, desde) {
    var r = $('#refresh'); r.classList.add('spin');
    var want = [desde, iso(mStart(S.mes, -1)), iso(mStart(new Date(), -1)), S.desde].filter(Boolean).sort()[0];
    S.desde = want;
    return call('adminDatos', { desde: S.desde }).then(function (d) {
      S.data = d; $('#brand').textContent = d.config.nombre; document.title = 'Panel · ' + d.config.nombre;
      var open = d.pedidos.filter(isOpen).length, pend = d.pedidos.filter(function (o) { return o.estado === 'pendiente'; }).length;
      if (silent && S.lastPend != null && pend > S.lastPend) { toast('🔔 ¡Nuevo pedido!'); if (navigator.vibrate) navigator.vibrate([80, 60, 80]); }
      S.lastPend = pend; $('#pendDot').hidden = !open; $('#pendDot').textContent = open;
      $('#sync').textContent = 'Actualizado ' + hora(new Date());
      var sp = $('#storePill'); sp.hidden = false; sp.className = 'store-pill ' + (d.config.abierto ? 'open' : 'closed'); sp.textContent = d.config.abierto ? 'Abierta' : 'Cerrada';
      S.anim = !silent;
      if (!silent || S.tab === 'resumen' || S.tab === 'pedidos') render();
    }).finally(function () { r.classList.remove('spin'); });
  }
  $('#refresh').onclick = function () { fetchData().catch(function (e) { toast(e.message); }); };
  $('#storePill').onclick = function () { $('[data-tab=ajustes]').click(); };

  function inR(o, a, b) { var t = new Date(o.fecha); return t >= a && t < b; }
  function stats(a, b) {
    var all = S.data.pedidos.filter(function (o) { return inR(o, a, b); });
    var s = { ventas: 0, gan: 0, n: 0, dia: {}, hora: new Array(24).fill(0), dow: new Array(7).fill(0), prod: {}, orig: {} };
    all.forEach(function (o) {
      var d = new Date(o.fecha);
      if (o.estado !== 'cancelado') s.hora[d.getHours()] += 1;
      if (!VENTA[o.estado]) return;
      s.n++; s.ventas += o.total; s.gan += o.ganancia; s.dow[d.getDay()] += o.total;
      var k = day0(d).getTime(), dd = s.dia[k] || (s.dia[k] = { v: 0, n: 0 }); dd.v += o.total; dd.n++;
      var og = o.origen || '', g = s.orig[og] || (s.orig[og] = { v: 0, n: 0 }); g.v += o.total; g.n++;
      o.items.forEach(function (i) {
        var p = s.prod[i.id] || (s.prod[i.id] = { id: i.id, nombre: i.nombre, u: 0, v: 0, g: 0 });
        p.u += i.cant; p.v += i.precio * i.cant; p.g += (i.precio - i.costo) * i.cant;
      });
    });
    s.ticket = s.n ? s.ventas / s.n : 0;
    return s;
  }

  /* ---------- render ---------- */
  function render() {
    if (!S.data) return;
    var v = $('#v-' + S.tab);
    ({ resumen: rResumen, pedidos: rPedidos, productos: rProductos, ajustes: rAjustes })[S.tab]();
    v.classList.toggle('anim', S.anim && !RM);
    if (S.anim && !RM) countUp(v);
    S.anim = false;
  }
  function countUp(root) {
    $$('[data-n]', root).forEach(function (el) {
      var to = +el.dataset.n, f = el.dataset.f, t0 = performance.now(), dur = 750;
      function fmt(x) { return f === 'm0' ? money0(x) : Math.round(x).toLocaleString('es-PE'); }
      (function tick(t) { var k = Math.min(1, (t - t0) / dur); el.textContent = fmt(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); })(t0);
    });
  }
  function panel(t, sub, body, cls) { return '<section class="panel ' + (cls || '') + '"><h3>' + t + '</h3>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + body + '</section>'; }
  function monthNav() {
    var now = new Date(), y = S.mes.getFullYear(), m = S.mes.getMonth(), cur = +S.mes === +mStart(now);
    var dim = new Date(y, m + 1, 0).getDate();
    return '<div class="mnav"><button class="ib" data-mon="-1" aria-label="Mes anterior">‹</button><div class="mnav-t"><b>' + MESL[m] + ' ' + y + '</b><small>' +
      (cur ? '<i class="live"></i>En curso · día ' + now.getDate() + ' de ' + dim : 'Mes cerrado') + '</small></div><button class="ib" data-mon="1" aria-label="Mes siguiente"' + (cur ? ' disabled' : '') + '>›</button></div>';
  }

  /* ---------- resumen (por mes) ---------- */
  function rResumen() {
    var now = new Date(), a = S.mes, b = mStart(S.mes, 1), live = now >= a && now < b;
    var s = stats(a, b), pa = mStart(S.mes, -1), pb = live ? new Date(Math.min(+a, +pa + (now - a))) : a, o = stats(pa, pb);
    var prods = S.data.productos, pmap = {}; prods.forEach(function (x) { pmap[x.id] = x; });
    var h = monthNav();

    // Para hacer ahora
    var open = S.data.pedidos.filter(isOpen), yp = open.filter(needsYape), del = open.filter(function (x) { return !needsYape(x); });
    var lowS = prods.filter(function (x) { return x.activo && typeof x.stock === 'number' && x.stock <= 5; });
    var sum = function (l) { return l.reduce(function (t, x) { return t + x.total; }, 0); };
    if (yp.length || del.length || lowS.length) {
      h += '<div class="todo"><h3>Para hacer ahora</h3><div class="todo-row">' +
        (yp.length ? '<button class="todo-i yape" data-gop="yape"><b>' + yp.length + '</b><span>' + (yp.length > 1 ? 'Yapes por verificar' : 'Yape por verificar') + '<small>' + money(sum(yp)) + ' por confirmar</small></span><em>›</em></button>' : '') +
        (del.length ? '<button class="todo-i del" data-gop="atender"><b>' + del.length + '</b><span>' + (del.length > 1 ? 'pedidos por entregar' : 'pedido por entregar') + '<small>' + money(sum(del)) + '</small></span><em>›</em></button>' : '') +
        (lowS.length ? '<button class="todo-i stock" data-gopr="low"><b>' + lowS.length + '</b><span>' + (lowS.length > 1 ? 'productos por acabarse' : 'producto por acabarse') + '<small>' + esc(lowS.slice(0, 2).map(function (x) { return x.nombre; }).join(', ')) + (lowS.length > 2 ? '…' : '') + '</small></span><em>›</em></button>' : '') +
        '</div></div>';
    } else h += '<div class="todo ok"><span>✓</span> Todo al día: no hay pedidos esperando.</div>';

    // KPIs
    var pn = MES[pa.getMonth()];
    h += '<div class="kpis">' +
      '<div class="kpi hero"><small>Vendiste</small><b data-n="' + s.ventas + '" data-f="m0">' + money0(s.ventas) + '</b>' + delta(s.ventas, o.ventas, pn, live) + '</div>' +
      '<div class="kpi"><small>Te quedó</small><b data-n="' + s.gan + '" data-f="m0">' + money0(s.gan) + '</b><p>ganancia, ya descontado lo que te costó la mercadería</p></div>' +
      '<div class="kpi"><small>Pedidos</small><b data-n="' + s.n + '">' + s.n + '</b><p>pagados o entregados' + (o.n ? ' · ' + o.n + ' en ' + pn + (live ? ' a esta fecha' : '') : '') + '</p></div>' +
      '<div class="kpi"><small>Cada cliente gasta</small><b data-n="' + s.ticket + '" data-f="m0">' + money0(s.ticket) + '</b><p>en promedio por pedido</p></div>' +
      '</div>';

    h += panel('Ventas de cada día', '', chartDays(s, a, b, live), 'c-days');
    h += '<div class="cols">' + panel('¿A qué hora te piden?', 'Pedidos que entraron en cada hora del mes', chartHours(s)) + panel('Lo más vendido', 'Unidades vendidas en el mes', topProds(s, pmap)) + '</div>';
    h += panel('¿De qué grupo llegan los pedidos?', '', groups(s));
    $('#v-resumen').innerHTML = h;
  }
  function delta(cur, prev, pn, live) {
    if (!prev) return '<span class="delta eq">Sin ventas en ' + pn + ' para comparar</span>';
    var d = (cur - prev) / prev * 100, c = Math.abs(d) < 1 ? 'eq' : d > 0 ? 'up' : 'down';
    return '<span class="delta ' + c + '">' + (c === 'eq' ? 'Igual que ' : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(0) + '% ' + (d > 0 ? 'más' : 'menos') + ' que ') + pn + (live ? ' a esta fecha' : '') + '</span>';
  }
  function chartDays(s, a, b, live) {
    var today = day0(new Date()), days = [], max = 0, tot = 0, past = 0;
    for (var d = new Date(a); d < b; d = addD(d, 1)) {
      var x = s.dia[d.getTime()] || { v: 0, n: 0 }, fut = live && d > today;
      days.push({ d: new Date(d), v: x.v, n: x.n, fut: fut }); max = Math.max(max, x.v);
      if (!fut) { tot += x.v; past++; }
    }
    if (!tot) return '<p class="empty">Aún no hay ventas este mes.</p>';
    var avg = tot / past, best = days.slice().sort(function (p, q) { return q.v - p.v; })[0];
    var bars = days.map(function (x, i) {
      var dw = x.d.getDay(), we = dw === 5 || dw === 6 || dw === 0;
      var rd = DIAL[dw] + ' ' + fmtD(x.d) + ' · <b>' + money(x.v) + '</b> · ' + x.n + (x.n === 1 ? ' pedido' : ' pedidos');
      return '<button class="dbar' + (we ? ' we' : '') + (x.fut ? ' fut' : '') + (+x.d === +today ? ' today' : '') + (x === best ? ' sel' : '') + '" style="--h:' + (x.v ? Math.max(.03, x.v / max).toFixed(3) : 0) + ';--i:' + i + '" data-rd="' + esc(rd) + '" aria-label="' + esc(rd.replace(/<\/?b>/g, '')) + '"><i></i><span>' + x.d.getDate() + '</span></button>';
    }).join('');
    // días fuertes
    var dws = s.dow.map(function (v, i) { return [i, v]; }).sort(function (p, q) { return q[1] - p[1]; }), tw = s.dow.reduce(function (t, v) { return t + v; }, 0);
    var pct = tw ? Math.round((dws[0][1] + dws[1][1]) / tw * 100) : 0;
    return '<div class="readout" id="readout">Mejor día: ' + DIAL[best.d.getDay()] + ' ' + fmtD(best.d) + ' · <b>' + money(best.v) + '</b> · ' + best.n + ' pedidos</div>' +
      '<div class="plot"><span class="ymax">' + money0(max) + '</span><div class="bars"><div class="avg" style="--f:' + (avg / max).toFixed(3) + '"><span>promedio ' + money0(avg) + ' al día</span></div>' + bars + '</div></div>' +
      '<div class="legend"><span><i class="c-ice"></i>Lun – jue</span><span><i class="c-amb"></i>Vie – dom</span><span class="tap">Toca una barra para ver el día</span></div>' +
      '<p class="insight">💡 Tus días fuertes son <b>' + DIAL[dws[0][0]] + ' y ' + DIAL[dws[1][0]] + '</b>: juntan el ' + pct + '% de lo que vendes.</p>';
  }
  function chartHours(s) {
    var order = []; for (var i = 6; i < 30; i++) order.push(i % 24);
    var first = -1, last = -1;
    order.forEach(function (hh, k) { if (s.hora[hh]) { if (first < 0) first = k; last = k; } });
    if (first < 0) return '<p class="empty">Aún no hay pedidos este mes.</p>';
    while (last - first < 7) { if (first > 0) first--; if (last - first < 7 && last < 23) last++; if (first === 0 && last === 23) break; }
    var hrs = order.slice(first, last + 1), max = Math.max.apply(null, hrs.map(function (x) { return s.hora[x]; })), peak = hrs.filter(function (x) { return s.hora[x] === max; })[0];
    var bars = hrs.map(function (x, k) {
      var n = s.hora[x];
      return '<div class="hbar' + (x === peak ? ' peak' : '') + '" style="--h:' + (n ? Math.max(.04, n / max).toFixed(3) : 0) + ';--i:' + k + '"><em>' + (n || '') + '</em><i></i><span>' + hl(x).replace(' ', '<br>') + '</span></div>';
    }).join('');
    return '<div class="hplot">' + bars + '</div><p class="insight">🕘 Hora pico: <b>' + hl(peak) + ' – ' + hl((peak + 1) % 24) + '</b> (' + max + ' pedidos). Publica en tus grupos una hora antes, a las <b>' + hl((peak + 23) % 24) + '</b>.</p>';
  }
  function topProds(s, pmap) {
    var list = Object.keys(s.prod).map(function (k) { return s.prod[k]; }).sort(function (p, q) { return q.u - p.u || q.v - p.v; }).slice(0, 5);
    if (!list.length) return '<p class="empty">Sin ventas aún.</p>';
    var mx = list[0].u;
    return '<ol class="rank">' + list.map(function (x, i) {
      var pr = pmap[x.id] || { nombre: x.nombre, forma: 'botella', color: '#888888' };
      return '<li style="--i:' + i + '"><span class="rk-n">' + (i + 1) + '</span>' + Draw.product(pr, 'art') + '<div class="rk-m"><b>' + esc(x.nombre) + '</b><div class="meter"><i style="--w:' + Math.max(4, x.u / mx * 100) + '%"></i></div></div><div class="rk-v"><b>' + x.u + ' u.</b><small>te dejó ' + money0(x.g) + '</small></div></li>';
    }).join('') + '</ol>';
  }
  function groups(s) {
    var keys = Object.keys(s.orig);
    if (!keys.length) return '<p class="empty">Sin pedidos aún.</p>';
    if (keys.length === 1 && keys[0] === '') return '<div class="hint-box">Todavía no usas links por grupo. Crea un link para cada grupo de WhatsApp y aquí verás cuál te compra más. <button class="btn-sm" data-gotab="ajustes">Crear links</button></div>';
    var arr = keys.map(function (k) { return [k, s.orig[k]]; }).sort(function (p, q) { return q[1].n - p[1].n; }), mx = arr[0][1].n;
    return '<div class="grp">' + arr.slice(0, 6).map(function (x, i) {
      var name = x[0] ? x[0].replace(/^grupo-/, 'Grupo ').replace(/-/g, ' ') : 'Sin link (directo)';
      return '<div class="g-row' + (x[0] ? '' : ' direct') + '" style="--i:' + i + '"><span>' + esc(name) + '</span><div class="meter"><i style="--w:' + Math.max(4, x[1].n / mx * 100) + '%"></i></div><b>' + x[1].n + ' <small>pedidos · ' + money0(x[1].v) + '</small></b></div>';
    }).join('') + '</div><p class="insight">Crea más links en <button class="lnk" data-gotab="ajustes">Ajustes → Links para grupos</button>.</p>';
  }

  /* ---------- pedidos ---------- */
  function rPedidos() {
    var all = S.data.pedidos, open = all.filter(isOpen), yp = open.filter(needsYape);
    var seg = function (k, t, n) { return '<button role="tab" data-pv="' + k + '" class="' + (S.pv === k ? 'on' : '') + (k === 'yape' && n ? ' hot' : '') + '">' + t + (n !== '' ? ' <b>' + n + '</b>' : '') + '</button>'; };
    var h = '<div class="seg" role="tablist">' + seg('atender', 'Por atender', open.length) + seg('yape', 'Verificar Yape', yp.length) + seg('historial', 'Historial', '') + '</div>';
    if (S.pv === 'historial') h += historial();
    else {
      var list = (S.pv === 'yape' ? yp : open).slice().sort(function (p, q) { return p.fecha < q.fecha ? -1 : 1; });
      if (S.pv === 'yape') h += '<div class="explain"><b>¿Cómo verifico?</b><ol><li>Abre tu Yape → <b>Movimientos</b>.</li><li>Busca un pago por el <b>monto</b> con el <b>código</b> del pedido en el mensaje.</li><li>Si está, toca <b>Sí llegó</b>. Si no, escríbele al cliente.</li></ol></div>';
      else if (list.length) h += '<p class="note">Del más antiguo al más nuevo. Atiende primero los de arriba.</p>';
      h += list.length ? '<div class="orders">' + list.map(orderCard).join('') + '</div>'
        : '<div class="empty-big"><span>' + (S.pv === 'yape' ? '💜' : '🎉') + '</span><b>' + (S.pv === 'yape' ? 'No hay Yapes por verificar' : 'Nada pendiente') + '</b><small>Los pedidos nuevos aparecen aquí solos.</small></div>';
    }
    $('#v-pedidos').innerHTML = h;
    var oq = $('#oq');
    if (oq) oq.oninput = function (e) { S.q = e.target.value; clearTimeout(rPedidos.t); rPedidos.t = setTimeout(function () { render(); var i = $('#oq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    if ($('#more')) $('#more').onclick = function () { S.shown += 40; render(); };
    if ($('#csv')) $('#csv').onclick = function () { csv(rPedidos.list || []); };
  }
  function telOf(o) { return o.telefono.length === 9 ? '51' + o.telefono : o.telefono; }
  function fmtTel(t) { return t.length === 9 ? t.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : t; }
  function wa(o, msg) { return 'https://wa.me/' + esc(telOf(o)) + '?text=' + encodeURIComponent(msg); }
  function orderCard(o, i) {
    var yp = needsYape(o), st = { pendiente: 0, pagado: 1, entregado: 2 }[o.estado], mins = (Date.now() - new Date(o.fecha)) / 60000, late = isOpen(o) && mins > 45;
    var nombre = S.data.config.nombre;
    var h = '<article class="order ' + o.estado + (yp ? ' needs-yape' : '') + '" style="--i:' + (i || 0) + '" data-oid="' + esc(o.id) + '">' +
      '<header class="o-head"><div><span class="o-code">' + esc(o.id) + '</span><span class="o-time' + (late ? ' late' : '') + '">' + (late ? '⏰ ' : '') + ago(o.fecha) + '</span></div><b class="o-total">' + money(o.total) + '</b></header>' +
      '<div class="o-who"><b>' + esc(o.cliente) + '</b><a href="tel:+' + esc(telOf(o)) + '">' + esc(fmtTel(o.telefono)) + '</a></div>';
    if (o.estado !== 'cancelado') h += '<ol class="steps s' + st + '"><li>Recibido</li><li>Pagado</li><li>Entregado</li></ol>';
    else h += '<div class="cancel-tag">Pedido cancelado · el stock volvió al inventario</div>';
    h += '<div class="o-where">' + (o.entrega === 'recojo' ? '🏪 <span>Recoge en tienda</span>' : '🛵 <span>' + esc(o.direccion) + (o.referencia ? ' · <i>' + esc(o.referencia) + '</i>' : '') + '</span><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(o.direccion + ' ' + (S.data.config.zona || '')) + '">Mapa</a>') + '</div>' +
      '<ul class="o-items">' + (o.items && o.items.length ? o.items.map(function (x) { return '<li><b>' + x.cant + '×</b> ' + esc(x.nombre) + '</li>'; }).join('') : '<li>' + esc(o.detalle) + '</li>') +
      (o.delivery ? '<li class="o-del">Delivery ' + money(o.delivery) + '</li>' : '') + '</ul>' +
      (o.nota ? '<p class="o-note">📝 ' + esc(o.nota) + '</p>' : '');
    if (yp) h += '<div class="verify"><div class="v-t">Busca este pago en tu Yape</div><div class="v-row"><div><small>Monto</small><b>' + money(o.total) + '</b></div><div><small>Código en el mensaje</small><b>' + esc(o.id) + '</b></div></div>' +
      '<div class="v-btns"><button class="btn btn-yape" data-act="pagado" data-id="' + esc(o.id) + '">✓ Sí llegó</button><a class="btn btn-ghost" target="_blank" rel="noopener" href="' + wa(o, 'Hola ' + o.cliente + ', te escribimos de ' + nombre + '. Aún no vemos tu Yape del pedido ' + o.id + ' por ' + money(o.total) + '. ¿Nos envías la captura? 🙏') + '">No llegó · escribirle</a></div></div>';
    else if (o.estado === 'pendiente') h += '<p class="o-pay wa">💬 Paga al coordinar por WhatsApp o al recibir</p>';
    else if (o.estado === 'pagado') h += '<p class="o-pay ok">✓ Pago confirmado' + (o.pago === 'yape' ? ' por Yape' : '') + '</p>';
    h += '<div class="o-actions">';
    if (o.estado === 'pendiente' && !yp) h += '<button class="btn btn-go" data-act="entregado" data-id="' + esc(o.id) + '">✓ Entregado y cobrado</button>';
    if (o.estado === 'pagado') h += '<button class="btn btn-go" data-act="entregado" data-id="' + esc(o.id) + '">✓ Marcar entregado</button>';
    h += '<a class="ib wa-b" target="_blank" rel="noopener" href="' + wa(o, 'Hola ' + o.cliente + ', te escribimos de ' + nombre + ' por tu pedido ' + o.id + ' (' + money(o.total) + ').') + '" aria-label="Escribir por WhatsApp" title="WhatsApp"><svg viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/></svg></a>';
    if (isOpen(o)) h += '<button class="lnk danger" data-act="cancelado" data-id="' + esc(o.id) + '">Cancelar</button>';
    return h + '</div></article>';
  }
  function historial() {
    var a = S.mes, b = mStart(S.mes, 1), q = S.q.toLowerCase();
    var all = S.data.pedidos.filter(function (o) { return inR(o, a, b) && !isOpen(o); }), cnt = { todos: all.length, entregado: 0, cancelado: 0 };
    all.forEach(function (o) { cnt[o.estado] = (cnt[o.estado] || 0) + 1; });
    var list = all.filter(function (o) { return (S.hf === 'todos' || o.estado === S.hf) && (!q || (o.id + ' ' + o.cliente + ' ' + o.telefono + ' ' + o.detalle + ' ' + o.direccion).toLowerCase().indexOf(q) >= 0); })
      .sort(function (p, r) { return p.fecha < r.fecha ? 1 : -1; });
    rPedidos.list = list;
    var h = monthNav() + '<div class="toolbar"><input id="oq" type="search" placeholder="Buscar código, nombre o celular…" value="' + esc(S.q) + '"><div class="chips">' +
      [['todos', 'Todos'], ['entregado', 'Entregados'], ['cancelado', 'Cancelados']].map(function (k) { return '<button data-hf="' + k[0] + '" class="' + (S.hf === k[0] ? 'on' : '') + '">' + k[1] + ' <b>' + (cnt[k[0]] || 0) + '</b></button>'; }).join('') + '</div></div>';
    if (!list.length) return h + '<div class="empty-big"><span>🗂️</span><b>No hay pedidos aquí</b></div>';
    var lastDay = '', html = '';
    list.slice(0, S.shown).forEach(function (o, i) {
      var d = new Date(o.fecha), key = day0(d).getTime();
      if (key !== lastDay) {
        lastDay = key; var tday = list.filter(function (x) { return day0(new Date(x.fecha)).getTime() === key && x.estado !== 'cancelado'; }).reduce(function (t, x) { return t + x.total; }, 0);
        html += '<div class="day-h"><span>' + DIAL[d.getDay()] + ' ' + fmtD(d) + '</span><b>' + money(tday) + '</b></div>';
      }
      var n = o.items ? o.items.reduce(function (t, x) { return t + x.cant; }, 0) : 0;
      html += '<button class="hrow ' + o.estado + '" data-open="' + esc(o.id) + '" style="--i:' + Math.min(i, 20) + '"><span class="h-who"><b>' + esc(o.cliente) + '</b><small>' + esc(o.id) + ' · ' + hora(d) + ' · ' + n + ' u. · ' + (o.pago === 'yape' ? 'Yape' : 'WhatsApp') + '</small></span><span class="h-r"><b>' + money(o.total) + '</b><i>' + EST[o.estado] + '</i></span></button>';
    });
    h += '<div class="hist">' + html + '</div>';
    if (list.length > S.shown) h += '<button class="btn btn-ghost more" id="more">Ver más (' + (list.length - S.shown) + ')</button>';
    return h + '<button class="btn btn-ghost more" id="csv">⬇ Descargar Excel del mes</button>';
  }
  function openOrder(id) {
    var o = S.data.pedidos.filter(function (x) { return x.id === id; })[0]; if (!o) return;
    modal('<div class="m-head"><h3>Pedido ' + esc(o.id) + '</h3><button class="ib" data-mclose aria-label="Cerrar">✕</button></div>' + orderCard(o, 0) +
      '<div class="m-states"><small>Cambiar estado a:</small><div>' + ['pendiente', 'pagado', 'entregado', 'cancelado'].filter(function (k) { return k !== o.estado; }).map(function (k) {
        return '<button class="btn-sm" data-act="' + k + '" data-id="' + esc(o.id) + '">' + EST[k] + '</button>';
      }).join('') + '</div></div>');
  }
  function setEstado(id, est, ok) {
    var o = S.data.pedidos.filter(function (x) { return x.id === id; })[0]; if (!o || o.estado === est) return;
    if (est === 'cancelado' && !ok) return confirmBox('¿Cancelar el pedido ' + id + ' de ' + o.cliente + '? El stock vuelve al inventario.', function () { setEstado(id, est, true); });
    var prev = o.estado, el = $('#v-pedidos [data-oid="' + id + '"]');
    if (!$('#modal').hidden) closeModal();
    var apply = function () { o.estado = est; render(); };
    if (el && !RM) { el.classList.add('leaving'); setTimeout(apply, 260); } else apply();
    call('actualizarPedido', { id: id, estado: est }).then(function () {
      var msg = { pagado: '💜 Pago confirmado · ' + id, entregado: '✓ ' + id + ' entregado', cancelado: id + ' cancelado', pendiente: id + ' volvió a pendiente' }[est];
      toast(msg, ok === 'undo' ? null : function () { setEstado(id, prev, 'undo'); });
      fetchData(true);
    }).catch(function (e) { o.estado = prev; render(); toast(e.message); });
  }
  function csv(list) {
    var rows = [['Código', 'Fecha', 'Estado', 'Cliente', 'Celular', 'Entrega', 'Dirección', 'Pago', 'Origen', 'Detalle', 'Subtotal', 'Delivery', 'Total', 'Costo', 'Ganancia']];
    list.forEach(function (o) { rows.push([o.id, new Date(o.fecha).toLocaleString('es-PE'), o.estado, o.cliente, o.telefono, o.entrega, o.direccion, o.pago, o.origen, o.detalle, o.subtotal, o.delivery, o.total, o.costo, o.ganancia]); });
    var txt = '﻿' + rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = 'pedidos-' + S.mes.getFullYear() + '-' + ('0' + (S.mes.getMonth() + 1)).slice(-2) + '.csv'; a.click();
  }

  /* ---------- productos ---------- */
  function tracked(p) { return typeof p.stock === 'number'; }
  function rProductos() {
    var ps = S.data.productos, now = new Date(), s = stats(mStart(now), mStart(now, 1)), q = S.pq.toLowerCase();
    var isLow = function (p) { return p.activo && tracked(p) && p.stock <= 5; };
    var cnt = { todos: ps.length, low: ps.filter(isLow).length, off: ps.filter(function (p) { return !p.activo; }).length, cero: ps.filter(function (p) { return p.activo && !s.prod[p.id]; }).length };
    var F = { todos: function () { return true; }, low: isLow, off: function (p) { return !p.activo; }, cero: function (p) { return p.activo && !s.prod[p.id]; } };
    var list = ps.filter(function (p) { return F[S.pf](p) && (!q || (p.nombre + ' ' + p.categoria + ' ' + p.presentacion).toLowerCase().indexOf(q) >= 0); });
    var h = '<div class="toolbar"><input id="pq" type="search" placeholder="Buscar producto…" value="' + esc(S.pq) + '"><div class="chips">' +
      [['todos', 'Todos'], ['low', 'Por acabarse'], ['cero', 'Sin ventas este mes'], ['off', 'Ocultos']].map(function (k) { return '<button data-pf="' + k[0] + '" class="' + (S.pf === k[0] ? 'on' : '') + (k[0] === 'low' && cnt.low ? ' warn' : '') + '">' + k[1] + ' <b>' + cnt[k[0]] + '</b></button>'; }).join('') + '</div></div>';
    if (S.pf === 'cero' && list.length) h += '<p class="note">No se vendieron este mes. Prueba ponerlos como destacados o en promo.</p>';
    var cats = [], by = {};
    list.forEach(function (p) { if (!by[p.categoria]) { by[p.categoria] = []; cats.push(p.categoria); } by[p.categoria].push(p); });
    var i = 0;
    h += list.length ? cats.map(function (c) {
      return '<h4 class="cat-h">' + esc(c) + ' <span>' + by[c].length + '</span></h4><div class="plist">' + by[c].map(function (p) {
        var low = isLow(p), sold = s.prod[p.id] ? s.prod[p.id].u : 0;
        var stk = !tracked(p) ? '<span class="stk none">Sin control de stock</span>' : '<span class="stk ' + (p.stock === 0 ? 'out' : low ? 'low' : 'ok') + '">' + (p.stock === 0 ? 'Agotado' : 'Quedan ' + p.stock) + '</span>';
        return '<button class="prow' + (p.activo ? '' : ' off') + '" data-edit="' + esc(p.id) + '" style="--i:' + Math.min(i++, 24) + '"><span class="p-art">' + Draw.product(p, 'art') + '</span>' +
          '<span class="p-main"><b>' + esc(p.nombre) + '</b><small>' + esc(p.presentacion) + '</small><span class="p-tags">' + (p.destacado ? '<i class="t-hot">🔥 Destacado</i>' : '') + (p.activo ? '' : '<i class="t-off">Oculto</i>') + '</span></span>' +
          '<span class="p-side"><b>' + money(p.precio) + '</b><small>ganas ' + money(p.precio - p.costo) + '</small></span>' +
          '<span class="p-foot">' + stk + '<span class="sold">' + (sold ? sold + ' vendidos este mes' : 'sin ventas este mes') + '</span></span></button>';
      }).join('') + '</div>';
    }).join('') : '<div class="empty-big"><span>🍺</span><b>No hay productos aquí</b></div>';
    h += '<button class="fab" id="newP">+ Producto</button>';
    $('#v-productos').innerHTML = h;
    $('#pq').oninput = function (e) { S.pq = e.target.value; clearTimeout(rProductos.t); rProductos.t = setTimeout(function () { render(); var x = $('#pq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 200); };
    $('#newP').onclick = function () { editP({ id: '', nombre: '', categoria: 'Cervezas', forma: 'botella', presentacion: '', precio: '', costo: '', stock: '', color: '#1f6b3a', vidrio: '', etiqueta: '', imagen: '', activo: true, destacado: false, orden: ps.length + 1, descripcion: '' }); };
  }
  function fl(lbl, inner, hint) { return '<div class="fl"><label>' + lbl + '</label>' + inner + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>'; }
  function sw(name, on, t, sub) { return '<label class="sw"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '><span class="sw-ui"></span><span class="sw-t"><b>' + t + '</b><small>' + sub + '</small></span></label>'; }
  function editP(p) {
    var cats = []; S.data.productos.forEach(function (x) { if (cats.indexOf(x.categoria) < 0) cats.push(x.categoria); });
    modal('<div class="m-head"><h3>' + (p.id ? 'Editar producto' : 'Nuevo producto') + '</h3><button class="ib" data-mclose aria-label="Cerrar">✕</button></div>' +
      '<form class="form" id="pf"><div class="preview" id="pprev"></div>' +
      '<fieldset><legend><i>1</i>Qué es</legend>' +
      fl('Nombre', '<input name="nombre" required maxlength="60" value="' + esc(p.nombre) + '" placeholder="Ej.: Pilsen Callao">') +
      '<div class="f2">' + fl('Presentación', '<input name="presentacion" maxlength="30" value="' + esc(p.presentacion) + '" placeholder="620 ml, x6…">') +
      fl('Categoría', '<input name="categoria" list="catl" value="' + esc(p.categoria) + '"><datalist id="catl">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>') + '</div>' +
      fl('Descripción corta (opcional)', '<textarea name="descripcion" maxlength="160" placeholder="Se muestra en la tienda">' + esc(p.descripcion) + '</textarea>') + '</fieldset>' +
      '<fieldset><legend><i>2</i>Precio y stock</legend><div class="f2">' +
      fl('Precio de venta (S/)', '<input name="precio" type="number" inputmode="decimal" step="0.1" min="0" required value="' + p.precio + '">') +
      fl('Te cuesta (S/)', '<input name="costo" type="number" inputmode="decimal" step="0.1" min="0" value="' + p.costo + '">') + '</div>' +
      '<div class="gain" id="mg"></div>' +
      fl('Stock (unidades que tienes)', '<input name="stock" type="number" inputmode="numeric" min="0" value="' + p.stock + '" placeholder="Vacío = no controlar">', 'Se descuenta solo con cada pedido. Te avisamos cuando queden 5 o menos.') + '</fieldset>' +
      '<fieldset><legend><i>3</i>Foto</legend>' +
      '<label class="drop"><input type="file" accept="image/*" id="pimg"><span>📷 ' + (p.imagen ? 'Cambiar foto' : 'Subir foto del producto') + '</span><small>Mejor PNG con fondo transparente. Se achica sola.</small></label>' +
      '<button type="button" class="lnk danger" id="pimgDel"' + (p.imagen ? '' : ' hidden') + '>Quitar foto y usar dibujo</button>' +
      '<details class="adv"><summary>Sin foto: personalizar el dibujo</summary><div class="f2">' +
      fl('Forma', '<select name="forma">' + ['botella', 'lata', 'pack', 'licor', 'otro'].map(function (k) { return '<option' + (p.forma === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>') +
      fl('Texto etiqueta', '<input name="etiqueta" maxlength="10" value="' + esc(p.etiqueta) + '" placeholder="PILSEN">') + '</div><div class="f2">' +
      fl('Color', '<input name="color" type="color" value="' + esc(p.color || '#c9a13b') + '">') +
      fl('Color del vidrio', '<input name="vidrio" type="color" value="' + esc(p.vidrio || '#5a2a0b') + '">', 'Solo botella o licor') + '</div></details></fieldset>' +
      '<fieldset><legend><i>4</i>En la tienda</legend>' +
      sw('activo', p.activo, 'Visible en la tienda', 'Apágalo para ocultarlo sin borrarlo') +
      sw('destacado', p.destacado, '🔥 Destacado', 'Sale primero en la exhibidora') +
      '<details class="adv"><summary>Posición en la lista</summary>' + fl('Orden', '<input name="orden" type="number" inputmode="numeric" value="' + p.orden + '">', 'Número menor = sale antes') + '</details></fieldset>' +
      '<div id="pErr"></div>' +
      '<div class="m-foot">' + (p.id ? '<button type="button" class="btn btn-danger" id="pDel">Eliminar</button>' : '<button type="button" class="btn btn-ghost" data-mclose>Cancelar</button>') + '<button class="btn btn-amber" type="submit">Guardar</button></div></form>');
    var form = $('#pf'), img = p.imagen;
    function cur() {
      var x = {}; ['nombre', 'categoria', 'presentacion', 'precio', 'costo', 'stock', 'orden', 'forma', 'etiqueta', 'color', 'vidrio', 'descripcion'].forEach(function (k) { x[k] = form[k].value; });
      x.destacado = form.destacado.checked; x.activo = form.activo.checked; x.imagen = img; x.id = p.id;
      if (x.forma !== 'botella' && x.forma !== 'licor') x.vidrio = ''; else if (x.forma === 'botella' && x.vidrio === '#5a2a0b') x.vidrio = '';
      return x;
    }
    function upd() {
      var x = cur(), pr = +x.precio, co = +x.costo;
      $('#pprev').innerHTML = '<span class="pv-art">' + Draw.product(Object.assign({}, x, { precio: pr }), 'art') + '</span><div><b>' + esc(x.nombre || 'Nombre del producto') + '</b><small>' + esc(x.presentacion || 'presentación') + '</small><strong>' + money(pr) + '</strong></div>';
      $('#mg').innerHTML = pr ? (pr - co >= 0 ? 'Ganas <b>' + money(pr - co) + '</b> por unidad <span>(' + Math.round((pr - co) / pr * 100) + '% del precio)</span>' : '<b class="neg">⚠ Pierdes ' + money(co - pr) + ' por unidad</b>') : 'Pon el precio para ver cuánto ganas';
    }
    form.addEventListener('input', upd); upd();
    $('#pimg').onchange = function (e) {
      var file = e.target.files[0]; if (!file) return;
      shrink(file, 220, 'image/webp').then(function (u) { img = u; $('#pimgDel').hidden = false; upd(); }).catch(function (x) { toast(x.message); });
    };
    $('#pimgDel').onclick = function () { img = ''; $('#pimg').value = ''; $('#pimgDel').hidden = true; upd(); };
    if ($('#pDel')) $('#pDel').onclick = function () {
      confirmBox('¿Eliminar ' + p.nombre + '? Si solo quieres que no se vea, apaga "Visible". Los pedidos antiguos se conservan.', function () {
        call('eliminarProducto', { id: p.id }).then(function () { toast('Eliminado'); fetchData(); }).catch(function (e) { toast(e.message); });
      });
    };
    form.onsubmit = function (e) {
      e.preventDefault();
      var b = form.querySelector('[type=submit]'); b.disabled = true;
      call('guardarProducto', { producto: cur() }).then(function () { toast('Guardado ✓'); closeModal(); return fetchData(); })
        .catch(function (x) { $('#pErr').innerHTML = '<div class="err">' + esc(x.message) + '</div>'; }).then(function () { b.disabled = false; });
    };
  }
  function shrink(file, max, type) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () {
        var im = new Image();
        im.onload = function () {
          var size = max;
          for (var tries = 0; tries < 5; tries++) {
            var k = Math.min(1, size / Math.max(im.width, im.height)), c = document.createElement('canvas');
            c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            var u = c.toDataURL(type, .82);
            if (u.length < 45000) return res(u);
            size = Math.round(size * .78);
          }
          rej(new Error('La imagen es muy pesada, prueba con otra.'));
        };
        im.onerror = function () { rej(new Error('No se pudo leer la imagen.')); };
        im.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  /* ---------- ajustes ---------- */
  function rAjustes() {
    var c = S.data.config, base = location.href.replace(/admin\.html.*$/, '');
    var card = function (ico, t, sub, body) { return '<section class="card"><header><span class="c-ico">' + ico + '</span><div><h3>' + t + '</h3><p>' + sub + '</p></div></header>' + body + '</section>'; };
    var h = '<form id="cf" class="set-grid">' +
      '<section class="card open-card' + (c.abierto ? ' is-open' : '') + '" id="openCard">' + sw('abierto', c.abierto, c.abierto ? 'Tienda abierta' : 'Tienda cerrada', c.abierto ? 'Recibiendo pedidos ahora' : 'Los clientes ven la tienda pero no pueden pedir') +
      fl('Aviso arriba de la tienda (opcional)', '<input name="aviso" maxlength="140" value="' + esc(c.aviso) + '" placeholder="Ej.: ¡Promo! Six pack a S/ 23 solo hoy">') + '</section>' +
      card('🏪', 'Tu tienda', 'Lo que ven tus clientes', fl('Nombre', '<input name="nombre" maxlength="40" value="' + esc(c.nombre) + '">') +
        fl('Frase', '<input name="slogan" maxlength="90" value="' + esc(c.slogan) + '">') +
        fl('Horario', '<input name="horario" maxlength="80" value="' + esc(c.horario) + '">') +
        fl('Zona de reparto', '<input name="zona" maxlength="120" value="' + esc(c.zona) + '">')) +
      card('🛵', 'Delivery y mínimo', '<span id="delSum"></span>', '<div class="f2">' + fl('Costo delivery (S/)', '<input name="costoDelivery" type="number" step="0.5" min="0" inputmode="decimal" value="' + c.costoDelivery + '">') +
        fl('Gratis desde (S/)', '<input name="deliveryGratisDesde" type="number" step="1" min="0" inputmode="decimal" value="' + c.deliveryGratisDesde + '">', '0 = nunca gratis') + '</div>' +
        fl('Pedido mínimo (S/)', '<input name="pedidoMinimo" type="number" step="1" min="0" inputmode="decimal" value="' + c.pedidoMinimo + '">')) +
      card('💜', 'Cobros', 'Cómo te pagan', fl('Formas de pago en la web', '<select name="modoPago"><option value="ambos"' + (c.modoPago === 'ambos' ? ' selected' : '') + '>Yape y WhatsApp (el cliente elige)</option><option value="yape"' + (c.modoPago === 'yape' ? ' selected' : '') + '>Solo Yape</option><option value="whatsapp"' + (c.modoPago === 'whatsapp' ? ' selected' : '') + '>Solo WhatsApp</option></select>') +
        fl('WhatsApp del negocio', '<input name="whatsapp" type="tel" inputmode="numeric" value="' + esc(c.whatsapp) + '">', 'Con 51 adelante. Ej.: 51987654321') +
        '<div class="f2">' + fl('Número Yape', '<input name="yapeNumero" type="tel" inputmode="numeric" value="' + esc(c.yapeNumero) + '">') +
        fl('Titular Yape', '<input name="yapeNombre" maxlength="60" value="' + esc(c.yapeNombre) + '">', 'Como sale en Yape') + '</div>' +
        fl('QR de Yape', '<div class="qr-row"><img class="qrprev" id="qrp" src="' + esc(c.yapeQR || '') + '" alt="QR"' + (c.yapeQR ? '' : ' hidden') + '><div><label class="drop sm"><input type="file" accept="image/*" id="qrf"><span>Subir QR</span></label><button type="button" class="lnk danger" id="qrDel"' + (c.yapeQR ? '' : ' hidden') + '>Quitar QR</button></div></div>', 'En Yape: Mi QR → Descargar, y sube esa imagen.') +
        '<details class="adv"><summary>Código de los pedidos</summary>' + fl('Prefijo', '<input name="prefijo" maxlength="5" value="' + esc(c.prefijo) + '">', 'Así se verán: ' + esc(c.prefijo) + '-0001') + '</details>') +
      '<div id="cErr"></div>' +
      '<div class="savebar" id="saveBar" hidden><span>Cambios sin guardar</span><button type="button" class="btn btn-ghost" id="cUndo">Descartar</button><button class="btn btn-amber" type="submit">Guardar</button></div>' +
      '</form><div class="set-grid">' +
      card('🔗', 'Links para grupos', 'Un link por grupo de WhatsApp: en Resumen verás cuál vende más', '<div class="linkgen"><input id="lg" placeholder="Nombre del grupo, ej.: vecinos mz b"><button class="btn-sm" id="lgb">Crear link</button></div><div id="lgo"></div>') +
      (API.demo ? '' : card('🔒', 'Seguridad', 'Cambia la clave del panel', '<div class="linkgen"><input id="np" type="password" placeholder="Nueva clave (mín. 6)" autocomplete="new-password"><button class="btn-sm" id="npb">Cambiar</button></div>')) +
      '</div>';
    $('#v-ajustes').innerHTML = h;
    var qr = c.yapeQR, form = $('#cf');
    function delSum() {
      var cd = +form.costoDelivery.value, g = +form.deliveryGratisDesde.value, m = +form.pedidoMinimo.value;
      $('#delSum').textContent = 'Delivery ' + (cd ? money0(cd) : 'gratis') + (cd && g ? ' · gratis desde ' + money0(g) : '') + (m ? ' · mínimo ' + money0(m) : ' · sin mínimo');
    }
    delSum();
    var dirty = function () { $('#saveBar').hidden = false; delSum(); };
    form.addEventListener('input', function (e) { if (e.target.name !== 'abierto') dirty(); });
    form.abierto.onchange = function () { save(true); };
    $('#cUndo').onclick = function () { rAjustes(); };
    $('#qrf').onchange = function (e) { var f = e.target.files[0]; if (f) shrink(f, 380, 'image/png').then(function (u) { qr = u; $('#qrp').src = u; $('#qrp').hidden = false; $('#qrDel').hidden = false; dirty(); }).catch(function (x) { toast(x.message); }); };
    $('#qrDel').onclick = function () { qr = ''; $('#qrp').hidden = true; $('#qrDel').hidden = true; dirty(); };
    function save(onlyOpen) {
      var x = Object.assign({}, c);
      if (onlyOpen) x.abierto = form.abierto.checked;
      else {
        ['nombre', 'slogan', 'horario', 'zona', 'aviso', 'costoDelivery', 'deliveryGratisDesde', 'pedidoMinimo', 'prefijo', 'modoPago', 'whatsapp', 'yapeNumero', 'yapeNombre'].forEach(function (k) { x[k] = form[k].value; });
        x.abierto = form.abierto.checked; x.yapeQR = qr;
        if (String(x.whatsapp).replace(/\D/g, '').length < 11) { $('#cErr').innerHTML = '<div class="err">El WhatsApp debe llevar 51 + 9 dígitos.</div>'; return; }
      }
      call('guardarConfig', { config: x }).then(function (r) {
        var keepDirty = onlyOpen && !$('#saveBar').hidden;
        S.data.config = r; c = r; $('#cErr').innerHTML = ''; $('#brand').textContent = r.nombre;
        toast(onlyOpen ? (r.abierto ? '🟢 Tienda abierta' : '🔴 Tienda cerrada') : 'Ajustes guardados ✓');
        var sp = $('#storePill'); sp.className = 'store-pill ' + (r.abierto ? 'open' : 'closed'); sp.textContent = r.abierto ? 'Abierta' : 'Cerrada';
        var oc = $('#openCard'); oc.classList.toggle('is-open', r.abierto); $('.sw-t b', oc).textContent = r.abierto ? 'Tienda abierta' : 'Tienda cerrada';
        $('.sw-t small', oc).textContent = r.abierto ? 'Recibiendo pedidos ahora' : 'Los clientes ven la tienda pero no pueden pedir';
        if (!keepDirty) $('#saveBar').hidden = true;
      }).catch(function (er) { $('#cErr').innerHTML = '<div class="err">' + esc(er.message) + '</div>'; });
    }
    form.onsubmit = function (e) { e.preventDefault(); save(false); };
    $('#lgb').onclick = function () {
      var g = $('#lg').value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
      if (!g) return;
      var link = base + '?ref=grupo-' + g.replace(/^grupo-/, '');
      $('#lgo').innerHTML = '<div class="out-link">' + esc(link) + '</div><button class="btn-sm" id="lgc">Copiar link</button>';
      $('#lgc').onclick = function () { navigator.clipboard.writeText(link).then(function () { toast('Link copiado ✓ pégalo en el grupo'); }); };
    };
    if ($('#npb')) $('#npb').onclick = function () {
      call('cambiarClave', { nueva: $('#np').value }).then(function () { toast('Clave cambiada ✓'); $('#np').value = ''; }).catch(function (e) { toast(e.message); });
    };
  }

  /* ---------- modal ---------- */
  function modal(html) { $('#modalCard').innerHTML = html; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal() { $('#modal').hidden = true; document.body.style.overflow = ''; }
  function confirmBox(msg, ok) {
    modal('<div class="m-head"><h3>¿Seguro?</h3></div><p>' + esc(msg) + '</p><div class="m-foot"><button class="btn btn-ghost" data-mclose>No</button><button class="btn btn-danger" id="cOk">Sí, continuar</button></div>');
    $('#cOk').onclick = function () { closeModal(); ok(); };
  }
  $('#modal').onclick = function (e) { if (e.target.id === 'modal' || e.target.closest('[data-mclose]')) closeModal(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

  /* ---------- eventos ---------- */
  function goTab(tab) {
    S.tab = tab; $$('#tabs button').forEach(function (x) { x.classList.toggle('on', x.dataset.tab === tab); });
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'v-' + tab; });
    $('#tabTitle').textContent = $('#tabs [data-tab=' + tab + '] span').textContent; scrollTo(0, 0); S.anim = true; render();
  }
  $('#tabs').onclick = function (e) { var b = e.target.closest('button'); if (b) goTab(b.dataset.tab); };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-pv],[data-hf],[data-pf],[data-edit],[data-gop],[data-gopr],[data-gotab],[data-mon],[data-open],[data-rd]');
    if (!t) return;
    var d = t.dataset;
    if (d.act) setEstado(d.id, d.act);
    else if (d.pv) { S.pv = d.pv; S.shown = 40; S.anim = true; render(); }
    else if (d.hf) { S.hf = d.hf; S.shown = 40; S.anim = true; render(); }
    else if (d.pf) { S.pf = d.pf; S.anim = true; render(); }
    else if (d.edit) { var p = S.data.productos.filter(function (x) { return x.id === d.edit; })[0]; if (p) editP(p); }
    else if (d.gop) { S.pv = d.gop; goTab('pedidos'); }
    else if (d.gopr) { S.pf = d.gopr; goTab('productos'); }
    else if (d.gotab) goTab(d.gotab);
    else if (d.open) openOrder(d.open);
    else if (d.mon) {
      var nm = mStart(S.mes, +d.mon); if (nm > new Date()) return;
      S.mes = nm; S.shown = 40; S.anim = true;
      if (iso(mStart(nm, -1)) < S.desde) fetchData(false, iso(mStart(nm, -1))).catch(function (er) { toast(er.message); }); else render();
    } else if (d.rd) {
      $$('.bars .dbar.sel').forEach(function (x) { x.classList.remove('sel'); }); t.classList.add('sel'); $('#readout').innerHTML = d.rd;
    }
  });
  $('#resetDemo').onclick = function () { API.resetDemo(); location.reload(); };

  if (S.token) start();
})();
