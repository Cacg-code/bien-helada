/* api.js — Conexión con la BD (Google Sheets vía Apps Script) o modo demo local. */
var API = (function () {
  var URL = (window.APP_CONFIG || {}).API_URL || '';
  var demo = !URL;

  /* ---------- Adaptador demo (localStorage) ---------- */
  var K = { p: 'bh_demo_productos', o: 'bh_demo_pedidos', c: 'bh_demo_config', s: 'bh_demo_seq', pw: 'bh_demo_clave' };
  function get(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function seedOrders() {
    var prods = Core.SEED, out = [], seq = 0, now = Date.now(), day = 864e5;
    var origenes = ['grupo-vecinos', 'grupo-futbol', 'grupo-condominio', '', 'grupo-vecinos'];
    var nombres = ['Luis', 'Carla', 'Jorge', 'Ana', 'Pedro', 'Rosa', 'Kevin', 'Milagros', 'Diego', 'Fiorella'];
    var weights = prods.map(function (p) { return p.destacado ? 5 : 1.5; });
    weights[3] = 0.4; weights[13] = 0.3; weights[16] = 0.6;
    function pick() {
      var t = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * t;
      for (var i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return prods[i]; }
      return prods[0];
    }
    for (var d = 50; d >= 0; d--) {
      var date = new Date(now - d * day), dow = date.getDay();
      var n = Math.round((dow === 5 || dow === 6 ? 6 : dow === 0 ? 4 : 2) + Math.random() * 3);
      for (var j = 0; j < n; j++) {
        var f = new Date(date); f.setHours(16 + Math.floor(Math.random() * 7), Math.floor(Math.random() * 60), 0, 0);
        if (f.getTime() > now) continue;
        var map = {}, k = 1 + Math.floor(Math.random() * 3);
        for (var x = 0; x < k; x++) { var p = pick(); map[p.id] = (map[p.id] || 0) + 1 + Math.floor(Math.random() * (p.forma === 'botella' || p.forma === 'lata' ? 6 : 2)); }
        var items = [], sub = 0, cost = 0;
        for (var id in map) {
          var pp = prods.filter(function (q) { return q.id === id; })[0];
          items.push({ id: id, nombre: pp.nombre + ' ' + pp.presentacion, cat: pp.categoria, cant: map[id], precio: pp.precio, costo: pp.costo });
          sub += pp.precio * map[id]; cost += pp.costo * map[id];
        }
        var del = sub >= 60 ? 0 : 3, est = d === 0 && Math.random() < .6 ? 'pendiente' : (Math.random() < .07 ? 'cancelado' : 'entregado');
        seq++;
        out.push({ id: 'BH-' + ('000' + seq).slice(-4), fecha: f.toISOString(), estado: est,
          cliente: nombres[Math.floor(Math.random() * nombres.length)], telefono: '9' + Math.floor(10000000 + Math.random() * 89999999),
          entrega: Math.random() < .8 ? 'delivery' : 'recojo', direccion: 'Calle Ejemplo ' + (100 + j), referencia: '',
          pago: Math.random() < .65 ? 'yape' : 'whatsapp', origen: origenes[Math.floor(Math.random() * origenes.length)],
          detalle: items.map(function (i) { return i.cant + 'x ' + i.nombre; }).join(', '),
          subtotal: +sub.toFixed(2), delivery: del, total: +(sub + del).toFixed(2), costo: +cost.toFixed(2),
          ganancia: +(sub - cost).toFixed(2), nota: '', items: items });
      }
    }
    set(K.s, seq);
    return out;
  }

  function ensureDemo() {
    if (localStorage.getItem('bh_demo_v') !== '3') { [K.p, K.o, K.s].forEach(function (k) { localStorage.removeItem(k); }); localStorage.removeItem('bh_cat_cache'); localStorage.removeItem('bh_cart'); localStorage.setItem('bh_demo_v', '3'); }
    if (!get(K.p)) set(K.p, Core.SEED);
    if (!get(K.c)) set(K.c, Core.DEF_CFG);
    if (!get(K.o)) set(K.o, seedOrders());
  }

  var demoDB = {
    getProducts: function () { return get(K.p, []); },
    saveProduct: function (p) {
      var l = get(K.p, []), i = l.findIndex(function (x) { return x.id === p.id; });
      if (i >= 0) l[i] = p; else l.push(p); set(K.p, l);
    },
    deleteProduct: function (id) { set(K.p, get(K.p, []).filter(function (x) { return x.id !== id; })); },
    getOrders: function () { return get(K.o, []); },
    addOrder: function (o) { var l = get(K.o, []); l.push(o); set(K.o, l); },
    saveOrder: function (o) {
      var l = get(K.o, []), i = l.findIndex(function (x) { return x.id === o.id; });
      if (i >= 0) l[i] = o; set(K.o, l);
    },
    getConfig: function () { return get(K.c, {}); },
    saveConfig: function (c) { set(K.c, c); },
    nextSeq: function () { var n = get(K.s, 0) + 1; set(K.s, n); return n; },
    checkPassword: function (pw) { return pw === get(K.pw, 'admin123'); },
    setPassword: function (pw) { set(K.pw, pw); },
    sign: function (exp) { return exp + '.demo'; },
    verify: function (t) { var p = t.split('.'); return p[1] === 'demo' && +p[0] > Date.now(); },
    lock: function (fn) { return fn(); },
    now: function () { return new Date(); }
  };

  var engine = null;
  function call(action, data) {
    data = data || {};
    if (demo) {
      ensureDemo();
      engine = engine || Core.create(demoDB);
      return new Promise(function (res, rej) {
        setTimeout(function () {
          try { res(JSON.parse(JSON.stringify(engine.handle(action, data)))); } catch (e) { rej(e); }
        }, 250);
      });
    }
    var body = JSON.stringify(Object.assign({ action: action }, data));
    // Sin Content-Type → "text/plain", evita el bloqueo CORS de Apps Script.
    return fetch(URL, { method: 'POST', body: body, redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('Sin conexión con la base de datos.'); return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'Error'); return j.data; });
  }

  function resetDemo() { Object.keys(K).forEach(function (k) { if (k !== 'pw') localStorage.removeItem(K[k]); }); engine = null; }

  return { call: call, demo: demo, resetDemo: resetDemo };
})();
