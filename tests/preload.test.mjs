import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPreload,fetchBundledCartography} from '../src/lib/preload.js';
test('não aceita ausência ou geometria fictícia no ficheiro predefinido',()=>{
 assert.equal(verifyPreload({route:null}),null);
 assert.equal(verifyPreload({route:{coords:[[38.7975,-9.31],[40.01,-8.81]],length:170000}}),null);
});
test('preserva lista sem mapa caso o serviço esteja indisponível',async()=>{
 const value=await fetchBundledCartography('mock',async()=>({ok:false}));
 assert.equal(value,null);
});
test('valida geometria real já obtida em cachê, sem substituir GPS',()=>{
 const coords=Array.from({length:151},(_,i)=>[38.79752688+i*(40.00997619-38.79752688)/150,-9.31318410+i*(-8.81314803+9.31318410)/150]);
 // Um perfil fictício não é aceite como mapa verificado se sair do comprimento físico definido.
 assert.equal(verifyPreload({route:{coords,length:1000}}),null);
 const map=verifyPreload({route:{coords,length:160000},osmPoints:[{id:'node/1',lat:39,lng:-9},{id:'node/2',lat:120,lng:2}]});
 assert.equal(map.osmPoints.length,1);assert.equal(map.route.needsCalibration,true);
});
