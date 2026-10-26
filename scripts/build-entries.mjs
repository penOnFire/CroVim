import {build} from 'esbuild';
import {mkdir,copyFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

await mkdir('dist/icons', {recursive: true});

try {
  await access('public/icons/icon-16.png');
} catch {
  spawnSync('node', ['scripts/generate-icons.mjs'], { stdio: 'inherit' });
}

await build({
  entryPoints: {
    'service-worker': 'src/background/service-worker.ts',
    'content-script': 'src/content/content-script.ts'
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022', 'chrome120', 'firefox115'],
  outdir: 'dist',
  splitting: false
});

await copyFile('src/styles/content.css', 'dist/content.css');

for (const s of ['16', '32', '48', '128']) {
  await copyFile(`public/icons/icon-${s}.png`, `dist/icons/icon-${s}.png`);
}

