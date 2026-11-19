/**
 * RJP Navigator Auto – prepara um projeto Android gerado por Capacitor 7.
 * Corre DEPOIS de android-auto/scripts/install-native.mjs.
 * Altera exclusivamente o projeto Android temporário no runner, sem tocar na versão estável.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
const app='android/app';
const play=process.env.RJP_BUILD_PLAY==='true';
const run=Number(process.env.GITHUB_RUN_NUMBER||'1');
assert(Number.isInteger(run)&&run>=1&&run<200000000,'Número de compilação inválido');
const identity='pt.rjp.navigator.auto';
let build=readFileSync(join(app,'build.gradle'),'utf8');
assert(/applicationId\s*["']pt\.rjp\.navigator["']/.test(build),'Application ID original não reconhecido');
build=build.replace(/applicationId\s*["']pt\.rjp\.navigator["']/,'applicationId "'+identity+'"');
assert(/versionCode\s+\d+/.test(build),'versionCode em falta');
build=build.replace(/versionCode\s+\d+/,'versionCode '+(1000+run));
build=build.replace(/versionName\s+["'][^"']+["']/,'versionName "1.0.'+run+'"');
if(play){
  const vars=['RJP_PLAY_KEYSTORE_PATH','RJP_PLAY_STORE_PASSWORD','RJP_PLAY_KEY_ALIAS','RJP_PLAY_KEY_PASSWORD'];
  for(const key of vars)assert(process.env[key],`Falta a variável secreta ${key}`);
  assert(existsSync(process.env.RJP_PLAY_KEYSTORE_PATH),'Keystore de envio não encontrado');
  assert(/android\s*\{/.test(build),'Bloco android em falta');
  assert(/buildTypes\s*\{[\s\S]*?release\s*\{/.test(build),'Build release em falta');
  const sign=String.raw`
    signingConfigs {
        playRelease {
            storeFile file(System.getenv('RJP_PLAY_KEYSTORE_PATH'))
            storePassword System.getenv('RJP_PLAY_STORE_PASSWORD')
            keyAlias System.getenv('RJP_PLAY_KEY_ALIAS')
            keyPassword System.getenv('RJP_PLAY_KEY_PASSWORD')
        }
    }
`;
  build=build.replace(/android\s*\{/,(v)=>v+sign);
  build=build.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{)/,'$1\n            signingConfig signingConfigs.playRelease');
}
writeFileSync(join(app,'build.gradle'),build);
const varsFile='android/variables.gradle';
let variables=readFileSync(varsFile,'utf8');
// Android Auto projetado é uma app para telemóvel: novas apps na Play exigem API 36 (desde 31/08/2026).
for(const [key,val] of [['compileSdkVersion',36],['targetSdkVersion',36]]){
 const rex=new RegExp(`\\b${key}\\s*=\\s*\\d+`);
 assert(rex.test(variables),`Não foi possível localizar ${key}`);
 variables=variables.replace(rex,`${key} = ${val}`);
}
writeFileSync(varsFile,variables);
const manifest=join(app,'src/main/AndroidManifest.xml');
let xml=readFileSync(manifest,'utf8');
assert(xml.includes('RjpCarAppService'),'Serviço Android Auto não integrado');
xml=xml.replace(/android:label="RJP Navigator"(?=\s*android:exported="true")/,'android:label="RJP Navigator Auto"');
const appMatch=xml.match(/<application\b[^>]*>/);
assert(appMatch,'Tag application em falta');
const tag=appMatch[0].replace(/android:icon="[^"]*"/,'android:icon="@mipmap/ic_launcher"')
  .replace(/android:roundIcon="[^"]*"/,'android:roundIcon="@mipmap/ic_launcher_round"');
xml=xml.replace(appMatch[0],tag);
writeFileSync(manifest,xml);
const strings=join(app,'src/main/res/values/strings.xml');
let str=readFileSync(strings,'utf8');
str=str.replace(/(<string name="app_name">)[\s\S]*?(<\/string>)/,'$1RJP Navigator Auto$2')
 .replace(/(<string name="title_activity_main">)[\s\S]*?(<\/string>)/,'$1RJP Navigator Auto$2');
writeFileSync(strings,str);
const resources='play-auto/branding/android-res';
for(const scale of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
 for(const name of ['ic_launcher.png','ic_launcher_round.png']){
  const source=join(resources,'mipmap-'+scale,name);
  const dest=join(app,'src/main/res/mipmap-'+scale,name);
  assert(existsSync(source),`Ícone em falta: ${source}`);
  mkdirSync(dirname(dest),{recursive:true});copyFileSync(source,dest);
 }
}
const xmlDir=join(app,'src/main/res/mipmap-anydpi-v26');mkdirSync(xmlDir,{recursive:true});
for(const name of ['ic_launcher.xml','ic_launcher_round.xml']){
 const source=join(resources,'mipmap-anydpi-v26',name);copyFileSync(source,join(xmlDir,name));
}
const drawableDir=join(app,'src/main/res/drawable');mkdirSync(drawableDir,{recursive:true});
copyFileSync(join(resources,'drawable','ic_launcher_foreground.png'),join(drawableDir,'ic_launcher_foreground.png'));
copyFileSync(join(resources,'drawable','ic_launcher_background.png'),join(drawableDir,'ic_launcher_background.png'));
console.log('RJP Navigator Auto: id '+identity+' · API 36 · ícone personalizado · '+(play?'AAB Play com assinatura':'APK de diagnóstico'));
