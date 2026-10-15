import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geometryProfile,defaultCalibration,locateNationalPK,locateGeometricDistance,nearestOnProfile,calibrationReferences} from '../src/lib/national.js';
const national=JSON.parse(readFileSync(new URL('../public/data/rede-ferroviaria-nacional.json',import.meta.url)));
const geo=(line,index=0)=>geometryProfile(national.linhas.find(l=>l.nome===line).segmentos[index].coords);
test('geometrias IP em 43 linhas utilizáveis',()=>assert.equal(national.linhas.length,43));
for(const [name,pk] of [['Linha do Norte','150+000'],['Linha do Minho','080+100'],['Linha de Cascais','12+000'],['Linha do Oeste','115+350'],['Linha de Cintura','5+000']]){
 test(`${name}: localização PK com referências explicitadas`,()=>{
  const idx=name==='Linha de Cintura'?1:0;const profile=geo(name,idx),location=locateNationalPK(pk,profile,defaultCalibration(name,idx));
  assert.ok(location.lat>36&&location.lat<43&&location.lng<0,JSON.stringify(location));
  const near=nearestOnProfile(profile,location);assert.ok(near.offsetMeters<5);
  assert.match(location.status,/Estimado/);
 });
}
test('sem referências não inventa PK e oferece km geométrico',()=>{
 const p=geo('Linha do Douro');const c=defaultCalibration('Linha do Douro',0);
 assert.match(locateNationalPK('100+000',p,c).error,/duas referências/);
 assert.ok(locateGeometricDistance(12345,p).lat>0);
});
test('duas referências GPS personalizadas calibram troço',()=>{
 const p=geo('Linha de Sintra');let c={anchors:[{pk:'12+000',lat:p.coords[100][0],lng:p.coords[100][1]},{pk:'22+000',lat:p.coords[500][0],lng:p.coords[500][1]}]};
 const result=locateNationalPK('17+000',p,c);assert.ok(result.lat>0,JSON.stringify(result));
});
test('rejeita GPS muito longe do eixo e referência invertida',()=>{
 const p=geo('Linha de Cascais');
 assert.match(calibrationReferences(p,{anchors:[{pk:'1+000',lat:42,lng:-7}]}).error,/>200 m/);
 assert.match(calibrationReferences(p,{anchors:[{pk:'1+000',position:'start'},{pk:'3+000',position:'end'},{pk:'4+000',lat:p.coords[200][0],lng:p.coords[200][1]}]}).error,/monotónicas/);
});
test('PK fora dos limites não extrapola',()=>{
 const p=geo('Linha do Norte');assert.match(locateNationalPK('500+000',p,defaultCalibration('Linha do Norte',0)).error,/fora do intervalo/);
});

test('Linha do Minho São Bento–Campanhã tem PK decrescentes',()=>{const p=geo('Linha do Minho',1),a=locateNationalPK('1+000',p,defaultCalibration('Linha do Minho',1));assert.ok(a.lat>40,JSON.stringify(a));});
