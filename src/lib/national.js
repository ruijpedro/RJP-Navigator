// RJP Navigator V3.8 — referenciação quilométrica por segmento da Rede Ferroviária Nacional.
// O shapefile fornece geometria, NÃO os PK oficiais. As referências documentais
// são indicativas; só levantamentos e documentação técnica validam os PK precisos.
import {parsePK, formatPK, metersBetween, validGPS} from './rail.js';

export const NATIONAL_PRESETS = {
 'Linha do Norte|0': {
  anchors:[{pk:'0+000',position:'start',source:'IP, Plano de Ação Linha do Norte I (PK 0+000 em Santa Apolónia)'},{pk:'336+079',position:'end',source:'IP, Plano de Ação Linha do Minho I (Campanhã, PK 336+079 da Linha do Norte)'}],
  source:'https://www.infraestruturasdeportugal.pt/sites/default/files/ambiente-ruido/2020/norte_I.pdf',
  note:'Extremos documentados. Correspondência geométrica e PK intermédios apenas estimados.'
 },
 'Linha do Minho|0': {
  anchors:[{pk:'0+000',position:'start',source:'IP, Plano de Ação Minho I: Campanhã PK 0+000'},{pk:'131+449',position:'end',source:'IP, Diretório da Rede 2019: Valença Fronteira PK 131+449'}],
  source:'https://www.infraestruturasdeportugal.pt/sites/default/files/ambiente-ruido/2020/minho_I.pdf',
  note:'PK de Valença proveniente de documento anterior; validar situação atual.'
 },
 'Linha de Cascais|0': {
  anchors:[{pk:'0+000',position:'start',source:'IP, Plano de Ação da Linha de Cascais'},{pk:'25+400',position:'end',source:'IP, Plano de Ação da Linha de Cascais — valor aproximado'}],
  source:'https://www.infraestruturasdeportugal.pt/sites/default/files/ambiente-ruido/2020/cascais.pdf',
  note:'PK final aproximadamente 25+400, conforme documentação IP; não é referência topográfica exata.'
 },
 'Linha de Cintura|1': {
  anchors:[{pk:'0+000',position:'start',source:'IP, Plano de Ação da Linha de Cintura: Alcântara-Terra'},{pk:'10+500',position:'end',source:'IP, Plano de Ação da Linha de Cintura: Braço de Prata, valor aproximado'}],
  source:'https://www.infraestruturasdeportugal.pt/sites/default/files/ambiente-ruido/2020/cintura.pdf',
  note:'Apenas troço Alcântara-Terra / Braço de Prata. PK final aproximado (10+500).'
 },
 'Linha do Minho|1': {
  anchors:[{pk:'2+618',position:'start',source:'IP, Plano de Ação da Linha do Minho I: Porto São Bento'},{pk:'0+000',position:'end',source:'IP, Plano de Ação da Linha do Minho I: Porto Campanhã'}],
  source:'https://www.infraestruturasdeportugal.pt/sites/default/files/ambiente-ruido/2020/minho_I.pdf',
  note:'Neste sub-troço os PK descem de 2+618 para 0+000. Estimativa por interpolação.'
 },
 'Linha do Oeste|0': {
  anchors:[{pk:'21+191',lat:38.79752688033888,lng:-9.313184100692187,source:'Referência cartográfica fornecida pelo utilizador'},{pk:'191+191',lat:40.00997619214555,lng:-8.813148027613115,source:'Referência cartográfica fornecida pelo utilizador'}],
  note:'Troço de responsabilidade PK 21+191–191+191; fora desse intervalo ainda não calibrado.'
 }
};

export function segmentKey(lineName, index){return `${lineName}|${index}`;}
export function defaultCalibration(lineName,index){return NATIONAL_PRESETS[segmentKey(lineName,index)]||{anchors:[],note:'Sem referências PK oficiais associadas aos extremos da geometria.'};}

export function geometryProfile(coords){
 if(!Array.isArray(coords)||coords.length<2)throw Error('Segmento sem geometria contínua.');
 const positions=[0];let length=0;
 for(let i=0;i<coords.length;i++){
  const p=coords[i];if(!Array.isArray(p)||!validGPS(p[0],p[1]))throw Error('Coordenadas do eixo inválidas.');
  if(i){const d=metersBetween(coords[i-1],p);if(d>10000)throw Error('Troço com descontinuidade geométrica superior a 10 km.');length+=d;positions.push(length);}
 }
 if(length<5)throw Error('Segmento demasiado curto para pesquisa.');
 return {coords,positions,length};
}

export function pointAt(profile,along){
 if(!profile||!Number.isFinite(along)||along<0||along>profile.length+0.01)return null;
 const d=Math.min(profile.length,Math.max(0,along));const cum=profile.positions;
 let l=0,r=cum.length-1;while(l<r){const m=(l+r)>>1;if(cum[m]<d)l=m+1;else r=m;}
 const i=Math.max(1,l),p0=profile.coords[i-1],p1=profile.coords[i],span=cum[i]-cum[i-1];
 const t=span?Math.min(1,(d-cum[i-1])/span):0;
 return {lat:p0[0]+(p1[0]-p0[0])*t,lng:p0[1]+(p1[1]-p0[1])*t,along:d};
}
export function nearestOnProfile(profile,p){
 const lat=Number(p?.lat),lng=Number(p?.lng);if(!validGPS(lat,lng))return null;
 const rad=Math.PI/180,metPerLat=111195,metPerLon=Math.cos(lat*rad)*111195;
 let best=null;
 for(let i=1;i<profile.coords.length;i++){
  const a=profile.coords[i-1],b=profile.coords[i];const ax=(a[1]-lng)*metPerLon,ay=(a[0]-lat)*metPerLat,bx=(b[1]-lng)*metPerLon,by=(b[0]-lat)*metPerLat;
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den)):0;
  const dist=Math.hypot(ax+dx*t,ay+dy*t);
  if(!best||dist<best.offsetMeters)best={along:profile.positions[i-1]+t*(profile.positions[i]-profile.positions[i-1]),offsetMeters:dist,lat:a[0]+(b[0]-a[0])*t,lng:a[1]+(b[1]-a[1])*t};
 }
 return best;
}
export function calibrationReferences(profile, calibration){
 if(!profile)return {references:[],error:'Sem geometria válida.'};
 const arr=[];
 for(const raw of calibration?.anchors||[]){
  const pk=parsePK(raw.pk);if(pk===null||pk<0) return {references:[],error:`PK de referência inválido: ${raw.pk||'vazio'}.`};
  let along,offsetMeters=0;
  if(raw.position==='start')along=0;
  else if(raw.position==='end')along=profile.length;
  else {
   const near=nearestOnProfile(profile,raw);
   if(!near)return {references:[],error:'Referência GPS inválida.'};
   if(near.offsetMeters>200)return {references:[],error:`O PK ${formatPK(pk)} está a ${Math.round(near.offsetMeters)} m do eixo (>200 m).`};
   along=near.along;offsetMeters=near.offsetMeters;
  }
  arr.push({pk,along,offsetMeters,source:raw.source||''});
 }
 arr.sort((a,b)=>a.along-b.along);
 for(let i=1;i<arr.length;i++){
  if(arr[i].along-arr[i-1].along<5)return {references:[],error:'Existem duas referências PK sobre o mesmo local do eixo.'};
 }
 if(arr.length>=2){const ascending=arr[1].pk>arr[0].pk;
  for(let i=1;i<arr.length;i++)if(ascending?arr[i].pk<=arr[i-1].pk:arr[i].pk>=arr[i-1].pk)return {references:[],error:'As referências PK não são monotónicas ao longo do eixo. Confirma ordem e PK.'};
 }
 return {references:arr,error:null};
}
export function locateNationalPK(pkValue,profile,calibration){
 const pk=parsePK(pkValue);if(pk===null||pk<0)return {error:'PK inválido. Usa o formato 115+350.'};
 const {references,error}=calibrationReferences(profile,calibration);
 if(error)return {error};
 if(references.length<2)return {error:'Ainda não existem duas referências PK/GPS neste troço. Podes navegar pelo km geométrico ou adicionar referências.'};
 const lo=Math.min(references[0].pk,references.at(-1).pk),hi=Math.max(references[0].pk,references.at(-1).pk);
 if(pk<lo||pk>hi)return {error:`PK fora do intervalo calibrado (${formatPK(lo)}–${formatPK(hi)}).`};
 for(let i=1;i<references.length;i++){
  const a=references[i-1],b=references[i];
  if(pk>=Math.min(a.pk,b.pk)&&pk<=Math.max(a.pk,b.pk)){
   const t=(pk-a.pk)/(b.pk-a.pk);const point=pointAt(profile,a.along+(b.along-a.along)*t);
   return {...point,pk,displayPK:formatPK(pk),status:'Estimado entre referências quilométricas',referenceCount:references.length,confidence:'Apenas estimativa cartográfica; confirmação topográfica pendente.',calibrationGapMeters:Math.abs(b.pk-a.pk)};
  }
 }
 return {error:'Intervalo PK não localizado.'};
}
export function locateGeometricDistance(distanceMeters,profile){
 const d=Number(distanceMeters);
 if(!Number.isFinite(d)||d<0||d>profile.length)return {error:`Distância geométrica fora do eixo: 0–${Math.round(profile.length)} m.`};
 return {...pointAt(profile,d),status:'Km geométrico a partir do extremo A — NÃO É PK OFICIAL',displayPK:null};
}
