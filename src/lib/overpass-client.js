/** Solicita marcos OSM com POST (recomendado para consultas Overpass extensas).
 * Alguns mirrors rejeitam GET com HTTP 406; alterna os endpoints sem disfarçar erros.
 */
export const OVERPASS_PK_HOSTS=[
 'https://overpass-api.de/api/interpreter',
 'https://overpass.kumi.systems/api/interpreter',
 'https://overpass.private.coffee/api/interpreter'
];

export async function requestOverpassPK(query,{fetcher=fetch,hosts=OVERPASS_PK_HOSTS,timeoutMs=35000,controllerFactory=()=>new AbortController()}={}){
 if(typeof query!=='string'||!query.includes('out:json'))throw Error('Consulta Overpass inválida.');
 let last='';
 for(const host of hosts){
  const ctl=controllerFactory();
  const timeout=setTimeout(()=>ctl.abort(),timeoutMs);
  try{
   const response=await fetcher(host,{method:'POST',body:new URLSearchParams({data:query}),
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},signal:ctl.signal});
   if(!response.ok)throw Error(`HTTP ${response.status} em ${host}`);
   const result=await response.json();
   if(!Array.isArray(result?.elements))throw Error('Resposta sem lista de elementos');
   return {elements:result.elements,host};
  }catch(e){last=e?.message||String(e);}finally{clearTimeout(timeout);}
 }
 throw Error(`Falhou consulta dos marcos ferroviários: ${last}`);
}
