import test from 'node:test';
import assert from 'node:assert/strict';
import {roadQuery,drivableRoad,projectToSegment,candidatesFromRoads,parseOSRMNearest,chooseAccess,parseRoadTimes,findRoadAccess} from '../src/lib/access.js';
const rail={lat:39.5,lng:-9};
test('consulta OSM apenas estradas motorizáveis junto a um PK',()=>{
 const q=roadQuery(rail);assert.match(q,/around:1800,39.5000000,-9.0000000/);
 assert.equal(drivableRoad({highway:'motorway'}),false);
 assert.equal(drivableRoad({highway:'residential',access:'private'}),false);
 assert.equal(drivableRoad({highway:'footway'}),false);
 assert.equal(drivableRoad({highway:'tertiary'}),true);
});
test('calcula local na estrada mais próximo da ferrovia, sem inventar o acesso à via',()=>{
 const p=projectToSegment(rail,{lat:39.501,lon:-9.001},{lat:39.501,lon:-8.999});
 assert.ok(Math.abs(p.lng+9)<1e-7);assert.ok(p.gapMeters>90&&p.gapMeters<130);
});
test('filtra estrada privada e devolve a mais próxima com distância',()=>{
 const elements=[
  {type:'way',id:1,tags:{highway:'residential',name:'Rua da Estação'},geometry:[{lat:39.5003,lon:-9.01},{lat:39.5003,lon:-8.99}]},
  {type:'way',id:2,tags:{highway:'residential',access:'private'},geometry:[{lat:39.5,lon:-9.001},{lat:39.5,lon:-8.999}]},
  {type:'way',id:3,tags:{highway:'footway'},geometry:[{lat:39.5,lon:-9.01},{lat:39.5,lon:-8.99}]}
 ];
 const c=candidatesFromRoads(rail,elements);assert.equal(c.length,1);assert.equal(c[0].id,'osm-way-1');assert.ok(c[0].gapMeters<50);
});
test('recomenda a mais rápida dentro de mais 300m mas guarda a mais próxima',()=>{
 const d=[{id:'A',gapMeters:90,durationMin:55},{id:'B',gapMeters:170,durationMin:20},{id:'C',gapMeters:900,durationMin:2}];
 const r=chooseAccess(d);assert.equal(r.near.id,'A');assert.equal(r.recommended.id,'B');assert.equal(r.alternatives.length,3);
});
test('sem origem de GPS seleciona a estrada mais próxima',()=>{
 const r=chooseAccess([{id:'A',gapMeters:10},{id:'B',gapMeters:25}]);assert.equal(r.recommended.id,'A');
});
test('OSRM nearest devolve localização rodoviária, não coordenada ferroviária',()=>{
 const x=parseOSRMNearest(rail,{code:'Ok',waypoints:[{location:[-9.0004,39.501],distance:110,name:'Rua pública'}]});
 assert.equal(x[0].name,'Rua pública');assert.ok(x[0].gapMeters>105);assert.equal(x[0].validated,false);
});
test('OSRM table converte minutos e km',()=>{
 const c=parseRoadTimes({code:'Ok',durations:[[180,300]],distances:[[1250,2500]]},rail,[{id:'x',gapMeters:50},{id:'y',gapMeters:60}]);
 assert.equal(c[0].durationMin,3);assert.equal(c[1].driveKm,2.5);
});
test('fallback OSRM nearest quando não há Overpass acessível',async()=>{
 const fetcher=async(url)=>{
  if(String(url).includes('/nearest/v1/driving/'))return {ok:true,json:async()=>({code:'Ok',waypoints:[{location:[-9.001,39.5],distance:90,name:'Estrada pública'}]})};
  throw Error('Overpass sem rede');
 };
 const r=await findRoadAccess(rail,null,{fetcher,hosts:['https://not-available.local/'],router:'https://example.test'});
 assert.equal(r.source,'osrm-fallback');assert.equal(r.recommended.name,'Estrada pública');assert.ok(r.recommended.gapMeters>80);
});
