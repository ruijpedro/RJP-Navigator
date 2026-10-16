import test from 'node:test';
import assert from 'node:assert/strict';
import {markersForSegment,buildNationalKilometerLayer,visibleNationalMarkers,positionAlongTrack} from '../src/lib/network-km-layer.js';
const shape=[[39,-9],[39.005,-9],[39.01,-9]];
const segment={coords:shape};
const anchors=[{pk:'10+000',position:'start',source:'IP: origem documental'},{pk:'11+100',position:'end',source:'IP: extremo documental'}];
const net={linhas:[{nome:'Linha A',segmentos:[segment]},{nome:'Linha B',segmentos:[segment]}]};
test('Km nacional vem de referências por linha e não extrapola os extremos',()=>{
 const m=markersForSegment(shape,anchors);
 assert.deepEqual(m.map(x=>x.label),['10+000','11+000']);
 assert.ok(m[1].lat>39&&m[1].lat<39.01);
 assert.equal(m[0].verified,false);
});
test('Sem referências não inventa PK nem quilómetros',()=>{
 const result=buildNationalKilometerLayer(net);
 assert.equal(result.markers.length,0);assert.equal(result.withoutPK,2);
});
test('Não aplica âncoras de uma linha a outra com o mesmo eixo',()=>{
 const r=buildNationalKilometerLayer(net,{presets:{'Linha A|0':{anchors}}});
 assert.equal(r.coverage.length,1);assert.ok(r.markers.every(x=>x.line==='Linha A'));
});
test('OSM tem prioridade sobre preset quando os seus marcos são coerentes',()=>{
 const osm=[{pk:20000,lat:39,lng:-9,source:'OSM'},{pk:21100,lat:39.01,lng:-9,source:'OSM'}];
 const r=buildNationalKilometerLayer(net,{referenceSets:{'Linha A|0':osm},presets:{'Linha A|0':{anchors}}});
 assert.equal(r.withOSM,1);assert.deepEqual(r.markers.map(x=>x.pk),[20000,21000]);
});
test('Milestone não calibrado ou distância fisicamente inverosímil é rejeitado',()=>{
 assert.deepEqual(markersForSegment(shape,[{pk:'10+000',position:'start'},{pk:'30+000',position:'end'}]),[]);
});
test('PK decrescente gera marcos válidos sem inventar sentido',()=>{
 const m=markersForSegment(shape,[{pk:'11+100',position:'start'},{pk:'10+000',position:'end'}]);
 assert.deepEqual(m.map(x=>x.pk),[10000,11000]);
});
test('Marcadores globais respeitam zoom, viewport e limites de densidade',()=>{
 const many=Array.from({length:1000},(_,i)=>({lat:39+i/100000,lng:-9+i/100000}));
 assert.equal(visibleNationalMarkers(many,null,6).length,0);
 assert.ok(visibleNationalMarkers(many,{south:39.002,north:39.004,west:-8.998,east:-8.996},12).length<=201);
 assert.ok(visibleNationalMarkers(many,null,10).length<=320);
});
test('Posição interpolada sobre a geometria tem latitude longitude numéricas',()=>{
 const q=positionAlongTrack(shape,[0,555,1110],277.5);
 assert.ok(Math.abs(q.lat-39.0025)<0.000001);
});
