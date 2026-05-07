const configuredApiBaseUrl = (process.env.REACT_APP_BACKEND_URL || 'https://sahiproducts.com').trim();

const API_BASE_URL = /^https?:\/\//i.test(configuredApiBaseUrl)
  ? configuredApiBaseUrl.replace(/\/+$/, '')
  : 'https://sahiproducts.com';

export default API_BASE_URL;
