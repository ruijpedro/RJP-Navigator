import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {passagensNivelLinhaOeste} from '../src/data/passagensNivel.js';
import {ASSETS_SCHEMA,normalizeAssetsPayload,assetIsActive,pnFromAssets,ASSET_TYPES,isValidCachedAssets} from '../src/lib/assets-sync.js';
import {ASSETS_CONFIG_SCHEMA,ASSETS_CONFIG_URLS,ASSETS_SYNC_INTERVAL_MS,normalizeAssetsConfig,fetchAssetsCentralConfig} from '../src/lib/assets-config.js';
const example=passagensNivelLinhaOeste.map(x=>({id:`LO-PN-${String(x.pk.replace('+','')).padStart(6,'0')}`,linha:'Linha do Oeste',tipo:'PN',pk:x.pk,nome:x.nome,localidade:x.localidade,concelho:x.concelho,freguesia:x.freguesia,lat:'',lng:'',estado:'Ativo'}));
const feed=(rows=example)=>({schema:ASSETS_SCHEMA,rows});
test('V4 mantém exatamente 103 PN no inventário offline',()=>{
 assert.equal(passagensNivelLinhaOeste.length,103);
 assert.equal(normalizeAssetsPayload(feed()).length,103);
 assert.equal(pnFromAssets(normalizeAssetsPayload(feed())).length,103);
});
test('V4 edita PN sem duplicar, inclui PH/PS/GEO na mesma tabela',()=>{
 const rows=example.map(x=>({...x}));
 rows.find(x=>x.pk==='45+850').nome='Sapataria corrigida no Drive';
 rows.push({id:'LO-PH-115350',linha:'Linha do Oeste',tipo:'PH',pk:'115+350',nome:'PH Rio',estado:'Ativo'},
           {id:'NO-PS-005500',linha:'Linha do Norte',tipo:'PS',pk:'5+500',nome:'PS Ponte',estado:'Ativo',lat:'38.72',lng:'-9.15'},
           {id:'LO-GEO-007',linha:'Linha do Oeste',tipo:'GEO',pk:'',nome:'Talude',estado:'Ativo',lat:'39.12',lng:'-9.05'});
 const all=normalizeAssetsPayload(feed(rows));
 assert.equal(all.length,106);assert.equal(all.filter(x=>x.tipo==='PH').length,1);
 assert.equal(all.find(x=>x.pk==='45+850').nome,'Sapataria corrigida no Drive');
 assert.equal(pnFromAssets(all).length,103);
 assert.equal(all.find(x=>x.id==='NO-PS-005500').lat,38.72);
 assert.equal(ASSET_TYPES.GEO,'Órgão Geotécnico');
});
test('V4 assinala tipos futuros sem alterar o código e oculta estados inativos',()=>{
 const rows=[...example,{id:'MIN-BC-100',linha:'Linha do Minho',tipo:'BC',pk:'12+000',nome:'Boca de canalização',estado:'Ativo'}];
 const all=normalizeAssetsPayload(feed(rows));assert.equal(all.at(-1).tipo,'BC');
 all[0].estado='Inativo';assert.equal(assetIsActive(all[0]),false);assert.equal(pnFromAssets(all).length,102);
});
test('V4 rejeita ID, PK e GPS inválidos e não substitui a cache com folha parcial',()=>{
 assert.throws(()=>normalizeAssetsPayload(feed([])),/incompleta/);
 assert.throws(()=>normalizeAssetsPayload(feed(example.slice(0,10))),/incompleta/);
 assert.throws(()=>normalizeAssetsPayload(feed([...example,example[0]])),/ID repetido/);
 assert.throws(()=>normalizeAssetsPayload(feed([...example,{...example[0],id:'NEW',pk:example[1].pk}])),/duplicados/);
 assert.throws(()=>normalizeAssetsPayload(feed(example.map((x,i)=>i?x:{...x,lat:'90.99',lng:'-9'}))),/GPS inválido/);
 assert.throws(()=>normalizeAssetsPayload(feed(example.map((x,i)=>i?x:{...x,pk:'quebrado'}))),/PK inválido/);
 assert.equal(isValidCachedAssets(feed()),true);
 assert.equal(isValidCachedAssets(feed(example.slice(0,10))),false);
});
test('V4 usa configuração central sem URL por aparelho',async()=>{
 assert.equal(ASSETS_SYNC_INTERVAL_MS,900000);
 assert.equal(ASSETS_CONFIG_URLS[0],'https://ruijpedro.github.io/RJP-Navigator/config/ativos-sync.json');
 const addr='https://script.google.com/macros/s/AKfycb123aBc/exec';
 assert.equal(normalizeAssetsConfig({schema:ASSETS_CONFIG_SCHEMA,enabled:true,feedUrl:addr}).feedUrl,addr);
 assert.throws(()=>normalizeAssetsConfig({schema:ASSETS_CONFIG_SCHEMA,enabled:true,feedUrl:'https://example.com/exec'}));
 const output=await fetchAssetsCentralConfig({urls:['https://test.local/config'],fetcher:async()=>({ok:true,json:async()=>({schema:ASSETS_CONFIG_SCHEMA,enabled:false,feedUrl:''})})});
 assert.equal(output.enabled,false);
 const shipped=JSON.parse(readFileSync(new URL('../public/config/ativos-sync.json',import.meta.url),'utf8'));
 assert.equal(shipped.enabled,true);
assert.match(shipped.feedUrl, /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/);
});
test('V4 usa um endpoint Google Apps Script só de leitura para uma tabela Ativos',()=>{
 const src=readFileSync(new URL('../integrations/google-apps-script/Code.gs',import.meta.url),'utf8');
 assert.match(src,/SHEET_NAME='Ativos'/);assert.match(src,/rjp-ativos-rfn-v1/);
 assert.match(src,/getDisplayValues\(/);
 assert.doesNotMatch(src,/\.setValues\(|\.appendRow\(|function\s+doPost\s*\(/);
 const ui=readFileSync(new URL('../src/NationalNavigator.jsx',import.meta.url),'utf8');
 assert.match(ui,/Ativos ferroviários/);assert.match(ui,/pickInventoryAsset/);assert.match(ui,/searchRoad\(loc\)/);
});
