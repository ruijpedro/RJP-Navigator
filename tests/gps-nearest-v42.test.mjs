import test from 'node:test';
import assert from 'node:assert/strict';
import {closestRailwayGPS,projectToRail,anchorPositions,pkFromPosition} from '../src/lib/gps-nearest.js';
const network={linhas:[
 {nome:'Linha do Oeste',segmentos:[{coords:[[39.0000,-9.1],[39.0010,-9.1],[39.0020,-9.1]]}]},
 {nome:'Linha do Norte',segmentos:[{coords:[[39.00,-8.80],[39.001,-8.80]]}]}
]};
const anchors=[{pk:'10+000',position:'start',verified:false},{pk:'10+222',position:'end',verified:false}];
test('GPS reconhece a linha nacional mais próxima sem introduzir PK',()=>{
 const r=closestRailwayGPS({lat:39.001,lng:-9.1001,acc:8},network);
 assert.equal(r.nearest.line,'Linha do Oeste');
 assert.ok(r.nearest.offsetMeters<15);
 assert.equal(r.nearest.pkLabel,null);
});
test('GPS mostra PK estimado quando existem duas referências compatíveis',()=>{
 const r=closestRailwayGPS({lat:39.001,lng:-9.1,acc:9},network,{presets:{'Linha do Oeste|0':{anchors}}});
 assert.equal(r.nearest.line,'Linha do Oeste');
 assert.equal(r.nearest.pkLabel,'10+111');
 assert.match(r.nearest.calibrationStatus,/Estimado/);
});
test('Coordenada ferroviária é projeção no eixo, não o GPS de estrada',()=>{
 const p=projectToRail({lat:39.0005,lng:-9.101},network.linhas[0].segmentos[0].coords);
 assert.ok(p.distance>70&&p.distance<110);
 assert.equal(p.lng,-9.1);
});
test('Falta de geometria nacional é erro claro, sem coordenada inventada',()=>{
 const r=closestRailwayGPS({lat:39,lng:-9,acc:12},{linhas:[]});
 assert.match(r.error,/não contém eixos/);
 assert.equal(r.nearest,undefined);
});
test('Não extrapola PK para fora do intervalo de referências',()=>{
 const coords=network.linhas[0].segmentos[0].coords;
 const refs=anchorPositions(coords,[{pk:'10+040',lat:39.0004,lng:-9.1},{pk:'10+180',lat:39.0018,lng:-9.1}]);
 assert.equal(pkFromPosition(0,refs),null);
 assert.ok(pkFromPosition((refs[0].along+refs[1].along)/2,refs));
});
test('Sem precisão suficiente e com duas linhas juntas mostra alternativas',()=>{
 const v={linhas:[{nome:'Linha do Oeste',segmentos:[{coords:[[39,-9],[39.01,-9]]}]},{nome:'Linha de Cintura',segmentos:[{coords:[[39,-9.0003],[39.01,-9.0003]]}]}]};
 const r=closestRailwayGPS({lat:39.005,lng:-9,acc:80},v);
 assert.equal(r.ambiguous,true);
 assert.ok(r.alternatives.some(x=>x.line==='Linha de Cintura'));
});
