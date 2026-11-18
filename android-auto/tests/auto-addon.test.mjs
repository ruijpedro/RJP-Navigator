import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Android Auto anuncia POI e usa ACTION_NAVIGATE para ponto rodoviário',()=>{
 const car=file('native/RjpCarAppService.java');
 assert.match(car,/CarContext\.ACTION_NAVIGATE/);
 assert.match(car,/getSharedPreferences\("rjp_car_accesses"/);
 assert.match(car,/optBoolean\("confirmed", false\)/);
 assert.doesNotMatch(car,/OSRM|Overpass|railway\.lat/);
});
test('Bridge mantém apenas dados Android e sem internet própria',()=>{
 const bridge=file('native/RjpCarBridge.java');
 assert.match(bridge,/getSharedPreferences\("rjp_car_accesses"/);
 assert.match(bridge,/setAccesses/);
 assert.doesNotMatch(bridge,/HttpURLConnection|http(s)?:\/\//);
});
test('Patch web não altera APK estável e filtra confirmados',()=>{
 const js=file('scripts/patch-web.mjs');
 assert.match(js,/RJP_CAR_AUTO_BRIDGE_V1/);
 assert.match(js,/Acesso confirmado pelo utilizador/);
});
test('Workflow isolado apenas execução manual',()=>{
 const wf=readFileSync(new URL('../../.github/workflows/android-auto-beta.yml',import.meta.url),'utf8');
 assert.match(wf,/workflow_dispatch:/);
 assert.match(wf,/node android-auto\/scripts\/install-native\.mjs/);
 assert.match(wf,/assembleDebug/);
 assert.doesNotMatch(wf,/pull_request:|push:/);
});
