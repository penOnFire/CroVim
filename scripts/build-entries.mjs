import {build} from 'esbuild'; import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
await mkdir('dist/icons',{recursive:true});
await build({entryPoints:{'service-worker':'src/background/service-worker.ts','content-script':'src/content/content-script.ts'},bundle:true,format:'esm',platform:'browser',target:'chrome120',outdir:'dist',splitting:false});
await copyFile('src/styles/content.css','dist/content.css');
for (const s of ['16','32','48','128']) { try { await copyFile(`public/icons/icon-${s}.png`,`dist/icons/icon-${s}.png`); } catch { await writeFile(`dist/icons/icon-${s}.png`,Buffer.from('')); } }
