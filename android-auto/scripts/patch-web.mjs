import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const path='src/NationalNavigator.jsx';
let s=readFileSync(path,'utf8');
if(s.includes('RJP_CAR_AUTO_BRIDGE_V1')){console.log('Bridge web já integrada');process.exit(0);}
const marker="const [accesses,setAccesses]=useState(()=>load(LS_ROADS,{}));";
assert(s.includes(marker),'A versão do NationalNavigator mudou: verificação manual necessária.');
s="import {Capacitor,registerPlugin} from '@capacitor/core';\n"+s;
const effect=`
 // RJP_CAR_AUTO_BRIDGE_V1 — partilha apenas acessos CONFIRMADOS com o ecrã do carro.
 useEffect(()=>{
   if(Capacitor.getPlatform()!=='android')return;
   const items=Object.entries(accesses).map(([compoundKey,access])=>{
     const cut=compoundKey.lastIndexOf('|');
     if(cut<0||!access||!Number.isFinite(Number(access.lat))||!Number.isFinite(Number(access.lng)))return null;
     const pkNum=Number(compoundKey.slice(cut+1));
     if(!Number.isFinite(pkNum))return null;
     const region=compoundKey.slice(0,cut);
     return {linha:region.replace(/[/#:]\\d+$/,''),pk:formatPK(pkNum),
       lat:Number(access.lat),lng:Number(access.lng),name:String(access.name||'Acesso rodoviário'),confirmed:access.note==='Acesso confirmado pelo utilizador'};
   }).filter(Boolean);
   // Falhas do bridge não impedem o Navigator normal de funcionar.
   Promise.resolve(registerPlugin('RjpCarBridge').setAccesses({accesses:items})).catch(()=>{});
 },[accesses]);
`;
s=s.replace(marker,marker+effect);
writeFileSync(path,s);
console.log('Sincronização de acessos confirmados com Android Auto integrada');
