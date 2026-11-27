// Coordinates must be in the same metric CRS (EPSG:3763).
export function projectSegment(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
 const t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0;
 const x=a[0]+t*dx,y=a[1]+t*dy;
 return {point:[x,y],distance:Math.hypot(p[0]-x,p[1]-y),offset:t*Math.sqrt(l2)};
}
export function projectCorridor(p,points){
 let best=null,chainage=0;
 for(let i=1;i<points.length;i++){
 const a=points[i-1],b=points[i],q=projectSegment(p,a,b);
 if(!best||q.distance<best.distance)best={...q,chainage:chainage+q.offset,segment:i-1};
 chainage+=Math.hypot(b[0]-a[0],b[1]-a[1]);
 }
 return best;
}
// No extrapolation: geometry length is not an official PK.
export function calibratedPk(chainage,anchors){
 const a=[...anchors].filter(x=>Number.isFinite(x.chainage)&&Number.isFinite(x.pk)).sort((x,y)=>x.chainage-y.chainage);
 for(let i=1;i<a.length;i++){
 const l=a[i-1],r=a[i];
 if(r.chainage>l.chainage&&chainage>=l.chainage&&chainage<=r.chainage)
 return l.pk+(r.pk-l.pk)*(chainage-l.chainage)/(r.chainage-l.chainage);
 }
 return null;
}

export const normalize = s => String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

/** Geo proximity in metres, for WGS84 (lat,lng) points. This does not establish official PK. */
export function nearest(p,items){
 if(!p||p.lat==null||p.lng==null||String(p.lat).trim()===''||String(p.lng).trim()===''||!Number.isFinite(+p.lat)||!Number.isFinite(+p.lng)||Math.abs(+p.lat)>90||Math.abs(+p.lng)>180) return null;
 const lat=+p.lat, lng=+p.lng,sy=111195,sx=sy*Math.cos(lat*Math.PI/180);let best=null;
 for(const item of items||[]){
  if(best&&Array.isArray(item.bbox)&&item.bbox.length===4){
   const [south,west,north,east]=item.bbox;
   const dy=Math.max(south-lat,0,lat-north)*sy;
   const dx=Math.max(west-lng,0,lng-east)*sx;
   if(Math.hypot(dx,dy)>best.distance+1)continue;
  }
  const pts=item.points|| (item.point?[item.point,item.point]:[]);
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i];
   if(!a||!b||![...a,...b].every(Number.isFinite))continue;
   const x=(a[1]-lng)*sx,y=(a[0]-lat)*sy,dx=(b[1]-a[1])*sx,dy=(b[0]-a[0])*sy;
   const t=Math.max(0,Math.min(1,-(x*dx+y*dy)/(dx*dx+dy*dy||1)));
   const distance=Math.hypot(x+t*dx,y+t*dy);
   if(!best||distance<best.distance)best={item,distance,lat:a[0]+t*(b[0]-a[0]),lng:a[1]+t*(b[1]-a[1])};
  }
 }
 return best;
}

// Explicit provenance; an estimate must be supplied independently, never extrapolated silently.
export function pkStatus(chainage, anchors=[], estimatedPk=null){
 const pk=Number.isFinite(chainage)?calibratedPk(chainage,anchors):null;
 if(Number.isFinite(pk))return {status:'calibrated',pk};
 if(Number.isFinite(chainage)&&Number.isFinite(estimatedPk)&&estimatedPk>=0)return {status:'estimated',pk:estimatedPk};
 return {status:'unavailable',pk:null};
}
