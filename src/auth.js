import API_BASE_URL from './api';

const AUTH_STORAGE_KEY = 'sriVallavanAuth';
let authFetchInstalled = false;
let originalFetch = null;

export function getStoredAuth() {
  try {
    const storedAuth = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    if (!storedAuth?.token || !storedAuth?.expiresAt || storedAuth.expiresAt <= Date.now()) {
      clearAuth();
      return null;
    }
    return storedAuth;
  } catch {
    clearAuth();
    return null;
  }
}

export function saveAuth(authData) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem('sriVallavanLoggedIn');
}

function isApiRequest(input) {
  const requestUrl = typeof input === 'string' ? input : input?.url;
  return requestUrl?.startsWith(`${API_BASE_URL}/api/`) || requestUrl?.startsWith('/api/');
}

function withAuthHeader(init = {}) {
  const storedAuth = getStoredAuth();
  if (!storedAuth?.token) return init;

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${storedAuth.token}`);

  return {
    ...init,
    headers,
  };
}

export function installAuthFetch() {
  if (authFetchInstalled || typeof window === 'undefined') return;

  originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const response = await originalFetch(
      input,
      isApiRequest(input) ? withAuthHeader(init) : init
    );

    if (response.status === 401 && isApiRequest(input)) {
      const requestUrl = typeof input === 'string' ? input : input?.url;
      if (!requestUrl?.endsWith('/api/login')) {
        clearAuth();
        window.dispatchEvent(new Event('sri-vallavan-auth-expired'));
      }
    }

    return response;
  };

  authFetchInstalled = true;
}
