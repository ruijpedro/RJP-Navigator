/**
 * Hectómetros virtuais / marcos cartografados da RFN.
 * A posição OSM e a interpolação NÃO constituem uma certificação da IP.
 */
import {formatPK,metersBetween,parsePK,validGPS} from './rail.js';
import {nearestOnLine,pointForPK} from './national.js';

/** railway:position utiliza quilómetros decimais; sem unidade é km. */
export function parseRailwayPosition(raw){
 if(typeof raw==='number')return Number.isFinite(raw)&&raw>=0&&raw<=999.999?Math.round(raw*1000):null;
 const s=String(raw??'').trim().replace(/\s/g,'');
 if(!s||/^mi:|^pkm:/i.test(s)||s.includes(';')||s.includes('|'))return null;
 const plus=s.match(/^(\d{1,3})\+(\d{1,3})$/);
 if(plus){let metres=Number(plus[2]);return metres<1000?Number(plus[1])*1000+metres:null;}
 if(!/^\d{1,3}(?:[,.]\d{1,3})?$/.test(s))return null;
 const [km,fraction='']=s.replace(',','.').split('.');
 return Number(km)*1000+Number(fraction.padEnd(3,'0'));
}

/** Pesquisa limitada à área geométrica. Não confundir marcos de linhas paralelas. */
export function milestoneQueryForRoute(route,padding=0.006){
 if(!Array.isArray(route?.coords)||route.coords.length<2)throw Error('Importa o traçado desta linha antes de pesquisar marcos.');
 const lat=route.coords.map(p=>Number(p[0])),lon=route.coords.map(p=>Number(p[1]));
 if(!lat.every(Number.isFinite)||!lon.every(Number.isFinite))throw Error('Traçado inválido.');
 const bound=[Math.min(...lat)-padding,Math.min(...lon)-padding,Math.max(...lat)+padding,Math.max(...lon)+padding];
 if(bound[2]-bound[0]>3.5||bound[3]-bound[1]>2.5)throw Error('Extensão geográfica demasiado ampla para consulta direta.');
 const bbox=bound.map(x=>x.toFixed(6)).join(',');
 return `[out:json][timeout:80];(node["railway"="milestone"](${bbox});node["railway:position"](${bbox});node["railway:position:exact"](${bbox}););out body;`;
}

export function parseMilestoneOSM(elements,route,{maxDistance=45,lineRef=''}={}){
 if(!route?.coords?.length)return [];
 const found=new Map();
 for(const el of elements||[]){
  if(el.type!=='node'||!Number.isFinite(Number(el.id))||!validGPS(el.lat,el.lon))continue;
  const tags=el.tags||{};
  const keys=Object.keys(tags).filter(k=>k.startsWith('railway:position:exact:')||k.startsWith('railway:position:'));
  // O campo do ramal/linha, quando indicado, é obrigatório para evitar confundir eixos vizinhos.
  const specific=keys;
  const canonical=tags['railway:position:exact']??tags['railway:position'];
  let raw=canonical,matchedLine=false;
  if(lineRef&&specific.length){
   const desired=String(lineRef).trim().toLowerCase();
   const exact=keys.find(k=>k.replace(/^railway:position:(?:exact:)?/,'').toLowerCase()===desired);
   if(exact){raw=tags[exact];matchedLine=true;}
   else if(!canonical)continue;
  }
  const pk=parseRailwayPosition(raw);
  if(pk==null)continue;
  const pos={lat:Number(el.lat),lng:Number(el.lon)},nearest=nearestOnLine(pos,route);
  if(!nearest||nearest.distance>maxDistance)continue;
  const k=String(el.id);
  found.set(k,{id:k,pk,lat:pos.lat,lng:pos.lng,along:nearest.along,snapDistance:nearest.distance,
   source:'OpenStreetMap · railway:position'+(tags['railway:position:exact']!=null?':exact':''),
   osmId:el.id,verified:false,matchedLine,physical:tags.railway==='milestone',tags});
 }
 return [...found.values()].sort((a,b)=>a.pk-b.pk);
}

/** Mantém ambiguidade visível: marcos que discordam da calibração não são promovidos. */
export function assessMilestones(markers,calibration,{maxDifference=250}={}){
 return (markers||[]).map(m=>{
  // Uma base com âncoras não verificadas e distantes não pode rejeitar um marco
  // pela simples divergência face à sua interpolação grosseira.
  const refs=calibration?.anchors||[];
  const between=refs.findIndex(a=>a.pk>=m.pk);
  const supported=calibration?.ready&&between>0&&refs[between].verified&&refs[between-1].verified&&(refs[between].pk-refs[between-1].pk)<=5000;
  const projected=supported?pointForPK(m.pk,calibration):null;
  const discrepancy=projected?metersBetween([m.lat,m.lng],[projected.lat,projected.lng]):null;
  const usable=discrepancy==null||discrepancy<=maxDifference;
  return {...m,discrepancy,usable,reason:!usable?'PK do marco não corresponde à calibração verificada — verificar linha e origem quilométrica':discrepancy==null?'Marco OSM por validar (sem âncoras oficiais próximas)':'Coerente com referências verificadas próximas'};
 });
}

/** Apenas marcas inteiras de 100 m dentro da zona entre âncoras. */
export function generateHectometers(calibration,{step=100,maxCount=40000}={}){
 if(!calibration?.ready)return [];
 if(!Number.isInteger(step)||step<100||step%100!==0)throw Error('Passo hectométrico inválido.');
 const [start,end]=calibration.span,first=Math.ceil(start/step)*step;
 const count=first>end?0:Math.floor((end-first)/step)+1;
 if(count>maxCount)throw Error('Número excessivo de marcos; seleciona uma linha ou reduz o intervalo.');
 const results=[];
 for(let pk=first;pk<=end;pk+=step){
  const p=pointForPK(pk,calibration);
  if(p)results.push({...p,label:formatPK(pk),physical:false,virtual:true,verified:false});
 }
 return results;
}

/** Diagnóstico quantitativo por intervalo (a precisão não pode ser inferida só da geometria). */
export function calibrationDiagnostics(calibration){
 if(!calibration?.ready)return {ready:false,segments:[],count:0,quality:'Sem calibração',reason:calibration?.reason||'Sem dados'};
 const a=calibration.anchors,segments=[];
 for(let i=1;i<a.length;i++){
  const pkSpan=a[i].pk-a[i-1].pk,geometrySpan=a[i].along-a[i-1].along;
  const scale=geometrySpan/pkSpan;
  const verified=Boolean(a[i].verified&&a[i-1].verified);
  const warning=pkSpan>10000||Math.abs(scale-1)>0.035||!verified;
  segments.push({from:a[i-1].pk,to:a[i].pk,pkSpan,geometrySpan,scale,verified,warning,
   quality:verified&&!warning?'Referências verificadas; interpolação':'Estimativa — validação necessária'});
 }
 return {ready:true,segments,count:a.length,quality:segments.every(s=>s.verified&&!s.warning)?'Referências verificadas':'Estimativa com validação pendente',
  worstGapMeters:Math.max(...segments.map(s=>s.pkSpan)),warnings:segments.filter(s=>s.warning).length};
}

/**
 * Acrescenta marcos OSM não certificados a uma calibração por linha, sem permitir
 * PK duplicados contraditórios, referências no eixo errado ou escala absurda.
 * Os marcos físicos não recebem automaticamente verified=true.
 */
export function improveCalibrationWithMilestones(route,baseAnchors,markers,{ratioMin=0.75,ratioMax=1.25}={}){
 const original=Array.isArray(baseAnchors)?baseAnchors:[];
 if(!route?.coords?.length)return {anchors:original,accepted:[],rejected:(markers||[]).map(x=>({...x,reason:'Sem eixo contínuo'}))};
 const snapped=original.filter(a=>parsePK(a.pk)!=null&&validGPS(a.lat,a.lng)).map(a=>{
  const snap=nearestOnLine(a,route);return snap?{...a,pk:parsePK(a.pk),along:snap.along,snapDistance:snap.distance}:null;
 }).filter(Boolean).filter(x=>x.snapDistance<=150);
 let accepted=[],rejected=[];
 const candidates=(markers||[]).filter(m=>m.usable!==false&&Number.isFinite(m.along)&&Number.isFinite(m.pk)&&m.snapDistance<=45)
  .sort((a,b)=>a.pk-b.pk||a.snapDistance-b.snapDistance);
 let chosen=[...snapped];
 const plausible=(a,b)=>{
  if(a.pk===b.pk)return Math.abs(a.along-b.along)<=20;
  const pkLength=Math.abs(b.pk-a.pk),railLength=Math.abs(b.along-a.along);
  if(pkLength<15)return true;
  const ratio=railLength/pkLength;
  return (b.pk-a.pk)*(b.along-a.along)>0&&ratio>=ratioMin&&ratio<=ratioMax;
 };
 for(const m of candidates){
  const duplicate=chosen.find(a=>a.pk===m.pk);
  if(duplicate){rejected.push({...m,reason:Math.abs(m.along-duplicate.along)>20?'PK duplicado, localização divergente':'Já existe referência para o PK'});continue;}
  const before=[...chosen].filter(a=>a.pk<m.pk).sort((a,b)=>b.pk-a.pk)[0];
  const after=[...chosen].filter(a=>a.pk>m.pk).sort((a,b)=>a.pk-b.pk)[0];
  if((before&&!plausible(before,m))||(after&&!plausible(m,after))){rejected.push({...m,reason:'Incompatível com âncoras ou escala quilométrica'});continue;}
  const ref={pk:m.pk,lat:m.lat,lng:m.lng,source:m.source||'Marco OSM não certificado',verified:false,osmId:m.osmId,physical:m.physical};
  chosen.push({...ref,along:m.along});accepted.push(ref);
 }
 chosen.sort((a,b)=>a.pk-b.pk);
 return {anchors:chosen.map(({along,snapDistance,...rest})=>rest),accepted,rejected};
}
