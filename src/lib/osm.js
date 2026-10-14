/* OpenStreetMap/Overpass: dados abertos, não substituem levantamento IP.
   Fonte para o eixo: relação OSM 2076345 (Linha do Oeste). */
import {metersBetween, parsePK, formatPK, validGPS, interpolatePK, PK_START, PK_END} from './rail.js';

export const OSM_RELATION_ID = 2076345;
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';
const BBOX='38.74,-9.52,40.06,-8.69';
const HOSTS=['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const REL_QUERY=`[out:json][timeout:70];way(r:${OSM_RELATION_ID});out geom;`;
const ASSET_QUERY=`[out:json][timeout:90];(nwr["railway"~"^(level_crossing|station|halt)$"](${BBOX});nwr["building"="train_station"](${BBOX}););out center;`;

export async function fetchOverpass(query,fetcher=fetch){
 let lastError;
 for(const endpoint of HOSTS){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),60000);
  try{
   const r=await fetcher(endpoint,{method:'POST',body:new URLSearchParams({data:query}),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:controller.signal});
   if(!r.ok)throw Error(`HTTP ${r.status}`);
   const data=await r.json();
   if(!data||!Array.isArray(data.elements)||data.remark?.includes('error'))throw Error(data.remark||'Resposta incompleta');
   return {elements:data.elements,origin:endpoint};
  }catch(e){lastError=e;}finally{clearTimeout(timer);}
 }
 throw Error('Não foi possível consultar o OpenStreetMap/Overpass. Confirma a internet e tenta novamente. '+(lastError?.message||''));
}

class Heap{
 constructor(){this.arr=[];}
 push(v){let a=this.arr,i=a.length;a.push(v);while(i>0){let p=(i-1)>>1;if(a[p][0]<=v[0])break;a[i]=a[p];i=p;}a[i]=v;}
 pop(){let a=this.arr;if(!a.length)return null;const out=a[0],last=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let child=i*2+1;if(child+1<a.length&&a[child+1][0]<a[child][0])child++;if(a[child][0]>=last[0])break;a[i]=a[child];i=child;}a[i]=last;}return out;}
 get length(){return this.arr.length;}
}
const keyFor=(way,idx,p)=>way.nodes?.[idx]!=null?`n${way.nodes[idx]}`:`c${Number(p.lat).toFixed(7)},${Number(p.lon).toFixed(7)}`;
export function createRouteFromOSM(elements,from,to){
 const nodes=new Map(),adj=new Map();let segments=0;
 for(const way of elements||[]){
  if(way.type!=='way'||!Array.isArray(way.geometry)||way.geometry.length<2)continue;
  const pts=way.geometry;
  for(let i=0;i<pts.length;i++){
   const p=pts[i],key=keyFor(way,i,p);
   if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon))continue;
   nodes.set(key,[p.lat,p.lon]);if(!adj.has(key))adj.set(key,[]);
   if(i===0)continue;
   const prev=keyFor(way,i-1,pts[i-1]);if(!nodes.has(prev))continue;
   const d=metersBetween(nodes.get(prev),nodes.get(key));if(d<0.01||d>10000)continue;
   adj.get(key).push([prev,d]);adj.get(prev).push([key,d]);segments++;
  }
 }
 if(!segments||nodes.size<10)throw Error('A relação ferroviária OSM não forneceu uma rede conectada utilizável.');
 function snap(point){let best=null,d=Infinity;for(const [k,pos] of nodes){const x=metersBetween(pos,point);if(x<d){d=x;best=k;}}return {key:best,offset:d};}
 const a=snap(from),b=snap(to);
 if(a.offset>2500||b.offset>2500)throw Error(`Os PK limites estão afastados do eixo OSM (${Math.round(a.offset)} m, ${Math.round(b.offset)} m). Verificar coordenadas/sistema de referência.`);
 const costs=new Map([[a.key,0]]),prev=new Map(),heap=new Heap();heap.push([0,a.key]);
 while(heap.length){const [cost,k]=heap.pop();if(cost>costs.get(k))continue;if(k===b.key)break;
  for(const [next,d] of adj.get(k)||[]){const n=cost+d;if(n<(costs.get(next)??Infinity)){costs.set(next,n);prev.set(next,k);heap.push([n,next]);}}
 }
 if(!costs.has(b.key))throw Error('A geometria OSM não liga os dois extremos; confirma a relação ferroviária e importa GeoJSON se necessário.');
 const keys=[];let cursor=b.key;let guard=0;while(cursor!=null&&guard++<=nodes.size){keys.push(cursor);if(cursor===a.key)break;cursor=prev.get(cursor);}
 if(keys[keys.length-1]!==a.key)throw Error('Caminho ferroviário incompleto.');
 const coords=keys.reverse().map(k=>nodes.get(k)),length=costs.get(b.key);
 if(length<115000||length>245000)throw Error(`Comprimento OSM de ${(length/1000).toFixed(1)} km fora do esperado. Não foram criadas localizações duvidosas.`);
 return {coords,length,startError:a.offset,endError:b.offset,sourceFile:`OpenStreetMap relação ${OSM_RELATION_ID}`,source:'osm',importedAt:new Date().toISOString(),needsCalibration:true};
}

function normalize(x){return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(estacao|ferroviaria|apeadeiro|estacao de|de|do|da|dos|das|sao|santa|santo)\b/g,'').replace(/[^a-z0-9]/g,'');}
export function parseOSMAssets(elements){return (elements||[]).filter(o=>o.type==='node'||o.type==='way'||o.type==='relation').map(x=>{
  const lat=Number(x.lat??x.center?.lat),lng=Number(x.lon??x.center?.lon),tags=x.tags||{};
  return {id:`${x.type}/${x.id}`,lat,lng,name:tags.name||tags['name:pt']||'',type:tags.railway==='level_crossing'?'crossing':(['station','halt'].includes(tags.railway)?'station':tags.building==='train_station'?'building':''),tags};
 }).filter(x=>x.type&&validGPS(x.lat,x.lng));}

export function closestOnRoute(point,route){
 if(!route?.coords?.length)return null;
 const R=6371008.8,toRad=Math.PI/180;let best=null,along=0;
 for(let i=1;i<route.coords.length;i++){
  const a=route.coords[i-1],b=route.coords[i],lat0=(a[0]+b[0]+point.lat)/3*toRad;
  const dx=(b[1]-a[1])*toRad*R*Math.cos(lat0),dy=(b[0]-a[0])*toRad*R;
  const px=(point.lng-a[1])*toRad*R*Math.cos(lat0),py=(point.lat-a[0])*toRad*R;
  const denom=dx*dx+dy*dy,t=denom?Math.min(1,Math.max(0,(px*dx+py*dy)/denom)):0;
  const dist=Math.hypot(px-dx*t,py-dy*t),len=metersBetween(a,b);
  if(best===null||dist<best.distance)best={distance:dist,along:along+len*t,lat:a[0]+(b[0]-a[0])*t,lng:a[1]+(b[1]-a[1])*t};
  along+=len;
 }
 if(best)best.estimatedPK=formatPK(PK_START+best.along/route.length*(PK_END-PK_START));
 return best;
}

export function associateOSM(base,route,osm){
 if(!route||!osm?.length)return {};
 const crossings=osm.filter(a=>a.type==='crossing').map(o=>({...o,projection:closestOnRoute(o,route)})).filter(o=>o.projection.distance<=40);
 const stations=osm.filter(a=>a.type==='station').map(o=>({...o,projection:closestOnRoute(o,route)})).filter(o=>o.projection.distance<=800);
 const buildings=osm.filter(a=>a.type==='building');
 const assignments={},used=new Set();
 // Correspondências conservadoras: PK interpolado difere no máximo 110 m; nunca alterar PK oficial.
 for(const item of base.filter(a=>a.categoria==='Passagem de Nível')){
  const pk=parsePK(item.pk);if(pk==null||pk<PK_START||pk>PK_END)continue;
  const predicted=route.length*(pk-PK_START)/(PK_END-PK_START);
  const candidates=crossings.filter(o=>!used.has(o.id)).map(o=>({o,delta:Math.abs(o.projection.along-predicted)})).filter(o=>o.delta<110).sort((a,b)=>a.delta-b.delta);
  if(!candidates.length||candidates[1]?.delta-candidates[0].delta<90)continue;
  const {o,delta}=candidates[0];used.add(o.id);
  assignments[item.key]={lat:o.lat,lng:o.lng,status:'OSM — PN provável',note:`Cruzamento cartografado ${o.id}; diferença estimada de PK: ${Math.round(delta)} m. Não confirmado no terreno.`,osmId:o.id};
 }
 // Estações cartografadas pelo nome (sem assumir que a estação seja o edifício EDF).
 for(const item of base.filter(a=>a.categoria==='Estação/Apeadeiro')){
  const n=normalize(item.nome);if(n.length<3)continue;
  let pool=stations.filter(o=>{const m=normalize(o.name);return m&&m.length>=3&&(m===n||m.includes(n)||n.includes(m));});
  pool.sort((a,b)=>a.projection.distance-b.projection.distance);
  if(!pool.length)continue;
  const chosen=pool[0];if(pool[1]&&normalize(pool[1].name)===normalize(chosen.name)&&Math.abs(pool[1].projection.distance-chosen.projection.distance)<80)continue;
  const suggestedPK=chosen.projection.estimatedPK;
  assignments[item.key]={lat:chosen.lat,lng:chosen.lng,status:'OSM — estação',note:`Local cartografado como ${chosen.name}; PK deduzido do eixo, não certificado.`,estimatedPK:suggestedPK,osmId:chosen.id};
  const edfKey=`edf-${item.id}`;
  if(base.some(b=>b.key===edfKey)){
   const building=buildings.map(b=>({...b,d:metersBetween([b.lat,b.lng],[chosen.lat,chosen.lng])})).filter(b=>b.d<=180).sort((a,b)=>a.d-b.d)[0];
   if(building){assignments[edfKey]={lat:building.lat,lng:building.lng,status:'OSM — edifício provável',note:`Edifício ${building.id}, a ${Math.round(building.d)} m da estação. Identificação EDF por validar.`,estimatedPK:suggestedPK,osmId:building.id};}
   else{assignments[edfKey]={lat:chosen.lat,lng:chosen.lng,status:'Estimado junto à estação',note:'GPS da estação, NÃO corresponde necessariamente ao edifício EDF. Confirmar no terreno.',estimatedPK:suggestedPK};}
  }
 }
 return assignments;
}
export {REL_QUERY, ASSET_QUERY};
