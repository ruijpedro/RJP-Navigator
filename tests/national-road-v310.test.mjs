import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveNationalLinePK,geometryProfile,locateGeometricDistance,nearestOnProfile} from '../src/lib/national.js';
import {findRoadAccess} from '../src/lib/access.js';
const network=JSON.parse(readFileSync(new URL('../public/data/rede-ferroviaria-nacional.json',import.meta.url)));
const line=name=>network.linhas.find(x=>x.nome===name);

test('43 linhas com ponto ferroviário selecionável e coordenadas GPS, sem confundir distância com PK oficial',()=>{
 assert.equal(network.linhas.length,43);
 for(const item of network.linhas){
  const valid=item.segmentos.find(s=>s.coords?.length>1);
  assert.ok(valid,`Sem troço: ${item.nome}`);
  const profile=geometryProfile(valid.coords);
  const location=locateGeometricDistance(profile.length/2,profile);
  assert.ok(location.lat>=36&&location.lat<43&&location.lng<0,JSON.stringify({nome:item.nome,location}));
  assert.equal(location.displayPK,null);
  const projected=nearestOnProfile(profile,location);
  assert.ok(projected.offsetMeters<1);
 }
});
test('pesquisa por PK nacional localiza os troços calibrados, sem dependência de internet',()=>{
 for(const [name,pk] of [['Linha do Oeste','115+350'],['Linha do Norte','150+000'],['Linha do Minho','080+100'],['Linha de Cascais','12+000'],['Linha de Cintura','5+000']]){
  const r=resolveNationalLinePK(pk,name,line(name).segmentos,{},0);
  assert.ok(!r.error,`${name}: ${r.error}`);
  assert.ok(Number.isFinite(r.location.lat)&&Number.isFinite(r.location.lng));
  assert.equal(r.location.displayPK,pk==='080+100'?'80+100':pk);
  if(name==='Linha de Cintura')assert.equal(r.segmentIndex,1);
 }
});
test('troços com PK decrescente são pesquisáveis',()=>{
 const r=resolveNationalLinePK('1+000','Linha do Minho',line('Linha do Minho').segmentos,{},1);
 assert.equal(r.segmentIndex,1);
 assert.equal(r.location.displayPK,'1+000');
});
test('uma linha ainda não calibrada não devolve PK inventado',()=>{
 const r=resolveNationalLinePK('50+000','Linha do Douro',line('Linha do Douro').segmentos);
 assert.match(r.error,/duas referências/);
 assert.equal(r.location,undefined);
});
test('PK fora do intervalo não extrapola a coordenada',()=>{
 const r=resolveNationalLinePK('900+000','Linha do Norte',line('Linha do Norte').segmentos);
 assert.match(r.error,/fora dos intervalos/);
});
test('intervalo num segundo troço utiliza automaticamente as suas referências do utilizador',()=>{
 const L=line('Linha do Algarve');
 const custom={'Linha do Algarve|1':{anchors:[{pk:'0+000',position:'start'},{pk:'45+300',position:'end'}]}};
 const r=resolveNationalLinePK('15+000','Linha do Algarve',L.segmentos,custom,0);
 assert.equal(r.segmentIndex,1);
 assert.equal(r.location.displayPK,'15+000');
});
test('pesquisa de estrada associa resultado ao ponto ferroviário do segmento nacional',async()=>{
 const point=resolveNationalLinePK('150+000','Linha do Norte',line('Linha do Norte').segmentos).location;
 const fakeRoad={type:'way',id:9,tags:{highway:'residential',name:'Rua de Teste'},geometry:[{lat:point.lat+.0002,lon:point.lng-.001},{lat:point.lat+.0002,lon:point.lng+.001}]};
 const fakeFetch=async(url)=>{
  if(String(url).includes('interpreter'))return {ok:true,json:async()=>({elements:[fakeRoad]})};
  throw Error('No external requests expected');
 };
 const out=await findRoadAccess(point,null,{fetcher:fakeFetch,hosts:['https://example.test/interpreter']});
 assert.ok(out.recommended.gapMeters<100);
 assert.equal(out.recommended.name,'Rua de Teste');
 assert.equal(out.railPoint.lat,point.lat);
 assert.equal(out.alternatives.length,1);
});
test('listagem de PN atualizada mantém-se na V3.10',()=>{
 const file=readFileSync(new URL('../src/data/passagensNivel.js',import.meta.url),'utf8');
 const matches=[...file.matchAll(/\b(?:\d{1,3})\+\d{3}\b/g)];
 assert.ok(matches.length>=103);
 assert.ok(file.includes('214+096'));
});
