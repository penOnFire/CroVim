import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./fixtures', import.meta.url)));
const contentTypes: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'navigation.html' : pathname.replace(/^\/+/, '');
  const file = resolve(root, relative);
  if (!file.startsWith(root + sep)) { response.statusCode = 400; response.end('bad request'); return; }
  try {
    response.setHeader('Content-Type', contentTypes[file.slice(file.lastIndexOf('.'))] ?? 'text/plain; charset=utf-8');
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end('not found');
  }
}).listen(4173, '127.0.0.1');
