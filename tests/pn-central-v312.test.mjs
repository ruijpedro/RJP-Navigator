import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PN_CONFIG_SCHEMA,PN_CONFIG_KEYS,PN_CENTRAL_CONFIG_URLS,PN_SYNC_INTERVAL_MS,normalizePNCentralConfig,getSavedPNCentralConfig,fetchPNCentralConfig} from '../src/lib/pn-config.js';

const example='https://script.google.com/macros/s/AKfycbRjpAbc_123/exec';
const active={schema:PN_CONFIG_SCHEMA,enabled:true,feedUrl:example,version:2};
const disabled={schema:PN_CONFIG_SCHEMA,enabled:false,feedUrl:'',version:1};

test('central: há um URL público partilhado e atualização automática de 15 min',()=>{
 assert.ok(PN_CENTRAL_CONFIG_URLS[0].startsWith('https://ruijpedro.github.io/RJP-Navigator/'));
 assert.ok(PN_CENTRAL_CONFIG_URLS[1].includes('/ruijpedro/RJP-Navigator/main/'));
 assert.equal(PN_SYNC_INTERVAL_MS,900000);assert.ok(PN_CONFIG_KEYS.saved);
});
test('central: só é aceite Apps Script oficial, com a configuração ativa',()=>{
 assert.equal(normalizePNCentralConfig(active).feedUrl,example);
 assert.equal(normalizePNCentralConfig(disabled).enabled,false);
 for(const data of [null,{}, {...active,enabled:'yes'}, {...active,feedUrl:'https://evil.example/exec'}, {...disabled,feedUrl:example}, {...active,feedUrl:''}, {...active,schema:'outro'}])assert.throws(()=>normalizePNCentralConfig(data));
 assert.equal(getSavedPNCentralConfig(active).enabled,true);
 assert.equal(getSavedPNCentralConfig({x:1}),null);
});
test('central: carrega configuração pública, ignora caches e valida conteúdo',async()=>{
 const seen=[];
 const result=await fetchPNCentralConfig({urls:['https://example.test/config.json'],fetcher:async(url,options)=>{
  seen.push({url,options});return {ok:true,json:async()=>active};
 }});
 assert.equal(result.feedUrl,example);assert.equal(seen.length,1);
 assert.equal(seen[0].options.cache,'no-store');
 assert.match(seen[0].url,/[?&]_rjp=/);
});
test('central: tenta URL alternativo se a fonte principal falhar',async()=>{
 let index=0;
 const got=await fetchPNCentralConfig({urls:['https://primeiro.test/config','https://segundo.test/config'],fetcher:async()=>{
  index++;if(index===1)throw Error('indisponível');return {ok:true,json:async()=>active};
 }});
 assert.equal(index,2);assert.equal(got.feedUrl,example);
});
test('central: rejeita respostas inválidas, sem confiar num URL de terceiros',async()=>{
 await assert.rejects(fetchPNCentralConfig({urls:['https://x.test/config'],fetcher:async()=>({ok:true,json:async()=>({...active,feedUrl:'https://adversario.test/'})})}),/Configuração central|HTTPS|Apps Script/);
});
test('central: ficheiro entregue está desativado até o utilizador publicar o Apps Script',()=>{
 const config=JSON.parse(readFileSync(new URL('../public/config/pn-sync.json',import.meta.url),'utf8'));
 assert.deepEqual(normalizePNCentralConfig(config),disabled);
});
test('central: a UI não exige configurar URL em cada aparelho',()=>{
 const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(main,/fetchPNCentralConfig\(/);
 assert.match(main,/Sincronizar agora/);
 assert.doesNotMatch(main,/Guardar ligação|Configuração única por instalação|pnFeedEdit/);
 assert.match(main,/PN_SYNC_INTERVAL_MS/);
 const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 assert.match(sw,/config\/pn-sync.json/);
 assert.match(sw,/cache: 'no-store'/);
});
