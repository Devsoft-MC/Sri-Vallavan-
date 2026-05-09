const PRODUCTION_API_BASE_URL = 'https://sahiproducts.com';
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || PRODUCTION_API_BASE_URL;

export default API_BASE_URL;
