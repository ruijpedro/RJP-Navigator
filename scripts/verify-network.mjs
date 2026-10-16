import {readFile} from 'node:fs/promises';
import {validateNationalNetwork} from '../src/lib/network-loader.js';
const d=JSON.parse(await readFile(new URL('../public/data/rede-ferroviaria-nacional.json',import.meta.url),'utf8'));
const network=validateNationalNetwork(d);
const count=network.linhas.reduce((n,l)=>n+(l.segmentos||[]).filter(s=>s.coords?.length>1).length,0);
console.log(`RJP V4.2: cartografia nacional pronta — ${network.linhas.length} linhas, ${count} segmentos reais.`);
