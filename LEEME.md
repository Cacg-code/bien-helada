# Bien Helada — tienda de bebidas + panel

Tienda web (celular primero) con exhibidora 3D, carrito, pago por **Yape** o pedido por **WhatsApp**, y panel con ventas, ganancias y ranking.
Todo gratis: la web en **GitHub Pages** y la base de datos en **Google Sheets**.

- Tienda: `index.html`
- Panel: `admin.html` (clave)
- Sin conectar Sheets funciona en **modo demo** (datos de ejemplo solo en tu navegador, clave `admin123`).

---

## 1. Conectar la base de datos (10 min, una sola vez)

1. Entra a <https://sheets.new> con tu cuenta de Google y ponle de nombre **Bien Helada BD**.
2. Menú **Extensiones → Apps Script**.
3. Borra lo que haya en `Código.gs` y pega todo `apps-script/Code.gs`.
4. Botón **+ → Secuencia de comandos**, nómbralo `Core` y pega **todo** `js/core.js`.
5. Guarda (💾). Arriba elige la función **setup** y dale **Ejecutar**. Acepta los permisos
   (“Google no ha verificado esta app” → *Configuración avanzada* → *Ir a… (no seguro)*: es tu propio script).
6. **Implementar → Nueva implementación** → tipo **App web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - Copia la **URL** que termina en `/exec`.
7. Abre `js/config.js` y pega la URL:
   ```js
   window.APP_CONFIG = { API_URL: 'https://script.google.com/macros/s/XXXX/exec' };
   ```
8. Sube el cambio (commit + push). Listo: los pedidos caen en la hoja **Pedidos**.
9. Entra a `admin.html` con la clave **cambiar123** y cámbiala en **Ajustes**.

> Si cambias algo en Code.gs: **Implementar → Gestionar implementaciones → ✏️ → Versión: nueva**. Así la URL no cambia.
> Olvidaste la clave: en Apps Script ejecuta `resetClave` (vuelve a `cambiar123`).

## 2. Configurar el negocio (en el panel → Ajustes)

- Nombre, frase, horario, zona, aviso de promo.
- **WhatsApp** del negocio con 51 adelante (ej. `51987654321`).
- **Número y titular de Yape** + **QR** (en Yape: *Mi QR → Descargar* y súbelo).
- Costo de delivery, delivery gratis desde, pedido mínimo.
- Forma de cobro: Yape, WhatsApp o ambos.
- Productos: precio, **costo** (para calcular la ganancia), stock, foto o dibujo.

## 3. Sobre Yape (importante)

Yape **no permite** abrir la app con el monto ya puesto para un Yape personal (eso solo existe para empresas con pasarela, que cobra comisión).
Por eso la web hace lo más rápido posible:

1. Muestra el **monto** y el **número** con botón *Copiar* y el **QR** (se puede descargar y escanear desde la galería en Yape).
2. Pide poner el **código del pedido** (ej. `BH-0012`) en el mensaje del Yape.
3. Botón **“Ya yapeé · enviar captura”** abre tu WhatsApp con el pedido listo.
4. Tú revisas el Yape y en el panel marcas **Pagado** → **Entregado**.

Solo los pedidos **Pagados** o **Entregados** cuentan como venta en los reportes.

## 4. Links por grupo de WhatsApp

En **Ajustes → Links para cada grupo** crea un link por grupo (ej. `…/?ref=vecinos-mz-b`).
En **Resumen → Ventas por grupo** verás cuál grupo vende más.

## 5. Panel

- Periodos: hoy, 7 días, quincena (1–15 / 16–fin), mes, anteriores o rango, con comparación vs. el periodo anterior.
- Ventas, ganancia, margen, ticket promedio, unidades.
- Más vendido, lo que menos sale, lo que más ganancia deja, por categoría, por hora y por grupo.
- Stock bajo, pedidos pendientes con aviso, descarga CSV para Excel.
- La hoja de Google es tu respaldo: **Archivo → Descargar** cuando quieras. No borres las filas de encabezado.

## 6. Legal (Perú)

- La web ya muestra **“Prohibida la venta de bebidas alcohólicas a menores de 18 años”** y **“Tomar bebidas alcohólicas en exceso es dañino”** (Ley 28681) y pide confirmar mayoría de edad.
- Necesitas **licencia municipal** para venta de licor y respetar el horario de tu distrito.
- Al entregar, pide DNI si dudas de la edad.

## Fotos de productos (créditos)
Fotos recortadas (fondo quitado) de fuentes con licencia libre, **no de Google Imágenes** (esas tienen derechos de autor):
- **Wikimedia Commons** (CC BY / CC BY-SA / dominio público): Pilsen Callao, Cristal, Cusqueña, Corona Extra, Heineken (botella y lata), Russkaya, Johnnie Walker Red Label — ver cada archivo en commons.wikimedia.org (`PilsenCallao.jpg`, `CRISTAL.jpg`, `Cusqueña (5879671296).jpg`, `Corona_Extra_beer_bottle_(2019).png`, `Heineken_Bottle.jpg`, `Heineken-Dose.jpg`, `RusskayaVodka.jpg`, `Johnnie_Walker_Red_Label_2.jpg`).
- **Open Food Facts** (CC BY-SA): Cusqueña Negra, Pisco 1615.
- Los packs se armaron combinando esas mismas fotos. La botella de la pantalla de carga sale de la foto de Cristal.
- Lo ideal: reemplazarlas por **fotos propias** del stock (celular, fondo blanco) — ponlas en `img/productos/` con el mismo nombre.
- Las marcas son de sus dueños; se muestran solo para identificar el producto que vendes.
