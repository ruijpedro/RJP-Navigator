import test from 'node:test';
import assert from 'node:assert/strict';
import {passagensNivelLinhaOeste as pn} from '../src/data/passagensNivel.js';
import {PK_START,PK_END,parsePK,interpolatePK} from '../src/lib/rail.js';
import {readFileSync} from 'node:fs';

const pack = JSON.parse(readFileSync(new URL('../public/data/linha-oeste-preload.json',import.meta.url)));
const items = pn.map(x=>parsePK(x.pk));
test('PN 2026: exatamente 103 PK únicos e ordenados',()=>{
 assert.equal(pn.length,103);
 assert.equal(new Set(items).size,103);
 assert.deepEqual([...items].sort((a,b)=>a-b),items);
 assert.ok(pn.every(p=>p.categoria==='Passagem de Nível'&&p.tipo==='PN'));
});
test('PN 2026: 48 antigas coincidentes, 55 novas; 11 ausentes eliminadas',()=>{
 assert.equal(pn.filter(x=>x.estadoDados.startsWith('PK coincidente')).length,48);
 assert.equal(pn.filter(x=>x.estadoDados.startsWith('Nova')).length,55);
 for(const retired of ['22+890','24+988','29+881'])assert.ok(!pn.some(p=>p.pk===retired),retired);
 assert.ok(pn.some(p=>p.pk==='30+906'&&p.nome==='Mastrontas'));
});
test('PN 2026: 84 dentro do troço e 19 fora, sem extrapolação GPS',()=>{
 assert.equal(pn.filter(p=>p.dentroTroco).length,84);
 assert.equal(pn.filter(p=>!p.dentroTroco).length,19);
 assert.equal(pn.at(-1).pk,'214+096');
 const route=pack.route||pack;
 assert.ok(route.coords?.length>4000&&route.length>100000);
 assert.ok(interpolatePK(30906,route));
 assert.equal(interpolatePK(214096,route),null);
});
