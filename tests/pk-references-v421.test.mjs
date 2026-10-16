import test from 'node:test';
import assert from 'node:assert/strict';
import {railwayMilestones,associatePKToNetwork,validatePKReferences,loadPKReferences,PK_REFERENCES_SCHEMA} from '../src/lib/pk-references.js';
import {closestRailwayGPS} from '../src/lib/gps-nearest.js';
const osm=(id,lat,lon,pk,tags={})=>({type:'node',id,lat,lon,tags:{railway:'milestone','railway:position':pk,...tags}});
const network={linhas:[{nome:'Linha do Teste',segmentos:[{coords:[[39,-9],[39,-8.99]]}]}]};
test('interpreta marcos OSM reais sem os marcar como verificados',()=>{
 const x=railwayMilestones([osm(10,39,-8.999,'0.100'),osm(11,39,-8.997,'0.300')]);
 assert.equal(x.length,2);assert.equal(x[0].pk,100);assert.equal(x[0].verified,false);assert.equal(x[0].physical,true);
});
test('não inventa PK quando existe apenas um marco',()=>{
 const r=associatePKToNetwork(network,[osm(10,39,-8.999,'0.100')]);
 assert.equal(r.assigned,0);assert.deepEqual(r.lines,{});
});
test('associa 2 ou mais marcos ao mesmo segmento consistente',()=>{
 const r=associatePKToNetwork(network,[osm(10,39,-8.999,'0.100'),osm(11,39,-8.996,'0.360'),osm(12,39,-8.993,'0.620')]);
 assert.equal(r.assigned,3);assert.equal(r.lines['Linha do Teste|0'].length,3);
 assert.ok(r.lines['Linha do Teste|0'].every(a=>a.verified===false));
});
test('não promove posições com PK contraditórios',()=>{
 const r=associatePKToNetwork(network,[osm(10,39,-8.999,'0.100'),osm(11,39,-8.996,'31.360')]);
 assert.equal(r.assigned,0);
});
test('ignora marcas afastadas do eixo',()=>{
 const r=associatePKToNetwork(network,[osm(10,39.01,-8.999,'0.100'),osm(11,39.01,-8.996,'0.360')]);
 assert.equal(r.assigned,0);
});
test('vias próximas de linhas distintas não criam âncoras ambiguas',()=>{
 const n={linhas:[{nome:'Linha do Teste',segmentos:[{coords:[[39,-9],[39,-8.99]]}]},{nome:'Linha da Paralela',segmentos:[{coords:[[39.00006,-9],[39.00006,-8.99]]}]}]};
 const r=associatePKToNetwork(n,[osm(10,39.00003,-8.999,'0.100'),osm(11,39.00003,-8.996,'0.360')]);
 assert.equal(r.assigned,0);assert.equal(r.ambiguous,2);
});
test('preserva a origem da rede na identificação GPS por interpolação entre marcos',()=>{
 const lines=associatePKToNetwork(network,[osm(10,39,-8.999,'0.100'),osm(11,39,-8.996,'0.360')]).lines;
 const g=closestRailwayGPS({lat:39,lng:-8.997,acc:8},network,{referenceSets:lines});
 assert.equal(g.nearest.line,'Linha do Teste');assert.ok(g.nearest.pk>100);assert.ok(g.nearest.pk<360);
 assert.match(g.nearest.calibrationStatus,/Estimado/);
});
test('recusa importações cuja validação OSM é alegadamente certificada',()=>{
 const invalid={schema:PK_REFERENCES_SCHEMA,lines:{'Linha|0':[{pk:200,lat:39,lng:-9,verified:true}]}};
 assert.throws(()=>validatePKReferences(invalid),/inválidas/);
});
test('carrega o ficheiro de marcos da pasta pública sem depender de um serviço externo no arranque',async()=>{
 const sample={schema:PK_REFERENCES_SCHEMA,lines:{},assigned:0};
 const data=await loadPKReferences('./data/referencias-pk-rfn.json',{fetcher:async()=>({ok:true,json:async()=>sample})});
 assert.equal(data.schema,PK_REFERENCES_SCHEMA);
});
