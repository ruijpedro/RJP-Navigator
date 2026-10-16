import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateNationalNetwork,loadNationalNetwork} from '../src/lib/network-loader.js';
const network={linhas:[{nome:'Linha do Oeste',segmentos:[{coords:[[39,-9],[39.1,-9]]}]}]};
test('recusa ficheiro cartográfico nacional incompleto por defeito',()=>{
 assert.throws(()=>validateNationalNetwork(network),/incompleto/);
});
test('suporta validação parametrizada para ficheiro de teste',()=>{
 assert.equal(validateNationalNetwork(network,{minimumLines:1,minimumSegments:1}),network);
});
test('a aplicação lê cartografia nacional do pacote, não só do localStorage',()=>{
 const src=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(src,/loadNationalNetwork\(/);
 assert.match(src,/rede-ferroviaria-nacional\.json/);
 assert.match(src,/closestRailwayGPS\(/);
 const component=readFileSync(new URL('../src/components/NationalNavigator.jsx',import.meta.url),'utf8');
 assert.match(component,/network\.linhas/);
 assert.match(component,/networkGroup/);
 assert.match(component,/Mostrar hectométricos/);
});

test('ambos os workflows validam o cadastro nacional antes de compilar',()=>{
 for(const path of ['build-android.yml','build-web.yml','deploy-webapp.yml']){
  const wf=readFileSync(new URL('../.github/workflows/'+path,import.meta.url),'utf8');
  assert.match(wf,/npm run repair:data/);
  assert.match(wf,/npm run verify:network/);
 }
});

test('referências PK têm módulo independente do motor legado, evitando export em falta',()=>{
 const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 const comp=readFileSync(new URL('../src/components/NationalNavigator.jsx',import.meta.url),'utf8');
 assert.match(main,/national-presets-v42\.js/);
 assert.match(comp,/national-presets-v42\.js/);
});
