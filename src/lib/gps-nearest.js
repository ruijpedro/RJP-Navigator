/**
 * RJP Navigator V4.2 — identificação automática da ferrovia mais próxima.
 * Todos os cálculos são locais e nunca confundem distância geométrica com PK oficial.
 * A rede contém eixos [latitude, longitude] por linha/segmento.
 */
import {formatPK,parsePK,metersBetween,validGPS} from './rail.js';

const DEFAULT_MAX_GPS_ERROR=120;
const MAX_SNAP_ANCHOR=150;
const rad=Math.PI/180;

export function projectToRail(point,coords){
 if(!validGPS(point?.lat,point?.lng)||!Array.isArray(coords)||coords.length<2)return null;
 const lat=Number(point.lat),lng=Number(point.lng),sx=111195*Math.cos(lat*rad),sy=111195;
 let d=0,best=null;
 for(let i=1;i<coords.length;i++){
  const a=coords[i-1],b=coords[i];
  if(!Array.isArray(a)||!Array.isArray(b)||!validGPS(a[0],a[1])||!validGPS(b[0],b[1]))return null;
  const dx=(b[1]-a[1])*sx,dy=(b[0]-a[0])*sy,px=(lng-a[1])*sx,py=(lat-a[0])*sy;
  const len2=dx*dx+dy*dy,t=len2?Math.max(0,Math.min(1,(dx*px+dy*py)/len2)):0;
  const p={lat:a[0]+(b[0]-a[0])*t,lng:a[1]+(b[1]-a[1])*t};
  const distance=metersBetween([lat,lng],[p.lat,p.lng]),seg=metersBetween(a,b);
  if(!best||distance<best.distance)best={...p,along:d+seg*t,distance};
  d+=seg;
 }
 return best?{...best,routeLength:d}:null;
}

export function anchorPositions(coords,anchors){
 if(!Array.isArray(anchors)||anchors.length<2)return [];
 let length=0;
 for(let i=1;i<coords.length;i++)length+=metersBetween(coords[i-1],coords[i]);
 const refs=[];
 for(const a of anchors){
  const pk=parsePK(a?.pk);
  if(pk==null)continue;
  let along;
  if(a.position==='start')along=0;
  else if(a.position==='end')along=length;
  else{
   if(!validGPS(a.lat,a.lng))continue;
   const projected=projectToRail(a,coords);
   if(!projected||projected.distance>MAX_SNAP_ANCHOR)continue;
   along=projected.along;
  }
  refs.push({pk,along,verified:a.verified===true,source:a.source||''});
 }
 refs.sort((a,b)=>a.along-b.along);
 if(refs.length<2)return [];
 const asc=refs[1].pk>refs[0].pk;
 for(let i=1;i<refs.length;i++){
  const prev=refs[i-1],now=refs[i];
  if(now.along-prev.along<3||(asc?now.pk<=prev.pk:now.pk>=prev.pk))return [];
  const ratio=(now.along-prev.along)/Math.abs(now.pk-prev.pk);
  // References with physically implausible ratio are not suitable for PK interpolation.
  if(ratio<0.55||ratio>1.6)return [];
 }
 return refs;
}

export function pkFromPosition(along,references){
 if(!Array.isArray(references)||references.length<2||!Number.isFinite(along))return null;
 if(along<references[0].along||along>references.at(-1).along)return null;
 for(let i=1;i<references.length;i++){
  const a=references[i-1],b=references[i];
  if(along<=b.along){
   const t=(along-a.along)/(b.along-a.along);
   const pk=Math.round(a.pk+(b.pk-a.pk)*t);
   return {pk,pkLabel:formatPK(pk),calibrationStatus:(a.verified&&b.verified)?'Entre referências verificadas':'Estimado entre referências',referenceGapMeters:Math.abs(b.pk-a.pk),referenceSources:[a.source,b.source]};
  }
 }
 return null;
}

const normalize=(v)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const lineId=name=>{
 const n=normalize(name);
 const overrides={linhadoeste:'oeste',linhadonorte:'norte',linhadominho:'minho',linhadodouro:'douro',linhadecascais:'cascais',linhadecintura:'cintura',linhadosul:'sul',linhadoalgarve:'algarve',linhadabeiraalta:'beira-alta',linhadabeirabaixa:'beira-baixa'};
 return overrides[n]||null;
};

/** Find nearest line independent from PK, then interpolate only where anchors permit it. */
export function closestRailwayGPS(point,network,{presets={},customAnchors={},referenceSets={},extraRoutes=[]}={}){
 if(!validGPS(point?.lat,point?.lng))return {error:'Localização GPS inválida.'};
 const accuracy=Number(point.acc);
 const hits=[];
 const data=(network?.linhas||[]).flatMap(line=>(line.segmentos||[]).map((seg,i)=>({name:line.nome,index:i,coords:seg.coords,source:'Rede Ferroviária Nacional'})));
 const lines=[...data,...extraRoutes];
 for(const item of lines){
  if(!item.coords?.length||item.coords.length<2)continue;
  const projected=projectToRail(point,item.coords);
  if(!projected)continue;
  hits.push({...projected,line:item.name,segmentIndex:item.index,source:item.source||'Traçado local',coords:item.coords,calibration:item.calibration});
 }
 if(!hits.length)return {error:'A cartografia nacional ainda não contém eixos para localizar uma linha.'};
 hits.sort((a,b)=>a.distance-b.distance);
 // Distinct line names only: overlapping segments of one line are not an ambiguity.
 const unique=[];const seen=new Set();
 for(const a of hits){const key=normalize(a.line);if(seen.has(key))continue;seen.add(key);unique.push(a);}
 const winner=unique[0];const akey=`${winner.line}|${winner.segmentIndex}`;
 const manual=customAnchors[lineId(winner.line)]||[];
 const anchors=winner.calibration|| (manual.length>=2?manual:(referenceSets[akey]?.length>=2?referenceSets[akey]:presets[akey]?.anchors||[]));
 const refs=anchorPositions(winner.coords,anchors);
 const pkInfo=winner.distance<=2000?pkFromPosition(winner.along,refs):null;
 const threshold=Math.max(40,Number.isFinite(accuracy)?Math.min(accuracy,100)*1.5:40);
 const alternatives=unique.slice(1).filter(c=>c.distance-winner.distance<=threshold).slice(0,3).map(c=>({line:c.line,distance:Math.round(c.distance)}));
 const near={line:winner.line,segmentIndex:winner.segmentIndex,lat:winner.lat,lng:winner.lng,offsetMeters:Math.round(winner.distance),source:winner.source,pk:pkInfo?.pk??null,pkLabel:pkInfo?.pkLabel??null,calibrationStatus:pkInfo?.calibrationStatus||'PK indisponível: faltam referências quilométricas',referenceGapMeters:pkInfo?.referenceGapMeters??null};
 return {nearest:near,alternatives,ambiguous:alternatives.length>0,accuracyMeters:Number.isFinite(accuracy)?Math.round(accuracy):null,gpsQuality:Number.isFinite(accuracy)&&accuracy>DEFAULT_MAX_GPS_ERROR?'GPS com precisão reduzida':'GPS disponível',farFromRail:winner.distance>2000};
}
