import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('workflow manual Play com API 36 e sem push na main',()=>{
 const w=readFileSync(new URL('../../.github/workflows/android-auto-play.yml',import.meta.url),'utf8');
 assert.match(w,/workflow_dispatch:/);
 assert.match(w,/google-play/);
 assert.match(w,/bundleRelease/);
 assert.match(w,/platforms;android-36/);
 assert.doesNotMatch(w,/push:\s*\n/);
});
test('id Google Play fixo e distinto da versao estável',()=>{
 const s=get('scripts/configure-play.mjs');
 assert.match(s,/pt\.rjp\.navigator\.auto/);
 assert.match(s,/targetSdkVersion',36/);
 assert.match(s,/RJP_PLAY_KEYSTORE_PATH/);
 assert.match(s,/buildTypes/);
});
test('icone e recursos Android disponíveis',()=>{
 for(const p of ['branding/rjp-auto-googleplay-512.png','branding/android-res/mipmap-mdpi/ic_launcher.png','branding/android-res/drawable/ic_launcher_foreground.png']){
  assert(existsSync(new URL('../'+p,import.meta.url)));
 }
});
test('Play nao armazena segredos no repositorio',()=>{
 const s=get('scripts/configure-play.mjs');
 assert.doesNotMatch(s,/storePassword\s*[=:]\s*['"][^'"$]+['"]/);
});
