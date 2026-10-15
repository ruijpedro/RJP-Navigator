// RJP Navigator V3.12: endereço de sincronização partilhado por todos os dispositivos.
// O GitHub Pages aloja uma configuração pública SEM segredos; só aceita URLs Apps Script /exec.
import {validatePNFeedURL} from './pn-sync.js';

export const PN_CONFIG_SCHEMA='rjp-pn-sync-config-v1';
export const PN_CONFIG_KEYS={saved:'rjp_nav_pn_central_config_v1'};
export const PN_CENTRAL_CONFIG_URLS=[
 'https://ruijpedro.github.io/RJP-Navigator/config/pn-sync.json',
 'https://raw.githubusercontent.com/ruijpedro/RJP-Navigator/main/public/config/pn-sync.json'
];
export const PN_SYNC_INTERVAL_MS=15*60*1000;

export function normalizePNCentralConfig(input){
 if(!input||typeof input!=='object'||input.schema!==PN_CONFIG_SCHEMA||typeof input.enabled!=='boolean'){
  throw Error('Configuração central inválida ou incompatível.');
 }
 if(input.enabled!==true){
  if(input.feedUrl)throw Error('Configuração desativada com endereço de sincronização preenchido.');
  return {schema:PN_CONFIG_SCHEMA,enabled:false,feedUrl:'',version:Number.isSafeInteger(input.version)&&input.version>=1?input.version:1};
 }
 const url=validatePNFeedURL(input.feedUrl);
 return {schema:PN_CONFIG_SCHEMA,enabled:true,feedUrl:url,version:Number.isSafeInteger(input.version)&&input.version>=1?input.version:1};
}

// A consulta ignora cache HTTP; o service worker também nunca serve um ficheiro antigo
// de configuração quando houver internet. Sem rede, a aplicação usa a última configuração validada.
export async function fetchPNCentralConfig({fetcher=fetch,urls=PN_CENTRAL_CONFIG_URLS,timeoutMs=12000}={}){
 let lastError=null;
 for(const base of urls){
  if(!/^https:\/\//.test(base))continue;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const url=new URL(base);
   url.searchParams.set('_rjp',String(Date.now()));
   const response=await fetcher(url.toString(),{method:'GET',cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error(`Configuração HTTP ${response.status}`);
   const config=normalizePNCentralConfig(await response.json());
   return {...config,source:base};
  }catch(err){lastError=err;}
  finally{clearTimeout(timer);}
 }
 throw Error(`Não foi possível consultar a configuração central. ${lastError?.message||'Verifica a internet.'}`);
}

export function getSavedPNCentralConfig(input){
 try{return normalizePNCentralConfig(input)}catch{return null}
}
