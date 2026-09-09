const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'ssmodina_token';

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (token) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
  },
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Fired on 401 so the auth provider can drop the session. */
const onUnauthorized = new Set();
export const subscribeUnauthorized = (fn) => {
  onUnauthorized.add(fn);
  return () => onUnauthorized.delete(fn);
};

async function request(method, path, body, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options.signal,
  });

  if (res.status === 401) {
    tokenStore.clear();
    onUnauthorized.forEach((fn) => fn());
  }

  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  }

  if (!res.ok) {
    throw new ApiError(res.status, payload?.message || res.statusText, payload?.details);
  }
  return payload;
}

/** Serialise list options into the query string the API expects. */
export function toQuery(params = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    sp.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body ?? {}, options),
  patch: (path, body, options) => request('PATCH', path, body ?? {}, options),
  put: (path, body, options) => request('PUT', path, body ?? {}, options),
  del: (path, options) => request('DELETE', path, undefined, options),
};
