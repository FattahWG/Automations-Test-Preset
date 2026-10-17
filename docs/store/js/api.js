const TOKEN_KEY = 'lawak-store-token';
const DB_KEY = 'lawak-store-db';
const MODE = window.LAWAK_API_MODE === 'http' ? 'http' : 'browser';

let backend = null;

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}

export const hasToken = () => Boolean(readToken());

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* storage blocked: the session lasts for this page only */ }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Returns { status, body }. Never throws for HTTP errors, so screens can show the message. */
export async function request(method, path, body) {
  const token = readToken();
  if (MODE === 'http') {
    try {
      const res = await fetch(path, {
        method,
        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    } catch (e) {
      return { status: 0, body: { error: { code: 'NETWORK', message: 'Cannot reach the server. Check your connection.' } } };
    }
  }
  if (!backend) backend = window.LawakBackend.createBackend(window.LawakBackend.localStorageAdapter(DB_KEY));
  await wait(120 + Math.random() * 160); // feels like a network call, so loading states are visible
  return backend.handle({ method, path, body, token });
}

export async function resetDemo() {
  const res = await request('POST', '/api/demo/reset');
  setToken(null);
  return res;
}

export const SHIPPING_FEE = window.LawakBackend.SHIPPING_FEE;
export const FREE_SHIPPING_FROM = window.LawakBackend.FREE_SHIPPING_FROM;
