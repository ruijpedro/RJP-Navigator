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
// Keep the IP datasets bundled, but hide the experimental standalone screen.
s=s.replace("import IPNavigator from './components/IPNavigator.jsx';\n","");
s=s.replace("['ip','Cartografia IP'],","");
s=s.replace("  {tab==='ip'&&<IPNavigator gps={gps} onGPS={obterGPS}/>}\n","");
s=s.replace("{!['nacional','ip'].includes(tab)&&","{tab!=='nacional'&&");

// Collapse legal sources without removing disclosures or links.
s=s.replace(/<section className="card" aria-label="Fontes de informação e independência"[^>]*>\s*<h2>Fontes de informação e independência<\/h2>/, '<details className="card" aria-label="Fontes de informação e independência" style={{margin:"12px auto",maxWidth:1100}}><summary style={{cursor:"pointer",fontWeight:600}}>ⓘ Sobre a aplicação</summary>');
const aboutStart=s.indexOf('<details className="card" aria-label="Fontes de informação e independência"');
if(aboutStart>=0){
 const end=s.indexOf('</section>',aboutStart);
 if(end>=0 && end<s.indexOf('<footer',aboutStart)){
  const block=s.slice(aboutStart,end).replace(/<a href=/g,'<a style={{display:"inline",background:"transparent",color:"#086348",padding:0,border:0,borderRadius:0,textDecoration:"underline",fontWeight:500,boxShadow:"none"}} href=');
  s=s.slice(0,aboutStart)+block+'</details>'+s.slice(end+10);
 }
}

await writeFile(mainPath,s,'utf8');

let sw=await readFile(swPath,'utf8');
sw=sw.replace(/const CACHE = 'rjp-navigator-webapp-[^']+';/,`const CACHE = 'rjp-navigator-webapp-v4-3-ip-experimental-2';`);
if(!sw.includes("'data/ip/rail.json'")){
 const old="'data/linha-oeste-preload.json', 'data/rede-ferroviaria-nacional.json'";
 if(!sw.includes(old))throw Error('IP reapply: service worker cache list not found');
 sw=sw.replace(old,old+",\n  'data/ip/rail.json', 'data/ip/road.json', 'data/ip/stations.json'");
}
sw=sw.replace('Promise.allSettled(required.map(url => cache.add(url)))','cache.addAll(required)');
await writeFile(swPath,sw,'utf8');
console.log('IP Navigator interface + offline cache preserved');
