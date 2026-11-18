import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {join} from 'node:path';
const root='android/app/src/main';
const pkg=join(root,'java/pt/rjp/navigator');
mkdirSync(pkg,{recursive:true});
for(const file of ['RjpCarBridge.java','RjpCarAppService.java'])
 copyFileSync('android-auto/native/'+file,join(pkg,file));
const main=join(pkg,'MainActivity.java');
let act=readFileSync(main,'utf8');
assert(act.includes('extends BridgeActivity'),'A estrutura do Capacitor mudou; rever MainActivity');
if(!act.includes('registerPlugin(RjpCarBridge.class)')){
 act=act.replace('import com.getcapacitor.BridgeActivity;',
   'import com.getcapacitor.BridgeActivity;\nimport android.os.Bundle;');
 act=act.replace(/public class MainActivity extends BridgeActivity\s*\{/,`public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle state) {
    registerPlugin(RjpCarBridge.class);
    super.onCreate(state);
  }
`);
}
assert(act.includes('registerPlugin(RjpCarBridge.class)'),'Falha no registo do plugin Capacitor');
writeFileSync(main,act);
const gradle='android/app/build.gradle';
let build=readFileSync(gradle,'utf8');
assert(/dependencies\s*\{/.test(build),'Bloco dependencies ausente');
if(!build.includes('androidx.car.app:app:1.7.0')){
 build=build.replace(/dependencies\s*\{/,`dependencies {
    implementation 'androidx.car.app:app:1.7.0'
    implementation 'androidx.car.app:app-projected:1.7.0'`);
}
// APK beta com identificador diferente, para NÃO substituir a V4.2.4 estável.
if(!build.includes('applicationIdSuffix ".autobeta"')){
 const at=build.indexOf('buildTypes {');assert(at>=0,'buildTypes ausente');
 build=build.slice(0,at)+build.slice(at).replace('buildTypes {',`buildTypes {
        debug {
            applicationIdSuffix ".autobeta"
        }`);
}
writeFileSync(gradle,build);
const manifest=join(root,'AndroidManifest.xml');
let xml=readFileSync(manifest,'utf8');
assert(xml.includes('<application'),'Aplicação Android não encontrada no manifest');
if(!xml.includes('androidx.car.app.minCarApiLevel')){
 xml=xml.replace('<application',`<application`);
 const appTag=xml.match(/<application\b[^>]*>/); assert(appTag,'Tag application não encontrada');
 const fields=`
        <meta-data android:name="androidx.car.app.minCarApiLevel" android:value="1" />
        <meta-data android:name="com.google.android.gms.car.application" android:resource="@xml/automotive_app_desc" />
        <service android:name="pt.rjp.navigator.RjpCarAppService"
                 android:label="RJP Navigator"
                 android:exported="true">
            <intent-filter>
                <action android:name="androidx.car.app.CarAppService" />
                <category android:name="androidx.car.app.category.POI" />
            </intent-filter>
        </service>
`;
 xml=xml.replace(appTag[0],appTag[0]+fields);
}
writeFileSync(manifest,xml);
const xmlDir=join(root,'res/xml');mkdirSync(xmlDir,{recursive:true});
writeFileSync(join(xmlDir,'automotive_app_desc.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<automotiveApp><uses name="template" /></automotiveApp>\n`);
console.log('Android Auto POI instalado (beta paralela, assinatura debug, app id com sufixo .autobeta)');
