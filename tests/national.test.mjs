import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RAIL_LINES,parseAnchorCSV,lineFromGeoJSON,makeRoute,calibrateReferences,
 pointForPK,pkForPoint,nearestOnLine,relationSearchQuery,relationWaysQuery,waysToSegments,pathBetweenAnchors
} from '../src/lib/national.js';
const line=makeRoute([[39,-9],[39.01,-9],[39.02,-9]],'Teste');
const refs=[{pk:1000,lat:39,lng:-9,verified:true},{pk:3000,lat:39.02,lng:-9,verified:true}];
test('catalogue national includes Oeste and Norte separately',()=>{
 assert.ok(RAIL_LINES.some(x=>x.id==='oeste'));
 assert.ok(RAIL_LINES.some(x=>x.id==='norte'));
 assert.notEqual(RAIL_LINES.find(x=>x.id==='oeste'),RAIL_LINES.find(x=>x.id==='norte'));
});
test('no calibration with one reference',()=>{
 const c=calibrateReferences(line,[refs[0]]);assert.equal(c.ready,false);assert.equal(pointForPK(1500,c),null);
});
test('interpolate PK between two distinct railway anchors',()=>{
 const c=calibrateReferences(line,refs);assert.equal(c.ready,true);
 const p=pointForPK('2+000',c);assert.ok(Math.abs(p.lat-39.01)<0.00001);assert.equal(p.status,'Interpolado entre referências');
 const reversed=pkForPoint({lat:39.015,lng:-9},c);assert.equal(reversed.pk,2500);
});
test('do not extrapolate beyond verified anchor range',()=>{
 const c=calibrateReferences(line,refs);assert.equal(pointForPK('0+999',c),null);assert.equal(pointForPK('3+001',c),null);
 assert.equal(pkForPoint({lat:39.021,lng:-9},c),null);
});
test('respect reversing a line geometry',()=>{
 const reversed=makeRoute([...line.coords].reverse());const c=calibrateReferences(reversed,refs);
 assert.equal(c.ready,true);assert.ok(Math.abs(pointForPK(2000,c).lat-39.01)<1e-6);
});
test('reject inconsistent calibrated points due to kilometre reset or wrong line',()=>{
 const c=calibrateReferences(line,[...refs,{pk:2000,lat:39.019,lng:-9}]);
 assert.equal(c.ready,false);assert.match(c.reason,/incompatíveis/);
});
test('anchor too far from geometry is not silently snapped',()=>{
 const c=calibrateReferences(line,[refs[0],{pk:3000,lat:40,lng:-8}]);assert.equal(c.ready,false);
});
test('national anchor importer can import multiple distinct lines',()=>{
 const input='linha;pk;latitude;longitude\nLinha do Oeste;21+191;38.7975269;-9.3131841\nLinha do Norte;114+500;39.12345;-8.65432\n';
 const o=parseAnchorCSV(input);assert.equal(o.anchors.length,2);
 assert.equal(o.anchors[0].lineId,'oeste');assert.equal(o.anchors[1].lineId,'norte');
 assert.equal(o.anchors[0].verified,false);
});
test('reject malformed GPS, preserve useful imported lines and count rejected',()=>{
 const o=parseAnchorCSV('linha;pk;latitude;longitude\nLinha do Norte;9+002;39.45;-8.5\nLinha do Norte;9+003;0;0');
 assert.equal(o.anchors.length,1);assert.deepEqual(o.errors,[3]);
});
test('accept WGS84 single line, reject ambiguous multilines and projected coordinates',()=>{
 const data={type:'LineString',coordinates:[[-9,39],[-9,39.01]]};
 const route=lineFromGeoJSON(data);assert.ok(route.length>1000);
 assert.throws(()=>lineFromGeoJSON({type:'MultiLineString',coordinates:[data.coordinates,data.coordinates]}),/única LineString/);
 assert.throws(()=>lineFromGeoJSON({type:'LineString',coordinates:[[-100000,38000],[-99900,38000]]}),/GeoJSON inválida/);
});
test('OSM relation query escapes names and ids safely',()=>{
 assert.match(relationSearchQuery('Linha do Norte'),/Linha do Norte/);
 assert.equal(relationWaysQuery(567), '[out:json][timeout:100];way(r:567);out geom;');
 assert.throws(()=>relationWaysQuery('wrong'),/inválido/);
});
test('build real continuous line from connected OSM ways between anchors',()=>{
 const ways=[{type:'way',id:1,nodes:[1,2],geometry:[{lat:39,lon:-9},{lat:39.01,lon:-9}]},{type:'way',id:2,nodes:[2,3],geometry:[{lat:39.01,lon:-9},{lat:39.02,lon:-9}]}];
 const segments=waysToSegments(ways);assert.equal(segments.length,2);
 const result=pathBetweenAnchors(ways,refs[0],refs[1]);assert.equal(result.coords.length,3);
 assert.ok(result.length>2000);
 assert.throws(()=>pathBetweenAnchors(ways,{lat:40,lng:-8},refs[1]),/afastadas/);
});
