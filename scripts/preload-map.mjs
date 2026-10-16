/**
 * Executado no GitHub Actions ANTES do Vite build: integra a geometria verdadeira
 * da relação OSM 2076345. Não gera uma linha artificial em caso de falha.
 */
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {fetchOverpass,createRouteFromOSM,parseOSMAssets,REL_QUERY,ASSET_QUERY} from '../src/lib/osm.js';
const LIMITS=JSON.parse(await readFile(new URL('../src/data/limites.json',import.meta.url),'utf8'));
const start=LIMITS.responsibility_segment.points[0].wgs84;
const end=LIMITS.responsibility_segment.points[1].wgs84;
const initial=[start.latitude,start.longitude],final=[end.latitude,end.longitude];
const out=new URL('../public/data/linha-oeste-preload.json',import.meta.url);
const result={version:'3.4.0',generatedAt:new Date().toISOString(),source:'OpenStreetMap contributors (ODbL); relation 2076345',route:null,osmPoints:[]};
try{
 console.log('RJP Navigator: descarregar eixo real da Linha do Oeste (OSM 2076345)');
 const response=await fetchOverpass(REL_QUERY);
 result.route=createRouteFromOSM(response.elements,initial,final);
 console.log(`Eixo: ${result.route.coords.length} vértices, ${Math.round(result.route.length/1000)} km`);
 try{
  const a=await fetchOverpass(ASSET_QUERY);
  result.osmPoints=parseOSMAssets(a.elements).filter(p=>p.lat>38.5&&p.lat<40.5&&p.lng>-9.8&&p.lng<-8.4);
  console.log(`Ativos cartografados: ${result.osmPoints.length}`);
 }catch(e){console.warn('Não foi possível pré-carregar PN e estações: '+e.message);}
}catch(e){
 console.warn('Não foi possível incluir o eixo no pacote: '+e.message);
 console.warn('A app tentará descarregá-lo automaticamente no primeiro arranque.');
}
await mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
await writeFile(out,JSON.stringify({...result,ready:!!result.route}));
console.log(`Dados cartográficos guardados: ${result.route?'sim':'não (modo automático online)'}`);
