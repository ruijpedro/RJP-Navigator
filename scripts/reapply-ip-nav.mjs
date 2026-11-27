/**
 * Preserves experimental IP navigator UI after the historic V4.0 compatibility
 * repair used by existing GitHub Actions workflows. Idempotent.
 */
import {readFile,writeFile} from 'node:fs/promises';
const mainPath='src/main.jsx',swPath='public/sw.js';
let s=await readFile(mainPath,'utf8');
const must=(before,after,label)=>{
 if(!s.includes(before))throw Error('IP reapply: anchor not found: '+label);
 s=s.replace(before,after);
};
if(!s.includes("import IPNavigator from './components/IPNavigator.jsx';")){
 must("import NationalNavigator from './components/NationalNavigator.jsx';",
 "import NationalNavigator from './components/NationalNavigator.jsx';\nimport IPNavigator from './components/IPNavigator.jsx';",'import');
}
if(!s.includes("['ip','Cartografia IP']")){
 must("['nacional','Rede Nacional'],","['nacional','Rede Nacional'],['ip','Cartografia IP'],",'tab');
}
if(!s.includes("{tab==='ip'&&<IPNavigator")){
 must("{tab==='nacional'&&<NationalNavigator",
 "{tab==='ip'&&<IPNavigator gps={gps} onGPS={obterGPS}/>}\n  {tab==='nacional'&&<NationalNavigator",'component');
}
s=s.replace("{tab!=='nacional'&&<section className=\"quicksearch\">",
 "{!['nacional','ip'].includes(tab)&&<section className=\"quicksearch\">");
await writeFile(mainPath,s,'utf8');

let sw=await readFile(swPath,'utf8');
sw=sw.replace(/const CACHE = 'rjp-navigator-webapp-[^']+';/,\"const CACHE = 'rjp-navigator-webapp-v4-3-ip-experimental';\");
if(!sw.includes("'data/ip/rail.json'")){
 const old="'data/linha-oeste-preload.json', 'data/rede-ferroviaria-nacional.json'";
 if(!sw.includes(old))throw Error('IP reapply: service worker cache list not found');
 sw=sw.replace(old,old+",\n  'data/ip/rail.json', 'data/ip/road.json', 'data/ip/stations.json'");
}
await writeFile(swPath,sw,'utf8');
console.log('IP Navigator interface + offline cache preserved');
