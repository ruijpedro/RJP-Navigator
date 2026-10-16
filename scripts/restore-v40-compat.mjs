/**
 * RJP Navigator V4.1.1 — Repara os ficheiros perdidos na passagem V4.0→V4.1.
 * Retém os componentes hectométricos V4.1 e os testes de regressão originais.
 * Os ficheiros base são recuperados de um commit público e imutável que passou CI.
 */
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {dirname,join} from 'node:path';

const BASE='8d895423409a7ef003498e31e53344429ab01c9d';
const OWNER='ruijpedro',REPO='RJP-Navigator';
const oldFiles=[
 'src/data/passagensNivel.js',
 'public/data/linha-oeste-preload.json',
 'src/lib/preload.js',
 'src/NationalNavigator.jsx',
 'src/lib/assets-config.js',
 'src/lib/assets-sync.js',
 'src/lib/pn-config.js',
 'src/lib/pn-sync.js',
 'src/lib/osm-direct.js',
 'public/config/ativos-sync.json',
 'public/config/pn-sync.json',
 'public/sw.js',
 'integrations/google-apps-script/Code.gs',
];
const requiredLarge='public/data/rede-ferroviaria-nacional.json';
const note='RJP_V411_COMPAT_REPAIRED';
const root=process.cwd();
const pathFor=p=>join(root,p);
const read=p=>readFile(pathFor(p),'utf8');
const put=async(p,s)=>{await mkdir(dirname(pathFor(p)),{recursive:true});await writeFile(pathFor(p),s,'utf8');};
const sleeping=ms=>new Promise(r=>setTimeout(r,ms));
async function legacy(path){
 const url=`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BASE}/${path}`;
 let e;
 for(let i=0;i<4;i++)try{
  const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(`HTTP ${response.status} em ${path}`);
  return await response.text();
 }catch(err){e=err;await sleeping(600*(i+1));}
 throw Error(`Falhou recuperação de ${path} (commit ${BASE}): ${e.message}`);
}
const current=await read('src/main.jsx');
// Idempotente: permite executar npm test e Actions sem repetir o descarregamento.
if(current.includes(note)){
 const pn=await read('src/data/passagensNivel.js');
 const preload=JSON.parse(await read('public/data/linha-oeste-preload.json'));
 if(pn.includes('São 103 PN únicas')&&preload?.route?.coords?.length>4000){
  console.log('RJP V4.1.1: compatibilidade já restaurada (103 PN e eixo offline).');
  process.exit(0);
 }
 throw Error('Os ficheiros foram novamente substituídos após a reparação. Reinstala o projeto V4.1.1.');
}
console.log('RJP V4.1.1: a recuperar a base validada da V4.0 e a preservar os hectométricos…');
const missing=await stat(pathFor(requiredLarge)).then(x=>x.size<150000).catch(()=>true);
const extra=missing?[requiredLarge]:[];
const filePaths=[...oldFiles,'src/lib/national.js','src/main.jsx','src/style.css',...extra];
const pairs=await Promise.all(filePaths.map(async p=>[p,await legacy(p)]));
const historical=Object.fromEntries(pairs);
const offline=JSON.parse(historical['public/data/linha-oeste-preload.json']);
if(offline.route?.source!=='ip-shapefile'||offline.route.coords.length<4000)throw Error('A cartografia anterior não é o eixo IP esperado. Reparação cancelada.');
const legacyPN=historical['src/data/passagensNivel.js'];
if(!legacyPN.includes('103 PN únicas')||!legacyPN.includes('214+096'))throw Error('O inventário histórico não contém 103 PN. Reparação cancelada.');
// Preservar o motor V4.1, acrescentando a API geométrica compatível com V4.0.
const national=await read('src/lib/national.js');
if(!national.includes('export function calibrateReferences'))throw Error('Motor nacional V4.1 em falta. Repara primeiro o ZIP completo.');
let main=current;
const must=(oldValue,newValue,label)=>{
 if(!main.includes(oldValue))throw Error('Estrutura da interface alterada: '+label);
 main=main.replace(oldValue,newValue);
};
must('import React,{useEffect,useMemo,useRef,useState}', 'import React,{useCallback,useEffect,useMemo,useRef,useState}', 'importação React');
const atImport=`import {ASSETS_SCHEMA,ASSETS_CACHE_KEY,normalizeAssetsPayload,isValidCachedAssets,pnFromAssets,fetchAssetsGoogleSheetJSONP,ASSET_TYPES,assetIsActive} from './lib/assets-sync.js';\nimport {ASSETS_CONFIG_STORAGE,ASSETS_SYNC_INTERVAL_MS,readSavedAssetsConfig,fetchAssetsCentralConfig} from './lib/assets-config.js';`;
must("import limite from './data/limites.json';", "import limite from './data/limites.json';\n"+atImport, 'imports de sincronização');
must('const getBase=()=>[','const getBase=(pnList=passagensNivelLinhaOeste)=>[','inventário de base');
must('...passagensNivelLinhaOeste.map(p=>','...pnList.map(p=>','PN integradas');
const oldMain=historical['src/main.jsx'];
const start=oldMain.indexOf(' const [assetsConfig,setAssetsConfig]');
const end=oldMain.indexOf(' const gpsAnchors=useMemo',start);
if(start<0||end<0)throw Error('Não foi possível encontrar o bloco de sincronização original.');
const syncBlock=oldMain.slice(start,end);
const baseLine=main.split('\n').find(x=>x.includes(' const base=useMemo(()=>[...getBase()'));
if(!baseLine)throw Error('Não foi possível localizar a base V4.1 a integrar.');
must(baseLine, syncBlock.trimEnd(), 'sincronização do inventário');
// Contagem mostrada na interface passa a refletir o inventário atual.
main=main.replaceAll("['59','Passagens de nível']","[String(pnList.length),'Passagens de nível']");
main=main.replaceAll('Ver 59 PN','Ver {pnList.length} PN');
// Adicionar painel central de atualização à UI, sem mexer no mapa interativo V4.1.
const syncStart=oldMain.indexOf("  {['pn','inicio','ativos'].includes(tab)");
const syncEnd=oldMain.indexOf("  {['rede','ativos'].includes(tab)",syncStart);
if(syncStart<0||syncEnd<0)throw Error('Painel de sincronização de V4.0 não localizado.');
const syncPanel=oldMain.slice(syncStart,syncEnd);
const noticeAnchor='  {notice&&<div className="notice" role="status">{notice}<button title="Fechar" onClick={()=>setNotice(\'\')}>×</button></div>}';
must(noticeAnchor,noticeAnchor+'\n'+syncPanel, 'painel sincronização');
must("['nacional','Rede Nacional'],", "['nacional','Rede Nacional'],['ativos','Ativos ferroviários'],", 'navegação');
const inventoryPanel=`  {tab==='ativos'&&<main className="card"><h2>Ativos ferroviários da base central</h2><p>{ativosCentrais.length} ativos; os dados são atualizados de 15 em 15 minutos quando o serviço responde.</p><div className="items">{ativosCentrais.slice(0,250).map(a=><div key={a.id} className="item"><b>{a.tipo} · {a.nome||a.id}</b><small>{a.linha} · {a.pk?'PK '+a.pk:'Sem PK'} · {validGPS(a.lat,a.lng)?'GPS disponível':'GPS a verificar'}</small></div>)}</div></main>}`;
must("  {tab==='nacional'&&<NationalNavigator",inventoryPanel+"\n  {tab==='nacional'&&<NationalNavigator",'inventário nacional');
main='// '+note+' — preserva GPS/PK/PN/EDF e hectómetros.\n'+main;
// Substituir os ficheiros só depois de validar as entradas históricas.
for(const p of oldFiles)await put(p,historical[p]);
if(missing)await put(requiredLarge,historical[requiredLarge]);
await put('src/lib/national-v40.js',historical['src/lib/national.js']);
await put('src/lib/national.js',national+"\n// API V4.0 para segmentos nacionais e cálculos rodoviários\nexport * from './national-v40.js';\n");
await put('src/main.jsx',main);
await put('src/style.css',historical['src/style.css']+'\n/* Camada visual V4.1 */\n'+await read('src/style.css'));
console.log('RJP V4.1.1: 103 PN + traçado IP offline + sincronização + motor V4.1/compatibilidade repostos.');
