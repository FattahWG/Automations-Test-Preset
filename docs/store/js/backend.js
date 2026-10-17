/*
 * Lawak Store mock backend.
 * The same file runs in the browser (data in localStorage) and in Node (data in memory),
 * so the UI tests and the API tests exercise one set of business rules.
 * Demo only: there is no real security, payment or persistence here.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LawakBackend = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DATA_VERSION = 3;
  const SHIPPING_FEE = 15000;
  const FREE_SHIPPING_FROM = 300000;
  const MAX_QTY_PER_ITEM = 10;
  const ORDER_FLOW = {
    Paid: ['Processing', 'Cancelled'],
    Processing: ['Shipped', 'Cancelled'],
    Shipped: ['Delivered'],
    Delivered: [],
    Cancelled: [],
  };

  // Demo-only hash so the seed does not hold plain passwords. Not a real password hash.
  function demoHash(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return 'demo$' + h.toString(16);
  }

  function daysAgo(n) {
    return new Date(Date.now() - n * 86400000).toISOString();
  }

  function seed() {
    const users = [
      { id: 'u1', name: 'Demo Admin', email: 'login@demo.com', password: demoHash('Logindemo123'), role: 'admin', status: 'active', createdAt: daysAgo(120) },
      { id: 'u2', name: 'Sari Wulandari', email: 'customer@demo.com', password: demoHash('Customer123'), role: 'customer', status: 'active', createdAt: daysAgo(60) },
      { id: 'u3', name: 'Budi Santoso', email: 'budi@demo.com', password: demoHash('Budi12345'), role: 'customer', status: 'disabled', createdAt: daysAgo(45) },
      { id: 'u4', name: 'Rina Hartono', email: 'rina@demo.com', password: demoHash('Rina12345'), role: 'customer', status: 'active', createdAt: daysAgo(30) },
      { id: 'u5', name: 'Agus Pratama', email: 'agus@demo.com', password: demoHash('Agus12345'), role: 'customer', status: 'active', createdAt: daysAgo(12) },
    ];
    const p = (id, sku, name, category, price, stock, description, status) =>
      ({ id, sku, name, category, price, stock, description, status: status || 'active', createdAt: daysAgo(90) });
    const products = [
      p('p1', 'LS-APP-001', 'Lawak Classic Tee', 'Apparel', 149000, 40, 'Soft cotton tee with the Lawak Store wordmark. Regular fit.'),
      p('p2', 'LS-APP-002', 'Batik Pattern Hoodie', 'Apparel', 329000, 18, 'Fleece hoodie with a modern batik pattern on the sleeves.'),
      p('p3', 'LS-APP-003', 'Sarong Beach Shorts', 'Apparel', 119000, 25, 'Light shorts made from sarong fabric. Quick dry.'),
      p('p4', 'LS-ACC-001', 'Canvas Tote Bag', 'Accessories', 89000, 60, 'Heavy canvas tote with an inside pocket.'),
      p('p5', 'LS-ACC-002', 'Enamel Pin Set', 'Accessories', 59000, 100, 'Set of four enamel pins: wayang, kopi, scooter and rice field.'),
      p('p6', 'LS-ACC-003', 'Bucket Hat', 'Accessories', 99000, 0, 'Washed cotton bucket hat. Back in stock soon.'),
      p('p7', 'LS-HOM-001', 'Ceramic Coffee Mug', 'Home', 79000, 35, 'Handmade ceramic mug, 350 ml.'),
      p('p8', 'LS-HOM-002', 'Rattan Coaster Set', 'Home', 69000, 22, 'Set of six woven rattan coasters.'),
      p('p9', 'LS-HOM-003', 'Jasmine Scented Candle', 'Home', 129000, 12, 'Soy wax candle with a jasmine scent. Burns about 40 hours.'),
      p('p10', 'LS-FNB-001', 'Kopi Toraja Beans 250g', 'Food & Drink', 95000, 30, 'Medium roast Toraja arabica, whole beans.'),
      p('p11', 'LS-FNB-002', 'Spicy Cassava Chips', 'Food & Drink', 25000, 150, 'Crunchy keripik singkong with chili seasoning.'),
      p('p12', 'LS-APP-004', 'Anniversary Jacket', 'Apparel', 599000, 5, 'Limited jacket for the store anniversary. Not released yet.', 'draft'),
    ];
    const line = (pid, qty) => {
      const prod = products.find((x) => x.id === pid);
      return { productId: pid, name: prod.name, price: prod.price, qty };
    };
    const order = (id, userId, items, status, age) => {
      const user = users.find((u) => u.id === userId);
      const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
      const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
      return {
        id, userId, items, subtotal, shipping, total: subtotal + shipping, status,
        customer: { name: user.name, email: user.email, phone: '081234567890', address: 'Jl. Merdeka No. 10', city: 'Bandung', postalCode: '40111' },
        payment: { method: 'card', last4: '4242', status: status === 'Cancelled' ? 'refunded' : 'captured' },
        createdAt: daysAgo(age), updatedAt: daysAgo(age),
      };
    };
    const orders = [
      order('LS-10001', 'u2', [line('p1', 2), line('p7', 1)], 'Delivered', 40),
      order('LS-10002', 'u4', [line('p2', 1)], 'Delivered', 33),
      order('LS-10003', 'u5', [line('p10', 2), line('p11', 4)], 'Shipped', 9),
      order('LS-10004', 'u2', [line('p4', 1), line('p5', 1)], 'Processing', 4),
      order('LS-10005', 'u4', [line('p9', 2)], 'Cancelled', 3),
      order('LS-10006', 'u5', [line('p3', 1), line('p8', 1)], 'Paid', 1),
    ];
    return { version: DATA_VERSION, users, products, orders, carts: {}, sessions: {}, nextOrder: 10007, nextId: 100 };
  }

  // ---------- helpers ----------
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const ok = (status, body) => ({ status, body });
  const fail = (status, code, message, fields) => ({ status, body: { error: { code, message, fields: fields || undefined } } });
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt });
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const isInt = (v) => Number.isInteger(v);

  function luhn(num) {
    let sum = 0;
    for (let i = 0; i < num.length; i++) {
      let d = Number(num[num.length - 1 - i]);
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    return sum % 10 === 0;
  }

  function validateCheckout(body) {
    const c = (body && body.customer) || {};
    const pay = (body && body.payment) || {};
    const fields = {};
    if (str(c.name).length < 2) fields.name = 'Enter your full name.';
    if (!EMAIL_RE.test(str(c.email))) fields.email = 'Enter a valid email address.';
    if (!/^\+?\d{9,15}$/.test(str(c.phone).replace(/[\s-]/g, ''))) fields.phone = 'Enter a phone number with 9 to 15 digits.';
    if (str(c.address).length < 10) fields.address = 'Enter a full street address (at least 10 characters).';
    if (!str(c.city)) fields.city = 'Enter your city.';
    // DEF-001 (seeded on purpose for the QA demo): the rule is "exactly 5 digits", but 4 digits pass.
    if (!/^\d{4,5}$/.test(str(c.postalCode))) fields.postalCode = 'Enter a 5-digit postal code.';
    const card = str(pay.cardNumber).replace(/\s/g, '');
    if (!/^\d{16}$/.test(card) || !luhn(card)) fields.cardNumber = 'Enter a valid 16-digit card number.';
    const exp = /^(\d{2})\/(\d{2})$/.exec(str(pay.expiry));
    if (!exp || Number(exp[1]) < 1 || Number(exp[1]) > 12) fields.expiry = 'Enter the expiry date as MM/YY.';
    else {
      const end = new Date(2000 + Number(exp[2]), Number(exp[1]), 1);
      if (end <= new Date()) fields.expiry = 'This card has expired.';
    }
    if (!/^\d{3}$/.test(str(pay.cvc))) fields.cvc = 'Enter the 3-digit security code.';
    if (str(pay.cardName).length < 2) fields.cardName = 'Enter the name on the card.';
    return { fields, card };
  }

  function validateProduct(body, db, selfId) {
    const fields = {};
    const name = str(body.name);
    const sku = str(body.sku).toUpperCase();
    if (name.length < 3 || name.length > 80) fields.name = 'Name must be 3 to 80 characters.';
    if (!/^[A-Z0-9-]{3,20}$/.test(sku)) fields.sku = 'SKU must be 3 to 20 letters, digits or hyphens.';
    else if (db.products.some((p) => p.sku === sku && p.id !== selfId)) fields.sku = 'This SKU is already used.';
    if (!str(body.category)) fields.category = 'Choose a category.';
    if (!isInt(body.price) || body.price <= 0) fields.price = 'Price must be a whole number above 0.';
    if (!isInt(body.stock) || body.stock < 0) fields.stock = 'Stock must be a whole number, 0 or more.';
    if (body.status && !['active', 'draft'].includes(body.status)) fields.status = 'Status must be active or draft.';
    return { fields, value: { name, sku, category: str(body.category), price: body.price, stock: body.stock, description: str(body.description), status: body.status || 'active' } };
  }

  // ---------- backend ----------
  function createBackend(storage) {
    let db = storage.load();
    if (!db || db.version !== DATA_VERSION) { db = seed(); storage.save(db); }
    const save = () => storage.save(db);

    function auth(token) {
      const uid = token && db.sessions[token];
      const user = uid && db.users.find((u) => u.id === uid);
      return user && user.status === 'active' ? user : null;
    }

    function cartView(uid) {
      const items = (db.carts[uid] || []).map((it) => {
        const prod = db.products.find((p) => p.id === it.productId);
        return prod ? { productId: prod.id, name: prod.name, price: prod.price, stock: prod.stock, qty: it.qty, lineTotal: prod.price * it.qty } : null;
      }).filter(Boolean);
      const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
      const shipping = items.length === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
      return { items, count: items.reduce((s, it) => s + it.qty, 0), subtotal, shipping, total: subtotal + shipping };
    }

    const routes = [];
    const on = (method, pattern, opts, fn) => {
      const keys = [];
      const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
      routes.push({ method, re, keys, fn, auth: opts.auth || null });
    };

    // auth
    on('POST', '/api/auth/login', {}, ({ body }) => {
      const email = str(body.email).toLowerCase();
      const fields = {};
      if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';
      if (!str(body.password)) fields.password = 'Enter your password.';
      if (Object.keys(fields).length) return fail(400, 'VALIDATION_ERROR', 'Check the highlighted fields.', fields);
      const user = db.users.find((u) => u.email === email);
      if (!user || user.password !== demoHash(String(body.password))) return fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      if (user.status !== 'active') return fail(403, 'ACCOUNT_DISABLED', 'This account is disabled. Contact support.');
      const token = 'tok_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      db.sessions[token] = user.id; save();
      return ok(200, { token, user: publicUser(user) });
    });
    on('POST', '/api/auth/register', {}, ({ body }) => {
      const name = str(body.name);
      const email = str(body.email).toLowerCase();
      const password = String(body.password || '');
      const fields = {};
      if (name.length < 2 || name.length > 50) fields.name = 'Name must be 2 to 50 characters.';
      if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';
      else if (db.users.some((u) => u.email === email)) fields.email = 'An account with this email already exists.';
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) fields.password = 'Use at least 8 characters with letters and numbers.';
      if (Object.keys(fields).length) {
        const taken = fields.email && fields.email.startsWith('An account');
        return fail(taken && Object.keys(fields).length === 1 ? 409 : 400, taken && Object.keys(fields).length === 1 ? 'EMAIL_TAKEN' : 'VALIDATION_ERROR', 'Check the highlighted fields.', fields);
      }
      const user = { id: 'u' + db.nextId++, name, email, password: demoHash(password), role: 'customer', status: 'active', createdAt: new Date().toISOString() };
      db.users.push(user); save();
      return ok(201, { user: publicUser(user) });
    });
    on('POST', '/api/auth/logout', {}, ({ token }) => { delete db.sessions[token]; save(); return ok(204, null); });
    on('GET', '/api/auth/me', { auth: 'any' }, ({ user }) => ok(200, { user: publicUser(user) }));

    // catalog
    on('GET', '/api/categories', {}, () => ok(200, { categories: [...new Set(db.products.filter((p) => p.status === 'active').map((p) => p.category))].sort() }));
    on('GET', '/api/products', {}, ({ query }) => {
      const q = str(query.search).toLowerCase();
      const cat = str(query.category);
      let list = db.products.filter((p) => p.status === 'active');
      if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
      if (cat) list = list.filter((p) => p.category === cat);
      if (query.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
      else if (query.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
      else list.sort((a, b) => a.name.localeCompare(b.name));
      return ok(200, { products: clone(list), total: list.length });
    });
    on('GET', '/api/products/:id', {}, ({ params, user }) => {
      const prod = db.products.find((p) => p.id === params.id);
      if (!prod || (prod.status !== 'active' && !(user && user.role === 'admin'))) return fail(404, 'NOT_FOUND', 'Product not found.');
      return ok(200, { product: clone(prod) });
    });

    // cart
    on('GET', '/api/cart', { auth: 'any' }, ({ user }) => ok(200, cartView(user.id)));
    on('POST', '/api/cart/items', { auth: 'any' }, ({ user, body }) => {
      const prod = db.products.find((p) => p.id === body.productId && p.status === 'active');
      if (!prod) return fail(404, 'NOT_FOUND', 'Product not found.');
      const qty = body.qty === undefined ? 1 : body.qty;
      if (!isInt(qty) || qty < 1) return fail(400, 'VALIDATION_ERROR', 'Quantity must be 1 or more.', { qty: 'Quantity must be 1 or more.' });
      const cart = db.carts[user.id] || (db.carts[user.id] = []);
      const line = cart.find((it) => it.productId === prod.id);
      const next = (line ? line.qty : 0) + qty;
      if (prod.stock === 0) return fail(409, 'OUT_OF_STOCK', 'This product is out of stock.');
      if (next > Math.min(prod.stock, MAX_QTY_PER_ITEM)) return fail(409, 'QTY_LIMIT', `You can buy at most ${Math.min(prod.stock, MAX_QTY_PER_ITEM)} of this item.`);
      if (line) line.qty = next; else cart.push({ productId: prod.id, qty });
      save();
      return ok(201, cartView(user.id));
    });
    on('PATCH', '/api/cart/items/:productId', { auth: 'any' }, ({ user, params, body }) => {
      const cart = db.carts[user.id] || [];
      const line = cart.find((it) => it.productId === params.productId);
      if (!line) return fail(404, 'NOT_FOUND', 'This item is not in your cart.');
      const prod = db.products.find((p) => p.id === line.productId);
      const limit = Math.min(prod.stock, MAX_QTY_PER_ITEM);
      if (!isInt(body.qty) || body.qty < 1 || body.qty > limit) return fail(400, 'VALIDATION_ERROR', `Quantity must be 1 to ${limit}.`, { qty: `Quantity must be 1 to ${limit}.` });
      line.qty = body.qty; save();
      return ok(200, cartView(user.id));
    });
    on('DELETE', '/api/cart/items/:productId', { auth: 'any' }, ({ user, params }) => {
      db.carts[user.id] = (db.carts[user.id] || []).filter((it) => it.productId !== params.productId); save();
      return ok(200, cartView(user.id));
    });

    // orders
    on('POST', '/api/orders', { auth: 'any' }, ({ user, body }) => {
      const cart = cartView(user.id);
      if (cart.items.length === 0) return fail(400, 'CART_EMPTY', 'Your cart is empty.');
      const { fields, card } = validateCheckout(body);
      if (Object.keys(fields).length) return fail(400, 'VALIDATION_ERROR', 'Check the highlighted fields.', fields);
      for (const it of cart.items) {
        if (it.qty > it.stock) return fail(409, 'OUT_OF_STOCK', `${it.name} has only ${it.stock} left.`);
      }
      if (card === '4000000000000002') return fail(402, 'PAYMENT_DECLINED', 'The card was declined. Use another card.');
      for (const it of cart.items) db.products.find((p) => p.id === it.productId).stock -= it.qty;
      const c = body.customer;
      const order = {
        id: 'LS-' + db.nextOrder++, userId: user.id,
        items: cart.items.map((it) => ({ productId: it.productId, name: it.name, price: it.price, qty: it.qty })),
        subtotal: cart.subtotal, shipping: cart.shipping, total: cart.total, status: 'Paid',
        customer: { name: str(c.name), email: str(c.email), phone: str(c.phone), address: str(c.address), city: str(c.city), postalCode: str(c.postalCode) },
        payment: { method: 'card', last4: card.slice(-4), status: 'captured' },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      db.orders.push(order); db.carts[user.id] = []; save();
      return ok(201, { order: clone(order) });
    });
    on('GET', '/api/orders', { auth: 'any' }, ({ user }) =>
      ok(200, { orders: clone(db.orders.filter((o) => o.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))) }));
    on('GET', '/api/orders/:id', { auth: 'any' }, ({ user, params }) => {
      const order = db.orders.find((o) => o.id === params.id);
      if (!order || (order.userId !== user.id && user.role !== 'admin')) return fail(404, 'NOT_FOUND', 'Order not found.');
      return ok(200, { order: clone(order) });
    });

    // admin
    on('GET', '/api/admin/stats', { auth: 'admin' }, () => {
      const paid = db.orders.filter((o) => o.status !== 'Cancelled');
      const byStatus = {};
      db.orders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
      return ok(200, {
        revenue: paid.reduce((s, o) => s + o.total, 0),
        orders: db.orders.length,
        customers: db.users.filter((u) => u.role === 'customer').length,
        lowStock: db.products.filter((p) => p.status === 'active' && p.stock <= 5).map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
        byStatus,
        recentOrders: clone(db.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)),
      });
    });
    on('GET', '/api/admin/products', { auth: 'admin' }, ({ query }) => {
      const q = str(query.search).toLowerCase();
      let list = db.products.slice();
      if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
      return ok(200, { products: clone(list.sort((a, b) => a.sku.localeCompare(b.sku))) });
    });
    on('POST', '/api/admin/products', { auth: 'admin' }, ({ body }) => {
      const { fields, value } = validateProduct(body || {}, db, null);
      if (Object.keys(fields).length) return fail(400, 'VALIDATION_ERROR', 'Check the highlighted fields.', fields);
      const prod = Object.assign({ id: 'p' + db.nextId++, createdAt: new Date().toISOString() }, value);
      db.products.push(prod); save();
      return ok(201, { product: clone(prod) });
    });
    on('PUT', '/api/admin/products/:id', { auth: 'admin' }, ({ params, body }) => {
      const prod = db.products.find((p) => p.id === params.id);
      if (!prod) return fail(404, 'NOT_FOUND', 'Product not found.');
      const { fields, value } = validateProduct(body || {}, db, prod.id);
      if (Object.keys(fields).length) return fail(400, 'VALIDATION_ERROR', 'Check the highlighted fields.', fields);
      Object.assign(prod, value); save();
      return ok(200, { product: clone(prod) });
    });
    on('DELETE', '/api/admin/products/:id', { auth: 'admin' }, ({ params }) => {
      const before = db.products.length;
      db.products = db.products.filter((p) => p.id !== params.id);
      if (db.products.length === before) return fail(404, 'NOT_FOUND', 'Product not found.');
      Object.keys(db.carts).forEach((uid) => { db.carts[uid] = db.carts[uid].filter((it) => it.productId !== params.id); });
      save();
      return ok(204, null);
    });
    on('GET', '/api/admin/orders', { auth: 'admin' }, ({ query }) => {
      let list = db.orders.slice();
      if (str(query.status)) list = list.filter((o) => o.status === str(query.status));
      return ok(200, { orders: clone(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) });
    });
    on('PATCH', '/api/admin/orders/:id', { auth: 'admin' }, ({ params, body }) => {
      const order = db.orders.find((o) => o.id === params.id);
      if (!order) return fail(404, 'NOT_FOUND', 'Order not found.');
      const next = str(body.status);
      if (!(ORDER_FLOW[order.status] || []).includes(next)) return fail(409, 'INVALID_TRANSITION', `An order that is ${order.status} cannot change to ${next || 'nothing'}.`);
      if (next === 'Cancelled') {
        order.items.forEach((it) => { const p = db.products.find((x) => x.id === it.productId); if (p) p.stock += it.qty; });
        order.payment.status = 'refunded';
      }
      order.status = next; order.updatedAt = new Date().toISOString(); save();
      return ok(200, { order: clone(order) });
    });
    on('GET', '/api/admin/users', { auth: 'admin' }, () => ok(200, { users: db.users.map(publicUser) }));
    on('PATCH', '/api/admin/users/:id', { auth: 'admin' }, ({ user, params, body }) => {
      const target = db.users.find((u) => u.id === params.id);
      if (!target) return fail(404, 'NOT_FOUND', 'User not found.');
      if (target.id === user.id) return fail(409, 'SELF_CHANGE', 'You cannot change your own role or status.');
      const fields = {};
      if (body.role !== undefined && !['admin', 'customer'].includes(body.role)) fields.role = 'Role must be admin or customer.';
      if (body.status !== undefined && !['active', 'disabled'].includes(body.status)) fields.status = 'Status must be active or disabled.';
      if (Object.keys(fields).length) return fail(400, 'VALIDATION_ERROR', 'Check the highlighted fields.', fields);
      if (body.role !== undefined) target.role = body.role;
      if (body.status !== undefined) {
        target.status = body.status;
        if (body.status === 'disabled') Object.keys(db.sessions).forEach((t) => { if (db.sessions[t] === target.id) delete db.sessions[t]; });
      }
      save();
      return ok(200, { user: publicUser(target) });
    });

    on('POST', '/api/demo/reset', {}, () => { db = seed(); save(); return ok(200, { reset: true }); });

    function handle(req) {
      const method = (req.method || 'GET').toUpperCase();
      const [path, qs] = String(req.path || '/').split('?');
      const query = Object.assign({}, req.query || {});
      if (qs) new URLSearchParams(qs).forEach((v, k) => { query[k] = v; });
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(path);
        if (!m) continue;
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        const user = auth(req.token);
        if (r.auth && !user) return fail(401, 'UNAUTHORIZED', 'Sign in to continue.');
        if (r.auth === 'admin' && user.role !== 'admin') return fail(403, 'FORBIDDEN', 'You do not have access to this page.');
        try {
          return r.fn({ params, query, body: req.body || {}, token: req.token, user });
        } catch (e) {
          return fail(500, 'SERVER_ERROR', 'Something went wrong. Try again.');
        }
      }
      return fail(404, 'NOT_FOUND', 'Endpoint not found.');
    }

    return { handle, reset: () => { db = seed(); save(); } };
  }

  function memoryStorage() {
    let data = null;
    return { load: () => (data ? clone(data) : null), save: (d) => { data = clone(d); } };
  }

  function localStorageAdapter(key) {
    return {
      load: () => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
      save: (d) => { try { localStorage.setItem(key, JSON.stringify(d)); } catch (e) { /* storage full or blocked: keep running in memory */ } },
    };
  }

  return { createBackend, memoryStorage, localStorageAdapter, SHIPPING_FEE, FREE_SHIPPING_FROM, MAX_QTY_PER_ITEM };
});
