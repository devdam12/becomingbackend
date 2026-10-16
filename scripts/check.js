const {readdirSync}=require('node:fs');
const {join}=require('node:path');
const {spawnSync}=require('node:child_process');
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);}
let failed=false;
for(const file of [...walk('src'),...walk('scripts'),...walk('test')].filter(f=>f.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status){failed=true;console.error(file,result.stderr);}}
if(failed)process.exitCode=1;else console.log('Backend JavaScript syntax checks passed. No compilation required.');
