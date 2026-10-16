/** Importa marcos ferroviários OSM para todos os troços da cartografia RFN.
 * Não fabrica marcos nem considera os resultados topograficamente certificados.
 * Erros de rede preservam o último ficheiro válido. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {associatePKToNetwork,validatePKReferences,emptyPKReferences} from '../src/lib/pk-references.js';
const nationalUrl=new URL('../public/data/rede-ferroviaria-nacional.json',import.meta.url);
const fileUrl=new URL('../public/data/referencias-pk-rfn.json',import.meta.url);
const net=JSON.parse(await readFile(nationalUrl,'utf8'));
const bounds=[[36.75,-9.65,38.75,-6.05],[38.75,-9.65,40.5,-6.05],[40.5,-9.65,42.25,-6.05]];
const hosts=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
async function fetchArea(bb){
 const b=bb.join(',');
 const query=`[out:json][timeout:90];(node["railway"="milestone"](${b});node["railway:position"](${b});node["railway:position:exact"](${b}););out body;`;
 let last='';
 for(const host of hosts){
  const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),70000);
  try{
   const res=await fetch(host+'?data='+encodeURIComponent(query),{signal:ctl.signal,headers:{Accept:'application/json'}});
   if(!res.ok)throw Error(`HTTP ${res.status}`);
   const data=await res.json();
   if(!Array.isArray(data.elements))throw Error('Sem elementos OSM');
   return data.elements;
  }catch(e){last=String(e.message||e);}finally{clearTimeout(timeout);}
 }
 throw Error(last||'Serviço de cartografia indisponível');
}
let saved;try{saved=validatePKReferences(JSON.parse(await readFile(fileUrl,'utf8')));}catch{saved=emptyPKReferences();}
const all=[];let errors=0;
for(const [i,b] of bounds.entries()){
 try{const nodes=await fetchArea(b);all.push(...nodes);console.log(`Marcos OSM: zona ${i+1}/${bounds.length}, ${nodes.length} nós.`);}
 catch(e){errors++;console.warn(`Consulta marcos da zona ${i+1} falhou: ${e.message}`);}
}
if(errors===0){
 const data=associatePKToNetwork(net,all);
 if(data.assigned>=2){saved=data;console.log(`Referências PK ligadas: ${data.assigned} marcos em ${Object.keys(data.lines).length} troços; ${data.ambiguous} ambíguos rejeitados.`);}
 else console.warn('A consulta não forneceu pares fiáveis; mantida a base anterior.');
}else console.warn('Consulta incompleta; preservadas referências anteriores, sem sugerir cobertura total.');
await mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
await writeFile(fileUrl,JSON.stringify(saved));
console.log(`Base PK incluída: ${saved.assigned||0} marcos, ${Object.keys(saved.lines).length} troços; estado=${saved.status}.`);
