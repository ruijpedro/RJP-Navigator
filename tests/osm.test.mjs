import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouteFromOSM,parseOSMAssets,closestOnRoute,associateOSM,fetchOverpass} from '../src/lib/osm.js';
import {deriveAssetLocation,parsePK,interpolatePK,PK_START,PK_END} from '../src/lib/rail.js';
const start=[38.797527,-9.313184],end=[40.009976,-8.813148];
const pts=Array.from({length:161},(_,i)=>({lat:start[0]+i/160*(end[0]-start[0]),lon:start[1]+i/160*(end[1]-start[1])}));
const ways=[{type:'way',id:1,nodes:pts.map((_,i)=>i+101),geometry:pts.slice(0,95)}, {type:'way',id:2,nodes:pts.slice(94).map((_,i)=>i+95),geometry:pts.slice(94)}];
// Fix first way's node ids so shared vertex is identical.
ways[0].nodes=pts.slice(0,95).map((_,i)=>i+101);
ways[1].nodes=pts.slice(94).map((_,i)=>i+101+94);
test('OSM railway path is continuous, with geometry and orientation checked',()=>{
 const line=createRouteFromOSM(ways,start,end);
 assert.equal(line.coords.length,161);
 assert.ok(line.length>115000&&line.length<245000);
 assert.ok(line.startError<1&&line.endError<1);
 assert.ok(interpolatePK(PK_START,line));
 assert.ok(interpolatePK(PK_END,line));
});
test('disconnected railways do not fabricate intermediate PKs',()=>{
 const disconnected=[{type:'way',id:1,nodes:[1,2],geometry:[pts[0],pts[1]]},{type:'way',id:2,nodes:[3,4],geometry:[pts.at(-2),pts.at(-1)]}];
 assert.throws(()=>createRouteFromOSM(disconnected,start,end));
});
test('PN is assigned only with unambiguous nearby OSM crossing, and field GPS wins',()=>{
 const line=createRouteFromOSM(ways,start,end),pk='115+350';
 const predicted=interpolatePK(parsePK(pk),line);
 const node={type:'node',id:1337,lat:predicted.lat,lon:predicted.lng,tags:{railway:'level_crossing'}};
 const osm=parseOSMAssets([node]);
 const base=[{key:'pn-a',pk,categoria:'Passagem de Nível',nome:'PN'}];
 const assigned=associateOSM(base,line,osm);
 assert.ok(assigned['pn-a']);
 assert.equal(assigned['pn-a'].status,'OSM — PN provável');
 const out=deriveAssetLocation(base[0],{}, {},line,assigned,[]);
 assert.equal(out.gpsStatus,'OSM — PN provável');
 const manual=deriveAssetLocation(base[0],{'pn-a':{lat:39.5,lng:-8.9}}, {},line,assigned,[]);
 assert.equal(manual.gpsStatus,'Confirmado no terreno');
});
test('station names map with estimated PK while EDF remains explicitly unverified',()=>{
 const line=createRouteFromOSM(ways,start,end);
 const mid=pts[70],base=[{key:'est-sabugo',id:'sabugo',nome:'Sabugo',categoria:'Estação/Apeadeiro',pk:''},{key:'edf-sabugo',id:'sabugo',nome:'Sabugo',categoria:'Edifício',pk:''}];
 const a=associateOSM(base,line,parseOSMAssets([{type:'node',id:44,lat:mid.lat,lon:mid.lon,tags:{railway:'station',name:'Estação de Sabugo'}}]));
 assert.ok(a['est-sabugo'].estimatedPK);
 assert.equal(a['edf-sabugo'].status,'Estimado junto à estação');
});
test('Overpass API errors are reported, not converted to guessed data',async()=>{
 await assert.rejects(()=>fetchOverpass('[out:json];',async()=>({ok:true,json:async()=>({remark:'error',elements:[]})})));
});
