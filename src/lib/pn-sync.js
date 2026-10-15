// RJP Navigator V3.12 — sincronização apenas de leitura de PN via Apps Script.
// O JSONP evita dependências de CORS e não inclui credenciais na APK/WebApp.
import {parsePK,formatPK,validGPS} from './rail.js';

export const PN_FEED_SCHEMA='rjp-pn-lo-v1';
export const PN_SYNC_KEYS={url:'rjp_nav_pn_lo_feed_v1',snapshot:'rjp_nav_pn_lo_snapshot_v1'};

export function validatePNFeedURL(value){
 const text=String(value??'').trim();
 if(!text)throw Error('Indica o endereço /exec da aplicação Google Apps Script.');
 let u;try{u=new URL(text);}catch{throw Error('URL inválido. Copia o endereço da implementação Google Apps Script.');}
 if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(u.pathname)||u.username||u.password){
  throw Error('Usa apenas um URL HTTPS do Google Apps Script, terminado em /exec.');
 }
 return `${u.origin}${u.pathname.replace(/\/$/,'')}`;
}

export function normalizePNPayload(payload, previousCount=103){
 if(!payload||payload.schema!==PN_FEED_SCHEMA||!Array.isArray(payload.rows))throw Error('Resposta incompatível: não contém a listagem PN_LO_Atual esperada.');
 if(payload.rows.length>700||payload.rows.length<Math.max(15,Math.floor(previousCount*.6)))throw Error('A folha devolveu uma listagem demasiado curta ou extensa; a cópia anterior foi preservada.');
 const seen=new Set();const pn=[];
 for(const item of payload.rows){
  if(!item||typeof item!=='object')throw Error('Linha inválida recebida na folha de PN.');
  const pkNum=parsePK(String(item.pk??'').trim());
  if(pkNum==null||pkNum<0||pkNum>999999)throw Error(`PK inválido na folha: ${String(item.pk??'').slice(0,40)}`);
  const pk=formatPK(pkNum);
  if(seen.has(pk))throw Error(`PK duplicado na folha: ${pk}`);
  seen.add(pk);
  const clean=(x,max=160)=>String(x??'').trim().slice(0,max);
  const name=clean(item.nome)||`PN km ${pk.replace('+',',')}`;
  const lat=Number(String(item.lat??'').replace(',','.'));
  const lng=Number(String(item.lng??'').replace(',','.'));
  const hasCoords=String(item.lat??'').trim()!==''&&String(item.lng??'').trim()!==''&&validGPS(lat,lng);
  const dentroTroco=pkNum>=21191&&pkNum<=191191;
  pn.push({
   id:`pn-km-${pk.replace('+','-')}`,pk,km:pk.replace('+',','),nome:name,
   localidade:clean(item.localidade),concelho:clean(item.concelho),freguesia:clean(item.freguesia),
   categoria:'Passagem de Nível',linha:'Linha do Oeste',tipo:'PN',
   lat:hasCoords?lat:'',lng:hasCoords?lng:'',
   fonte:'Google Drive — PN_LO_Atual (sincronizado)',
   estadoDados:'Sincronizada do Google Drive',dentroTroco,
   observacoes:clean(item.observacoes,500)||(dentroTroco?'PK sincronizado; posição calculada sobre traçado IP, GPS por validar.':'PN fora do troço PK 21+191–191+191; GPS por calibrar.'),
  });
 }
 if(!pn.length)throw Error('A listagem das PN está vazia.');
 pn.sort((a,b)=>parsePK(a.pk)-parsePK(b.pk));
 return pn;
}

export function isValidCachedPNSnapshot(data){
 if(!data||data.schema!==PN_FEED_SCHEMA||!Array.isArray(data.rows))return false;
 try{return normalizePNPayload(data,103).length>0;}catch{return false;}
}

export function fetchPNGoogleSheetJSONP(endpoint,{timeoutMs=20000}={}){
 const base=validatePNFeedURL(endpoint);
 if(typeof window==='undefined'||typeof document==='undefined')return Promise.reject(Error('A sincronização online só pode ser executada na WebApp ou APK.'));
 return new Promise((resolve,reject)=>{
  const key=`__rjpPnSync_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
  const script=document.createElement('script');let settled=false;
  let timer;
  const finish=(err,data)=>{
   if(settled)return;settled=true;clearTimeout(timer);
   script.remove();try{delete window[key];}catch{window[key]=undefined;}
   if(err)reject(err);else resolve(data);
  };
  window[key]=data=>finish(null,data);
  script.onerror=()=>finish(Error('Não foi possível consultar o Google Apps Script. Confirma a publicação e a ligação à internet.'));
  script.async=true;
  script.referrerPolicy='no-referrer';
  script.src=`${base}?callback=${encodeURIComponent(key)}&t=${Date.now()}`;
  timer=setTimeout(()=>finish(Error('Tempo de resposta excedido ao consultar as PN no Google Drive.')),timeoutMs);
  (document.head||document.body).appendChild(script);
 });
}
