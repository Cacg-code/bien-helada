/* core.js — Lógica del negocio compartida.
 * Se usa en el navegador (modo demo) y en Google Apps Script (copiar como Core.gs).
 * No tocar sin copiar también a Apps Script.
 */
var Core = (function () {
  var VENTA = { pagado: 1, entregado: 1 };
  var ESTADOS = ['pendiente', 'pagado', 'entregado', 'cancelado'];
  var FORMAS = ['botella', 'lata', 'pack', 'licor', 'otro'];
  var PUBLIC_CFG = ['nombre', 'slogan', 'whatsapp', 'yapeNumero', 'yapeNombre', 'yapeQR', 'costoDelivery',
    'deliveryGratisDesde', 'pedidoMinimo', 'horario', 'zona', 'modoPago', 'abierto', 'aviso'];
  var DEF_CFG = {
    nombre: 'Bien Helada', slogan: 'Chelas bien heladas, directo a tu puerta',
    whatsapp: '51999999999', yapeNumero: '999999999', yapeNombre: 'Nombre del titular', yapeQR: '',
    costoDelivery: 3, deliveryGratisDesde: 60, pedidoMinimo: 15,
    horario: 'Lun a Dom · 4:00 p. m. – 11:30 p. m.', zona: 'Delivery en tu zona',
    modoPago: 'ambos', abierto: true, aviso: '', prefijo: 'BH'
  };

  var SEED = [
    ['Pilsen Callao', 'Cervezas', 'botella', '630 ml', 7.5, 5.8, 48, '#1f6b3a', '', 'PILSEN', 1],
    ['Cristal', 'Cervezas', 'botella', '650 ml', 7, 5.4, 48, '#c8102e', '', 'CRISTAL', 1],
    ['Cusqueña Dorada', 'Cervezas', 'botella', '620 ml', 8, 6.2, 36, '#b8902f', '', 'CUSQUEÑA', 1],
    ['Cusqueña Negra', 'Cervezas', 'botella', '620 ml', 8.5, 6.5, 24, '#2a1a10', '#2a160a', 'NEGRA', 1],
    ['Corona Extra', 'Cervezas', 'botella', '355 ml', 7, 5.2, 24, '#1d3d8f', '#e9dfa8', 'CORONA', 1],
    ['Pilsen Callao lata', 'Latas', 'lata', '355 ml', 4.5, 3.4, 48, '#1f6b3a', '', 'PILSEN', 1],
    ['Cristal lata', 'Latas', 'lata', '355 ml', 4.5, 3.3, 48, '#c8102e', '', 'CRISTAL', 1],
    ['Cusqueña lata', 'Latas', 'lata', '355 ml', 5, 3.8, 36, '#b8902f', '', 'CUSQUEÑA', 0],
    ['Heineken lata', 'Latas', 'lata', '355 ml', 6, 4.5, 24, '#00843d', '', 'HEINEKEN', 1],
    ['Six pack Pilsen', 'Packs', 'pack', 'x6 latas', 25, 19.5, 15, '#1f6b3a', '', 'x6', 1],
    ['Caja Cristal', 'Packs', 'pack', 'x12 botellas', 72, 60, 8, '#c8102e', '', 'x12', 0],
    ['Pack Corona', 'Packs', 'pack', 'x6 botellas', 38, 29, 10, '#1d3d8f', '', 'x6', 0],
    ['Ron Cartavio Black', 'Licores', 'licor', '750 ml', 35, 26, 10, '#7a3b12', '', 'CARTAVIO', 1],
    ['Pisco Quebranta', 'Licores', 'licor', '700 ml', 39, 29, 8, '#f2efe6', '', 'PISCO', 0],
    ['Vodka Russkaya', 'Licores', 'licor', '750 ml', 28, 20, 10, '#e9f3f7', '', 'VODKA', 0],
    ['Hielo en bolsa', 'Complementos', 'otro', '3 kg', 5, 2.5, 30, '#7fc8e8', '', 'HIELO', 1],
    ['Coca-Cola', 'Complementos', 'otro', '1.5 L', 7.5, 5.6, 24, '#d0161b', '', 'COCA', 0]
  ].map(function (r, i) {
    return { id: 'p' + (i + 1), nombre: r[0], categoria: r[1], forma: r[2], presentacion: r[3], descripcion: '',
      precio: r[4], costo: r[5], stock: r[6], color: r[7], vidrio: r[8], etiqueta: r[9], imagen: '',
      activo: true, destacado: !!r[10], orden: i + 1 };
  });

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function r2(n) { return Math.round(n * 100) / 100; }
  function txt(v, max) { return String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 120); }
  function bool(v) { return v === true || v === 1 || /^(true|verdadero|si|sí|1)$/i.test(String(v)); }
  function tracked(p) { return p.stock !== '' && p.stock != null; }
  function hex(v) { return /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : ''; }
  function img(v) {
    v = String(v || '');
    return /^(https:\/\/[^\s"'<>]+|data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+\/=]+|img\/[\w\-.\/]+)$/.test(v) && v.length < 48000 ? v : '';
  }

  function normProduct(p) {
    p = p || {};
    return {
      id: txt(p.id, 40), nombre: txt(p.nombre, 60), categoria: txt(p.categoria, 30) || 'Cervezas',
      forma: FORMAS.indexOf(p.forma) >= 0 ? p.forma : 'botella', presentacion: txt(p.presentacion, 30),
      descripcion: txt(p.descripcion, 160), precio: r2(num(p.precio)), costo: r2(num(p.costo)),
      stock: (p.stock === '' || p.stock == null) ? '' : Math.max(0, Math.floor(num(p.stock))),
      color: hex(p.color) || '#c9a13b', vidrio: hex(p.vidrio), etiqueta: txt(p.etiqueta, 10), imagen: img(p.imagen),
      activo: p.activo === undefined || p.activo === '' ? true : bool(p.activo), destacado: bool(p.destacado),
      orden: Math.floor(num(p.orden))
    };
  }

  function normConfig(c) {
    c = c || {};
    var o = {};
    for (var k in DEF_CFG) o[k] = (c[k] === undefined || c[k] === '') ? DEF_CFG[k] : c[k];
    o.nombre = txt(o.nombre, 40); o.slogan = txt(o.slogan, 90);
    o.whatsapp = String(o.whatsapp).replace(/\D/g, '').slice(0, 15);
    o.yapeNumero = String(o.yapeNumero).replace(/\D/g, '').slice(0, 12);
    o.yapeNombre = txt(o.yapeNombre, 60); o.yapeQR = img(o.yapeQR);
    o.costoDelivery = r2(num(o.costoDelivery)); o.deliveryGratisDesde = r2(num(o.deliveryGratisDesde));
    o.pedidoMinimo = r2(num(o.pedidoMinimo)); o.horario = txt(o.horario, 80); o.zona = txt(o.zona, 120);
    o.modoPago = ['ambos', 'yape', 'whatsapp'].indexOf(o.modoPago) >= 0 ? o.modoPago : 'ambos';
    o.abierto = bool(o.abierto); o.aviso = txt(o.aviso, 140);
    o.prefijo = txt(o.prefijo, 5).replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'BH';
    return o;
  }

  function normOrder(o) {
    var items = o.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) { items = []; } }
    return {
      id: String(o.id), fecha: String(o.fecha), estado: ESTADOS.indexOf(o.estado) >= 0 ? o.estado : 'pendiente',
      cliente: String(o.cliente || ''), telefono: String(o.telefono || ''), entrega: String(o.entrega || ''),
      direccion: String(o.direccion || ''), referencia: String(o.referencia || ''), pago: String(o.pago || ''),
      origen: String(o.origen || ''), detalle: String(o.detalle || ''), subtotal: num(o.subtotal),
      delivery: num(o.delivery), total: num(o.total), costo: num(o.costo), ganancia: num(o.ganancia),
      nota: String(o.nota || ''), items: items || []
    };
  }

  function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }

  function create(db) {
    function auth(d) { if (!d || !db.verify(String(d.token || ''))) throw new Error('AUTH'); }
    function products() { return db.getProducts().map(normProduct).filter(function (p) { return p.id; }); }
    function sortP(a, b) { return (a.orden - b.orden) || a.nombre.localeCompare(b.nombre); }

    var A = {
      catalogo: function () {
        var cfg = normConfig(db.getConfig()), pub = {};
        PUBLIC_CFG.forEach(function (k) { pub[k] = cfg[k]; });
        var list = products().filter(function (p) { return p.activo; }).sort(sortP).map(function (p) {
          var q = {}; for (var k in p) if (k !== 'costo') q[k] = p[k]; return q;
        });
        return { config: pub, productos: list };
      },

      crearPedido: function (d) {
        return db.lock(function () {
          var cfg = normConfig(db.getConfig());
          if (!cfg.abierto) throw new Error('La tienda está cerrada en este momento. Vuelve en nuestro horario.');
          var map = {};
          products().forEach(function (p) { map[p.id] = p; });
          var items = [], sub = 0, cost = 0, touched = [];
          (d.items || []).slice(0, 40).forEach(function (it) {
            var p = map[String(it.id)], cant = Math.floor(num(it.cant));
            if (!p || !p.activo || cant < 1) return;
            cant = Math.min(cant, 99);
            if (tracked(p) && p.stock < cant)
              throw new Error(p.stock ? 'Solo quedan ' + p.stock + ' de ' + p.nombre + '.' : p.nombre + ' se agotó.');
            items.push({ id: p.id, nombre: p.nombre + (p.presentacion ? ' ' + p.presentacion : ''), cat: p.categoria,
              cant: cant, precio: p.precio, costo: p.costo });
            sub += p.precio * cant; cost += p.costo * cant;
            if (tracked(p)) { p.stock -= cant; touched.push(p); }
          });
          if (!items.length) throw new Error('Tu carrito está vacío.');
          sub = r2(sub); cost = r2(cost);
          if (sub < cfg.pedidoMinimo) throw new Error('El pedido mínimo es S/ ' + cfg.pedidoMinimo.toFixed(2) + '.');
          var cliente = txt(d.cliente, 60), tel = String(d.telefono || '').replace(/\D/g, '').slice(-12);
          var entrega = d.entrega === 'recojo' ? 'recojo' : 'delivery';
          var dir = txt(d.direccion, 160);
          if (cliente.length < 2) throw new Error('Escribe tu nombre.');
          if (tel.length < 9) throw new Error('Escribe un celular válido (9 dígitos).');
          if (entrega === 'delivery' && dir.length < 5) throw new Error('Escribe tu dirección para el delivery.');
          var del = entrega === 'delivery' && !(cfg.deliveryGratisDesde > 0 && sub >= cfg.deliveryGratisDesde) ? cfg.costoDelivery : 0;
          touched.forEach(function (p) { db.saveProduct(p); });
          var codigo = cfg.prefijo + '-' + pad(db.nextSeq(), 4);
          var o = {
            id: codigo, fecha: db.now().toISOString(), estado: 'pendiente', cliente: cliente, telefono: tel,
            entrega: entrega, direccion: entrega === 'delivery' ? dir : '', referencia: txt(d.referencia, 120),
            pago: d.pago === 'yape' ? 'yape' : 'whatsapp', origen: txt(d.origen, 40).toLowerCase(),
            detalle: items.map(function (i) { return i.cant + 'x ' + i.nombre; }).join(', '),
            subtotal: sub, delivery: del, total: r2(sub + del), costo: cost, ganancia: r2(sub - cost),
            nota: txt(d.nota, 200), items: items
          };
          db.addOrder(o);
          return { codigo: codigo, subtotal: sub, delivery: del, total: o.total,
            items: items.map(function (i) { return { nombre: i.nombre, cant: i.cant, precio: i.precio }; }) };
        });
      },

      login: function (d) {
        if (!db.checkPassword(String(d.clave || ''))) throw new Error('Clave incorrecta.');
        return { token: db.sign(Date.now() + 12 * 3600 * 1000) };
      },

      adminDatos: function (d) {
        auth(d);
        var desde = String(d.desde || '');
        var pedidos = db.getOrders().map(normOrder).filter(function (o) { return !desde || o.fecha >= desde; });
        return { productos: products().sort(sortP), pedidos: pedidos, config: normConfig(db.getConfig()) };
      },

      actualizarPedido: function (d) {
        auth(d);
        return db.lock(function () {
          var o = null;
          db.getOrders().forEach(function (x) { if (String(x.id) === String(d.id)) o = normOrder(x); });
          if (!o) throw new Error('Pedido no encontrado.');
          var nuevo = ESTADOS.indexOf(d.estado) >= 0 ? d.estado : o.estado;
          if (nuevo !== o.estado && (nuevo === 'cancelado' || o.estado === 'cancelado')) {
            var sign = nuevo === 'cancelado' ? 1 : -1, map = {};
            products().forEach(function (p) { map[p.id] = p; });
            o.items.forEach(function (i) {
              var p = map[i.id];
              if (p && tracked(p)) { p.stock = Math.max(0, p.stock + sign * i.cant); db.saveProduct(p); }
            });
          }
          o.estado = nuevo;
          if (d.nota !== undefined) o.nota = txt(d.nota, 200);
          db.saveOrder(o);
          return o;
        });
      },

      guardarProducto: function (d) {
        auth(d);
        var p = normProduct(d.producto);
        if (!p.id) p.id = 'p' + Date.now().toString(36);
        if (p.nombre.length < 2) throw new Error('Falta el nombre.');
        if (p.precio <= 0) throw new Error('El precio debe ser mayor a 0.');
        db.saveProduct(p);
        return p;
      },

      eliminarProducto: function (d) { auth(d); db.deleteProduct(String(d.id)); return true; },

      guardarConfig: function (d) {
        auth(d);
        var c = normConfig(d.config);
        db.saveConfig(c);
        return c;
      },

      cambiarClave: function (d) {
        auth(d);
        if (String(d.nueva || '').length < 6) throw new Error('La clave debe tener al menos 6 caracteres.');
        db.setPassword(String(d.nueva));
        return true;
      }
    };

    return {
      handle: function (action, data) {
        if (!A.hasOwnProperty(action)) throw new Error('Acción no válida.');
        return A[action](data || {});
      }
    };
  }

  return { create: create, SEED: SEED, DEF_CFG: DEF_CFG, normConfig: normConfig, normOrder: normOrder, VENTA: VENTA };
})();
