import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { request as httpRequest } from 'http';
import { join } from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import type { NestExpressApplication } from '@nestjs/platform-express';

const webPort = 3012;

function webDirectory() {
  const candidates = [
    join(process.cwd(), 'apps/web'),
    join(process.cwd(), '../web'),
    join(__dirname, '../../web'),
    join(__dirname, '../../../apps/web'),
  ];
  return candidates.find((dir) => existsSync(join(dir, '.next', 'BUILD_ID'))) ?? null;
}

function nextBinary(webDir: string) {
  const candidates = [
    join(webDir, 'node_modules/next/dist/bin/next'),
    join(webDir, '../../node_modules/next/dist/bin/next'),
    join(process.cwd(), 'node_modules/next/dist/bin/next'),
    join(process.cwd(), '../node_modules/next/dist/bin/next'),
    join(process.cwd(), '../../node_modules/next/dist/bin/next'),
  ];
  return candidates.find((file) => existsSync(file)) ?? null;
}

function forward(req: IncomingMessage, res: ServerResponse) {
  const headers = { ...req.headers, host: `127.0.0.1:${webPort}` };
  delete headers.connection;
  delete headers['transfer-encoding'];
  const upstream = httpRequest(
    { hostname: '127.0.0.1', port: webPort, path: req.url, method: req.method, headers },
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
    res.end('Η σελίδα του σχολείου ξεκινάει. Δοκίμασε ξανά σε λίγο.');
  });
  req.pipe(upstream);
}

export function mountSchoolSite(app: NestExpressApplication) {
  const webDir = webDirectory();
  const bin = webDir ? nextBinary(webDir) : null;
  if (!webDir || !bin) {
    console.log('school site not started', { webDir, bin });
    return;
  }
  const child = spawn(process.execPath, [bin, 'start', '-p', String(webPort), '-H', '127.0.0.1'], {
    cwd: webDir,
    env: { ...process.env, PORT: String(webPort) },
    stdio: 'inherit',
  });
  child.on('exit', (code) => console.log(`school site exited ${code}`));

  const server = app.getHttpAdapter().getInstance();
  server.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';
    if (url.startsWith('/api') || url.startsWith('/uploads')) return next();
    forward(req, res);
  });
  const stack = server._router?.stack as unknown[] | undefined;
  const layer = stack?.pop();
  if (layer) stack?.unshift(layer);
}
