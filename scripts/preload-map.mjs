/**
 * RJP Navigator V3.6: inclui na APK os dados da relação ferroviária OSM 2076345.
 * Primeiro tenta a API OSM normal (GET), depois Overpass. Não cria linha fictícia.
 * Em CI, RJP_REQUIRE_MAPS=1 impede publicar APKs com cartografia vazia.
 */
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {fetchOverpass,parseOSMAssets,REL_QUERY,ASSET_QUERY} from '../src/lib/osm.js';
import {getRailwayFromOSM} from '../src/lib/osm-direct.js';
import {verifyPreload} from '../src/lib/preload.js';
const LIMITS=JSON.parse(await readFile(new URL('../src/data/limites.json',import.meta.url),'utf8'));
const initial=LIMITS.responsibility_segment.points[0].wgs84;
const final=LIMITS.responsibility_segment.points[1].wgs84;
const start=[initial.latitude,initial.longitude],end=[final.latitude,final.longitude];
const out=new URL('../public/data/linha-oeste-preload.json',import.meta.url);
const result={version:'3.6.0',generatedAt:new Date().toISOString(),source:'OpenStreetMap contributors (ODbL), relation 2076345',route:null,osmPoints:[],ready:false};
let error=null;
try{
 console.log('Descarregar geometria OSM via API direta; alternativa: Overpass.');
 const response=await getRailwayFromOSM({start,end,overpassFetch:()=>fetchOverpass(REL_QUERY)});
 result.route=response.route;
 result.osmPoints=response.osmPoints;
 result.source+=` · ${response.source}`;
 console.log(`Eixo: ${response.route.coords.length} vértices e ${(response.route.length/1000).toFixed(1)} km`);
 // Os marcadores obtidos na API direta são imediatamente utilizáveis.
 // A consulta adicional pode falhar sem invalidar a geometria do PK.
 try{
  if(result.osmPoints.length<50){
   const a=await fetchOverpass(ASSET_QUERY);
   const candidates=parseOSMAssets(a.elements);
   const ids=new Set(result.osmPoints.map(p=>p.id));
   for(const p of candidates)if(!ids.has(p.id)){result.osmPoints.push(p);ids.add(p.id);}
  }
  console.log(`Ativos OSM: ${result.osmPoints.length}`);
 }catch(e){console.warn('Pontos de estação/PN adicionais indisponíveis: '+e.message);}
 result.ready=!!verifyPreload(result);
 if(!result.ready)throw Error('O eixo descarregado não passou a verificação geométrica do troço.');
}catch(e){error=e;console.error('Cartografia predefinida indisponível: '+e.message);}

// Se já existir um mapa real e válido no repositório, não o destruir por uma falha temporária de rede.
if(!result.ready){
 try{
  const previous=JSON.parse(await readFile(out,'utf8'));
  if(verifyPreload(previous)){
   console.warn('A reutilizar geometria OSM válida guardada no pacote.');
   result.route=previous.route;result.osmPoints=previous.osmPoints||[];
   result.source=previous.source;result.ready=true;
  }
 }catch{/* sem cache */}
}
await mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
await writeFile(out,JSON.stringify(result));
if(result.ready)console.log(`Mapa integrado: ${result.route.coords.length} vértices · ${result.osmPoints.length} pontos.`);
else{
 console.error('MAPA NÃO INCLUÍDO. Esta APK continuaria sem localizar os PK intermédios.');
 if(process.env.RJP_REQUIRE_MAPS==='1')throw Error(`Não publicar APK sem traçado ferroviário OSM. ${error?.message||'Fonte indisponível'}`);
}
