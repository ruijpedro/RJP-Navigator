/* RJP Navigator: obter a relação ferroviária diretamente da API OSM.
 * A API principal permite recuperar nós e vias sem depender de vários servidores Overpass.
 * Dados © OpenStreetMap contributors, ODbL. Não constituem referenciação quilométrica certificada.
 */
import {createRouteFromOSM,parseOSMAssets,OSM_RELATION_ID} from './osm.js';

export const OSM_DIRECT_URL=`https://api.openstreetmap.org/api/0.6/relation/${OSM_RELATION_ID}/full`;
const attribute=(s,key)=>{
 const m=String(s).match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`));
 return m?m[1]:'';
};
const decode=(s)=>String(s).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const parseTags=(s)=>{
 const tags={};for(const [,a] of s.matchAll(/<tag\b([^>]*?)\/?\s*>/g)){
  const k=attribute(a,'k'); if(k)tags[k]=decode(attribute(a,'v'));
 }
 return tags;
};

/** A resposta `relation/full` contém todos os nós das vias pertencentes à relação.
 *  Usa os IDs reais, nunca fabrica ligações entre vias desconectadas.
 */
export function parseOSMRelationFullXML(xml,relationId=OSM_RELATION_ID){
 if(typeof xml!=='string'||!xml.includes('<osm'))throw Error('Resposta XML OSM inválida.');
 const nodes=new Map(),elements=[];
 const nodeRegex=/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g;
 for(const [,a,inner=''] of xml.matchAll(nodeRegex)){
  const id=Number(attribute(a,'id')),lat=Number(attribute(a,'lat')),lon=Number(attribute(a,'lon'));
  if(!Number.isSafeInteger(id)||!Number.isFinite(lat)||!Number.isFinite(lon))continue;
  const node={type:'node',id,lat,lon,tags:parseTags(inner)};
  nodes.set(id,node);
  if(Object.keys(node.tags).length)elements.push(node);
 }
 const relRx=/<relation\b([^>]*)>([\s\S]*?)<\/relation>/g;
 let members=null;
 for(const [,a,body] of xml.matchAll(relRx)){
  if(Number(attribute(a,'id'))!==relationId)continue;
  members=new Set([...body.matchAll(/<member\b([^>]*?)\/?\s*>/g)]
   .filter(([,m])=>attribute(m,'type')==='way')
   .map(([,m])=>Number(attribute(m,'ref'))));
  break;
 }
 if(!members?.size)throw Error('A relação OSM não contém vias ferroviárias diretas.');
 const ways=[];
 for(const [,a,body] of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)){
  const id=Number(attribute(a,'id'));
  if(!members.has(id))continue;
  const refs=[...body.matchAll(/<nd\b([^>]*?)\/?\s*>/g)].map(([,d])=>Number(attribute(d,'ref')));
  if(refs.length<2||!refs.every(id=>nodes.has(id)))continue;
  const geometry=refs.map(id=>({lat:nodes.get(id).lat,lon:nodes.get(id).lon}));
  ways.push({type:'way',id,nodes:refs,geometry,tags:parseTags(body)});
 }
 if(!ways.length)throw Error('As vias da Linha do Oeste não vieram na resposta OSM.');
 return {ways,osmPoints:parseOSMAssets(elements)};
}

export async function fetchOSMDirect(fetcher=fetch,{timeoutMs=30000}={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher(OSM_DIRECT_URL,{method:'GET',headers:{Accept:'application/xml'},signal:controller.signal});
  if(!response.ok)throw Error(`API OSM HTTP ${response.status}`);
  return parseOSMRelationFullXML(await response.text());
 }finally{clearTimeout(timer);}
}

export async function getRailwayFromOSM({start,end,fetcher=fetch,overpassFetch}={}){
 let directError=null;
 try{
  const result=await fetchOSMDirect(fetcher);
  const route=createRouteFromOSM(result.ways,start,end);
  return {route,osmPoints:result.osmPoints,source:'OSM API direta'};
 }catch(e){directError=e;}
 if(typeof overpassFetch!=='function')throw Error(`API OSM direta falhou: ${directError.message}`);
 try{
  const {elements}=await overpassFetch();
  const route=createRouteFromOSM(elements,start,end);
  return {route,osmPoints:[],source:'Overpass'};
 }catch(e){throw Error(`Não foi possível obter um traçado contínuo da Linha do Oeste: API OSM (${directError.message}); Overpass (${e.message}).`);}
}
