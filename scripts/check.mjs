import {readFile,readdir,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'..'),dist=resolve(root,'dist');
const files=await readdir(dist);
for(const file of files.filter(f=>f.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',resolve(dist,file)],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);}
const html=await readFile(resolve(dist,'index.html'),'utf8');
for(const m of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g))await access(resolve(dist,m[1]));
for(const file of files.filter(f=>f.endsWith('.js'))){const source=await readFile(resolve(dist,file),'utf8');for(const m of source.matchAll(/(?:from|import)\s*['"](\.\/[^'"]+)['"]/g))await access(resolve(dirname(resolve(dist,file)),m[1]));}
if(/https?:\/\//.test(await readFile(resolve(dist,'styles.css'),'utf8')))throw new Error('Stylesheet unexpectedly includes external assets.');
console.log(`Syntax and local asset checks passed: ${files.length} application files.`);
