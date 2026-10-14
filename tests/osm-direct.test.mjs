import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOSMRelationFullXML,fetchOSMDirect,getRailwayFromOSM} from '../src/lib/osm-direct.js';
const id=2076345;
const xml=`<?xml version="1.0"?><osm version="0.6">
<node id="1" lat="38.79752688" lon="-9.3131841" />
<node id="2" lat="39.1" lon="-9.2"><tag k="railway" v="level_crossing" /></node>
<node id="3" lat="39.5" lon="-9.1" />
<node id="4" lat="40.00997619" lon="-8.81314803" />
<way id="80"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><tag k="railway" v="rail"/></way>
<relation id="${id}"><member type="way" ref="80" role=""/><tag k="route" v="railway"/></relation></osm>`;
test('API principal converte XML em vias com nós conectados e PN identificada',()=>{
 const d=parseOSMRelationFullXML(xml);
 assert.equal(d.ways.length,1);
 assert.equal(d.ways[0].nodes.length,4);
 assert.equal(d.osmPoints.length,1);
 assert.equal(d.osmPoints[0].type,'crossing');
});
test('API principal recusa relação errada ou XML sem geometria',()=>{
 assert.throws(()=>parseOSMRelationFullXML(xml,555));
 assert.throws(()=>parseOSMRelationFullXML('invalid'));
});
test('GET API principal é utilizado para carregar o mapa sem POST Overpass',async()=>{
 const r=await fetchOSMDirect(async url=>({ok:true,text:async()=>xml}));
 assert.equal(r.ways.length,1);
});
test('se falhar a API principal, tenta Overpass',async()=>{
 const out=await getRailwayFromOSM({start:[38.79752688,-9.3131841],end:[40.00997619,-8.81314803],fetcher:async()=>{throw Error('offline');},overpassFetch:async()=>({elements:[{type:'way',id:80,nodes:Array.from({length:151},(_,i)=>i+1),geometry:Array.from({length:151},(_,i)=>({lat:38.79752688+(40.00997619-38.79752688)*i/150,lon:-9.3131841+(-8.81314803+9.3131841)*i/150}))}]})});
 assert.equal(out.source,'Overpass');assert.equal(out.route.coords.length,151);
});
import {interpolatePK,parsePK,deriveAssetLocation} from '../src/lib/rail.js';
import {createRouteFromOSM} from '../src/lib/osm.js';
test('um PK 115+350 e uma PN passam a ter latitude e longitude após obter eixo válido',()=>{
 const start=[38.79752688,-9.3131841],end=[40.00997619,-8.81314803];
 const path=Array.from({length:180},(_,i)=>({lat:start[0]+(end[0]-start[0])*i/179,lon:start[1]+(end[1]-start[1])*i/179}));
 const route=createRouteFromOSM([{type:'way',id:123,nodes:path.map((_,i)=>i+1),geometry:path}],start,end);
 const p=interpolatePK(parsePK('115+350'),route);
 assert.ok(p?.lat>start[0]&&p?.lat<end[0]);
 const pn=deriveAssetLocation({key:'pn-test',pk:'115+350',categoria:'Passagem de Nível'},{},{},route);
 assert.ok(Number.isFinite(pn.lat)&&Number.isFinite(pn.lng));
 assert.equal(pn.gpsStatus,'Estimado pelo traçado');
});
