import test from 'node:test';
import assert from 'node:assert/strict';
import {gpsAreaCell,describeGPSArea,formatGPSCoordinates} from '../src/lib/gps-area.js';
import {parsePortugueseAddress} from '../src/lib/identify.js';
test('GPS sem posição não desencadeia pesquisa administrativa',()=>{
 assert.equal(gpsAreaCell(null),null);
 assert.equal(gpsAreaCell({lat:120,lng:-9}),null);
});
test('Atualizações GPS na mesma célula reutilizam o mesmo resultado',()=>{
 assert.equal(gpsAreaCell({lat:39.12341,lng:-9.12341}),gpsAreaCell({lat:39.12342,lng:-9.12342}));
});
test('Mostra apenas o nome do lugar com o concelho, sem lista administrativa',()=>{
 const area=parsePortugueseAddress({address:{parish:'Pereira',municipality:'Montemor-o-Velho',state_district:'Coimbra',village:'Pereira'}});
 const result=describeGPSArea(area);
 assert.equal(result.location,'Pereira, Montemor-o-Velho');
 assert.doesNotMatch(result.location,/Distrito:|Freguesia:|PK/);
});
test('Se só houver concelho o nome do local continua legível',()=>{
 assert.equal(describeGPSArea({concelho:'Sintra'}).location,'Sintra');
 assert.equal(describeGPSArea({}).location,null);
});
test('Coordenadas GPS formatadas com 6 decimais, incluindo altitude de precisão separada',()=>{
 assert.equal(formatGPSCoordinates({lat:39.12345672,lng:-9.34567899}),'39.123457, -9.345679');
 assert.equal(formatGPSCoordinates(null),'');
});
