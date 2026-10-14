import {metersBetween,validGPS,PK_START,PK_END} from './rail.js';
// Aceitar apenas dados com eixo contínuo e extremos próximos do troço de responsabilidade.
const START=[38.79752688,-9.31318410], END=[40.00997619,-8.81314803];
export function verifyPreload(data){
 if(!data||!data.route||!Array.isArray(data.route.coords))return null;
 const r=data.route,c=r.coords;
 if(c.length<100||c.length>60000||!(r.length>=115000&&r.length<=245000))return null;
 if(!c.every(v=>Array.isArray(v)&&v.length===2&&validGPS(v[0],v[1])&&v[0]>38.5&&v[0]<40.5&&v[1]>-9.8&&v[1]<-8.4))return null;
 if(metersBetween(c[0],START)>2500||metersBetween(c[c.length-1],END)>2500)return null;
 const p=(data.osmPoints||[]).filter(v=>validGPS(v.lat,v.lng)&&typeof v.id==='string').slice(0,15000);
 return {route:{...r,source:r.source||'cartografia-importada',needsCalibration:true},osmPoints:p,source:data.source||'Cartografia ferroviária importada',createdAt:data.generatedAt};
}
export async function fetchBundledCartography(url,fetcher=fetch){
 try{const response=await fetcher(url,{cache:'default'});if(!response.ok)return null;return verifyPreload(await response.json());}catch{return null;}
}
