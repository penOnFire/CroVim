import {readFile,stat} from 'node:fs/promises'; import manifest from '../manifest.json' with {type:'json'};
const paths=[manifest.background.service_worker,...manifest.content_scripts.flatMap(x=>[...(x.js??[]),...(x.css??[])]),manifest.action.default_popup,manifest.options_ui.page,...manifest.icons?Object.values(manifest.icons):[]];
for(const p of paths){try{await stat(`dist/${p}`)}catch{throw new Error(`Missing dist/${p}`)}} await readFile('dist/manifest.json'); console.log('dist valid');
