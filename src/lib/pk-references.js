/**
 * RJP Navigator V4.2.1 — georreferenciamento de marcos OSM por linha/troço.
 * Uma observação OSM nunca é certificação da Infraestruturas de Portugal.
 * Ambiguidades entre vias paralelas são rejeitadas, não atribuídas ao acaso.
 */
import {parseRailwayPosition} from './hectometers.js';
import {projectToRail} from './gps-nearest.js';

export const PK_REFERENCES_SCHEMA='rjp-rfn-osm-pk-v1';
export const emptyPKReferences=()=>({schema:PK_REFERENCES_SCHEMA,source:'© OpenStreetMap contributors (ODbL)',generatedAt:null,lines:{},observed:0,assigned:0,ambiguous:0,status:'not-downloaded'});
const fmt=(name,index)=>`${name}|${index}`;
const namesMatch=(tags,name)=>{
 const n=String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const label=[tags['railway:ref'],tags['railway:line'],tags['railway:position:line'],tags['ref:railway'],tags.line].filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(!label)return true;
 // Only reject explicit designation mismatch if a full line name is specified.
 const full=label.match(/linha\s+d[aoe]\s+[a-z-]+/);
 return !full||n.includes(full[0])||full[0].includes(n);
};

export function railwayMilestones(elements){
 const seen=new Set(),out=[];
 for(const e of elements||[]){
  if(e?.type!=='node'||!Number.isSafeInteger(Number(e.id))||!Number.isFinite(Number(e.lat))||!Number.isFinite(Number(e.lon)))continue;
  const tags=e.tags||{};
  const pk=parseRailwayPosition(tags['railway:position:exact']??tags['railway:position']);
  if(pk==null||e.lat<36||e.lat>43||e.lon< -10||e.lon> -5.5||seen.has(e.id))continue;
  seen.add(e.id);
  out.push({pk,id:Number(e.id),lat:Number(e.lat),lng:Number(e.lon),tags,source:tags['railway:position:exact']!=null?'OSM railway:position:exact':'OSM railway:position',physical:tags.railway==='milestone',verified:false});
 }
 return out;
}

function bounds(coords){
 const lat=coords.map(x=>x[0]),lon=coords.map(x=>x[1]);
 return {minLat:Math.min(...lat),maxLat:Math.max(...lat),minLng:Math.min(...lon),maxLng:Math.max(...lon)};
}
function selectSequence(markers){
 // A cadeia mais longa consistente em distância e sentido protege de PK de uma
 // via paralela com origem diferente, geometria invertida e marcos errados.
 if(markers.length<2)return [];
 const ordered=[...markers].sort((a,b)=>a.along-b.along);
 const longest=(direction)=>{
  const dp=ordered.map((_,i)=>({score:1,prev:-1}));
  for(let i=0;i<ordered.length;i++)for(let j=0;j<i;j++){
   const pkDiff=(ordered[i].pk-ordered[j].pk)*direction;
   const railDiff=ordered[i].along-ordered[j].along;
   if(pkDiff<80||railDiff<50)continue;
   const ratio=railDiff/pkDiff;
   if(ratio<0.72||ratio>1.32)continue;
   if(dp[j].score+1>dp[i].score)dp[i]={score:dp[j].score+1,prev:j};
  }
  const at=dp.reduce((best,item,i)=>item.score>dp[best].score?i:best,0);
  const result=[];for(let i=at;i>=0;i=dp[i].prev){result.push(ordered[i]);if(dp[i].prev<0)break;}
  return result.reverse();
 };
 const a=longest(1),b=longest(-1),winner=a.length>=b.length?a:b;
 return winner.length>=2?winner:[];
}

export function associatePKToNetwork(network,rawMilestones,{maxDistance=32,ambiguity=10}={}){
 const tracks=[];
 for(const l of network?.linhas||[])for(const [index,s] of (l.segmentos||[]).entries()){
  if(!Array.isArray(s.coords)||s.coords.length<2)continue;
  tracks.push({name:l.nome,index,coords:s.coords,bounds:bounds(s.coords)});
 }
 const milestones=railwayMilestones(rawMilestones),groups=new Map();
 let ambiguous=0,unmatched=0;
 for(const m of milestones){
  const hits=[];
  for(const tr of tracks){
   const b=tr.bounds;
   if(m.lat<b.minLat-.0005||m.lat>b.maxLat+.0005||m.lng<b.minLng-.0007||m.lng>b.maxLng+.0007)continue;
   if(!namesMatch(m.tags,tr.name))continue;
   const p=projectToRail(m,tr.coords);
   if(p&&p.distance<=maxDistance)hits.push({...tr,along:p.along,snapDistance:p.distance});
  }
  hits.sort((a,b)=>a.snapDistance-b.snapDistance);
  if(!hits.length){unmatched++;continue;}
  const closest=hits[0],runner=hits.find(h=>h.name!==closest.name||h.index!==closest.index);
  if(runner&&runner.snapDistance-closest.snapDistance<ambiguity){ambiguous++;continue;}
  const key=fmt(closest.name,closest.index);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push({pk:m.pk,lat:m.lat,lng:m.lng,along:closest.along,snapDistance:closest.snapDistance,source:m.source,osmId:m.id,physical:m.physical,verified:false});
 }
 const lines={};let assigned=0,rejected=0;
 for(const [key,items] of groups){
  const selected=selectSequence(items);
  if(selected.length>=2){
   lines[key]=selected.sort((a,b)=>a.pk-b.pk);
   assigned+=selected.length;
  }
  rejected+=items.length-selected.length;
 }
 return {schema:PK_REFERENCES_SCHEMA,source:'© OpenStreetMap contributors (ODbL)',generatedAt:new Date().toISOString(),lines,observed:milestones.length,assigned,ambiguous,unmatched,rejected,status:'collected'};
}
export function validatePKReferences(data){
 if(!data||data.schema!==PK_REFERENCES_SCHEMA||typeof data.lines!=='object'||Array.isArray(data.lines))throw Error('Base de marcos PK incompatível.');
 for(const arr of Object.values(data.lines))if(!Array.isArray(arr)||arr.some(x=>!Number.isFinite(x.pk)||!Number.isFinite(x.lat)||!Number.isFinite(x.lng)||x.verified!==false))throw Error('Referências PK inválidas ou marcadas indevidamente como verificadas.');
 return data;
}
export async function loadPKReferences(url,{fetcher=fetch,signal}={}){
 const response=await fetcher(url,{cache:'no-cache',signal});
 if(!response.ok)throw Error(`HTTP ${response.status}`);
 return validatePKReferences(await response.json());
}
