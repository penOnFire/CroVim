import {mkdir,rename,readFile,writeFile} from 'node:fs/promises';
for(const [name,file] of [['popup','popup'],['options','options'],['vomnibar','vomnibar']]){await mkdir('dist/pages',{recursive:true});let html=await readFile(`dist/src/pages/${name}/index.html`,'utf8');html=html.replaceAll('../','../').replaceAll('/src/pages/','/pages/');await writeFile(`dist/pages/${file}.html`,html);}
await writeFile('dist/pages/help-dialog.html','<!doctype html><html><body><dialog open><h1>CroVim Help</h1></dialog></body></html>');
