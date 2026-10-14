/**
 * V3.7: mapa integrado a partir do Shapefile da Rede Ferroviária Nacional.
 * Não descarrega dados OSM nem depende de Overpass durante o build.
 * A cartografia vem em public/data/ e mantém a atribuição de origem.
 */
import {readFile} from 'node:fs/promises';
import {verifyPreload} from '../src/lib/preload.js';
const root=new URL('../public/data/',import.meta.url);
const preload=JSON.parse(await readFile(new URL('linha-oeste-preload.json',root),'utf8'));
const rede=JSON.parse(await readFile(new URL('rede-ferroviaria-nacional.json',root),'utf8'));
const loaded=verifyPreload(preload);
if(!loaded||!loaded.route?.coords?.length)throw Error('Mapa IP da Linha do Oeste inválido ou vazio. Não compilar APK.');
if(loaded.route.source!=='ip-shapefile')throw Error('Mapa não proveniente do Shapefile entregue.');
if(!Array.isArray(rede.linhas)||rede.linhas.length<40)throw Error('Base nacional ausente ou incompleta.');
if(!rede.linhas.some(l=>l.nome==='Linha do Oeste'))throw Error('Falta a Linha do Oeste na rede nacional.');
console.log(`Mapa integrado: ${loaded.route.coords.length} vértices · ${(loaded.route.length/1000).toFixed(2)} km · fonte IP (Shapefile local)`);
console.log(`Rede nacional integrada: ${rede.linhas.length} designações com geometria, ${rede.linhas.reduce((n,l)=>n+l.segmentos.length,0)} segmentos.`);
console.log('Sem pedidos HTTP. Os restantes PK exigem calibração quilométrica por linha.');
