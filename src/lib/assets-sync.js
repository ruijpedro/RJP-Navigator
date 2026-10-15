// RJP Navigator V4.0 — inventário único da RFN (Google Sheets, só leitura).
import {parsePK,formatPK,validGPS} from './rail.js';
import {fetchPNGoogleSheetJSONP} from './pn-sync.js';

export const ASSETS_SCHEMA='rjp-ativos-rfn-v1';
export const ASSETS_CACHE_KEY='rjp_nav_ativos_central_v40';
export const ASSET_TYPES={PN:'Passagem de Nível',PH:'Passagem Hidráulica',PS:'Passagem Superior',PI:'Passagem Inferior',ATR:'Atravessamento',VAL:'Valeta / Drenagem',GEO:'Órgão Geotécnico',OA:'Obra de Arte',OUTROS:'Outro ativo'};
const clean=(value,max=300)=>String(value??'').trim().slice(0,max);
const safeType=x=>{const code=clean(x,25).toUpperCase().replace(/\s+/g,'_');if(!/^[A-Z0-9_-]{2,25}$/.test(code))throw Error('Tipo de ativo inválido: '+code);return code;};
export function normalizeAssetsPayload(payload,{previousCount=103}={}){
 if(!payload||payload.schema!==ASSETS_SCHEMA||!Array.isArray(payload.rows))throw Error('A resposta não corresponde à tabela única de ativos.');
 if(payload.rows.length>15000||payload.rows.length<Math.max(1,Math.floor(previousCount*.6)))throw Error('A lista recebida está incompleta ou fora dos limites; preservada a última cópia.');
 const ids=new Set();const pnPKs=new Set();const rows=[];
 for(const r of payload.rows){
  if(!r||typeof r!=='object')throw Error('Registo de ativo inválido.');
  const id=clean(r.id,100),linha=clean(r.linha,160),tipo=safeType(r.tipo);
  if(!id||!linha)throw Error('Todos os ativos têm de ter ID e Linha.');
  if(ids.has(id))throw Error('ID repetido na base central: '+id);ids.add(id);
  const pkRaw=clean(r.pk,24);let pk='';
  if(pkRaw){const n=parsePK(pkRaw);if(n===null||n<0||n>9999999)throw Error('PK inválido em '+id);pk=formatPK(n);}
  const state=clean(r.estado,80)||'Ativo';
  const latRaw=clean(r.lat,35),lngRaw=clean(r.lng,35);
  let lat='',lng='';
  if(latRaw||lngRaw){lat=Number(latRaw.replace(',','.'));lng=Number(lngRaw.replace(',','.'));if(!latRaw||!lngRaw||!validGPS(lat,lng))throw Error('GPS inválido em '+id);}
  if(tipo==='PN'&&pk){const composite=linha+'|'+pk;if(pnPKs.has(composite))throw Error('PN com linha e PK duplicados: '+composite);pnPKs.add(composite);}
  rows.push({id,linha,tipo,pk,nome:clean(r.nome,180),localidade:clean(r.localidade,160),concelho:clean(r.concelho,160),freguesia:clean(r.freguesia,160),lat,lng,estado:state,observacoes:clean(r.observacoes,1000),fonte:clean(r.fonte,250),atualizadoEm:clean(r.atualizadoEm,80)});
 }
 return rows;
}
export function assetIsActive(a){return !/^(inativo|desativado|desativada|eliminado|eliminada|arquivado|arquivada)$/i.test(String(a?.estado||'').trim());}
export function pnFromAssets(rows){
 return rows.filter(a=>a.tipo==='PN'&&a.linha==='Linha do Oeste'&&a.pk&&assetIsActive(a)).map(a=>{
  const pkNum=parsePK(a.pk),inside=pkNum>=21191&&pkNum<=191191;
  return {id:'pn-km-'+a.pk.replace('+','-'),pk:a.pk,km:a.pk.replace('+',','),nome:a.nome||`PN km ${a.pk.replace('+',',')}`,
   localidade:a.localidade,concelho:a.concelho,freguesia:a.freguesia,categoria:'Passagem de Nível',linha:a.linha,tipo:'PN',
   lat:a.lat,lng:a.lng,fonte:a.fonte||'Google Drive — Ativos',estadoDados:'Sincronizada da base central',dentroTroco:inside,
   observacoes:a.observacoes||(inside?'GPS calculado por estimativa no eixo, por confirmar.':'PK fora do troço calibrado; GPS por validar.')};
 }).sort((a,b)=>parsePK(a.pk)-parsePK(b.pk));
}
export function isValidCachedAssets(snapshot){if(snapshot?.schema!==ASSETS_SCHEMA||!Array.isArray(snapshot.rows))return false;try{return normalizeAssetsPayload(snapshot,{previousCount:103}).length>0;}catch{return false;}}
// A reutilização deste transporte JSONP mantém o endpoint restrito a script.google.com/macros/s/.../exec.
export const fetchAssetsGoogleSheetJSONP=fetchPNGoogleSheetJSONP;
