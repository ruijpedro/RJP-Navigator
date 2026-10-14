import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyPreload} from '../src/lib/preload.js';
import {interpolatePK,parsePK,metersBetween,deriveAssetLocation} from '../src/lib/rail.js';
const base=new URL('../public/data/',import.meta.url);
const map=JSON.parse(await readFile(new URL('linha-oeste-preload.json',base),'utf8'));
const national=JSON.parse(await readFile(new URL('rede-ferroviaria-nacional.json',base),'utf8'));
test('cartografia IP da Linha do Oeste vem dentro do pacote e possui eixo contínuo',()=>{
 const verified=verifyPreload(map);
 assert.ok(verified); assert.equal(verified.route.source,'ip-shapefile');
 assert.ok(verified.route.coords.length>4000); assert.ok(verified.route.length>169000&&verified.route.length<172000);
});
test('PK 21+191, PK 115+350 e PK 191+191 geram coordenadas no traçado IP',()=>{
 const route=verifyPreload(map).route;
 const a=interpolatePK(parsePK('21+191'),route);
 const mid=interpolatePK(parsePK('115+350'),route);
 const b=interpolatePK(parsePK('191+191'),route);
 for (const p of [a,mid,b]){assert.ok(p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng));}
 assert.ok(metersBetween([a.lat,a.lng],[38.79752688,-9.3131841])<15);
 assert.ok(metersBetween([b.lat,b.lng],[40.00997619,-8.81314803])<15);
 assert.ok(mid.lat>a.lat&&mid.lat<b.lat);
});
test('passagem de nível com PK conhecido fica localizável sem consultas OSM',()=>{
 const route=verifyPreload(map).route;
 const result=deriveAssetLocation({key:'pn-exemplo',pk:'115+641',lat:'',lng:'',categoria:'Passagem de Nível'}, {}, {},route);
 assert.equal(result.gpsStatus,'Estimado pelo traçado');assert.ok(result.lat>39);
});
test('base nacional representa 43 designações e 56 segmentos georreferenciados',()=>{
 assert.equal(national.linhas.length,43);
 assert.equal(national.linhas.reduce((n,l)=>n+l.segmentos.length,0),56);
 assert.equal(national.semGeometria.length,3);
 assert.ok(national.linhas.some(x=>x.nome==='Linha do Norte'&&x.segmentos.length));
});
