import test from 'node:test';
import assert from 'node:assert/strict';
import {nearest,normalize} from '../src/lib/ipSpatial.mjs';
test('nearest line is selected in metres',()=>{
 const p={lat:39,lng:-9};
 const x=nearest(p,[{name:'near',points:[[39,-9.001],[39,-8.999]]},{name:'far',points:[[40,-9],[40,-8.99]]}]);
 assert.equal(x.item.name,'near');assert.ok(x.distance<1);
});
test('invalid GPS never gives a false result',()=>assert.equal(nearest({lat:NaN,lng:-9},[]),null));
test('station with point location is supported',()=>{
 const x=nearest({lat:39,lng:-9},[{name:'estação',point:[39,-9]}]);
 assert.equal(x.distance,0);
});
test('Portuguese diacritics are ignored in search',()=>assert.equal(normalize('ESTAÇÃO DE LEIRIA'),'estacao de leiria'));
