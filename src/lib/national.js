/**
 * RJP Navigator — referenciação quilométrica nacional.
 * Os PK das diferentes linhas têm origens independentes e NÃO se deduzem da
 * extensão geométrica sem um mínimo de duas referências PK↔GPS na mesma linha.
 */
import {metersBetween,parsePK,formatPK,validGPS} from './rail.js';

export const RAIL_LINES=[
 ['oeste','Linha do Oeste'],['norte','Linha do Norte'],['minho','Linha do Minho'],
 ['douro','Linha do Douro'],['beira-alta','Linha da Beira Alta'],['beira-baixa','Linha da Beira Baixa'],
 ['sul','Linha do Sul'],['algarve','Linha do Algarve'],['cascais','Linha de Cascais'],
 ['sintra','Linha de Sintra'],['cintura','Linha de Cintura'],['azambuja','Linha da Azambuja'],
 ['sado','Linha do Sado'],['alentejo','Linha do Alentejo'],['evora','Linha de Évora'],
 ['leste','Linha do Leste'],['vendas-novas','Linha de Vendas Novas'],['setil','Ramal de Setil'],
 ['tunes-lagos','Ramal de Lagos'],['tomar','Ramal de Tomar'],['lousa','Ramal da Lousã'],
 ['figueira-da-foz','Ramal da Figueira da Foz'],['pocinho','Linha do Tua'],
 ['trofa','Linha de Leixões'],['guimaraes','Linha de Guimarães'],['aveiro','Ramal de Aveiro'],
 ['neves-corvo','Ramal de Neves-Corvo'],['sines','Linha de Sines'],
 ['caceres','Ramal de Cáceres'],['moura','Ramal de Moura'],['regua-chaves','Linha do Corgo'],
 ['vouga','Linha do Vouga'],['tamega','Linha do Tâmega'],['moncao','Ramal de Monção'],
 ['alfarelos','Ramal de Alfarelos'],['portalegre','Ramal de Portalegre']
].map(([id,nome])=>({id,nome}));
export const NATIONAL_CATALOGUE_NOTE='Catálogo inicial de pesquisa: contém também linhas/ramais sem exploração atual. A existência no catálogo não confirma via ativa.';
const normalize=(s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function idForLine(raw){const name=normalize(raw);const known=RAIL_LINES.find(x=>normalize(x.nome)===name||normalize(x.id)===name);return known?.id||null;}
export function readCSVRecords(text){
 const clean=String(text||'').replace(/^\uFEFF/,'').trim();if(!clean)return [];
 const lines=clean.split(/\r?\n/).filter(Boolean);const delimiter=(lines[0].match(/;/g)||[]).length>=(lines[0].match(/,/g)||[]).length?';':',';
 return lines.map(line=>{let cells=[],s='',quoted=false;for(let i=0;i<line.length;i++){let c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){s+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){cells.push(s.trim());s='';}else s+=c;}cells.push(s.trim());return cells;});
}
export function parseAnchorCSV(input){
 const records=readCSVRecords(input);if(!records.length)throw Error('O CSV está vazio.');
 const header=records[0].map(x=>normalize(x));
 const idx=(...names)=>header.findIndex(x=>names.some(n=>x===normalize(n)));
 const lineIdx=idx('linha','line','ferrovia','linhaferroviaria'),pkIdx=idx('pk','km','quilometragem'),latIdx=idx('latitude','lat'),lonIdx=idx('longitude','lon','lng');
 if([lineIdx,pkIdx,latIdx,lonIdx].includes(-1))throw Error('O CSV precisa de cabeçalhos: linha;pk;latitude;longitude.');
 const out=[],errors=[];
 for(let i=1;i<records.length;i++){
  const cells=records[i],line=cells[lineIdx],id=idForLine(line)||String(line||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),pk=parsePK(cells[pkIdx]);
  const lat=Number(String(cells[latIdx]||'').replace(',','.')),lng=Number(String(cells[lonIdx]||'').replace(',','.'));
  if(!line||!id||pk==null||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<36||lat>43||lng < -10||lng >-5.5){errors.push(i+1);continue;}
  out.push({lineId:id,lineName:line,pk,lat,lng,source:'Importação CSV — por verificar',verified:false});
 }
 if(!out.length)throw Error('Nenhuma referência PK/GPS válida no CSV. Linhas com erro: '+errors.join(', '));
 return {anchors:out,errors};
}
const validCoord=(v)=>Array.isArray(v)&&v.length>=2&&Number.isFinite(Number(v[0]))&&Number.isFinite(Number(v[1]))&&Number(v[0])>=-11&&Number(v[0])<=-5&&Number(v[1])>=35&&Number(v[1])<=43;
export function lineFromGeoJSON(data){
 const lines=[];
 function walk(v){if(!v)return;if(v.type==='FeatureCollection')return (v.features||[]).forEach(walk);if(v.type==='Feature')return walk(v.geometry);if(v.type==='LineString')lines.push(v.coordinates);if(v.type==='MultiLineString')v.coordinates.forEach(line=>lines.push(line));}
 walk(data);
 if(lines.length!==1)throw Error('Escolhe uma única LineString contínua da linha ferroviária; uma rede de segmentos não pode ser tratada como um único eixo quilométrico.');
 const raw=lines[0];if(raw.length<2||raw.length>60000||!raw.every(validCoord))throw Error('Geometria GeoJSON inválida ou não convertida para WGS84 (EPSG:4326).');
 const coords=raw.map(p=>[Number(p[1]),Number(p[0])]);return makeRoute(coords,'GeoJSON importado');
}
export function makeRoute(coords,source='Eixo importado'){
 if(!Array.isArray(coords)||coords.length<2)throw Error('Traçado vazio.');
 let length=0;for(let i=1;i<coords.length;i++){const d=metersBetween(coords[i-1],coords[i]);if(!Number.isFinite(d)||d>7000)throw Error('Traçado descontínuo ou inválido; verifica lacunas e ramificações.');length+=d;}
 if(length<100)throw Error('Traçado demasiado curto.');
 return {coords,length,source,needsCalibration:true,importedAt:new Date().toISOString()};
}
export function nearestOnLine(point,route){
 if(!validGPS(point?.lat,point?.lng)||!route?.coords?.length)return null;
 const lat=Number(point.lat),lng=Number(point.lng),rad=Math.PI/180;
 let along=0,best=null;
 for(let i=1;i<route.coords.length;i++){
  const a=route.coords[i-1],b=route.coords[i],sx=111195*Math.cos(lat*rad),sy=111195;
  const dx=(b[1]-a[1])*sx,dy=(b[0]-a[0])*sy,px=(lng-a[1])*sx,py=(lat-a[0])*sy;
  const t=dx*dx+dy*dy?Math.max(0,Math.min(1,(dx*px+dy*py)/(dx*dx+dy*dy))):0;
  const p={lat:a[0]+(b[0]-a[0])*t,lng:a[1]+(b[1]-a[1])*t};
  const distance=metersBetween([lat,lng],[p.lat,p.lng]);
  if(!best||distance<best.distance)best={...p,distance,along:along+metersBetween(a,b)*t};
  along+=metersBetween(a,b);
 }
 return best;
}
export function calibrateReferences(route,anchors,maxSnap=250){
 if(!route?.coords?.length)return {ready:false,anchors:[],reason:'Sem eixo cartografado.'};
 const projected=(anchors||[]).filter(a=>parsePK(a.pk)!=null&&validGPS(a.lat,a.lng)).map(a=>{
  const snap=nearestOnLine(a,route);return {...a,pk:parsePK(a.pk),snapDistance:snap.distance,along:snap.along};
 }).filter(a=>a.snapDistance<=maxSnap).sort((a,b)=>a.pk-b.pk);
 const unique=[];for(const a of projected){if(unique.length&&a.pk===unique.at(-1).pk){if(Math.abs(a.along-unique.at(-1).along)>25)return {ready:false,anchors:unique,reason:'O mesmo PK tem coordenadas contraditórias. Rever duplicados e linha.'};if(a.verified&&!unique.at(-1).verified)unique[unique.length-1]=a;}else unique.push(a);}
 if(unique.length<2)return {ready:false,anchors:unique,reason:`Referências próximas do eixo: ${unique.length}. São necessárias pelo menos duas.`};
 // Respect PK direction; the route may be reversed but anchors must never be reordered by PK silently.
 const ascend=unique.every((a,i)=>i===0||a.along>unique[i-1].along);
 const descend=unique.every((a,i)=>i===0||a.along<unique[i-1].along);
 if(!ascend&&!descend)return {ready:false,anchors:unique,reason:'Referências PK incompatíveis com o sentido/traçado. Verificar descontinuidades de kilometragem ou desvios.'};
 // Relações desproporcionadas denunciam referência errada, inversão de eixo ou descontinuidade de PK.
 if(ascend){
  for(let i=1;i<unique.length;i++){const km=unique[i].pk-unique[i-1].pk,rail=unique[i].along-unique[i-1].along;
   if(km>=200&&(rail/km<0.65||rail/km>1.5))return {ready:false,anchors:unique,reason:'Referências incompatíveis: distância ferroviária muito diferente do intervalo de PK. Confirmar troços e descontinuidades.'};
  }
 }
 if(descend){const reversed={...route,coords:[...route.coords].reverse()};return calibrateReferences(reversed,anchors,maxSnap);}
 return {ready:true,anchors:unique,route,span:[unique[0].pk,unique.at(-1).pk],verified:unique.every(a=>a.verified===true)};
}
export function pointForPK(pk,calibration){
 if(!calibration?.ready)return null;const n=parsePK(pk),refs=calibration.anchors;
 if(n==null||n<refs[0].pk||n>refs.at(-1).pk)return null;
 const j=refs.findIndex(a=>a.pk>=n);let along,status='Interpolado entre referências';
 if(refs[j].pk===n){along=refs[j].along;status=refs[j].verified?'Referência GPS verificada':'Referência importada — por validar';}
 else{const a=refs[j-1],b=refs[j];along=a.along+(n-a.pk)/(b.pk-a.pk)*(b.along-a.along);}
 const coords=calibration.route.coords;let d=0;
 for(let i=1;i<coords.length;i++){
  const seg=metersBetween(coords[i-1],coords[i]);if(d+seg>=along||i===coords.length-1){const t=seg?Math.max(0,Math.min(1,(along-d)/seg)):0;
   return {pk:n,lat:coords[i-1][0]+t*(coords[i][0]-coords[i-1][0]),lng:coords[i-1][1]+t*(coords[i][1]-coords[i-1][1]),status,along};}
  d+=seg;
 }return null;
}
export function pkForPoint(point,calibration){
 if(!calibration?.ready)return null;const projection=nearestOnLine(point,calibration.route);if(!projection)return null;
 if(projection.distance>80)return null;
 const refs=calibration.anchors;if(projection.along<refs[0].along||projection.along>refs.at(-1).along)return null;
 const j=refs.findIndex(a=>a.along>=projection.along);
 if(j<0)return null;
 if(j===0)return {...projection,pk:refs[0].pk,pkLabel:formatPK(refs[0].pk),status:'Estimativa calibrada'};
 const a=refs[j-1],b=refs[j];const pk=Math.round(a.pk+(projection.along-a.along)/(b.along-a.along)*(b.pk-a.pk));
 return {...projection,pk,pkLabel:formatPK(pk),status:'Estimativa interpolada'};
}
export function relationSearchQuery(lineName){
 const safe=String(lineName||'').replace(/["\\]/g,'').slice(0,90);if(!safe)throw Error('Nome de linha inválido');
 return `[out:json][timeout:65];relation["route"="railway"]["name"="${safe}"];out tags;`;
}
export function relationWaysQuery(relationId){const id=Number(relationId);if(!Number.isSafeInteger(id)||id<=0)throw Error('ID OSM inválido');return `[out:json][timeout:100];way(r:${id});out geom;`;}
export function waysToSegments(elements){return (elements||[]).filter(x=>x.type==='way'&&Array.isArray(x.geometry)&&x.geometry.length>=2).map(w=>({id:w.id,nodes:w.nodes||[],coords:w.geometry.map(x=>[x.lat,x.lon])})).filter(w=>w.coords.every(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])));}
/** Stitch an OSM railway relation between two PK/GPS anchors via a shortest connected path. */
export function pathBetweenAnchors(elements,a,b){
 const ways=waysToSegments(elements),nodes=new Map(),adj=new Map();
 for(const w of ways){for(let i=0;i<w.coords.length;i++){
  const pos=w.coords[i],key=w.nodes[i]!=null?'n'+w.nodes[i]:'c'+pos[0].toFixed(7)+','+pos[1].toFixed(7);
  nodes.set(key,pos);if(!adj.has(key))adj.set(key,[]);
  if(i){const prev=w.nodes[i-1]!=null?'n'+w.nodes[i-1]:'c'+w.coords[i-1][0].toFixed(7)+','+w.coords[i-1][1].toFixed(7);
   if(adj.has(prev)){const d=metersBetween(nodes.get(prev),pos);if(d>0&&d<7000){adj.get(key).push([prev,d]);adj.get(prev).push([key,d]);}}}
 }}
 const nearest=p=>{let best=null;for(const [id,pos] of nodes){const dist=metersBetween(pos,[p.lat,p.lng]);if(!best||dist<best.dist)best={id,dist};}return best;};
 const st=nearest(a),en=nearest(b);if(!st||!en||st.dist>1000||en.dist>1000)throw Error('As referências PK estão demasiado afastadas da relação OSM (mais de 1 km).');
 const cost=new Map([[st.id,0]]),prev=new Map(),heap=[[0,st.id]];
 const push=(v)=>{heap.push(v);let i=heap.length-1;while(i>0){const parent=(i-1)>>1;if(heap[parent][0]<=v[0])break;heap[i]=heap[parent];i=parent;}heap[i]=v;};
 const pop=()=>{const out=heap[0],last=heap.pop();if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return out;};
 while(heap.length){const [d,id]=pop();if(d>cost.get(id))continue;if(id===en.id)break;for(const [n,len] of adj.get(id)||[]){const next=d+len;if(next<(cost.get(n)??Infinity)){cost.set(n,next);prev.set(n,id);push([next,n]);}}}
 if(!cost.has(en.id))throw Error('Eixo OSM desconectado entre as referências. Não se gerou um PK fictício.');
 let key=en.id,arr=[];for(let guard=0;guard<=nodes.size;guard++){arr.push(nodes.get(key));if(key===st.id)break;key=prev.get(key);if(key==null)break;}
 if(arr.length<2||key!==st.id)throw Error('Não foi possível reconstruir o eixo.');
 return makeRoute(arr.reverse(),`Relação OpenStreetMap · entre referências PK`);
}
