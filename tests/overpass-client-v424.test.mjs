import test from 'node:test';
import assert from 'node:assert/strict';
import {requestOverpassPK} from '../src/lib/overpass-client.js';
const q='[out:json];node["railway"="milestone"](39,-9,40,-8);out body;';
test('Overpass recolhe marcos por POST em vez de GET rejeitado com HTTP 406',async()=>{
 let call;
 const r=await requestOverpassPK(q,{hosts:['https://example.test/interpreter'],fetcher:async(url,args)=>{
  call={url,args};return {ok:true,json:async()=>({elements:[{type:'node',id:1}]})};
 }});
 assert.equal(call.args.method,'POST');
 assert.equal(call.args.body.get('data'),q);
 assert.match(call.args.headers['Content-Type'],/urlencoded/);
 assert.equal(r.elements.length,1);
});
test('Overpass tenta servidor alternativo quando o primeiro responde 406',async()=>{
 let n=0;
 const r=await requestOverpassPK(q,{hosts:['https://x.test','https://y.test'],fetcher:async()=>{
  n++;if(n===1)return {ok:false,status:406};return {ok:true,json:async()=>({elements:[]})};
 }});
 assert.equal(n,2);assert.equal(r.host,'https://y.test');
});
test('Overpass não substitui marcos antigos por respostas inválidas',async()=>{
 await assert.rejects(requestOverpassPK(q,{hosts:['https://x.test'],fetcher:async()=>({ok:true,json:async()=>({error:'quota'})})}),/Resposta sem lista/);
});
