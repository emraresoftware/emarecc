import axios from 'axios';

// Relative URL — tarayıcı hangi adresten sayfayı gösterdiyse API de oradan gider
const base = import.meta.env.VITE_API_URL || '';
console.log('[API] baseURL:', base || '(relative — same origin)');
const api = axios.create({
  baseURL: `${base}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${base}/api/v1/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem('access_token', data.access_token);
          err.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api(err.config);
        } catch {}
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
