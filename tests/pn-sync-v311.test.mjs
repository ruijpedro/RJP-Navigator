import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {passagensNivelLinhaOeste as bundled} from '../src/data/passagensNivel.js';
import {PN_FEED_SCHEMA,validatePNFeedURL,normalizePNPayload,isValidCachedPNSnapshot,fetchPNGoogleSheetJSONP} from '../src/lib/pn-sync.js';

const entries=bundled.map(x=>({pk:x.pk,nome:x.nome,localidade:x.localidade,concelho:x.concelho,freguesia:x.freguesia}));
const sheet=(data=entries)=>({schema:PN_FEED_SCHEMA,rows:data,generatedAt:new Date().toISOString()});

test('Apps Script aceita somente URL HTTPS /exec oficial',()=>{
 assert.equal(validatePNFeedURL('  https://script.google.com/macros/s/AKfycb123_mY-/exec?usp=sharing  '),'https://script.google.com/macros/s/AKfycb123_mY-/exec');
 for(const url of ['https://example.com/macros/s/a/exec','http://script.google.com/macros/s/a/exec','https://script.google.com/macros/s/a/dev','javascript:alert(1)','https://script.google.com.evil.org/macros/s/a/exec','https://bad@script.google.com/macros/s/a/exec'])assert.throws(()=>validatePNFeedURL(url));
});

test('alteração do nome do PK 45+850 propaga-se sem perder os atributos de GPS/PK',()=>{
 const rows=entries.map(x=>({...x}));
 rows.find(x=>x.pk==='45+850').nome='Sapataria (revisto no Drive)';
 const result=normalizePNPayload(sheet(rows));
 assert.equal(result.length,103);
 const changed=result.find(x=>x.pk==='45+850');
 assert.equal(changed.nome,'Sapataria (revisto no Drive)');
 assert.equal(changed.id,'pn-km-45-850');
 assert.equal(changed.categoria,'Passagem de Nível');
 assert.equal(changed.estadoDados,'Sincronizada do Google Drive');
});

test('a folha completa substitui (não junta) PN antigas: removidas desaparecem',()=>{
 const removed='29+876';const rows=entries.filter(x=>x.pk!==removed);
 const result=normalizePNPayload(sheet(rows));
 assert.equal(result.length,102);
 assert.ok(!result.some(x=>x.pk===removed));
 assert.ok(!result.some(x=>x.pk==='22+890'));
});

test('não sobrescreve offline com folha vazia ou parcial',()=>{
 assert.throws(()=>normalizePNPayload(sheet([])),/curta|extensa/);
 assert.throws(()=>normalizePNPayload(sheet(entries.slice(0,20))),/curta|extensa/);
 assert.equal(isValidCachedPNSnapshot(sheet(entries)),true);
 assert.equal(isValidCachedPNSnapshot(sheet([])),false);
});

test('bloqueia PK duplicados, PK inválidos e esquemas inesperados',()=>{
 assert.throws(()=>normalizePNPayload(sheet([...entries,{...entries[0]}])),/duplicado/);
 assert.throws(()=>normalizePNPayload(sheet([{...entries[0],pk:'danger'} ,...entries.slice(1)])),/inválido/);
 assert.throws(()=>normalizePNPayload({rows:entries,schema:'unknown'}),/incompatível/);
});

test('atributos GPS só são aceites se válidos e não reivindica validação de campo',()=>{
 const rows=entries.map(x=>({...x}));
 rows[0].lat='39,12345';rows[0].lng='-9,12345';
 rows[1].lat='999';rows[1].lng='-9';
 const got=normalizePNPayload(sheet(rows));
 assert.equal(got[0].lat,39.12345);
 assert.equal(got[0].lng,-9.12345);
 assert.equal(got[1].lat,'');
 assert.equal(got[0].fonte,'Google Drive — PN_LO_Atual (sincronizado)');
});

test('carrega JSONP sem CORS e liberta callback e elemento quando recebe resposta',async()=>{
 const originalWindow=globalThis.window, originalDocument=globalThis.document;
 const count={removed:0};
 globalThis.window={};
 globalThis.document={
  createElement:()=>({async:false,remove:()=>{count.removed++}}),
  head:{appendChild:element=>{
   const callback=new URL(element.src).searchParams.get('callback');
   assert.match(callback,/^__rjpPnSync_\d+_[a-z0-9]+$/);
   queueMicrotask(()=>globalThis.window[callback](sheet(entries)));
  }}
 };
 try{
  const result=await fetchPNGoogleSheetJSONP('https://script.google.com/macros/s/AKfycb123/exec');
  assert.equal(result.rows.length,103);assert.equal(count.removed,1);
  assert.equal(Object.keys(globalThis.window).length,0);
 }finally{globalThis.window=originalWindow;globalThis.document=originalDocument;}
});

test('Apps Script aponta para a folha e não contém operações de escrita',()=>{
 const code=readFileSync(new URL('../integrations/google-apps-script/Code.gs',import.meta.url),'utf8');
 assert.match(code,/SHEET_NAME='Ativos'/);
 assert.match(code,/1JBRHtWuFx-wMsCGimf28LhVVOjrL5mIX5Z_NGiJa0Dw/);
 assert.match(code,/getDisplayValues\(/);
 assert.doesNotMatch(code,/\.setValues\(|\.appendRow\(|function\s+doPost\s*\(/);
});

test('Base embutida conserva a designação confirmada no Drive para PK 45+850',()=>{
 assert.equal(bundled.find(x=>x.pk==='45+850').nome,'Sapataria');
});

test('UI importa o hook useCallback usado pela sincronização',()=>{
 const code=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(code,/import\s+React,\{[^}]*\buseCallback\b[^}]*\}\s+from\s+['"]react['"]/);
 assert.match(code,/const\s+atualizarAtivos\s*=\s*useCallback\(/);
 assert.match(code,/Sincronizar agora/);
});
