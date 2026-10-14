/**
 * Acesso rodoviário APROXIMADO para um PK.
 * OSM/OSRM são fontes públicas e não garantem acesso físico, estacionamento nem autorização.
 * Nunca tratar o ponto de estrada como entrada certificada na ferrovia.
 */
import {metersBetween,validGPS} from './rail.js';

export const ROUTER_BASE='https://router.project-osrm.org';
const ROAD_ENDPOINTS=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
const VALID_HIGHWAY=new Set(['primary','secondary','tertiary','unclassified','residential','living_street','service','track','road','primary_link','secondary_link','tertiary_link']);
const FORBIDDEN_ACCESS=new Set(['private','no','agricultural','forestry','delivery','customers']);

export function drivableRoad(tags={}){
 const highway=String(tags.highway||'');
 if(!VALID_HIGHWAY.has(highway))return false;
 if(['yes','true','1'].includes(String(tags.construction||'')))return false;
 if(['yes','true','1'].includes(String(tags.proposed||'')))return false;
 for(const k of ['access','vehicle','motor_vehicle','motorcar'])if(FORBIDDEN_ACCESS.has(String(tags[k]||'')))return false;
 if(tags.highway==='road'||tags.highway==='track'||tags.highway==='service'){
   // Permitidos como possibilidades, mas o UI obriga a verificação de acesso real.
 }
 return true;
}

export function roadQuery(point,radius=1800){
 if(!validGPS(point?.lat,point?.lng))throw Error('PK sem posição ferroviária.');
 const r=Math.min(4000,Math.max(200,Math.round(radius)));
 const lat=Number(point.lat).toFixed(7),lng=Number(point.lng).toFixed(7);
 return `[out:json][timeout:22];way["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|service|track|road|primary_link|secondary_link|tertiary_link)$"](around:${r},${lat},${lng});out geom;`;
}

export function projectToSegment(point,a,b){
 const R=6371008.8,k=Math.PI/180,lat0=(Number(point.lat)+a.lat+b.lat)/3*k;
 const dx=(b.lon-a.lon)*k*R*Math.cos(lat0),dy=(b.lat-a.lat)*k*R;
 const px=(Number(point.lng)-a.lon)*k*R*Math.cos(lat0),py=(Number(point.lat)-a.lat)*k*R;
 const dd=dx*dx+dy*dy;const t=dd?Math.max(0,Math.min(1,(px*dx+py*dy)/dd)):0;
 const lat=a.lat+(b.lat-a.lat)*t,lng=a.lon+(b.lon-a.lon)*t;
 return {lat,lng,gapMeters:metersBetween([Number(point.lat),Number(point.lng)],[lat,lng])};
}

export function candidatesFromRoads(railPoint,elements,{radius=1800,limit=12}={}){
 const spots=[];
 for(const way of elements||[]){
  if(way.type!=='way'||!drivableRoad(way.tags)||!Array.isArray(way.geometry)||way.geometry.length<2)continue;
  let best=null;
  for(let j=1;j<way.geometry.length;j++){
   const a=way.geometry[j-1],b=way.geometry[j];
   if(!Number.isFinite(a?.lat)||!Number.isFinite(a?.lon)||!Number.isFinite(b?.lat)||!Number.isFinite(b?.lon))continue;
   const p=projectToSegment(railPoint,a,b);
   if(!best||p.gapMeters<best.gapMeters)best=p;
  }
  if(!best||best.gapMeters>radius)continue;
  const tags=way.tags||{};
  spots.push({...best,id:`osm-way-${way.id}`,name:tags.name||tags.ref||`Estrada ${tags.highway}`,highway:tags.highway,source:'OpenStreetMap',validated:false,warning:tags.highway==='track'?'Caminho: confirmar transitabilidade e autorização.':tags.highway==='service'?'Via de serviço: confirmar que é pública e transitável.':''});
 }
 spots.sort((a,b)=>a.gapMeters-b.gapMeters);
 const filtered=[];
 for(const spot of spots){
  if(filtered.every(other=>metersBetween([spot.lat,spot.lng],[other.lat,other.lng])>=90))filtered.push(spot);
  if(filtered.length===limit)break;
 }
 return filtered;
}

async function fetchWithTimeout(fetcher,url,options={},timeout=17000){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
 try{const response=await fetcher(url,{...options,signal:controller.signal});if(!response.ok)throw Error(`HTTP ${response.status}`);return await response.json();}
 finally{clearTimeout(timer);}
}

export async function fetchRoadCandidates(point,{fetcher=fetch,hosts=ROAD_ENDPOINTS}={}){
 const query=roadQuery(point);
 let error;
 for(const host of hosts){
  try{
   const data=await fetchWithTimeout(fetcher,host,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query})},18000);
   if(!Array.isArray(data.elements)||data.remark?.includes('error'))throw Error('Resposta OSM incompleta');
   const roads=candidatesFromRoads(point,data.elements);
   if(roads.length)return roads;
   error=Error('Não foram encontradas estradas públicas próximas no OSM.');
  }catch(e){error=e;}
 }
 throw error||Error('Sem estradas OSM próximas.');
}

export function parseOSRMNearest(point,data){
 if(data?.code!=='Ok'||!Array.isArray(data.waypoints))throw Error('A rede rodoviária não encontrou um ponto próximo.');
 return data.waypoints.filter(x=>Array.isArray(x.location)&&validGPS(x.location[1],x.location[0])&&Number.isFinite(x.distance)).map((x,i)=>({
  id:`osrm-${i}`,lat:x.location[1],lng:x.location[0],gapMeters:metersBetween([point.lat,point.lng],[x.location[1],x.location[0]]),name:x.name||'Via mais próxima',source:'OSRM — correspondência rodoviária não validada',highway:'desconhecido',validated:false,warning:'Tipo de estrada e possibilidade de paragem não confirmados.'
 })).sort((a,b)=>a.gapMeters-b.gapMeters).filter(x=>x.gapMeters<5000);
}

export async function osrmNearest(point,{fetcher=fetch,router=ROUTER_BASE}={}){
 const url=`${router}/nearest/v1/driving/${point.lng},${point.lat}?number=5`;
 const data=await fetchWithTimeout(fetcher,url,{},18000);
 return parseOSRMNearest(point,data);
}

export function parseRoadTimes(data,origin,candidates){
 if(data?.code!=='Ok'||!Array.isArray(data.durations?.[0]))throw Error('Sem matriz de tempos rodoviários.');
 return candidates.map((point,i)=>{
  const seconds=data.durations[0][i],meters=data.distances?.[0]?.[i];
  return {...point,durationMin:Number.isFinite(seconds)?Math.ceil(seconds/60):null,driveKm:Number.isFinite(meters)?meters/1000:null};
 });
}

export async function estimateRoadTimes(origin,candidates,{fetcher=fetch,router=ROUTER_BASE}={}){
 if(!validGPS(origin?.lat,origin?.lng)||!candidates.length)return candidates;
 const all=[origin,...candidates].map(p=>`${Number(p.lng).toFixed(7)},${Number(p.lat).toFixed(7)}`).join(';');
 const dest=candidates.map((_,i)=>i+1).join(';');
 const url=`${router}/table/v1/driving/${all}?sources=0&destinations=${dest}&annotations=duration,distance`;
 const data=await fetchWithTimeout(fetcher,url,{},17000);
 return parseRoadTimes(data,origin,candidates);
}

export function chooseAccess(candidates){
 const sorted=[...(candidates||[])].sort((a,b)=>a.gapMeters-b.gapMeters);
 if(!sorted.length)return {near:null,recommended:null,fastestNearby:null,alternatives:[]};
 const near=sorted[0];
 // Privilegiar acessos junto ao PK; dentro de uma tolerância de 300 m comparar tempo de condução.
 const close=sorted.filter(c=>c.gapMeters<=near.gapMeters+300);
 const connected=close.filter(c=>Number.isFinite(c.durationMin));
 const fastestNearby=connected.sort((a,b)=>a.durationMin-b.durationMin||a.gapMeters-b.gapMeters)[0]||null;
 const recommended=fastestNearby||near;
 const alternatives=[recommended,...sorted.filter(x=>x.id!==recommended.id)].slice(0,5);
 return {near,recommended,fastestNearby,alternatives};
}

export async function findRoadAccess(railPoint,origin=null,options={}){
 if(!validGPS(railPoint?.lat,railPoint?.lng))throw Error('PK não localizado: falta o traçado ferroviário.');
 let roads=[],roadError=null,source='osm';
 try{roads=await fetchRoadCandidates(railPoint,options);}catch(e){roadError=e;}
 if(!roads.length){source='osrm-fallback';roads=await osrmNearest(railPoint,options);}
 if(!roads.length)throw Error('Sem pontos rodoviários próximos.');
 let roadTimeError=null;
 if(origin&&validGPS(origin.lat,origin.lng)){
  try{roads=await estimateRoadTimes(origin,roads.slice(0,8),options);}catch(e){roadTimeError=e;}
 }
 const result=chooseAccess(roads);
 return {...result,source,roadError:roadError?.message||'',roadTimeError:roadTimeError?.message||'',railPoint};
}
