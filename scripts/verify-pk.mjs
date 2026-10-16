import {readFile} from 'node:fs/promises';
import {validatePKReferences} from '../src/lib/pk-references.js';
const file=new URL('../public/data/referencias-pk-rfn.json',import.meta.url);
const d=validatePKReferences(JSON.parse(await readFile(file,'utf8')));
console.log(`RJP RFN: ${d.assigned||0} marcos em ${Object.keys(d.lines).length} troços; estado=${d.status}. OSM não certificado.`);
