/**
 * EmareAPI Helper — Node.js projeleri için anahtar yöneticisi
 * Kullanım: const { getKey } = require('./emareapi');
 *           const key = await getKey('GEMINI_API_KEY');
 */
const https = require('https');
const http  = require('http');
require('dotenv').config();

let _token = process.env.EMAREAPI_TOKEN || '';

async function _request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function _getToken() {
  if (_token) return _token;
  const baseUrl  = process.env.EMAREAPI_URL || 'http://localhost:8000';
  const username = process.env.EMAREAPI_USERNAME || '';
  const password = process.env.EMAREAPI_PASSWORD || '';
  const body = JSON.stringify({ username, password });
  const res = await _request(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
  if (res.status !== 200) throw new Error(`EmareAPI giriş başarısız: ${res.body}`);
  _token = JSON.parse(res.body).access_token;
  return _token;
}

async function getKey(keyName) {
  const baseUrl = process.env.EMAREAPI_URL || 'http://localhost:8000';
  const token   = await _getToken();
  const res = await _request(`${baseUrl}/keys/${keyName.toUpperCase()}/reveal`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status !== 200) throw new Error(`Anahtar alınamadı: ${keyName}`);
  return JSON.parse(res.body).value;
}

module.exports = { getKey };
