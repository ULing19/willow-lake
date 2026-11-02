import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, '..', 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await build({
  entryPoints: [path.join(root, '..', 'src', 'main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  sourcemap: false,
  outfile: path.join(dist, 'app.js'),
  logLevel: 'info'
});
await cp(path.join(root, '..', 'index.html'), path.join(dist, 'index.html'));
await cp(path.join(root, '..', 'style.css'), path.join(dist, 'style.css'));
await cp(path.join(root, '..', 'assets'), path.join(dist, 'assets'), { recursive: true });
console.log(`Built ${dist}`);
