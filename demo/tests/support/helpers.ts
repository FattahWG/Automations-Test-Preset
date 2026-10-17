import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const ADMIN = { email: 'login@demo.com', password: 'Logindemo123', name: 'Demo Admin' };
export const CUSTOMER = { email: 'customer@demo.com', password: 'Customer123', name: 'Sari Wulandari' };
export const CARD_OK = '4242 4242 4242 4242';
export const CARD_DECLINED = '4000 0000 0000 0002';

let counter = 0;
/** Test data prefix: every record the tests make starts with qa-auto. */
export const uniq = (label: string) => `qa-auto-${label}-${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status(), `login ${email}`).toBe(200);
  return (await res.json()).token;
}

/** Registers a fresh customer through the API, so a test never shares a cart with another test. */
export async function newCustomer(request: APIRequestContext, label = 'buyer') {
  const email = `${uniq(label)}@example.test`;
  const password = 'Password123';
  const name = 'QA Auto ' + label;
  const res = await request.post('/api/auth/register', { data: { name, email, password } });
  expect(res.status(), 'register customer').toBe(201);
  return { email, password, name };
}

/** Opens a store page as a signed-in user. The query string forces a full load, so the app boots with the token. */
export async function openWithToken(page: Page, token: string, hashPath: string) {
  if (!page.url().startsWith('http')) await page.goto('/store/?boot=1');
  await page.evaluate((t) => localStorage.setItem('lawak-store-token', t), token);
  await page.goto(`/store/?t=${Date.now()}#${hashPath}`);
}

/** Signs in through the API (faster than the form) and opens the page. Returns the token. */
export async function openAs(page: Page, request: APIRequestContext, user: { email: string; password: string }, hashPath: string) {
  const token = await apiLogin(request, user.email, user.password);
  await openWithToken(page, token, hashPath);
  return token;
}

export async function placeOrderApi(request: APIRequestContext, token: string) {
  const res = await request.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      customer: { name: 'QA Auto Buyer', email: 'qa-auto@example.test', phone: '081234567890', address: 'Jl. Asia Afrika No. 8', city: 'Bandung', postalCode: '40111' },
      payment: { cardNumber: '4242424242424242', cardName: 'QA AUTO', expiry: '12/30', cvc: '123' },
    },
  });
  expect(res.status(), 'place order').toBe(201);
  return (await res.json()).order.id as string;
}

export async function createProductApi(request: APIRequestContext, token: string, over: Record<string, unknown> = {}) {
  const name = uniq('product');
  const sku = ('QA-' + Date.now().toString(36) + (counter++).toString(36)).toUpperCase().slice(0, 20);
  const res = await request.post('/api/admin/products', {
    headers: { Authorization: `Bearer ${token}` },
    data: Object.assign({ name, sku, category: 'Home', price: 120000, stock: 9, status: 'active', description: 'Made by automation.' }, over),
  });
  expect(res.status(), 'create product').toBe(201);
  return (await res.json()).product as { id: string; name: string; sku: string; price: number; stock: number };
}

export async function deleteProductApi(request: APIRequestContext, token: string, id: string) {
  await request.delete(`/api/admin/products/${id}`, { headers: { Authorization: `Bearer ${token}` } });
}

export const newSku = () => ('QA-' + Date.now().toString(36) + (counter++).toString(36)).toUpperCase().slice(0, 20);

export async function signInWithForm(page: Page, user: { email: string; password: string }) {
  await page.goto('/store/#/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function addToCartApi(request: APIRequestContext, token: string, productId: string, qty = 1) {
  const res = await request.post('/api/cart/items', { data: { productId, qty }, headers: { Authorization: `Bearer ${token}` } });
  expect(res.status(), `add ${productId} to cart`).toBe(201);
}

export async function fillCheckout(page: Page, overrides: Partial<Record<string, string>> = {}) {
  const v = Object.assign({
    'Full name': 'QA Auto Buyer', Email: 'qa-auto@example.test', Phone: '081234567890',
    'Street address': 'Jl. Asia Afrika No. 8', City: 'Bandung', 'Postal code': '40111',
    'Card number': CARD_OK, 'Name on card': 'QA AUTO', 'Expiry (MM/YY)': '12/30', 'Security code (CVC)': '123',
  }, overrides);
  for (const [label, value] of Object.entries(v)) await page.getByLabel(label, { exact: true }).fill(value);
}

export const cartCount = (page: Page) => page.getByTestId('cart-count');
export const formAlert = (page: Page) => page.locator('.form-alert [role="alert"]');
