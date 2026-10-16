import {metersBetween,PK_START,PK_END,formatPK,validGPS} from './rail.js';

// Project the touched position onto the nearest railway segment.
// Returns an estimate only: PK calibration follows the same anchors as PK search.
export function nearestRailPoint(point,route){
 if(!route?.coords?.length||route.coords.length<2||!validGPS(point?.lat,point?.lng))return null;
 const lat=Number(point.lat),lng=Number(point.lng),rad=Math.PI/180;
 const xx=111195*Math.cos(lat*rad), yy=111195;
 let accumulated=0,best=null;
 for(let i=1;i<route.coords.length;i++){
  const a=route.coords[i-1],b=route.coords[i];
  const dx=(b[1]-a[1])*xx,dy=(b[0]-a[0])*yy;
  const px=(lng-a[1])*xx,py=(lat-a[0])*yy;
  const m=dx*dx+dy*dy;
  const t=m?Math.min(1,Math.max(0,(px*dx+py*dy)/m)):0;
  const snapped={lat:a[0]+t*(b[0]-a[0]),lng:a[1]+t*(b[1]-a[1])};
  const distance=metersBetween([lat,lng],[snapped.lat,snapped.lng]);
  const segmentLength=metersBetween(a,b);
  if(!best||distance<best.distance)best={...snapped,along:accumulated+segmentLength*t,distance};
  accumulated+=segmentLength;
 }
 return best;
}

export function pkAtDistance(along,route,anchors=[]){
 if(!route||!Number.isFinite(along)||!Number.isFinite(route.length)||route.length<=0)return null;
 const refs=[{pk:PK_START,along:0},...anchors,{pk:PK_END,along:route.length}]
  .filter(x=>Number.isFinite(x?.pk)&&Number.isFinite(x?.along)&&x.pk>=PK_START&&x.pk<=PK_END&&x.along>=0&&x.along<=route.length)
  .sort((a,b)=>a.pk-b.pk);
 const monotonic=[refs[0]];
 for(const r of refs.slice(1))if(r.pk>monotonic.at(-1).pk&&r.along>monotonic.at(-1).along)monotonic.push(r);
 if(monotonic.at(-1).pk!==PK_END)monotonic.push({pk:PK_END,along:route.length});
 const d=Math.max(0,Math.min(route.length,along));
 const high=monotonic.findIndex(x=>x.along>=d);
 const b=monotonic[Math.max(high,1)],a=monotonic[Math.max(high-1,0)];
 const fraction=b.along===a.along?0:(d-a.along)/(b.along-a.along);
 return Math.round(a.pk+fraction*(b.pk-a.pk));
}
export function identifyRailPoint(point,route,anchors=[]){
 const snapped=nearestRailPoint(point,route);
 if(!snapped)return null;
 const pk=pkAtDistance(snapped.along,route,anchors);
 return {...snapped,pk,pkLabel:formatPK(pk),estimated:true};
}

const get=(o,...keys)=>keys.map(k=>o[k]).find(v=>typeof v==='string'&&v.trim())||'';
export function parsePortugueseAddress(data){
 const a=data?.address||{};
 return {
  freguesia:get(a,'parish','civil_parish'),
  concelho:get(a,'municipality','county'),
  distrito:get(a,'state_district','district'),
  localidade:get(a,'city','town','village','hamlet','suburb','neighbourhood'),
  descricao:typeof data?.display_name==='string'?data.display_name:'',
  fonte:'OpenStreetMap / Nominatim — limites administrativos aproximados'
 };
}

// Nominatim public instance: call only for explicit tap, not bulk lookups.
// Do not infer a freguesia from a generic suburb or a district from a country region.
export async function reverseAdministrative(point,fetcher=fetch,signal){
 if(!validGPS(point?.lat,point?.lng))throw Error('GPS inválido para identificar a área.');
 const query=new URLSearchParams({format:'jsonv2',lat:String(point.lat),lon:String(point.lng),zoom:'18',addressdetails:'1','accept-language':'pt-PT'});
 const response=await fetcher(`https://nominatim.openstreetmap.org/reverse?${query}`,{headers:{Accept:'application/json'},signal});
 if(!response.ok)throw Error(`Serviço de freguesias indisponível (${response.status}).`);
 const payload=await response.json();
 if(payload.error)throw Error(payload.error);
 return parsePortugueseAddress(payload);
}
