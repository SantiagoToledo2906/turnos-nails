// server/server.js - Express server that mimics Apps Script behavior
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch'); // node >=18 has global fetch but keeping for compat
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const DATA_DIR = path.join(__dirname, '..', 'data');
const TURNOS_FILE = path.join(DATA_DIR, 'turnos.json');
const RESERV_FILE = path.join(DATA_DIR, 'reservations.json');

const RES_EXPIRATION_MIN = parseInt(process.env.RES_EXPIRATION_MIN || '30', 10);
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ensure data dir exists
async function ensureData() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try { await fs.access(TURNOS_FILE); } catch { await fs.writeFile(TURNOS_FILE, '[]'); }
    try { await fs.access(RESERV_FILE); } catch { await fs.writeFile(RESERV_FILE, '{}'); }
  } catch (e) { console.error('Data init error', e); }
}

// simple mutex
let lock = false;
async function withLock(fn) {
  while (lock) await new Promise(r => setTimeout(r, 50));
  lock = true;
  try { return await fn(); } finally { lock = false; }
}

async function cleanupExpiredReservations(props) {
  const now = Date.now();
  for (const k of Object.keys(props)) {
    if (k.startsWith('res|')) {
      try {
        const ts = new Date(props[k].ts).getTime();
        if ((now - ts)/60000 > RES_EXPIRATION_MIN) delete props[k];
      } catch(e) { delete props[k]; }
    }
  }
}

// API: crearPago (POST)
app.post('/api/crearPago', async (req, res) => {
  const { nombre = '', fecha = '', hora = '', tipo = '' } = req.body;
  const sNombre = String(nombre).trim();
  const sFecha = String(fecha).trim();
  const sHora = String(hora).trim();
  const sTipo = String(tipo).trim();
  const resKey = `res|${sFecha}|${sHora}`;

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fechaReserva = new Date(sFecha);
  if (fechaReserva < hoy) return res.send('error_fecha');

  await ensureData();
  await withLock(async () => {
    const turnos = JSON.parse(await fs.readFile(TURNOS_FILE, 'utf8'));
    const props = JSON.parse(await fs.readFile(RESERV_FILE, 'utf8'));

    await cleanupExpiredReservations(props);

    const confirmKey = `confirmed|${resKey}`;
    if (props[confirmKey]) return res.send('occupied');

    const ocupado = turnos.some(r => r.fecha === sFecha && r.hora === sHora);
    if (ocupado || props[resKey]) return res.send('occupied');

    props[resKey] = { ts: (new Date()).toISOString() };

    await fs.writeFile(RESERV_FILE, JSON.stringify(props, null, 2));

    // If MercadoPago token is set, call API, otherwise return local confirm URL for testing
    if (!MP_ACCESS_TOKEN) {
      // return a local confirm link that simulates MercadoPago success redirect after "payment"
      const fake = `${BASE_URL}/confirm?status=success&nombre=${encodeURIComponent(sNombre)}&fecha=${encodeURIComponent(sFecha)}&hora=${encodeURIComponent(sHora)}&tipo=${encodeURIComponent(sTipo)}&resKey=${encodeURIComponent(resKey)}`;
      return res.send(fake);
    }

    // Build preference for MercadoPago
    const pref = {
      items: [{ title: `Reserva ${sTipo}`, quantity: 1, unit_price: 1, currency_id: "ARS" }],
      back_urls: {
        success: `${BASE_URL}/confirm?status=success&nombre=${encodeURIComponent(sNombre)}&fecha=${encodeURIComponent(sFecha)}&hora=${encodeURIComponent(sHora)}&tipo=${encodeURIComponent(sTipo)}`,
        failure: `${BASE_URL}/confirm?status=failure`,
        pending: `${BASE_URL}/confirm?status=pending`
      },
      auto_return: "approved"
    };

    try {
      const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
        },
        body: JSON.stringify(pref)
      });
      const txt = await mpResp.text();
      if (!mpResp.ok) {
        // cleanup reservation
        delete props[resKey];
        await fs.writeFile(RESERV_FILE, JSON.stringify(props, null, 2));
        console.error('MP error', mpResp.status, txt);
        return res.send('error');
      }
      const json = JSON.parse(txt);
      if (!json.init_point) {
        delete props[resKey];
        await fs.writeFile(RESERV_FILE, JSON.stringify(props, null, 2));
        console.error('MP no init_point', txt);
        return res.send('error');
      }
      return res.send(json.init_point);
    } catch (e) {
      delete props[resKey];
      await fs.writeFile(RESERV_FILE, JSON.stringify(props, null, 2));
      console.error('MP call error', e);
      return res.send('error');
    }
  });
});

// Confirmation endpoint (simulates doGet behavior)
app.get('/confirm', async (req, res) => {
  const { status } = req.query;
  await ensureData();
  if (status !== 'success') return res.send('<h3>Pago no confirmado.</h3>');

  const nombre = (req.query.nombre || '').trim();
  const fecha = (req.query.fecha || '').trim();
  const hora = (req.query.hora || '').trim();
  const tipo = (req.query.tipo || '').trim();
  const resKey = `res|${fecha}|${hora}`;

  await withLock(async () => {
    const turnos = JSON.parse(await fs.readFile(TURNOS_FILE, 'utf8'));
    const props = JSON.parse(await fs.readFile(RESERV_FILE, 'utf8'));

    await cleanupExpiredReservations(props);

    const confirmKey = `confirmed|${resKey}`;
    if (props[confirmKey]) {
      // already confirmed, render confirmation
      return res.send(renderConfirmation(nombre, fecha, hora, tipo));
    }

    const existe = turnos.some(r => r.fecha === fecha && r.hora === hora);
    if (!existe) {
      turnos.push({ nombre, fecha, hora, tipo, createdAt: (new Date()).toISOString(), resKey, status: 'CONFIRMED' });
      await fs.writeFile(TURNOS_FILE, JSON.stringify(turnos, null, 2));
    }

    props[confirmKey] = true;
    delete props[resKey];
    await fs.writeFile(RESERV_FILE, JSON.stringify(props, null, 2));

    return res.send(renderConfirmation(nombre, fecha, hora, tipo));
  });
});

function renderConfirmation(nombre, fecha, hora, tipo) {
  return `
  <html><head>
    <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Confirmación</title>
  </head>
  <body style="font-family:Poppins,sans-serif;text-align:center;margin-top:50px;">
    <h2 style="color:#c45ba3;">💅 ¡Tu turno fue reservado!</h2>
    <p>${nombre}, nos vemos el <b>${fecha}</b> a las <b>${hora}</b> para <b>${tipo}</b>.</p>
    <a href="/" style="color:#c45ba3;margin-top:20px;display:block;">Volver</a>
  </body></html>`;
}

// API to get occupied schedules for a date
app.get('/api/horarios', async (req, res) => {
  const fecha = (req.query.fecha || '').trim();
  await ensureData();
  const turnos = JSON.parse(await fs.readFile(TURNOS_FILE, 'utf8'));
  const props = JSON.parse(await fs.readFile(RESERV_FILE, 'utf8'));
  await cleanupExpiredReservations(props);

  const ocup = new Set();
  turnos.forEach(r => { if (r.fecha === fecha) ocup.add(r.hora); });
  Object.keys(props).forEach(k => {
    if (k.startsWith('res|')) {
      const parts = k.split('|');
      if (parts[1] === fecha) ocup.add(parts[2]);
    }
  });

  res.json(Array.from(ocup));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
