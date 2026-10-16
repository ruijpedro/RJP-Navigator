import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoute,calibrateReferences,pointForPK} from '../src/lib/national.js';
import {parseRailwayPosition,milestoneQueryForRoute,parseMilestoneOSM,assessMilestones,improveCalibrationWithMilestones,generateHectometers,calibrationDiagnostics} from '../src/lib/hectometers.js';
const route=makeRoute([[39,-9],[39.01,-9],[39.02,-9]]);
const a={pk:1000,lat:39,lng:-9,verified:true,source:'Levantamento'},b={pk:3200,lat:39.02,lng:-9,verified:true,source:'Levantamento'};
test('interpreta posição ferroviária decimal km e PK, sem inventar valores',()=>{
 assert.equal(parseRailwayPosition('12.3'),12300);
 assert.equal(parseRailwayPosition('12,345'),12345);
 assert.equal(parseRailwayPosition('12+345'),12345);
 assert.equal(parseRailwayPosition('12+1200'),null);
 assert.equal(parseRailwayPosition('10;11'),null);
 assert.equal(parseRailwayPosition('abc'),null);
});
test('pesquisa OSM limitada ao traçado para marcos quilométricos',()=>{
 const q=milestoneQueryForRoute(route);
 assert.match(q,/railway:position:exact/);
 assert.match(q,/railway"="milestone/);
 assert.throws(()=>milestoneQueryForRoute({coords:[]}),/traçado/);
});
test('associa marcos OSM a no máximo 45 m do eixo, sem dar validação oficial',()=>{
 const elements=[
  {type:'node',id:1,lat:39.01,lon:-9,tags:{railway:'milestone','railway:position':'2.1'}},
  {type:'node',id:2,lat:40,lon:-9,tags:{railway:'milestone','railway:position':'2.2'}},
  {type:'node',id:3,lat:39.01,lon:-9,tags:{railway:'milestone',name:'Marco sem PK'}},
 ];
 const items=parseMilestoneOSM(elements,route);
 assert.equal(items.length,1);assert.equal(items[0].pk,2100);assert.equal(items[0].verified,false);assert.equal(items[0].physical,true);
});
test('incompatibilidades entre âncoras e marcos são rejeitadas',()=>{
 const calibration=calibrateReferences(route,[a,b]);assert.equal(calibration.ready,true);
 const items=[{pk:2100,lat:39.01,lng:-9,along:route.length/2,snapDistance:0,usable:true,source:'OSM'},
              {pk:2500,lat:39.019,lng:-9,along:route.length*0.95,snapDistance:0,usable:true,source:'OSM'}];
 const upgraded=improveCalibrationWithMilestones(route,[a,b],items);
 assert.equal(upgraded.accepted.length,1);
 assert.equal(upgraded.rejected.length,1);
 const reCal=calibrateReferences(route,upgraded.anchors);assert.equal(reCal.ready,true);
 assert.equal(reCal.verified,false);
 assert.ok(pointForPK(2100,reCal));
});
test('marcos divergentes da posição interpolada ficam assinalados',()=>{
 const cal=calibrateReferences(route,[a,b]);
 const out=assessMilestones([{pk:2100,lat:39.0199,lng:-9,along:route.length/2,snapDistance:0}],cal,{maxDifference:100});
 assert.equal(out[0].usable,false);
});
test('hectómetros só entre âncoras, identificados como estimados',()=>{
 const cal=calibrateReferences(route,[a,b]);const h=generateHectometers(cal);
 assert.equal(h.length,23);assert.equal(h[0].label,'1+000');assert.equal(h.at(-1).label,'3+200');
 assert.ok(h.every(x=>x.virtual===true&&x.verified===false));
 assert.equal(generateHectometers({ready:false}).length,0);
 const d=calibrationDiagnostics(cal);assert.equal(d.ready,true);assert.equal(d.count,2);
});
test('calibração inicial com extremos não verificados não bloqueia indevidamente marcos OSM',()=>{
 const loose=calibrateReferences(route,[{...a,verified:false},{...b,verified:false}]);
 const marker={pk:2000,lat:39.019,lng:-9,along:route.length*0.95,snapDistance:0};
 const r=assessMilestones([marker],loose);
 assert.equal(r[0].usable,true);assert.equal(r[0].discrepancy,null);
});
