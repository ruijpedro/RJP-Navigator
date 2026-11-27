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
