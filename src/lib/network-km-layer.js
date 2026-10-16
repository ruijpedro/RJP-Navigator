/**
 * Marcadores quilométricos nacionais derivados EXCLUSIVAMENTE de referências
 * PK↔geometria: documentais da IP, marcos OSM ou levantamentos locais.
 * Um quilómetro geométrico NÃO é um PK oficial.
 */
import {metersBetween,formatPK} from './rail.js';
import {anchorPositions} from './gps-nearest.js';

const validCoords=c=>Array.isArray(c)&&c.length>1&&c.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]));

/** Localiza uma distância acumulada sobre o eixo, sem extrapolar. */
export function positionAlongTrack(coords,positions,d){
 if(!Array.isArray(coords)||coords.length<2||!Array.isArray(positions)||positions.length!==coords.length||!Number.isFinite(d)||d<0||d>positions.at(-1)+0.0001)return null;
 let lo=1,hi=positions.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(positions[mid]<d)lo=mid+1;else hi=mid;}
 const i=lo,span=positions[i]-positions[i-1],t=span>0?Math.max(0,Math.min(1,(d-positions[i-1])/span)):0;
 return {lat:coords[i-1][0]+(coords[i][0]-coords[i-1][0])*t,lng:coords[i-1][1]+(coords[i][1]-coords[i-1][1])*t};
}

export function markersForSegment(coords,rawAnchors,{step=1000,limit=800}={}){
 if(!validCoords(coords)||!Number.isInteger(step)||step<100||step%100!==0)return [];
 const refs=anchorPositions(coords,rawAnchors);
 if(refs.length<2)return [];
 const cumulative=[0];
 for(let i=1;i<coords.length;i++)cumulative.push(cumulative[i-1]+metersBetween(coords[i-1],coords[i]));
 const collected=new Map();
 for(let i=1;i<refs.length;i++){
  const a=refs[i-1],b=refs[i];
  if(a.pk===b.pk||b.along<=a.along)continue;
  const start=Math.ceil(Math.min(a.pk,b.pk)/step)*step;
  const end=Math.floor(Math.max(a.pk,b.pk)/step)*step;
  if((end-start)/step+1>limit)return [];
  for(let pk=start;pk<=end;pk+=step){
   const fraction=(pk-a.pk)/(b.pk-a.pk),d=a.along+(b.along-a.along)*fraction;
   const point=positionAlongTrack(coords,cumulative,d);
   if(!point)continue;
   const verified=a.verified===true&&b.verified===true;
   collected.set(pk,{...point,pk,label:formatPK(pk),verified,
    source:rawAnchors.some(x=>String(x.source||'').includes('OSM'))?'OSM':'referências documentais',
    status:verified?'Interpolado entre referências verificadas':'PK estimado — referências por validar',gapMeters:Math.abs(a.pk-b.pk)});
   if(collected.size>limit)return [];
  }
 }
 return [...collected.values()].sort((a,b)=>a.pk-b.pk);
}

/** Cria camada de várias linhas, sem marcar troços sem referências suficientes. */
export function buildNationalKilometerLayer(network,{referenceSets={},presets={},maxMarkers=12000}={}){
 const markers=[],coverage=[];let segments=0,calibrated=0,withOSM=0;
 for(const line of network?.linhas||[]){
  for(const [index,segment] of (line.segmentos||[]).entries()){
   if(!validCoords(segment.coords))continue;
   segments++;
   const key=`${line.nome}|${index}`;
   const osm=referenceSets[key]||[];
   const documentary=presets[key]?.anchors||[];
   // Priorizar marcos físicos coerentes, mas nunca perder referências documentais válidas.
   let used='OSM',refs=osm,part=markersForSegment(segment.coords,osm);
   if(!part.length){used='documental';refs=documentary;part=markersForSegment(segment.coords,documentary);}
   if(!part.length)continue;
   calibrated++;
   if(used==='OSM')withOSM++;
   coverage.push({line:line.nome,segmentIndex:index,source:used,referenceCount:refs.length,count:part.length});
   for(const marker of part){
    if(markers.length>=maxMarkers)break;
    markers.push({...marker,line:line.nome,segmentIndex:index,source:used});
   }
  }
 }
 return {markers,coverage,segments,calibrated,withOSM,withoutPK:Math.max(0,segments-calibrated)};
}

/** Mantém a camada navegável em telemóveis, mesmo com milhares de PK. */
export function visibleNationalMarkers(markers,bounds,zoom,{maxVisible=320}={}){
 if(!Number.isFinite(zoom)||zoom<7)return [];
 const inside=(m)=>!bounds||(m.lat>=bounds.south&&m.lat<=bounds.north&&m.lng>=bounds.west&&m.lng<=bounds.east);
 const visible=(markers||[]).filter(inside);
 if(visible.length<=maxVisible)return visible;
 // Amostragem por grelha visual evita sobreposição no zoom regional.
 const cols=Math.max(8,Math.ceil(Math.sqrt(maxVisible*2))),rows=Math.max(6,Math.floor(maxVisible/cols));
 const grid=new Set(),out=[];
 const box=bounds||{south:36.7,north:42.3,west:-9.7,east:-6};
 for(const m of visible){
  const x=Math.floor((m.lng-box.west)/Math.max(0.000001,box.east-box.west)*cols);
  const y=Math.floor((m.lat-box.south)/Math.max(0.000001,box.north-box.south)*rows);
  const key=`${x}|${y}`;
  if(grid.has(key))continue;grid.add(key);out.push(m);
  if(out.length>=maxVisible)break;
 }
 return out;
}
