import config from './config';

const rawApiBaseUrl = config.apiBaseUrl;

export const API_BASE_URL = rawApiBaseUrl && rawApiBaseUrl.trim() ? rawApiBaseUrl.trim() : '/api';
export const AUTH_API_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '') + '/api/accounts';
