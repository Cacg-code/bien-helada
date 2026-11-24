/* admin.js — Panel del negocio: resumen, pedidos, productos y ajustes. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = Draw.esc, VENTA = Core.VENTA;
  var money = function (n) { return 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var S = { token: sessionStorage.getItem('bh_admin') || '', data: null, desde: '', tab: 'resumen', per: 'quincena', rango: null, fEstado: 'todos', q: '', shown: 30, lastPend: null };
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  var DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 1900); }
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
    }).catch(function (x) { $('#loginErr').textContent = x.message; $('#loginErr').hidden = false; }).then(function () { b.disabled = false; });
  };
  function logout() { sessionStorage.removeItem('bh_admin'); S.token = ''; $('#app').hidden = true; $('#login').hidden = false; }
  $('#logout').onclick = logout;

  function start() {
    $('#login').hidden = true; $('#app').hidden = false; $('#demoBanner').hidden = !API.demo;
    fetchData().catch(function (e) { toast(e.message); });
    setInterval(function () { if (!document.hidden && S.token) fetchData(true); }, 60000);
  }

  /* ---------- datos ---------- */
  function iso(d) { return d.toISOString(); }
  function fetchData(silent, desde) {
    var r = $('#refresh'); r.classList.add('spin');
    var def = new Date(); def.setDate(1); def.setMonth(def.getMonth() - 2); def.setHours(0, 0, 0, 0);
    S.desde = desde || (S.desde && S.desde < iso(def) ? S.desde : iso(def));
    return call('adminDatos', { desde: S.desde }).then(function (d) {
      S.data = d; $('#brand').textContent = d.config.nombre; document.title = 'Panel · ' + d.config.nombre;
      var pend = d.pedidos.filter(function (o) { return o.estado === 'pendiente'; }).length;
      if (silent && S.lastPend != null && pend > S.lastPend) { toast('🔔 ¡Nuevo pedido!'); if (navigator.vibrate) navigator.vibrate([80, 60, 80]); }
      S.lastPend = pend; $('#pendDot').hidden = !pend; $('#pendDot').textContent = pend;
      $('#sync').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      if (!silent || S.tab === 'resumen' || S.tab === 'pedidos') render();
    }).finally(function () { r.classList.remove('spin'); });
  }
  $('#refresh').onclick = function () { fetchData().catch(function (e) { toast(e.message); }); };

  /* ---------- periodos ---------- */
  function day0(d) { d = new Date(d); d.setHours(0, 0, 0, 0); return d; }
  function addD(d, n) { d = new Date(d); d.setDate(d.getDate() + n); return d; }
  function period() {
    var now = new Date(), t = day0(now), a, b, pa, pb, y = t.getFullYear(), m = t.getMonth();
    switch (S.per) {
      case 'hoy': a = t; b = addD(t, 1); pa = addD(t, -1); pb = t; break;
      case '7d': a = addD(t, -6); b = addD(t, 1); pa = addD(a, -7); pb = a; break;
      case 'mes': a = new Date(y, m, 1); b = new Date(y, m + 1, 1); pa = new Date(y, m - 1, 1); pb = a; break;
      case 'mant': a = new Date(y, m - 1, 1); b = new Date(y, m, 1); pa = new Date(y, m - 2, 1); pb = a; break;
      case 'rango':
        a = S.rango ? S.rango[0] : addD(t, -29); b = S.rango ? S.rango[1] : addD(t, 1);
        var len = b - a; pa = new Date(a - len); pb = a; break;
      default: // quincena (1–15 / 16–fin)
        var q1 = t.getDate() <= 15;
        if (S.per === 'qant') { if (q1) { a = new Date(y, m - 1, 16); b = new Date(y, m, 1); } else { a = new Date(y, m, 1); b = new Date(y, m, 16); } }
        else { if (q1) { a = new Date(y, m, 1); b = new Date(y, m, 16); } else { a = new Date(y, m, 16); b = new Date(y, m + 1, 1); } }
        if (a.getDate() === 1) { pa = new Date(a.getFullYear(), a.getMonth() - 1, 16); pb = a; } else { pa = new Date(a.getFullYear(), a.getMonth(), 1); pb = a; }
    }
    return { a: a, b: b, pa: pa, pb: pb };
  }
  function fmtD(d) { return d.getDate() + ' ' + MES[d.getMonth()]; }
  function labelP(p) { var end = addD(p.b, -1); return +p.a === +day0(end) ? DIA[p.a.getDay()] + ' ' + fmtD(p.a) : fmtD(p.a) + ' – ' + fmtD(end) + ' ' + end.getFullYear(); }
  $('#pchips').onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return;
    S.per = b.dataset.p; $$('#pchips button').forEach(function (x) { x.classList.toggle('on', x === b); });
    $('#range').hidden = S.per !== 'rango';
    if (S.per === 'rango' && !$('#rDesde').value) { var t = day0(new Date()); $('#rDesde').valueAsDate = addD(t, -29); $('#rHasta').valueAsDate = t; }
    ensureRange();
  };
  $('#rApply').onclick = function () {
    var a = $('#rDesde').value, b = $('#rHasta').value; if (!a || !b) return;
    var A = new Date(a + 'T00:00:00'), B = addD(new Date(b + 'T00:00:00'), 1); if (B <= A) return toast('Rango inválido');
    S.rango = [A, B]; ensureRange();
  };
  function ensureRange() {
    var p = period();
    if (iso(p.pa) < S.desde) fetchData(false, iso(p.pa)).catch(function (e) { toast(e.message); }); else render();
  }

  /* ---------- cálculo ---------- */
  function inR(o, a, b) { var t = new Date(o.fecha); return t >= a && t < b; }
  function stats(a, b) {
    var all = S.data.pedidos.filter(function (o) { return inR(o, a, b); }), v = all.filter(function (o) { return VENTA[o.estado]; });
    var s = { all: all, ventas: 0, gan: 0, del: 0, n: v.length, u: 0, prod: {}, cat: {}, hora: new Array(24).fill(0), dia: {}, orig: {}, pago: {}, pend: all.filter(function (o) { return o.estado === 'pendiente'; }) };
    v.forEach(function (o) {
      s.ventas += o.total; s.gan += o.ganancia; s.del += o.delivery;
      var d = new Date(o.fecha), k = day0(d).getTime();
      s.dia[k] = (s.dia[k] || 0) + o.total; s.hora[d.getHours()] += 1;
      var og = o.origen || 'directo'; s.orig[og] = (s.orig[og] || 0) + o.total;
      s.pago[o.pago] = (s.pago[o.pago] || 0) + o.total;
      o.items.forEach(function (i) {
        var p = s.prod[i.id] || (s.prod[i.id] = { id: i.id, nombre: i.nombre, u: 0, v: 0, g: 0 });
        p.u += i.cant; p.v += i.precio * i.cant; p.g += (i.precio - i.costo) * i.cant; s.u += i.cant;
        var c = i.cat || 'Otros'; s.cat[c] = (s.cat[c] || 0) + i.precio * i.cant;
      });
    });
    s.ticket = s.n ? s.ventas / s.n : 0; s.margen = s.ventas - s.del > 0 ? s.gan / (s.ventas - s.del) * 100 : 0;
    return s;
  }
  function delta(cur, prev) {
    if (!prev && !cur) return '<span class="delta eq">sin cambios</span>';
    if (!prev) return '<span class="delta up">nuevo</span>';
    var d = (cur - prev) / prev * 100, c = Math.abs(d) < 1 ? 'eq' : d > 0 ? 'up' : 'down';
    return '<span class="delta ' + c + '">' + (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + Math.abs(d).toFixed(0) + '% ' + (delta.live ? 'vs. mismo avance' : 'vs. anterior') + '</span>';
  }

  /* ---------- render ---------- */
  function render() {
    if (!S.data) return;
    var p = period(); $('#plabel').textContent = labelP(p);
    $('#periodBox').hidden = S.tab === 'productos' || S.tab === 'ajustes';
    ({ resumen: rResumen, pedidos: rPedidos, productos: rProductos, ajustes: rAjustes })[S.tab](p);
  }

  function rResumen(p) {
    var now = new Date(), live = p.b > now && p.a < now, s = stats(p.a, p.b), o = stats(p.pa, live ? new Date(Math.min(+p.pb, +p.pa + (now - p.a))) : p.pb), prods = S.data.productos;
    var pmap = {}; prods.forEach(function (x) { pmap[x.id] = x; });
    delta.live = live;
    var h = '<div class="kpis">' +
      '<div class="kpi big"><small>Ventas</small><b>' + money(s.ventas) + '</b>' + delta(s.ventas, o.ventas) + '</div>' +
      '<div class="kpi"><small>Ganancia</small><b>' + money(s.gan) + '</b>' + delta(s.gan, o.gan) + '</div>' +
      '<div class="kpi"><small>Margen</small><b>' + s.margen.toFixed(0) + '%</b><span class="delta eq">sobre productos</span></div>' +
      '<div class="kpi"><small>Pedidos</small><b>' + s.n + '</b>' + delta(s.n, o.n) + '</div>' +
      '<div class="kpi"><small>Ticket prom.</small><b>' + money(s.ticket) + '</b>' + delta(s.ticket, o.ticket) + '</div>' +
      '<div class="kpi"><small>Unidades</small><b>' + s.u + '</b>' + delta(s.u, o.u) + '</div>' +
      '<div class="kpi"><small>Delivery cobrado</small><b>' + money(s.del) + '</b><span class="delta eq">no suma a ganancia</span></div>' +
      '</div>';
    var allPend = S.data.pedidos.filter(function (x) { return x.estado === 'pendiente'; });
    if (allPend.length) h += '<div class="alert">⏳<span>' + allPend.length + ' pedido' + (allPend.length > 1 ? 's' : '') + ' por confirmar · ' + money(allPend.reduce(function (a, x) { return a + x.total; }, 0)) + '</span><button class="btn-sm" data-goto="pendiente">Ver</button></div>';

    // ventas por día
    var days = [], d = new Date(p.a), maxD = 0;
    if (p.b - p.a <= 864e5 * 1.5) {
      h += panel('Pedidos por hora', 'Cuántos pedidos entran a cada hora', vHours(s));
    } else {
      while (d < p.b && days.length < 62) { var k = day0(d).getTime(), val = s.dia[k] || 0; days.push({ d: new Date(d), v: val }); maxD = Math.max(maxD, val); d = addD(d, 1); }
      var bars = days.map(function (x) {
        var we = x.d.getDay() === 5 || x.d.getDay() === 6 || x.d.getDay() === 0, ht = maxD ? Math.max(2, x.v / maxD * 100) : 2;
        return '<div class="vbar' + (we ? ' we' : '') + (x.v ? '' : ' zero') + '" data-tip="' + DIA[x.d.getDay()] + ' ' + fmtD(x.d) + ' · ' + money(x.v) + '"><i style="height:' + ht + '%"></i><span>' + (days.length > 16 ? (x.d.getDate() % 3 === 1 ? x.d.getDate() : '') : x.d.getDate()) + '</span></div>';
      }).join('');
      var best = days.slice().sort(function (a, b) { return b.v - a.v; })[0];
      h += panel('Ventas por día', best && best.v ? 'Mejor día: ' + DIA[best.d.getDay()] + ' ' + fmtD(best.d) + ' con ' + money(best.v) + ' · toca una barra' : 'Aún no hay ventas en este periodo',
        '<div class="vbars" id="vbars">' + bars + '</div><div class="legend"><span><i class="c1"></i>Lun–jue</span><span><i class="c2"></i>Vie–dom</span></div>');
    }

    // ranking
    var list = Object.keys(s.prod).map(function (k) { return s.prod[k]; });
    prods.forEach(function (x) { if (x.activo && !s.prod[x.id]) list.push({ id: x.id, nombre: x.nombre + ' ' + x.presentacion, u: 0, v: 0, g: 0 }); });
    var top = list.slice().sort(function (a, b) { return b.u - a.u || b.v - a.v; }).slice(0, 5);
    var low = list.filter(function (x) { return !pmap[x.id] || pmap[x.id].activo; }).sort(function (a, b) { return a.u - b.u || a.v - b.v; }).slice(0, 5);
    var maxU = top.length ? top[0].u : 0;
    function rk(arr, cls) {
      if (!arr.length) return '<p class="muted">Sin datos.</p>';
      return '<div class="rank ' + (cls || '') + '">' + arr.map(function (x) {
        var pr = pmap[x.id] || { nombre: x.nombre, forma: 'botella', color: '#888888' };
        return '<div class="rk">' + Draw.product(pr, 'art') + '<div style="min-width:0"><div class="rk-name">' + esc(x.nombre) + '</div><div class="rk-bar"><i style="width:' + (maxU ? Math.max(2, x.u / maxU * 100) : 2) + '%"></i></div></div><div class="rk-val">' + x.u + ' u.<small>' + money(x.v) + '</small></div></div>';
      }).join('') + '</div>';
    }
    var topG = list.slice().sort(function (a, b) { return b.g - a.g; }).slice(0, 5);
    h += '<div class="cols">' + panel('🔥 Lo más vendido', 'Por unidades', rk(top)) + panel('🧊 Lo que menos sale', 'Considera promocionarlo o dejar de comprarlo', rk(low, 'low')) + '</div>';
    h += '<div class="cols">' + panel('💰 Lo que más ganancia deja', 'Ganancia = precio − costo', hb(topG.map(function (x) { return [x.nombre, x.g]; }), true)) +
      panel('Ventas por categoría', '', hb(obj2arr(s.cat))) + '</div>';
    h += '<div class="cols">' + panel('📣 Ventas por grupo / link', 'Usa links con ?ref= para saber qué grupo de WhatsApp vende más (Ajustes)', hb(obj2arr(s.orig))) +
      panel('Forma de pago', '', hb(obj2arr(s.pago).map(function (x) { return [x[0] === 'yape' ? 'Yape' : 'WhatsApp', x[1]]; }))) + '</div>';
    if (p.b - p.a > 864e5 * 1.5) h += panel('🕓 ¿A qué hora piden?', 'Publica tus anuncios 1 hora antes de la hora más fuerte', vHours(s));
    var lowS = prods.filter(function (x) { return x.activo && typeof x.stock === 'number' && x.stock <= 5; });
    h += panel('⚠️ Stock bajo', lowS.length ? 'Repón pronto' : '', lowS.length ? '<div class="stock-list">' + lowS.map(function (x) { return '<div><span>' + esc(x.nombre + ' ' + x.presentacion) + '</span><b>' + (x.stock ? 'quedan ' + x.stock : 'agotado') + '</b></div>'; }).join('') + '</div>' : '<p class="muted">Todo con stock suficiente 👌</p>');
    $('#v-resumen').innerHTML = h;
  }
  function vHours(s) {
    var mx = Math.max.apply(null, s.hora) || 1, cells = '';
    for (var i = 0; i < 24; i++) cells += '<div title="' + i + ':00 · ' + s.hora[i] + ' pedidos" style="background:rgba(143,227,255,' + (0.06 + s.hora[i] / mx * .85).toFixed(2) + ')">' + i + '</div>';
    var best = s.hora.indexOf(Math.max.apply(null, s.hora));
    return '<div class="hours">' + cells + '</div><p class="muted" style="margin:8px 0 0">' + (s.hora[best] ? 'Hora más fuerte: <b>' + best + ':00 – ' + (best + 1) + ':00</b>' : 'Sin pedidos aún') + '</p>';
  }
  function obj2arr(o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); }
  function hb(arr, green) {
    if (!arr.length) return '<p class="muted">Sin datos.</p>';
    var mx = arr[0][1] || 1, tot = arr.reduce(function (a, x) { return a + x[1]; }, 0);
    return '<div class="hb">' + arr.slice(0, 7).map(function (x, i) {
      return '<div class="hb-row"><span title="' + esc(x[0]) + '">' + esc(x[0]) + '</span><div class="rk-bar"><i class="' + (green ? 'c4' : 'c' + (i % 6 + 1)) + '" style="width:' + Math.max(2, x[1] / mx * 100) + '%"></i></div><b>' + money(x[1]).replace('S/ ', '') + (tot && !green ? '<small class="muted"> ' + Math.round(x[1] / tot * 100) + '%</small>' : '') + '</b></div>';
    }).join('') + '</div>';
  }
  function panel(t, sub, body) { return '<div class="panel"><h3>' + t + '</h3>' + (sub ? '<p class="sub">' + sub + '</p>' : '<p class="sub"></p>') + body + '</div>'; }

  /* ---------- pedidos ---------- */
  var EST = { pendiente: 'Pendiente', pagado: 'Pagado', entregado: 'Entregado', cancelado: 'Cancelado' };
  function rPedidos(p) {
    var all = S.data.pedidos.filter(function (o) { return inR(o, p.a, p.b) || o.estado === 'pendiente'; });
    var q = S.q.toLowerCase(), cnt = { todos: all.length };
    all.forEach(function (o) { cnt[o.estado] = (cnt[o.estado] || 0) + 1; });
    var list = all.filter(function (o) { return (S.fEstado === 'todos' || o.estado === S.fEstado) && (!q || (o.id + ' ' + o.cliente + ' ' + o.telefono + ' ' + o.detalle + ' ' + o.direccion).toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    var h = '<div class="toolbar"><input id="oq" type="search" placeholder="Buscar por código, nombre, celular…" value="' + esc(S.q) + '"><div class="fchips" id="fchips">' +
      ['todos', 'pendiente', 'pagado', 'entregado', 'cancelado'].map(function (k) { return '<button data-f="' + k + '" class="' + (S.fEstado === k ? 'on' : '') + '">' + (k === 'todos' ? 'Todos' : EST[k]) + ' ' + (cnt[k] || 0) + '</button>'; }).join('') +
      '</div></div>';
    h += list.length ? '<div class="orders">' + list.slice(0, S.shown).map(orderCard).join('') + '</div>' : '<p class="muted" style="text-align:center;padding:30px">No hay pedidos aquí.</p>';
    if (list.length > S.shown) h += '<button class="btn btn-ghost more" id="more">Ver más (' + (list.length - S.shown) + ')</button>';
    h += '<button class="btn btn-ghost more" id="csv">⬇ Descargar Excel (CSV) del periodo</button>';
    $('#v-pedidos').innerHTML = h;
    $('#oq').oninput = function (e) { S.q = e.target.value; clearTimeout(rPedidos.t); rPedidos.t = setTimeout(function () { render(); var i = $('#oq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    if ($('#more')) $('#more').onclick = function () { S.shown += 30; render(); };
    $('#csv').onclick = function () { csv(list); };
  }
  function ago(f) {
    var m = Math.round((Date.now() - new Date(f)) / 60000), d = new Date(f);
    if (m < 60) return 'hace ' + Math.max(1, m) + ' min';
    if (m < 60 * 12) return 'hace ' + Math.round(m / 60) + ' h';
    return DIA[d.getDay()] + ' ' + fmtD(d) + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }
  function orderCard(o) {
    var msg = 'Hola ' + o.cliente + ', te escribimos de ' + S.data.config.nombre + ' por tu pedido ' + o.id + ' (' + money(o.total) + ').';
    var tel = o.telefono.length === 9 ? '51' + o.telefono : o.telefono;
    return '<div class="order ' + o.estado + '"><div class="o-top"><span class="o-code">' + esc(o.id) + '</span><span class="o-time">' + ago(o.fecha) + '</span><span class="o-total">' + money(o.total) + '</span></div>' +
      '<div class="o-who">' + esc(o.cliente) + ' · ' + esc(o.telefono) + '</div>' +
      '<div class="o-meta">' + (o.entrega === 'recojo' ? '🏪 Recojo en tienda' : '🛵 ' + esc(o.direccion) + (o.referencia ? ' · ' + esc(o.referencia) : '')) + '</div>' +
      '<div class="o-items">' + esc(o.detalle) + (o.delivery ? ' · delivery ' + money(o.delivery) : '') + (o.nota ? '<br><i>📝 ' + esc(o.nota) + '</i>' : '') + '</div>' +
      '<div style="margin-bottom:8px"><span class="tagp ' + esc(o.pago) + '">' + (o.pago === 'yape' ? 'Yape' : 'WhatsApp') + '</span>' + (o.origen ? '<span class="tagp ref">' + esc(o.origen) + '</span>' : '') + '<span class="tagp ref">Ganancia ' + money(o.ganancia) + '</span></div>' +
      '<div class="o-actions">' + ['pagado', 'entregado', 'cancelado'].map(function (k) {
        return '<button class="btn-sm' + (o.estado === k ? ' on' : '') + '" data-est="' + k + '" data-id="' + esc(o.id) + '">' + (o.estado === k ? '✓ ' : '') + EST[k] + '</button>';
      }).join('') + '<a class="btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(tel) + '?text=' + encodeURIComponent(msg) + '" aria-label="Escribir por WhatsApp">💬</a></div></div>';
  }
  function setEstado(id, est) {
    var o = S.data.pedidos.filter(function (x) { return x.id === id; })[0]; if (!o) return;
    var nuevo = o.estado === est ? 'pendiente' : est;
    if (nuevo === 'cancelado' && !confirmBox('¿Cancelar el pedido ' + id + '? El stock vuelve al inventario.', function () { go(); })) return;
    go();
    function go() {
      var prev = o.estado; o.estado = nuevo; render();
      call('actualizarPedido', { id: id, estado: nuevo }).then(function () { toast(id + ' → ' + EST[nuevo]); fetchData(true); })
        .catch(function (e) { o.estado = prev; render(); toast(e.message); });
    }
  }
  function csv(list) {
    var rows = [['Código', 'Fecha', 'Estado', 'Cliente', 'Celular', 'Entrega', 'Dirección', 'Pago', 'Origen', 'Detalle', 'Subtotal', 'Delivery', 'Total', 'Costo', 'Ganancia']];
    list.forEach(function (o) { rows.push([o.id, new Date(o.fecha).toLocaleString('es-PE'), o.estado, o.cliente, o.telefono, o.entrega, o.direccion, o.pago, o.origen, o.detalle, o.subtotal, o.delivery, o.total, o.costo, o.ganancia]); });
    var txt = '﻿' + rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = 'pedidos-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
  }

  /* ---------- productos ---------- */
  function rProductos() {
    var ps = S.data.productos;
    var h = '<div class="plist">' + ps.map(function (p) {
      var low = typeof p.stock === 'number' && p.stock <= 5, mg = p.precio ? Math.round((p.precio - p.costo) / p.precio * 100) : 0;
      return '<button class="prow' + (p.activo ? '' : ' off') + '" data-edit="' + esc(p.id) + '">' + Draw.product(p, 'art') +
        '<div style="min-width:0"><b>' + esc(p.nombre) + (p.destacado ? ' 🔥' : '') + '</b><small>' + esc(p.categoria) + ' · ' + esc(p.presentacion) + (p.activo ? '' : ' · oculto') + '</small><br>' +
        '<span class="stk' + (low ? ' low' : '') + '">' + (p.stock === '' ? 'sin control de stock' : 'stock ' + p.stock) + '</span></div>' +
        '<div class="pr"><b>' + money(p.precio) + '</b><br><small>costo ' + money(p.costo) + '</small><br><small style="color:var(--green)">margen ' + mg + '%</small></div></button>';
    }).join('') + '</div><button class="fab" id="newP">+ Producto</button>';
    $('#v-productos').innerHTML = h;
    $('#newP').onclick = function () { editP({ id: '', nombre: '', categoria: 'Cervezas', forma: 'botella', presentacion: '', precio: '', costo: '', stock: '', color: '#1f6b3a', vidrio: '', etiqueta: '', imagen: '', activo: true, destacado: false, orden: ps.length + 1, descripcion: '' }); };
  }
  function editP(p) {
    var cats = []; S.data.productos.forEach(function (x) { if (cats.indexOf(x.categoria) < 0) cats.push(x.categoria); });
    var f = function (lbl, inner, hint) { return '<div class="fl"><label>' + lbl + '</label>' + inner + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>'; };
    modal('<div class="m-head"><h3>' + (p.id ? 'Editar producto' : 'Nuevo producto') + '</h3><button class="ib" data-mclose>✕</button></div>' +
      '<form class="form" id="pf"><div class="preview" id="pprev"></div>' +
      f('Nombre', '<input name="nombre" required maxlength="60" value="' + esc(p.nombre) + '" placeholder="Ej.: Pilsen Callao">') +
      '<div class="f2">' + f('Categoría', '<input name="categoria" list="catl" value="' + esc(p.categoria) + '"><datalist id="catl">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>') +
      f('Presentación', '<input name="presentacion" maxlength="30" value="' + esc(p.presentacion) + '" placeholder="620 ml, x6…">') + '</div>' +
      '<div class="f2">' + f('Precio de venta S/', '<input name="precio" type="number" inputmode="decimal" step="0.1" min="0" required value="' + p.precio + '">') +
      f('Costo (lo que te cuesta) S/', '<input name="costo" type="number" inputmode="decimal" step="0.1" min="0" value="' + p.costo + '">', '<span id="mg"></span>') + '</div>' +
      '<div class="f2">' + f('Stock', '<input name="stock" type="number" inputmode="numeric" min="0" value="' + p.stock + '" placeholder="vacío = sin control">') +
      f('Orden', '<input name="orden" type="number" inputmode="numeric" value="' + p.orden + '">') + '</div>' +
      '<div class="section-t">Cómo se ve</div>' +
      '<div class="f2">' + f('Forma', '<select name="forma">' + ['botella', 'lata', 'pack', 'licor', 'otro'].map(function (k) { return '<option' + (p.forma === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>') +
      f('Texto etiqueta', '<input name="etiqueta" maxlength="10" value="' + esc(p.etiqueta) + '" placeholder="PILSEN">') + '</div>' +
      '<div class="f2">' + f('Color', '<input name="color" type="color" value="' + esc(p.color || '#c9a13b') + '">') +
      f('Color vidrio', '<input name="vidrio" type="color" value="' + esc(p.vidrio || '#5a2a0b') + '">', 'botella/licor') + '</div>' +
      f('Foto (opcional)', '<input type="file" accept="image/*" id="pimg"><button type="button" class="btn-sm" id="pimgDel" style="margin-top:6px"' + (p.imagen ? '' : ' hidden') + '>Quitar foto y usar dibujo</button>', 'Mejor con fondo transparente (PNG). Se achica sola.') +
      f('Descripción (opcional)', '<textarea name="descripcion" maxlength="160">' + esc(p.descripcion) + '</textarea>') +
      '<label class="check"><input type="checkbox" name="destacado"' + (p.destacado ? ' checked' : '') + '> 🔥 Destacado (va primero en la exhibidora)</label>' +
      '<label class="check"><input type="checkbox" name="activo"' + (p.activo ? ' checked' : '') + '> Visible en la tienda</label>' +
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
      $('#pprev').innerHTML = Draw.product(Core.create ? Object.assign({}, x, { precio: pr }) : x, 'art') + '<div><b>' + esc(x.nombre || 'Nombre') + '</b><br><span class="muted">' + esc(x.presentacion) + '</span><br><b>' + money(pr) + '</b></div>';
      $('#mg').innerHTML = pr ? 'Ganas <b style="color:var(--green)">' + money(pr - co) + '</b> por unidad (' + Math.round((pr - co) / pr * 100) + '%)' : '';
    }
    form.addEventListener('input', upd); upd();
    $('#pimg').onchange = function (e) {
      var file = e.target.files[0]; if (!file) return;
      shrink(file, 220, 'image/webp').then(function (u) { img = u; $('#pimgDel').hidden = false; upd(); }).catch(function (x) { toast(x.message); });
    };
    $('#pimgDel').onclick = function () { img = ''; $('#pimg').value = ''; $('#pimgDel').hidden = true; upd(); };
    if ($('#pDel')) $('#pDel').onclick = function () {
      confirmBox('¿Eliminar ' + p.nombre + '? Mejor desmárcalo como "Visible" si solo quieres ocultarlo. Los pedidos antiguos se conservan.', function () {
        call('eliminarProducto', { id: p.id }).then(function () { toast('Eliminado'); closeModal(); fetchData(); }).catch(function (e) { toast(e.message); });
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
    var f = function (lbl, inner, hint) { return '<div class="fl"><label>' + lbl + '</label>' + inner + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>'; };
    var h = '<form class="form" id="cf"><div class="ajustes-grid"><div class="form">' +
      '<div class="section-t">Tienda</div>' +
      f('Nombre', '<input name="nombre" maxlength="40" value="' + esc(c.nombre) + '">') +
      f('Frase', '<input name="slogan" maxlength="90" value="' + esc(c.slogan) + '">') +
      f('Horario', '<input name="horario" maxlength="80" value="' + esc(c.horario) + '">') +
      f('Zona de reparto', '<input name="zona" maxlength="120" value="' + esc(c.zona) + '">') +
      f('Aviso arriba de la tienda (opcional)', '<input name="aviso" maxlength="140" value="' + esc(c.aviso) + '" placeholder="Ej.: ¡Promo! Six pack a S/ 23 solo hoy">') +
      '<label class="check"><input type="checkbox" name="abierto"' + (c.abierto ? ' checked' : '') + '> Tienda abierta (recibe pedidos)</label>' +
      '<div class="section-t">Delivery</div>' +
      '<div class="f2">' + f('Costo delivery S/', '<input name="costoDelivery" type="number" step="0.5" min="0" inputmode="decimal" value="' + c.costoDelivery + '">') +
      f('Gratis desde S/', '<input name="deliveryGratisDesde" type="number" step="1" min="0" inputmode="decimal" value="' + c.deliveryGratisDesde + '">', '0 = nunca gratis') + '</div>' +
      '<div class="f2">' + f('Pedido mínimo S/', '<input name="pedidoMinimo" type="number" step="1" min="0" inputmode="decimal" value="' + c.pedidoMinimo + '">') +
      f('Prefijo de pedidos', '<input name="prefijo" maxlength="5" value="' + esc(c.prefijo) + '">', 'BH-0001') + '</div>' +
      '</div><div class="form">' +
      '<div class="section-t">Cobro</div>' +
      f('Formas de pago en la web', '<select name="modoPago"><option value="ambos"' + (c.modoPago === 'ambos' ? ' selected' : '') + '>Yape y WhatsApp (el cliente elige)</option><option value="yape"' + (c.modoPago === 'yape' ? ' selected' : '') + '>Solo Yape</option><option value="whatsapp"' + (c.modoPago === 'whatsapp' ? ' selected' : '') + '>Solo WhatsApp</option></select>') +
      f('WhatsApp del negocio', '<input name="whatsapp" type="tel" inputmode="numeric" value="' + esc(c.whatsapp) + '">', 'Con 51 adelante. Ej.: 51987654321') +
      '<div class="f2">' + f('Número Yape', '<input name="yapeNumero" type="tel" inputmode="numeric" value="' + esc(c.yapeNumero) + '">') +
      f('Titular Yape', '<input name="yapeNombre" maxlength="60" value="' + esc(c.yapeNombre) + '">', 'Como sale en Yape') + '</div>' +
      f('QR de Yape', '<div style="display:flex;gap:12px;align-items:center">' + (c.yapeQR ? '<img class="qrprev" id="qrp" src="' + esc(c.yapeQR) + '" alt="QR">' : '<img class="qrprev" id="qrp" hidden alt="QR">') + '<div><input type="file" accept="image/*" id="qrf"><button type="button" class="btn-sm" id="qrDel" style="margin-top:6px">Quitar QR</button></div></div>', 'En Yape: Mi QR → Descargar. Sube esa imagen.') +
      '<div id="cErr"></div><button class="btn btn-amber" type="submit">Guardar ajustes</button>' +
      '</div></div></form>' +
      '<div class="panel"><h3>🔗 Links para cada grupo de WhatsApp</h3><p class="sub">Así sabrás qué grupo te trae más ventas (sale en Resumen).</p>' +
      '<div class="linkgen"><div class="fl" style="flex:1"><input id="lg" placeholder="Nombre del grupo, ej.: vecinos-mz-b"></div><button class="btn-sm" id="lgb">Crear</button></div><div id="lgo"></div></div>' +
      (API.demo ? '' : '<div class="panel"><h3>🔒 Cambiar clave</h3><div class="linkgen"><div class="fl" style="flex:1"><input id="np" type="password" placeholder="Nueva clave (mín. 6)" autocomplete="new-password"></div><button class="btn-sm" id="npb">Cambiar</button></div></div>');
    $('#v-ajustes').innerHTML = h;
    var qr = c.yapeQR, form = $('#cf');
    $('#qrf').onchange = function (e) { var fl = e.target.files[0]; if (fl) shrink(fl, 380, 'image/png').then(function (u) { qr = u; $('#qrp').src = u; $('#qrp').hidden = false; }).catch(function (x) { toast(x.message); }); };
    $('#qrDel').onclick = function () { qr = ''; $('#qrp').hidden = true; };
    form.onsubmit = function (e) {
      e.preventDefault();
      var x = Object.assign({}, c);
      ['nombre', 'slogan', 'horario', 'zona', 'aviso', 'costoDelivery', 'deliveryGratisDesde', 'pedidoMinimo', 'prefijo', 'modoPago', 'whatsapp', 'yapeNumero', 'yapeNombre'].forEach(function (k) { x[k] = form[k].value; });
      x.abierto = form.abierto.checked; x.yapeQR = qr;
      if (String(x.whatsapp).replace(/\D/g, '').length < 11) { $('#cErr').innerHTML = '<div class="err">El WhatsApp debe llevar 51 + 9 dígitos.</div>'; return; }
      call('guardarConfig', { config: x }).then(function (r) { S.data.config = r; $('#cErr').innerHTML = ''; toast('Ajustes guardados ✓'); $('#brand').textContent = r.nombre; })
        .catch(function (er) { $('#cErr').innerHTML = '<div class="err">' + esc(er.message) + '</div>'; });
    };
    $('#lgb').onclick = function () {
      var g = $('#lg').value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
      if (!g) return;
      var link = base + '?ref=' + g;
      $('#lgo').innerHTML = '<div class="out-link">' + esc(link) + '</div><button class="btn-sm" id="lgc" style="margin-top:6px">Copiar link</button>';
      $('#lgc').onclick = function () { navigator.clipboard.writeText(link).then(function () { toast('Link copiado ✓'); }); };
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
    return false;
  }
  $('#modal').onclick = function (e) { if (e.target.id === 'modal' || e.target.closest('[data-mclose]')) closeModal(); };

  /* ---------- eventos ---------- */
  $('#tabs').onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return;
    S.tab = b.dataset.tab; $$('#tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'v-' + S.tab; });
    $('#tabTitle').textContent = b.querySelector('span').textContent; scrollTo(0, 0); render();
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-est],[data-f],[data-edit],[data-goto],.vbar');
    if (!t) return;
    if (t.dataset.est) setEstado(t.dataset.id, t.dataset.est);
    else if (t.dataset.f) { S.fEstado = t.dataset.f; S.shown = 30; render(); }
    else if (t.dataset.edit) { var p = S.data.productos.filter(function (x) { return x.id === t.dataset.edit; })[0]; if (p) editP(p); }
    else if (t.dataset.goto) { S.fEstado = t.dataset.goto; $('[data-tab=pedidos]').click(); }
    else if (t.classList.contains('vbar')) { $$('.vbar.active').forEach(function (x) { if (x !== t) x.classList.remove('active'); }); t.classList.toggle('active'); }
  });
  $('#resetDemo').onclick = function () { API.resetDemo(); location.reload(); };

  if (S.token) start();
})();
