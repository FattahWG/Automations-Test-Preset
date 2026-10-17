import { request, setToken, hasToken, resetDemo, FREE_SHIPPING_FROM } from './api.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const state = { user: null, cartCount: 0 };
const CATEGORIES = ['Apparel', 'Accessories', 'Home', 'Food & Drink'];
const ORDER_FLOW = { Paid: ['Processing', 'Cancelled'], Processing: ['Shipped', 'Cancelled'], Shipped: ['Delivered'], Delivered: [], Cancelled: [] };
const STATUS_PILL = { Paid: 'info', Processing: 'warn', Shipped: 'info', Delivered: 'ok', Cancelled: 'bad', active: 'ok', draft: 'warn', disabled: 'bad', admin: 'info', customer: '' };

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const moneyFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const money = (n) => moneyFmt.format(n).replace(/ /g, ' ');
const date = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const pill = (text) => `<span class="pill ${STATUS_PILL[text] || ''}">${esc(text)}</span>`;
const errorOf = (res) => (res.body && res.body.error) || { message: 'Something went wrong. Try again.' };
const spinner = () => '<div class="spinner" role="status" aria-label="Loading"></div>';

const ART_COLORS = { Apparel: ['#c8262b', '#fde8e4'], Accessories: ['#1d7a48', '#e3f3ea'], Home: ['#6a3fa0', '#efe8f7'], 'Food & Drink': ['#a84a0c', '#fdeedd'] };
function art(product) {
  const [fg, bg] = ART_COLORS[product.category] || ['#3a3035', '#f3eeea'];
  const initials = product.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${bg}"/>` +
    `<circle cx="150" cy="48" r="60" fill="${fg}" opacity=".12"/><circle cx="40" cy="170" r="70" fill="${fg}" opacity=".1"/>` +
    `<text x="100" y="118" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="700" fill="${fg}" text-anchor="middle">${esc(initials)}</text></svg>`;
  return `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" alt="" loading="lazy">`;
}

function toast(message, type) {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function confirmDialog(text, okLabel) {
  const dlg = document.getElementById('confirm-dialog');
  document.getElementById('confirm-text').textContent = text;
  document.getElementById('confirm-ok').textContent = okLabel || 'Confirm';
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'confirm'), { once: true }));
}

function field({ name, label, type = 'text', value = '', autocomplete, hint, full, attrs = '' }) {
  return `<div class="field${full ? ' full' : ''}">
    <label for="f-${name}">${esc(label)}</label>
    <input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} aria-describedby="err-${name}${hint ? ` hint-${name}` : ''}" ${attrs}>
    ${hint ? `<span class="hint" id="hint-${name}">${esc(hint)}</span>` : ''}
    <span class="error" id="err-${name}"></span>
  </div>`;
}

function selectField({ name, label, options, value, full }) {
  return `<div class="field${full ? ' full' : ''}">
    <label for="f-${name}">${esc(label)}</label>
    <select id="f-${name}" name="${name}" aria-describedby="err-${name}">
      ${options.map((o) => { const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label; return `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}
    </select>
    <span class="error" id="err-${name}"></span>
  </div>`;
}

function clearErrors(form) {
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('.error').forEach((el) => { el.textContent = ''; });
  const alert = form.querySelector('.form-alert');
  if (alert) alert.innerHTML = '';
}

function showErrors(form, error) {
  const fields = error.fields || {};
  let first = null;
  Object.entries(fields).forEach(([name, msg]) => {
    const input = form.querySelector(`[name="${name}"]`);
    const err = form.querySelector(`#err-${name}`);
    if (input) { input.setAttribute('aria-invalid', 'true'); first = first || input; }
    if (err) err.textContent = msg;
  });
  const alert = form.querySelector('.form-alert');
  if (alert) alert.innerHTML = `<div class="alert error" role="alert">${esc(error.message)}</div>`;
  if (first) first.focus();
}

function busy(button, on, label) {
  if (!button) return;
  if (on) { button.dataset.label = button.textContent; button.textContent = label || 'Please wait...'; button.disabled = true; }
  else { button.textContent = button.dataset.label || button.textContent; button.disabled = false; }
}

// ---------- routing ----------
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

const routes = [
  ['/', homeView],
  ['/shop', shopView],
  ['/product/:id', productView],
  ['/login', loginView],
  ['/register', registerView],
  ['/cart', cartView, 'auth'],
  ['/checkout', checkoutView, 'auth'],
  ['/orders', ordersView, 'auth'],
  ['/order/:id', orderView, 'auth'],
  ['/admin', adminDashboardView, 'admin'],
  ['/admin/products', adminProductsView, 'admin'],
  ['/admin/products/new', adminProductFormView, 'admin'],
  ['/admin/products/:id/edit', adminProductFormView, 'admin'],
  ['/admin/orders', adminOrdersView, 'admin'],
  ['/admin/users', adminUsersView, 'admin'],
].map(([pattern, view, guard]) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  return { re, keys, view, guard };
});

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const { path, query } = parseHash();
  let match = null; let params = {};
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) { match = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; }
  }
  renderNav(path);
  if (!match) { $app.innerHTML = notFound(); return; }
  if (match.guard && !state.user) { go('#/login?next=' + encodeURIComponent(location.hash)); return; }
  if (match.guard === 'admin' && state.user.role !== 'admin') { $app.innerHTML = forbidden(); document.title = 'No access - Lawak Store'; return; }
  $app.innerHTML = spinner();
  try {
    await match.view({ params, query, isCurrent: () => seq === renderSeq });
  } catch (e) {
    console.error(e);
    if (seq === renderSeq) $app.innerHTML = `<div class="alert error" role="alert">The page could not load. Reload the page and try again.</div>`;
  }
  if (seq === renderSeq) $app.focus({ preventScroll: true });
}

function renderNav(path) {
  const cur = (p) => (path === p || (p !== '/' && path.startsWith(p + '/')) ? 'aria-current="page"' : '');
  const u = state.user;
  $nav.innerHTML = `
    <a href="#/shop" ${cur('/shop')}>Shop</a>
    ${u && u.role === 'admin' ? `<a href="#/admin" ${cur('/admin')}>Admin</a>` : ''}
    ${u ? `<a href="#/orders" ${cur('/orders')}>My orders</a>` : ''}
    <a href="#/cart" ${cur('/cart')}>Cart<span class="cart-badge" data-testid="cart-count" aria-label="${state.cartCount} items">${state.cartCount}</span></a>
    ${u ? `<span class="muted" style="padding:0 8px;font-size:.9rem" data-testid="signed-in-user">${esc(u.name)}</span><button class="link" type="button" id="logout-btn">Sign out</button>`
        : `<a href="#/login" ${cur('/login')}>Sign in</a>`}`;
  const btn = document.getElementById('logout-btn');
  if (btn) btn.addEventListener('click', logout);
}

async function refreshCartCount() {
  if (!state.user) { state.cartCount = 0; return; }
  const res = await request('GET', '/api/cart');
  state.cartCount = res.status === 200 ? res.body.count : 0;
}

async function logout() {
  await request('POST', '/api/auth/logout');
  setToken(null);
  state.user = null; state.cartCount = 0;
  toast('You are signed out.');
  go('#/');
}

// ---------- storefront ----------
function productCard(p) {
  const stock = p.stock === 0 ? '<span class="pill bad">Out of stock</span>' : p.stock <= 5 ? `<span class="pill warn">Only ${p.stock} left</span>` : '';
  return `<a class="card product-card" href="#/product/${esc(p.id)}" data-testid="product-card">
    <div class="art">${art(p)}</div>
    <div class="body"><span class="muted" style="font-size:.8rem">${esc(p.category)}</span><span class="name">${esc(p.name)}</span>
    <span class="row between"><span class="price">${money(p.price)}</span>${stock}</span></div></a>`;
}

async function homeView() {
  document.title = 'Lawak Store';
  const res = await request('GET', '/api/products');
  const featured = res.body.products.filter((p) => p.stock > 0).slice(0, 4);
  $app.innerHTML = `
    <section class="hero">
      <div><h1>Local goods with a sense of humor</h1>
        <p>Tees, totes, kopi and snacks from the Lawak Store team. Free shipping on orders from ${money(FREE_SHIPPING_FROM)}.</p>
        <div class="row"><a class="btn primary" href="#/shop">Shop all products</a>${state.user ? '' : '<a class="btn" href="#/login">Sign in</a>'}</div></div>
      <div class="hero-art">${art({ name: 'Lawak Store', category: 'Apparel' })}</div>
    </section>
    <div class="chips" aria-label="Categories">${CATEGORIES.map((c) => `<a class="chip" href="#/shop?category=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>
    <h2>Featured</h2>
    <div class="products">${featured.map(productCard).join('')}</div>`;
}

async function shopView({ query, isCurrent }) {
  document.title = 'Shop - Lawak Store';
  const qs = new URLSearchParams();
  if (query.search) qs.set('search', query.search);
  if (query.category) qs.set('category', query.category);
  if (query.sort) qs.set('sort', query.sort);
  const res = await request('GET', '/api/products?' + qs.toString());
  if (!isCurrent()) return;
  const list = res.body.products;
  $app.innerHTML = `
    <div class="row between"><h1>Shop</h1><span class="muted" data-testid="result-count">${list.length} ${list.length === 1 ? 'product' : 'products'}</span></div>
    <form class="toolbar" id="filter-form" role="search">
      <label class="sr-only" for="search">Search products</label>
      <input class="input" id="search" name="search" type="search" placeholder="Search by name or SKU" value="${esc(query.search || '')}">
      <label class="sr-only" for="category">Category</label>
      <select class="input" id="category" name="category"><option value="">All categories</option>${CATEGORIES.map((c) => `<option ${c === query.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <label class="sr-only" for="sort">Sort</label>
      <select class="input" id="sort" name="sort">
        <option value="">Sort: Name A-Z</option>
        <option value="price-asc" ${query.sort === 'price-asc' ? 'selected' : ''}>Price: low to high</option>
        <option value="price-desc" ${query.sort === 'price-desc' ? 'selected' : ''}>Price: high to low</option>
      </select>
      <button class="btn primary" type="submit">Search</button>
    </form>
    ${list.length ? `<div class="products">${list.map(productCard).join('')}</div>`
      : `<div class="card empty"><h2>No products match your search</h2><p class="muted">Try another word or category.</p><a class="btn" href="#/shop">Clear filters</a></div>`}`;
  const form = document.getElementById('filter-form');
  const apply = () => {
    const f = new URLSearchParams();
    ['search', 'category', 'sort'].forEach((k) => { const v = form.elements[k].value.trim(); if (v) f.set(k, v); });
    go('#/shop' + (f.toString() ? '?' + f.toString() : ''));
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
  form.elements.category.addEventListener('change', apply);
  form.elements.sort.addEventListener('change', apply);
}

async function productView({ params, isCurrent }) {
  const res = await request('GET', '/api/products/' + encodeURIComponent(params.id));
  if (!isCurrent()) return;
  if (res.status !== 200) { $app.innerHTML = notFound('This product does not exist or is not for sale.'); return; }
  const p = res.body.product;
  document.title = p.name + ' - Lawak Store';
  const max = Math.min(p.stock, 10);
  $app.innerHTML = `
    <p><a href="#/shop">&larr; Back to shop</a></p>
    <div class="detail">
      <div class="art card">${art(p)}</div>
      <div class="stack">
        <span class="muted">${esc(p.category)} &middot; SKU ${esc(p.sku)}</span>
        <h1>${esc(p.name)}</h1>
        <div class="price" style="font-size:1.6rem" data-testid="product-price">${money(p.price)}</div>
        <p>${esc(p.description)}</p>
        <div data-testid="stock-status">${p.stock === 0 ? '<span class="pill bad">Out of stock</span>' : p.stock <= 5 ? `<span class="pill warn">Only ${p.stock} left</span>` : '<span class="pill ok">In stock</span>'}</div>
        ${p.stock > 0 ? `
        <form id="add-form" class="row">
          <div class="qty" role="group" aria-label="Quantity">
            <button type="button" data-step="-1" aria-label="Decrease quantity">&minus;</button>
            <input id="qty" name="qty" type="number" min="1" max="${max}" value="1" aria-label="Quantity">
            <button type="button" data-step="1" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn primary" type="submit" id="add-btn">Add to cart</button>
        </form>` : '<button class="btn" disabled>Out of stock</button>'}
        <div id="add-msg"></div>
      </div>
    </div>`;
  const form = document.getElementById('add-form');
  if (!form) return;
  const qty = form.elements.qty;
  form.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    qty.value = String(Math.max(1, Math.min(max, (Number(qty.value) || 1) + Number(b.dataset.step))));
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.user) { go('#/login?next=' + encodeURIComponent(location.hash)); return; }
    const btn = document.getElementById('add-btn');
    busy(btn, true, 'Adding...');
    const r = await request('POST', '/api/cart/items', { productId: p.id, qty: Number(qty.value) });
    busy(btn, false);
    const msg = document.getElementById('add-msg');
    if (r.status === 201) {
      state.cartCount = r.body.count; renderNav(parseHash().path);
      msg.innerHTML = `<div class="alert success" role="status">Added to cart. <a href="#/cart">View cart</a></div>`;
    } else {
      msg.innerHTML = `<div class="alert error" role="alert">${esc(errorOf(r).message)}</div>`;
    }
  });
}

function summaryBox(cart, extra) {
  return `<aside class="card pad summary" aria-label="Order summary">
    <h2>Order summary</h2>
    <dl>
      <dt>Subtotal</dt><dd data-testid="subtotal">${money(cart.subtotal)}</dd>
      <dt>Shipping</dt><dd data-testid="shipping">${cart.shipping === 0 ? 'Free' : money(cart.shipping)}</dd>
      <dt class="total">Total</dt><dd class="total" data-testid="total">${money(cart.total)}</dd>
    </dl>
    ${cart.subtotal > 0 && cart.subtotal < FREE_SHIPPING_FROM ? `<p class="muted" style="font-size:.85rem">Add ${money(FREE_SHIPPING_FROM - cart.subtotal)} more for free shipping.</p>` : ''}
    ${extra || ''}
  </aside>`;
}

async function cartView({ isCurrent }) {
  document.title = 'Cart - Lawak Store';
  const res = await request('GET', '/api/cart');
  if (!isCurrent()) return;
  const cart = res.body;
  state.cartCount = cart.count; renderNav('/cart');
  if (cart.items.length === 0) {
    $app.innerHTML = `<h1>Your cart</h1><div class="card empty"><h2>Your cart is empty</h2><p class="muted">Find something you like in the shop.</p><a class="btn primary" href="#/shop">Go to shop</a></div>`;
    return;
  }
  $app.innerHTML = `
    <h1>Your cart</h1>
    <div class="split">
      <section class="card pad" aria-label="Cart items">
        ${cart.items.map((it) => `
          <div class="line-item" data-testid="cart-line" data-product="${esc(it.productId)}">
            <div class="art">${art({ name: it.name, category: '' })}</div>
            <div><div style="font-weight:700">${esc(it.name)}</div><div class="muted">${money(it.price)} each</div></div>
            <div class="controls">
              <div class="qty" role="group" aria-label="Quantity for ${esc(it.name)}">
                <button type="button" data-act="dec" aria-label="Decrease ${esc(it.name)}">&minus;</button>
                <input type="number" value="${it.qty}" min="1" max="${Math.min(it.stock, 10)}" aria-label="Quantity for ${esc(it.name)}" data-act="set">
                <button type="button" data-act="inc" aria-label="Increase ${esc(it.name)}">+</button>
              </div>
              <span class="price" style="min-width:110px;text-align:right" data-testid="line-total">${money(it.lineTotal)}</span>
              <button class="btn small danger" type="button" data-act="remove">Remove</button>
            </div>
          </div>`).join('')}
        <div id="cart-msg"></div>
      </section>
      ${summaryBox(cart, '<a class="btn primary block" href="#/checkout">Checkout</a>')}
    </div>`;
  $app.querySelectorAll('[data-testid="cart-line"]').forEach((row) => {
    const pid = row.dataset.product;
    const input = row.querySelector('input');
    const current = input.value;
    const setQty = async (q) => {
      const r = await request('PATCH', '/api/cart/items/' + pid, { qty: q });
      if (r.status === 200) { render(); return; }
      input.value = current;
      document.getElementById('cart-msg').innerHTML = `<div class="alert error" role="alert">${esc(errorOf(r).message)}</div>`;
    };
    row.querySelector('[data-act="dec"]').addEventListener('click', () => setQty(Number(input.value) - 1));
    row.querySelector('[data-act="inc"]').addEventListener('click', () => setQty(Number(input.value) + 1));
    input.addEventListener('change', () => setQty(Number(input.value)));
    row.querySelector('[data-act="remove"]').addEventListener('click', async () => {
      const r = await request('DELETE', '/api/cart/items/' + pid);
      if (r.status === 200) { toast('Item removed from cart.'); render(); }
    });
  });
}

async function checkoutView({ isCurrent }) {
  document.title = 'Checkout - Lawak Store';
  const res = await request('GET', '/api/cart');
  if (!isCurrent()) return;
  const cart = res.body;
  if (cart.items.length === 0) { go('#/cart'); return; }
  const u = state.user;
  $app.innerHTML = `
    <h1>Checkout</h1>
    <div class="split">
      <form class="card pad stack" id="checkout-form" novalidate>
        <div class="form-alert"></div>
        <h2>Contact</h2>
        <div class="form-grid">
          ${field({ name: 'name', label: 'Full name', value: u.name, autocomplete: 'name', full: true })}
          ${field({ name: 'email', label: 'Email', type: 'email', value: u.email, autocomplete: 'email' })}
          ${field({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', hint: '9 to 15 digits, for example 081234567890' })}
        </div>
        <h2>Shipping address</h2>
        <div class="form-grid">
          ${field({ name: 'address', label: 'Street address', autocomplete: 'street-address', full: true })}
          ${field({ name: 'city', label: 'City', autocomplete: 'address-level2' })}
          ${field({ name: 'postalCode', label: 'Postal code', autocomplete: 'postal-code', hint: '5 digits', attrs: 'inputmode="numeric"' })}
        </div>
        <h2>Payment</h2>
        <p class="muted" style="font-size:.88rem">Mock payment. Use <code>4242 4242 4242 4242</code>. The card <code>4000 0000 0000 0002</code> is always declined.</p>
        <div class="form-grid">
          ${field({ name: 'cardNumber', label: 'Card number', autocomplete: 'cc-number', full: true, attrs: 'inputmode="numeric"' })}
          ${field({ name: 'cardName', label: 'Name on card', autocomplete: 'cc-name', full: true })}
          ${field({ name: 'expiry', label: 'Expiry (MM/YY)', autocomplete: 'cc-exp', attrs: 'placeholder="MM/YY"' })}
          ${field({ name: 'cvc', label: 'Security code (CVC)', autocomplete: 'cc-csc', attrs: 'inputmode="numeric"' })}
        </div>
        <button class="btn primary block" type="submit" id="pay-btn">Pay ${money(cart.total)}</button>
      </form>
      ${summaryBox(cart, `<ul class="muted" style="padding-left:18px;margin:0">${cart.items.map((it) => `<li>${esc(it.name)} &times; ${it.qty}</li>`).join('')}</ul>`)}
    </div>`;
  const form = document.getElementById('checkout-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const v = (k) => form.elements[k].value.trim();
    // Client checks give fast feedback. The backend checks every rule again.
    const fields = {};
    ['name', 'email', 'phone', 'address', 'city', 'postalCode', 'cardNumber', 'cardName', 'expiry', 'cvc'].forEach((k) => { if (!v(k)) fields[k] = 'This field is required.'; });
    if (Object.keys(fields).length) { showErrors(form, { message: 'Check the highlighted fields.', fields }); return; }
    const btn = document.getElementById('pay-btn');
    busy(btn, true, 'Processing payment...');
    const r = await request('POST', '/api/orders', {
      customer: { name: v('name'), email: v('email'), phone: v('phone'), address: v('address'), city: v('city'), postalCode: v('postalCode') },
      payment: { cardNumber: v('cardNumber'), cardName: v('cardName'), expiry: v('expiry'), cvc: v('cvc') },
    });
    busy(btn, false);
    if (r.status === 201) {
      state.cartCount = 0;
      go('#/order/' + encodeURIComponent(r.body.order.id) + '?placed=1');
    } else {
      showErrors(form, errorOf(r));
    }
  });
}

async function ordersView({ isCurrent }) {
  document.title = 'My orders - Lawak Store';
  const res = await request('GET', '/api/orders');
  if (!isCurrent()) return;
  const orders = res.body.orders;
  $app.innerHTML = `<h1>My orders</h1>` + (orders.length === 0
    ? `<div class="card empty"><h2>No orders yet</h2><p class="muted">Your orders show here after checkout.</p><a class="btn primary" href="#/shop">Start shopping</a></div>`
    : `<div class="card table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th class="num">Items</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
      ${orders.map((o) => `<tr><td><a href="#/order/${esc(o.id)}">${esc(o.id)}</a></td><td>${date(o.createdAt)}</td><td class="num">${o.items.reduce((s, i) => s + i.qty, 0)}</td><td class="num">${money(o.total)}</td><td>${pill(o.status)}</td></tr>`).join('')}
      </tbody></table></div>`);
}

async function orderView({ params, query, isCurrent }) {
  const res = await request('GET', '/api/orders/' + encodeURIComponent(params.id));
  if (!isCurrent()) return;
  if (res.status !== 200) { $app.innerHTML = notFound('This order does not exist.'); return; }
  const o = res.body.order;
  document.title = o.id + ' - Lawak Store';
  $app.innerHTML = `
    ${query.placed ? `<div class="alert success" role="status" style="margin-bottom:18px" data-testid="order-confirmation"><strong>Thank you! Your order <span data-testid="order-id">${esc(o.id)}</span> is confirmed.</strong> A receipt is on its way to ${esc(o.customer.email)}.</div>` : ''}
    <div class="row between"><h1>Order ${esc(o.id)}</h1>${pill(o.status)}</div>
    <div class="split">
      <section class="card pad">
        <div class="table-wrap"><table><thead><tr><th>Product</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Total</th></tr></thead><tbody>
        ${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${money(i.price)}</td><td class="num">${i.qty}</td><td class="num">${money(i.price * i.qty)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:18px">
          <div><h3>Ship to</h3><p class="muted">${esc(o.customer.name)}<br>${esc(o.customer.address)}<br>${esc(o.customer.city)} ${esc(o.customer.postalCode)}<br>${esc(o.customer.phone)}</p></div>
          <div><h3>Payment</h3><p class="muted">Card ending ${esc(o.payment.last4)}<br>Payment ${esc(o.payment.status)}<br>Placed ${date(o.createdAt)}</p></div>
        </div>
      </section>
      ${summaryBox(o, `<a class="btn block" href="#/orders">All my orders</a>`)}
    </div>`;
}

// ---------- auth ----------
async function loginView({ query }) {
  document.title = 'Sign in - Lawak Store';
  if (state.user) { go(query.next || '#/'); return; }
  $app.innerHTML = `
    <div class="auth card pad stack">
      <h1>Sign in</h1>
      ${query.registered ? '<div class="alert success" role="status">Account created. Sign in to continue.</div>' : ''}
      <form id="login-form" class="stack" novalidate>
        <div class="form-alert"></div>
        ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'username', value: query.email || '' })}
        ${field({ name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password' })}
        <button class="btn primary block" type="submit" id="login-btn">Sign in</button>
      </form>
      <div class="demo-creds"><strong>Demo account</strong><br>Email <code>login@demo.com</code> &middot; Password <code>Logindemo123</code><br>
        <button class="btn small" type="button" id="fill-demo" style="margin-top:8px">Use demo account</button></div>
      <p class="muted">New here? <a href="#/register">Create an account</a></p>
    </div>`;
  const form = document.getElementById('login-form');
  document.getElementById('fill-demo').addEventListener('click', () => {
    form.elements.email.value = 'login@demo.com'; form.elements.password.value = 'Logindemo123';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const btn = document.getElementById('login-btn');
    busy(btn, true, 'Signing in...');
    const r = await request('POST', '/api/auth/login', { email: form.elements.email.value, password: form.elements.password.value });
    busy(btn, false);
    if (r.status !== 200) { showErrors(form, errorOf(r)); return; }
    setToken(r.body.token);
    state.user = r.body.user;
    await refreshCartCount();
    toast('Welcome back, ' + state.user.name + '.');
    go(query.next || (state.user.role === 'admin' ? '#/admin' : '#/shop'));
  });
}

async function registerView() {
  document.title = 'Create account - Lawak Store';
  $app.innerHTML = `
    <div class="auth card pad stack">
      <h1>Create account</h1>
      <form id="register-form" class="stack" novalidate>
        <div class="form-alert"></div>
        ${field({ name: 'name', label: 'Full name', autocomplete: 'name' })}
        ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
        ${field({ name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password', hint: 'At least 8 characters with letters and numbers' })}
        ${field({ name: 'confirm', label: 'Confirm password', type: 'password', autocomplete: 'new-password' })}
        <button class="btn primary block" type="submit" id="register-btn">Create account</button>
      </form>
      <p class="muted">Already have an account? <a href="#/login">Sign in</a></p>
    </div>`;
  const form = document.getElementById('register-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    if (form.elements.password.value !== form.elements.confirm.value) {
      showErrors(form, { message: 'Check the highlighted fields.', fields: { confirm: 'The passwords do not match.' } });
      return;
    }
    const btn = document.getElementById('register-btn');
    busy(btn, true, 'Creating account...');
    const r = await request('POST', '/api/auth/register', { name: form.elements.name.value, email: form.elements.email.value, password: form.elements.password.value });
    busy(btn, false);
    if (r.status !== 201) { showErrors(form, errorOf(r)); return; }
    go('#/login?registered=1&email=' + encodeURIComponent(r.body.user.email));
  });
}

// ---------- admin ----------
function adminShell(active, content) {
  const link = (href, label, key) => `<a href="${href}" ${active === key ? 'aria-current="page"' : ''}>${label}</a>`;
  return `<div class="admin">
    <nav class="card admin-nav" aria-label="Admin">${link('#/admin', 'Dashboard', 'dash')}${link('#/admin/products', 'Products', 'products')}${link('#/admin/orders', 'Orders', 'orders')}${link('#/admin/users', 'Users', 'users')}</nav>
    <section class="stack">${content}</section></div>`;
}

async function adminDashboardView({ isCurrent }) {
  document.title = 'Admin dashboard - Lawak Store';
  const res = await request('GET', '/api/admin/stats');
  if (!isCurrent()) return;
  if (res.status !== 200) { $app.innerHTML = forbidden(); return; }
  const s = res.body;
  $app.innerHTML = adminShell('dash', `
    <h1>Dashboard</h1>
    <div class="kpis">
      <div class="card kpi"><div class="label">Revenue (not cancelled)</div><div class="value" data-testid="kpi-revenue">${money(s.revenue)}</div></div>
      <div class="card kpi"><div class="label">Orders</div><div class="value" data-testid="kpi-orders">${s.orders}</div></div>
      <div class="card kpi"><div class="label">Customers</div><div class="value" data-testid="kpi-customers">${s.customers}</div></div>
      <div class="card kpi"><div class="label">Low stock items</div><div class="value" data-testid="kpi-low-stock">${s.lowStock.length}</div></div>
    </div>
    <div class="card pad"><h2>Orders by status</h2><div class="row">${Object.keys(ORDER_FLOW).map((k) => `${pill(k)} <strong>${s.byStatus[k] || 0}</strong>`).join('&nbsp;&nbsp;')}</div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
      <div class="card"><div class="pad" style="padding:16px 16px 0"><h2>Recent orders</h2></div><div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
        ${s.recentOrders.map((o) => `<tr><td>${esc(o.id)}</td><td>${esc(o.customer.name)}</td><td class="num">${money(o.total)}</td><td>${pill(o.status)}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="card pad"><h2>Low stock</h2>${s.lowStock.length ? `<ul>${s.lowStock.map((p) => `<li>${esc(p.name)} <span class="pill ${p.stock === 0 ? 'bad' : 'warn'}">${p.stock} left</span></li>`).join('')}</ul>` : '<p class="muted">All products have enough stock.</p>'}</div>
    </div>`);
}

async function adminProductsView({ query, isCurrent }) {
  document.title = 'Products - Admin - Lawak Store';
  const res = await request('GET', '/api/admin/products' + (query.search ? '?search=' + encodeURIComponent(query.search) : ''));
  if (!isCurrent()) return;
  const list = res.body.products;
  $app.innerHTML = adminShell('products', `
    <div class="row between"><h1>Products</h1><a class="btn primary" href="#/admin/products/new">Add product</a></div>
    <form class="toolbar" id="admin-search" role="search">
      <label class="sr-only" for="admin-q">Search products</label>
      <input class="input" id="admin-q" name="q" type="search" placeholder="Search by name or SKU" value="${esc(query.search || '')}">
      <button class="btn" type="submit">Search</button>
    </form>
    ${list.length === 0 ? `<div class="card empty"><h2>No products found</h2><a class="btn" href="#/admin/products">Clear search</a></div>` : `
    <div class="card table-wrap"><table><thead><tr><th>SKU</th><th>Name</th><th>Category</th><th class="num">Price</th><th class="num">Stock</th><th>Status</th><th class="num">Actions</th></tr></thead><tbody>
    ${list.map((p) => `<tr data-testid="product-row" data-id="${esc(p.id)}"><td>${esc(p.sku)}</td><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td class="num">${money(p.price)}</td><td class="num">${p.stock}</td><td>${pill(p.status)}</td>
      <td><div class="actions"><a class="btn small" href="#/admin/products/${esc(p.id)}/edit" aria-label="Edit ${esc(p.name)}">Edit</a><button class="btn small danger" type="button" data-delete="${esc(p.id)}" data-name="${esc(p.name)}" aria-label="Delete ${esc(p.name)}">Delete</button></div></td></tr>`).join('')}
    </tbody></table></div>`}`);
  document.getElementById('admin-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = e.target.elements.q.value.trim();
    go('#/admin/products' + (q ? '?search=' + encodeURIComponent(q) : ''));
  });
  $app.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmDialog(`Delete "${b.dataset.name}"? This cannot be undone.`, 'Delete'))) return;
    const r = await request('DELETE', '/api/admin/products/' + b.dataset.delete);
    if (r.status === 204) { toast('Product deleted.'); render(); } else toast(errorOf(r).message, 'error');
  }));
}

async function adminProductFormView({ params, isCurrent }) {
  const editing = Boolean(params.id);
  let p = { name: '', sku: '', category: 'Apparel', price: '', stock: '', status: 'active', description: '' };
  if (editing) {
    const res = await request('GET', '/api/products/' + encodeURIComponent(params.id));
    if (!isCurrent()) return;
    if (res.status !== 200) { $app.innerHTML = adminShell('products', notFound('This product does not exist.')); return; }
    p = res.body.product;
  }
  document.title = (editing ? 'Edit product' : 'Add product') + ' - Admin - Lawak Store';
  $app.innerHTML = adminShell('products', `
    <p><a href="#/admin/products">&larr; Back to products</a></p>
    <h1>${editing ? 'Edit product' : 'Add product'}</h1>
    <form class="card pad stack" id="product-form" novalidate>
      <div class="form-alert"></div>
      <div class="form-grid">
        ${field({ name: 'name', label: 'Product name', value: p.name, full: true })}
        ${field({ name: 'sku', label: 'SKU', value: p.sku, hint: 'For example LS-APP-005' })}
        ${selectField({ name: 'category', label: 'Category', options: CATEGORIES, value: p.category })}
        ${field({ name: 'price', label: 'Price (IDR)', type: 'number', value: p.price, attrs: 'min="1" step="1"' })}
        ${field({ name: 'stock', label: 'Stock', type: 'number', value: p.stock, attrs: 'min="0" step="1"' })}
        ${selectField({ name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active (for sale)' }, { value: 'draft', label: 'Draft (hidden)' }], value: p.status })}
        <div class="field full"><label for="f-description">Description</label><textarea id="f-description" name="description">${esc(p.description)}</textarea></div>
      </div>
      <div class="row"><button class="btn primary" type="submit" id="save-btn">${editing ? 'Save changes' : 'Create product'}</button><a class="btn" href="#/admin/products">Cancel</a></div>
    </form>`);
  const form = document.getElementById('product-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const num = (k) => (form.elements[k].value.trim() === '' ? NaN : Number(form.elements[k].value));
    const body = {
      name: form.elements.name.value, sku: form.elements.sku.value, category: form.elements.category.value,
      price: num('price'), stock: num('stock'), status: form.elements.status.value, description: form.elements.description.value,
    };
    const btn = document.getElementById('save-btn');
    busy(btn, true, 'Saving...');
    const r = editing ? await request('PUT', '/api/admin/products/' + p.id, body) : await request('POST', '/api/admin/products', body);
    busy(btn, false);
    if (r.status === 200 || r.status === 201) { toast(editing ? 'Product updated.' : 'Product created.'); go('#/admin/products'); }
    else showErrors(form, errorOf(r));
  });
}

async function adminOrdersView({ query, isCurrent }) {
  document.title = 'Orders - Admin - Lawak Store';
  const res = await request('GET', '/api/admin/orders' + (query.status ? '?status=' + encodeURIComponent(query.status) : ''));
  if (!isCurrent()) return;
  const list = res.body.orders;
  $app.innerHTML = adminShell('orders', `
    <div class="row between"><h1>Orders</h1>
      <div><label class="sr-only" for="status-filter">Filter by status</label>
      <select class="input" id="status-filter"><option value="">All statuses</option>${Object.keys(ORDER_FLOW).map((s) => `<option ${s === query.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
    ${list.length === 0 ? '<div class="card empty"><h2>No orders with this status</h2></div>' : `
    <div class="card table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th class="num">Total</th><th>Status</th><th>Change status</th></tr></thead><tbody>
    ${list.map((o) => `<tr data-testid="order-row" data-id="${esc(o.id)}"><td>${esc(o.id)}</td><td>${date(o.createdAt)}</td><td>${esc(o.customer.name)}<div class="muted" style="font-size:.8rem">${esc(o.customer.email)}</div></td><td class="num">${money(o.total)}</td><td>${pill(o.status)}</td>
      <td>${ORDER_FLOW[o.status].length ? `<label class="sr-only" for="st-${esc(o.id)}">New status for ${esc(o.id)}</label><select class="input" style="min-height:34px;padding:4px 8px" id="st-${esc(o.id)}" data-order="${esc(o.id)}"><option value="">Choose...</option>${ORDER_FLOW[o.status].map((s) => `<option>${s}</option>`).join('')}</select>` : '<span class="muted">Final</span>'}</td></tr>`).join('')}
    </tbody></table></div>`}`);
  document.getElementById('status-filter').addEventListener('change', (e) => go('#/admin/orders' + (e.target.value ? '?status=' + encodeURIComponent(e.target.value) : '')));
  $app.querySelectorAll('select[data-order]').forEach((sel) => sel.addEventListener('change', async () => {
    if (!sel.value) return;
    if (sel.value === 'Cancelled' && !(await confirmDialog(`Cancel order ${sel.dataset.order}? The stock goes back and the payment is refunded.`, 'Cancel order'))) { sel.value = ''; return; }
    const r = await request('PATCH', '/api/admin/orders/' + sel.dataset.order, { status: sel.value });
    if (r.status === 200) { toast(`Order ${sel.dataset.order} is now ${r.body.order.status}.`); render(); } else toast(errorOf(r).message, 'error');
  }));
}

async function adminUsersView({ isCurrent }) {
  document.title = 'Users - Admin - Lawak Store';
  const res = await request('GET', '/api/admin/users');
  if (!isCurrent()) return;
  const me = state.user.id;
  $app.innerHTML = adminShell('users', `
    <h1>Users</h1>
    <div class="card table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th class="num">Actions</th></tr></thead><tbody>
    ${res.body.users.map((u) => `<tr data-testid="user-row" data-id="${esc(u.id)}"><td>${esc(u.name)}${u.id === me ? ' <span class="muted">(you)</span>' : ''}</td><td>${esc(u.email)}</td>
      <td>${u.id === me ? pill(u.role) : `<label class="sr-only" for="role-${esc(u.id)}">Role for ${esc(u.name)}</label><select class="input" style="min-height:34px;padding:4px 8px" id="role-${esc(u.id)}" data-role="${esc(u.id)}"><option value="customer" ${u.role === 'customer' ? 'selected' : ''}>customer</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option></select>`}</td>
      <td>${pill(u.status)}</td><td>${date(u.createdAt)}</td>
      <td><div class="actions">${u.id === me ? '' : `<button class="btn small ${u.status === 'active' ? 'danger' : ''}" type="button" data-toggle="${esc(u.id)}" data-name="${esc(u.name)}" data-next="${u.status === 'active' ? 'disabled' : 'active'}">${u.status === 'active' ? 'Disable' : 'Enable'}</button>`}</div></td></tr>`).join('')}
    </tbody></table></div>`);
  $app.querySelectorAll('select[data-role]').forEach((sel) => sel.addEventListener('change', async () => {
    const r = await request('PATCH', '/api/admin/users/' + sel.dataset.role, { role: sel.value });
    if (r.status === 200) { toast(`${r.body.user.name} is now ${r.body.user.role}.`); render(); } else toast(errorOf(r).message, 'error');
  }));
  $app.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.next === 'disabled' && !(await confirmDialog(`Disable ${b.dataset.name}? They are signed out and cannot sign in.`, 'Disable'))) return;
    const r = await request('PATCH', '/api/admin/users/' + b.dataset.toggle, { status: b.dataset.next });
    if (r.status === 200) { toast(`${r.body.user.name} is ${r.body.user.status}.`); render(); } else toast(errorOf(r).message, 'error');
  }));
}

// ---------- fallbacks ----------
function notFound(text) {
  document.title = 'Not found - Lawak Store';
  return `<div class="card empty"><h1>Page not found</h1><p class="muted">${esc(text || 'The page you opened does not exist.')}</p><a class="btn primary" href="#/">Go to home</a></div>`;
}
function forbidden() {
  return `<div class="card empty" data-testid="forbidden"><h1>You do not have access to this page</h1><p class="muted">This page is for administrators only.</p><a class="btn primary" href="#/">Go to home</a></div>`;
}

// ---------- start ----------
async function boot() {
  if (hasToken()) {
    const me = await request('GET', '/api/auth/me');
    if (me.status === 200) { state.user = me.body.user; await refreshCartCount(); } else setToken(null);
  }
  document.getElementById('reset-demo').addEventListener('click', async () => {
    if (!(await confirmDialog('Reset all demo data? Products, orders and accounts go back to the start. You are signed out.', 'Reset'))) return;
    await resetDemo();
    state.user = null; state.cartCount = 0;
    toast('Demo data is reset.');
    go('#/');
  });
  window.addEventListener('hashchange', render);
  render();
}
boot();
