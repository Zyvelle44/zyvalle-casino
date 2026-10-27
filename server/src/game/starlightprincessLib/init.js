/** Node loader for the supplied PHP init.php key=value configuration. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export function loadInit(file=path.join(here,'init.txt')) {
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  return Object.fromEntries(lines.map(line=>{const i=line.indexOf('=');return i<0?[line,'']:[line.slice(0,i),line.slice(i+1)];}));
}
export default loadInit;
