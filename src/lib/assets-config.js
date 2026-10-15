// Configuração central de leitura, comum à APK e WebApp.
import {validatePNFeedURL} from './pn-sync.js';
export const ASSETS_CONFIG_SCHEMA='rjp-ativos-config-v1';
export const ASSETS_CONFIG_STORAGE='rjp_nav_ativos_config_v40';
export const ASSETS_SYNC_INTERVAL_MS=15*60*1000;
export const ASSETS_CONFIG_URLS=[
 'https://ruijpedro.github.io/RJP-Navigator/config/ativos-sync.json',
 'https://raw.githubusercontent.com/ruijpedro/RJP-Navigator/main/public/config/ativos-sync.json'
];
export function normalizeAssetsConfig(o){
 if(!o||o.schema!==ASSETS_CONFIG_SCHEMA||typeof o.enabled!=='boolean')throw Error('Configuração central incompatível.');
 const enabled=o.enabled;
 if(!enabled&&o.feedUrl)throw Error('Desativada mas com URL preenchido.');
 const feedUrl=enabled?validatePNFeedURL(o.feedUrl):'';
 return {schema:ASSETS_CONFIG_SCHEMA,enabled,feedUrl,version:Number.isSafeInteger(o.version)&&o.version>=1?o.version:1};
}
export function readSavedAssetsConfig(input){try{return normalizeAssetsConfig(input)}catch{return null}}
export async function fetchAssetsCentralConfig({fetcher=fetch,urls=ASSETS_CONFIG_URLS,timeoutMs=12000}={}){
 let lastError;
 for(const base of urls){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const url=new URL(base);url.searchParams.set('_rjp',Date.now().toString());const response=await fetcher(url.toString(),{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('HTTP '+response.status);return normalizeAssetsConfig(await response.json());
  }catch(e){lastError=e;}finally{clearTimeout(timer);}
 }
 throw Error('Configuração central indisponível: '+(lastError?.message||'verifica a internet'));
}
