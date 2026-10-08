import http from 'http';

const apiPort = Number(process.env.API_UPSTREAM || 3011);
const webPort = Number(process.env.WEB_UPSTREAM || 3012);
const publicPort = Number(process.env.PUBLIC_PORT || process.env.PORT || 3001);

function proxy(req, res, port) {
  const headers = { ...req.headers };
  delete headers.connection;
  delete headers['transfer-encoding'];
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path: req.url,
      method: req.method,
      headers,
    },
    (up) => {
      const responseHeaders = { ...up.headers };
      delete responseHeaders.connection;
      delete responseHeaders['transfer-encoding'];
      res.writeHead(up.statusCode || 502, responseHeaders);
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Η υπηρεσία ξεκινάει. Δοκίμασε ξανά σε λίγο.');
  });
  req.pipe(upstream);
}

function targetPort(url) {
  const path = url.split('?')[0];
  if (path === '/api/receipt-logo' || path.startsWith('/api/receipt-logo/')) return webPort;
  if (path.startsWith('/api') || path.startsWith('/uploads')) return apiPort;
  return webPort;
}

const ports = new Set([publicPort, 3001].filter((port) => Number.isFinite(port) && port > 0));

for (const port of ports) {
  const server = http.createServer((req, res) => {
    proxy(req, res, targetPort(req.url || '/'));
  });
  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
      console.warn(`port in use, continuing: ${error.message}`);
      return;
    }
    console.error(error);
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`omnedu site listening on ${port}`);
  });
}
