export const PK_START=21191;
export const PK_END=191191;
export function parsePK(value){
  if(typeof value==='number') return Number.isFinite(value)?value:null;
  const s=String(value??'').trim().replace(/\s+/g,'');
  let m=s.match(/^(\d{1,3})\+(\d{1,3})$/);
  if(m){const sub=Number(m[2]);return sub<1000?Number(m[1])*1000+sub:null;}
  m=s.match(/^(\d{1,3})[,.](\d{1,3})$/);
  if(m)return Number(m[1])*1000+Number(m[2].padEnd(3,'0'));
  m=s.match(/^\d{4,6}$/);return m?Number(s):null;
}
export function formatPK(value){if(!Number.isFinite(value))return '—';return `${Math.floor(value/1000)}+${String(Math.round(value%1000)).padStart(3,'0')}`;}
export function validGPS(lat,lng){return Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Number(lat)>=-90&&Number(lat)<=90&&Number(lng)>=-180&&Number(lng)<=180&&String(lat).trim()!==''&&String(lng).trim()!=='';}
export function metersBetween(a,b){const R=6371008.8;const rad=Math.PI/180;const dLat=(b[0]-a[0])*rad;const dLon=(b[1]-a[1])*rad;const x=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function validPoint(point){return Array.isArray(point)&&point.length>=2&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90;}
export function parseRouteGeoJSON(data){
 if(!data||typeof data!=='object') throw Error('GeoJSON inválido.');
 const lines=[];function walk(x){if(!x)return;if(x.type==='FeatureCollection')return (x.features||[]).forEach(walk);
 if(x.type==='Feature')return walk(x.geometry);if(x.type==='LineString')lines.push(x.coordinates);
 else if(x.type==='MultiLineString')(x.coordinates||[]).forEach(p=>lines.push(p));
 else if(x.type==='GeometryCollection')(x.geometries||[]).forEach(walk);
 }walk(data);
 if(lines.length!==1)throw Error('Importa uma única LineString contínua do teu troço; combina os segmentos antes da importação.');
 const line=lines[0];if(!Array.isArray(line)||line.length<2||line.length>40000||!line.every(validPoint))throw Error('Geometria inválida ou demasiado grande.');
 const coords=line.map(p=>[p[1],p[0]]);let len=0;for(let i=1;i<coords.length;i++)len+=metersBetween(coords[i-1],coords[i]);
 if(len<1000||len>400000)throw Error('Extensão inesperada; confirma que é apenas a Linha do Oeste.');
 return {coords,length:len};
}
export function orientAndValidateRoute(geometry,start,end){
 const c=geometry.coords;
 const normal=metersBetween(c[0],start)+metersBetween(c[c.length-1],end);
 const reversed=metersBetween(c[0],end)+metersBetween(c[c.length-1],start);
 const oriented=reversed<normal?[...c].reverse():c;
 const startError=metersBetween(oriented[0],start);
 const endError=metersBetween(oriented[oriented.length-1],end);
 if(startError>3000||endError>3000)throw Error(`Extremos do traçado afastados dos PK de referência (${Math.round(startError)} m e ${Math.round(endError)} m). Importa apenas o troço PK 21+191–191+191.`);
 if(Math.abs(geometry.length-170000)>50000)throw Error(`Extensão geométrica ${Math.round(geometry.length/1000)} km muito diferente dos 170 km de referência.`);
 return {coords:oriented,length:geometry.length,startError,endError,needsCalibration:true};
}
export function interpolatePK(pk,route){
 if(!route||!Number.isFinite(pk)||pk<PK_START||pk>PK_END)return null;
 const fraction=(pk-PK_START)/(PK_END-PK_START);const target=route.length*fraction;
 let dist=0;const cs=route.coords;
 for(let i=1;i<cs.length;i++){
  const step=metersBetween(cs[i-1],cs[i]);
  if(target<=dist+step||i===cs.length-1){const t=step===0?0:Math.max(0,Math.min(1,(target-dist)/step));
   return {lat:cs[i-1][0]+t*(cs[i][0]-cs[i-1][0]),lng:cs[i-1][1]+t*(cs[i][1]-cs[i-1][1]),status:'Estimado pelo traçado',accuracy:'Não calibrado por marcos intermédios'};
  }dist+=step;
 }
 return null;
}
export function deriveAssetLocation(item, gpsOverrides, pkOverrides, route){
 const pk=pkOverrides[item.key]??item.pk;const manual=gpsOverrides[item.key];
 if(manual&&validGPS(manual.lat,manual.lng))return {...item,pk,lat:Number(manual.lat),lng:Number(manual.lng),gpsSaved:manual,gpsStatus:'Confirmado no terreno'};
 if(validGPS(item.lat,item.lng))return {...item,pk,lat:Number(item.lat),lng:Number(item.lng),gpsStatus:'GPS de origem'};
 const p=interpolatePK(parsePK(pk),route);
 return {...item,pk,lat:p?.lat??null,lng:p?.lng??null,gpsStatus:p?.status??'Sem coordenadas', gpsNote:p?.accuracy??'PK ou geometria por confirmar'};
}
export function downloadText(text,name,mime){const blob=new Blob([text],{type:mime});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
export function makeKML(route,assets){
 const esc=(s)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const line=route?`<Placemark><name>Traçado ferroviário — localização estimada por calibração linear</name><Style><LineStyle><color>ff3399ff</color><width>5</width></LineStyle></Style><LineString><tessellate>1</tessellate><coordinates>${route.coords.map(([lat,lng])=>`${lng},${lat},0`).join(' ')}</coordinates></LineString></Placemark>`:'';
 const marks=assets.filter(a=>validGPS(a.lat,a.lng)&&a.categoria!=='Marco Quilométrico').map(a=>`<Placemark><name>${esc(a.titulo||a.nome)}</name><description>${esc(`PK ${a.pk||'?'} · ${a.categoria} · ${a.gpsStatus}. Ponto ferroviário não equivale a acesso rodoviário.`)}</description><Point><coordinates>${a.lng},${a.lat},0</coordinates></Point></Placemark>`).join('');
 return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>RJP Navigator — Linha do Oeste</name>${line}${marks}</Document></kml>`;
}
