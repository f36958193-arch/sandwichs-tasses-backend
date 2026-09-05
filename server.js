/**
 * Sandwichs & Tasses — Backend API
 * ---------------------------------------------------
 * Écrit uniquement avec les modules natifs de Node.js
 * (aucun "npm install" nécessaire — juste Node.js).
 *
 * Démarrage :   node server.js
 * Par défaut, écoute sur http://localhost:3000
 *
 * Les données sont sauvegardées dans data.json (à côté
 * de ce fichier), donc elles survivent aux redémarrages
 * du serveur — contrairement au prototype précédent qui
 * perdait tout à la fermeture de la page.
 * ---------------------------------------------------
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sandwichs2026';
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ---------------------------------------------------
 * Petite "base de données" fichier JSON
 * ------------------------------------------------- */
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      accounts: [],
      dishes: [
        { id: 1, name: "Club Sandwich", desc: "Poulet grillé, bacon, œuf, crudités, pain toasté", price: 2500, available: true, image: null, section: "exterieur" },
        { id: 2, name: "Sandwich Poulet Braisé", desc: "Poulet mariné maison, salade, sauce piquante douce", price: 2000, available: true, image: null, section: "exterieur" },
        { id: 3, name: "Sandwich Thon", desc: "Thon, œuf dur, mayonnaise, crudités fraîches", price: 1800, available: true, image: null, section: "exterieur" },
        { id: 4, name: "Croque-Monsieur", desc: "Jambon, fromage fondu, pain de mie doré", price: 1500, available: true, image: null, section: "exterieur" },
        { id: 5, name: "Cappuccino", desc: "Café espresso, mousse de lait onctueuse", price: 1000, available: true, image: null, section: "exterieur" },
        { id: 6, name: "Café Latte", desc: "Espresso allongé au lait chaud", price: 1000, available: true, image: null, section: "exterieur" },
        { id: 7, name: "Jus de bissap maison", desc: "Infusé au gingembre, servi frais", price: 800, available: true, image: null, section: "exterieur" },
        { id: 8, name: "Assiette Gourmande Sandwichs & Tasses", desc: "Trois mini-sandwichs assortis + boisson chaude au choix, salon privé", price: 6000, available: true, image: null, section: "vip" },
        { id: 9, name: "Sandwich Saumon Fumé", desc: "Saumon fumé, avocat, pain complet, salon privé", price: 4000, available: true, image: null, section: "vip" }
      ],
      orders: [],
      reservations: [],
      counters: { dish: 10, order: 1, reservation: 1 }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();

/* ---------------------------------------------------
 * Aides HTTP
 * ------------------------------------------------- */
function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      // Limite de sécurité : 15 Mo (photos en base64 comprises)
      if (size > 15 * 1024 * 1024) {
        reject(new Error('Payload trop volumineux'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Enregistre une image base64 sur disque et renvoie son URL relative (/uploads/xxx.png)
function saveBase64Image(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = crypto.randomBytes(12).toString('hex') + '.' + ext;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(match[2], 'base64'));
  return '/uploads/' + filename;
}

function findAccount(email) {
  return db.accounts.find(a => a.email.toLowerCase() === String(email).toLowerCase());
}

/* ---------------------------------------------------
 * Routeur
 * ------------------------------------------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean); // ex: ['api','dishes']

  if (req.method === 'OPTIONS') {
    return sendJSON(res, 204, {});
  }

  // ---- Fichiers uploadés (photos) ----
  if (req.method === 'GET' && parts[0] === 'uploads' && parts[1]) {
    const filepath = path.join(UPLOADS_DIR, parts[1]);
    if (fs.existsSync(filepath)) {
      const ext = path.extname(filepath).slice(1);
      res.writeHead(200, { 'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`, 'Access-Control-Allow-Origin': '*' });
      return fs.createReadStream(filepath).pipe(res);
    }
    res.writeHead(404); return res.end();
  }

  if (parts[0] !== 'api') {
    return sendJSON(res, 404, { error: 'Route inconnue' });
  }

  try {
    /* ============ CONNEXION ADMIN ============ */
    if (req.method === 'POST' && parts[1] === 'admin' && parts[2] === 'login') {
      const body = await readBody(req);
      if (body.password === ADMIN_PASSWORD) return sendJSON(res, 200, { ok: true });
      return sendJSON(res, 401, { error: 'Mot de passe incorrect' });
    }

    /* ============ COMPTES ============ */
    // Créer un compte (inscription)
    if (req.method === 'POST' && parts[1] === 'accounts') {
      const body = await readBody(req);
      const { nom, prenom, email } = body;
      if (!nom || !prenom || !email) return sendJSON(res, 400, { error: 'nom, prenom et email sont requis' });
      let account = findAccount(email);
      if (account) return sendJSON(res, 200, account); // déjà existant → "connexion"
      const photoUrl = saveBase64Image(body.photo);
      account = { id: crypto.randomUUID(), nom, prenom, email, photo: photoUrl, createdAt: new Date().toISOString() };
      db.accounts.push(account);
      saveData(db);
      return sendJSON(res, 201, account);
    }

    // Récupérer un compte par email (reconnexion)
    if (req.method === 'GET' && parts[1] === 'accounts' && parts[2]) {
      const account = findAccount(decodeURIComponent(parts[2]));
      if (!account) return sendJSON(res, 404, { error: 'Compte introuvable' });
      return sendJSON(res, 200, account);
    }

    /* ============ PLATS ============ */
    if (req.method === 'GET' && parts[1] === 'dishes') {
      return sendJSON(res, 200, db.dishes);
    }

    if (req.method === 'POST' && parts[1] === 'admin' && parts[2] === 'dishes') {
      const body = await readBody(req);
      const { name, desc, price, available, section } = body;
      if (!name || price == null) return sendJSON(res, 400, { error: 'name et price sont requis' });
      const photoUrl = saveBase64Image(body.image);
      const dish = {
        id: db.counters.dish++,
        name, desc: desc || '', price: Number(price),
        available: available !== false,
        image: photoUrl,
        section: section === 'vip' ? 'vip' : 'exterieur'
      };
      db.dishes.push(dish);
      saveData(db);
      return sendJSON(res, 201, dish);
    }

    if (req.method === 'PATCH' && parts[1] === 'admin' && parts[2] === 'dishes' && parts[3]) {
      const dish = db.dishes.find(d => d.id === Number(parts[3]));
      if (!dish) return sendJSON(res, 404, { error: 'Plat introuvable' });
      const body = await readBody(req);
      if (typeof body.available === 'boolean') dish.available = body.available;
      if (body.price != null) dish.price = Number(body.price);
      if (body.name) dish.name = body.name;
      if (body.desc != null) dish.desc = body.desc;
      if (body.section) dish.section = body.section;
      saveData(db);
      return sendJSON(res, 200, dish);
    }

    if (req.method === 'DELETE' && parts[1] === 'admin' && parts[2] === 'dishes' && parts[3]) {
      const idx = db.dishes.findIndex(d => d.id === Number(parts[3]));
      if (idx === -1) return sendJSON(res, 404, { error: 'Plat introuvable' });
      db.dishes.splice(idx, 1);
      saveData(db);
      return sendJSON(res, 200, { deleted: true });
    }

    /* ============ COMMANDES ============ */
    if (req.method === 'POST' && parts[1] === 'orders') {
      const body = await readBody(req);
      const { email, items, mode, table, address, phone } = body;
      const account = findAccount(email);
      if (!account) return sendJSON(res, 400, { error: 'Compte introuvable' });
      if (!items || !items.length) return sendJSON(res, 400, { error: 'Panier vide' });
      if (!phone) return sendJSON(res, 400, { error: 'Téléphone requis' });
      if (mode === 'livraison' && !address) return sendJSON(res, 400, { error: 'Adresse requise pour la livraison' });
      if (mode !== 'livraison' && !table) return sendJSON(res, 400, { error: 'Numéro de table requis' });

      const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
      const order = {
        id: db.counters.order++,
        accountEmail: account.email,
        clientName: `${account.prenom} ${account.nom}`,
        clientPhoto: account.photo,
        items, total, mode: mode || 'surplace', table: table || '', address: address || '',
        phone, note: body.note || '',
        status: 'attente', adminMessage: null,
        date: new Date().toLocaleString('fr-FR')
      };
      db.orders.unshift(order);
      saveData(db);
      return sendJSON(res, 201, order);
    }

    if (req.method === 'GET' && parts[1] === 'orders') {
      const email = url.searchParams.get('email');
      const list = email ? db.orders.filter(o => o.accountEmail.toLowerCase() === email.toLowerCase()) : db.orders;
      return sendJSON(res, 200, list);
    }

    if (req.method === 'GET' && parts[1] === 'admin' && parts[2] === 'orders') {
      return sendJSON(res, 200, db.orders);
    }

    if (req.method === 'PATCH' && parts[1] === 'admin' && parts[2] === 'orders' && parts[3]) {
      const order = db.orders.find(o => o.id === Number(parts[3]));
      if (!order) return sendJSON(res, 404, { error: 'Commande introuvable' });
      const body = await readBody(req);
      if (body.status) order.status = body.status;
      if (body.adminMessage != null) order.adminMessage = body.adminMessage;
      saveData(db);
      return sendJSON(res, 200, order);
    }

    /* ============ RÉSERVATIONS ============ */
    if (req.method === 'POST' && parts[1] === 'reservations') {
      const body = await readBody(req);
      const { email, date, time, table, people, phone } = body;
      const account = findAccount(email);
      if (!account) return sendJSON(res, 400, { error: 'Compte introuvable' });
      if (!date || !time || !table || !phone) return sendJSON(res, 400, { error: 'date, time, table et phone sont requis' });

      const resa = {
        id: db.counters.reservation++,
        accountEmail: account.email,
        clientName: `${account.prenom} ${account.nom}`,
        clientPhoto: account.photo,
        date, time, table, people: people || 1, phone, note: body.note || '',
        occasion: body.occasion || null,
        status: 'attente', adminMessage: null,
        dateCreated: new Date().toLocaleString('fr-FR')
      };
      db.reservations.unshift(resa);
      saveData(db);
      return sendJSON(res, 201, resa);
    }

    if (req.method === 'GET' && parts[1] === 'reservations') {
      const email = url.searchParams.get('email');
      const list = email ? db.reservations.filter(r => r.accountEmail.toLowerCase() === email.toLowerCase()) : db.reservations;
      return sendJSON(res, 200, list);
    }

    if (req.method === 'GET' && parts[1] === 'admin' && parts[2] === 'reservations') {
      return sendJSON(res, 200, db.reservations);
    }

    if (req.method === 'PATCH' && parts[1] === 'admin' && parts[2] === 'reservations' && parts[3]) {
      const resa = db.reservations.find(r => r.id === Number(parts[3]));
      if (!resa) return sendJSON(res, 404, { error: 'Réservation introuvable' });
      const body = await readBody(req);
      if (body.status) resa.status = body.status;
      if (body.adminMessage != null) resa.adminMessage = body.adminMessage;
      saveData(db);
      return sendJSON(res, 200, resa);
    }

    /* ============ STATISTIQUES ADMIN ============ */
    if (req.method === 'GET' && parts[1] === 'admin' && parts[2] === 'stats') {
      const orderedEmails = new Set([
        ...db.orders.map(o => o.accountEmail),
        ...db.reservations.map(r => r.accountEmail)
      ]);
      return sendJSON(res, 200, {
        visitors: db.accounts.length,
        ordered: orderedEmails.size
      });
    }

    return sendJSON(res, 404, { error: 'Route inconnue' });
  } catch (err) {
    console.error(err);
    return sendJSON(res, 500, { error: 'Erreur serveur', detail: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Sandwichs & Tasses — API démarrée sur http://localhost:${PORT}`);
});
