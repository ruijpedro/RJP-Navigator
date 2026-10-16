/** Nome resumido da posição atual, independente do PK ferroviário. */
export function gpsAreaCell(gps){
 const lat=Number(gps?.lat),lng=Number(gps?.lng);
 if(gps?.lat==null||gps?.lng==null||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
 // Uma consulta administrativa por célula de ~110m e cache local diária.
 return `${lat.toFixed(3)}|${lng.toFixed(3)}`;
}
export function describeGPSArea(area){
 const name=String(area?.localidade||area?.freguesia||area?.concelho||area?.distrito||'').trim();
 const municipality=String(area?.concelho||'').trim();
 // A localização é apresentada numa única linha: localidade + concelho quando distintos.
 const location=name&&municipality&&name.toLocaleLowerCase('pt-PT')!==municipality.toLocaleLowerCase('pt-PT')?`${name}, ${municipality}`:name;
 return {location:location||null,found:!!location};
}
export function formatGPSCoordinates(gps){
 const lat=Number(gps?.lat),lng=Number(gps?.lng);
 if(gpsAreaCell(gps)==null)return '';
 return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
