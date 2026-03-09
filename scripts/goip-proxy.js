/**
 * GoIP16 HTTP Proxy
 * Docker konteynerlerinin GoIP16'ya erişmesi için host makinede çalışır.
 * Backend konteyner → host.docker.internal:8880 → 192.168.1.100:80
 */
const http = require('http');

const GOIP_HOST = process.env.GOIP_REAL_HOST || '192.168.1.100';
const GOIP_PORT = parseInt(process.env.GOIP_REAL_PORT || '80', 10);
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '8880', 10);

const server = http.createServer((clientReq, clientRes) => {
  const options = {
    hostname: GOIP_HOST,
    port: GOIP_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: clientReq.headers,
    timeout: 10000,
    insecureHTTPParser: true,
  };

  const proxy = http.request(options, (goipRes) => {
    clientRes.writeHead(goipRes.statusCode, goipRes.headers);
    goipRes.pipe(clientRes, { end: true });
  });

  proxy.on('error', (err) => {
    clientRes.writeHead(502, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'GoIP16 erişilemez', detail: err.message }));
  });

  proxy.on('timeout', () => {
    proxy.destroy();
    clientRes.writeHead(504, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'GoIP16 zaman aşımı' }));
  });

  clientReq.pipe(proxy, { end: true });
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`GoIP16 proxy dinleniyor: 0.0.0.0:${PROXY_PORT} → ${GOIP_HOST}:${GOIP_PORT}`);
});
