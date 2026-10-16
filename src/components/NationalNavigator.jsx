import React,{useEffect,useMemo,useRef,useState} from 'react';
import L from 'leaflet';
import {fetchOverpass} from '../lib/osm.js';
import {reverseAdministrative} from '../lib/identify.js';
import {findRoadAccess} from '../lib/access.js';
import {parsePK,formatPK,downloadText,validGPS} from '../lib/rail.js';
import limites from '../data/limites.json';
import {
 RAIL_LINES,NATIONAL_CATALOGUE_NOTE,parseAnchorCSV,calibrateReferences,lineFromGeoJSON,makeRoute,idForLine,
 pointForPK,pkForPoint,relationSearchQuery,relationWaysQuery,waysToSegments,pathBetweenAnchors,
 nearestOnLine
} from '../lib/national.js';
import {NATIONAL_PRESETS} from '../lib/national-presets-v42.js';
import {milestoneQueryForRoute,parseMilestoneOSM,assessMilestones,improveCalibrationWithMilestones,generateHectometers,calibrationDiagnostics} from '../lib/hectometers.js';
import {buildNationalKilometerLayer,visibleNationalMarkers} from '../lib/network-km-layer.js';

const CACHE='rjp_nav_nacional_v4';
const load=()=>{
 let data={};try{data=JSON.parse(localStorage.getItem(CACHE)||'{}');}catch{}
 const defaults=limites.responsibility_segment.points.map(p=>({lineId:'oeste',pk:p.pk_m,lat:p.wgs84.latitude,lng:p.wgs84.longitude,verified:false,source:'Limite do utilizador — EPSG:3763 assumido; CRS por confirmar'}));
 return {...data,anchors:{oeste:defaults,...(data.anchors||{})}};
};
const save=(s)=>{try{localStorage.setItem(CACHE,JSON.stringify(s));return true;}catch{return false;}};
const coord=p=>`${Number(p.lat).toFixed(7)}, ${Number(p.lng).toFixed(7)}`;
const maps=p=>`https://www.google.com/maps/dir/?api=1&destination=${p.lat}%2C${p.lng}&travelmode=driving`;
const waze=p=>`https://www.waze.com/ul?ll=${p.lat}%2C${p.lng}&navigate=yes`;
const osmLink=p=>`https://www.openrailwaymap.org/?style=standard&lat=${p.lat}&lon=${p.lng}&zoom=15`;
const defaultCenter=[39.6,-8.2];
const safeFeatureCount=100000;
const EMPTY_ARRAY=Object.freeze([]);
const EMPTY_OBJECT=Object.freeze({});

function NationalMap({route,segments,network,calibration,selectedPoint,onPick,showRail=true,showHectometers=false,hectometers=[],milestones=[],nationalKm=[],showNationalKm=true}){
 const mapElement=useRef(),mapRef=useRef(),networkGroup=useRef(),lineGroup=useRef(),hectoGroup=useRef(),markerGroup=useRef(),nationalKmGroup=useRef();
 const [viewport,setViewport]=useState({zoom:7,bounds:null});
 useEffect(()=>{
  if(!mapElement.current)return;
  const map=L.map(mapElement.current,{preferCanvas:true,scrollWheelZoom:false}).setView(defaultCenter,7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',{maxZoom:19,opacity:.86,attribution:'© OpenRailwayMap / OpenStreetMap'}).addTo(map);
  L.control.scale({imperial:false}).addTo(map);
  networkGroup.current=L.layerGroup().addTo(map);lineGroup.current=L.layerGroup().addTo(map);hectoGroup.current=L.layerGroup().addTo(map);markerGroup.current=L.layerGroup().addTo(map);nationalKmGroup.current=L.layerGroup().addTo(map);mapRef.current=map;
  const refresh=()=>setViewport({zoom:map.getZoom(),bounds:map.getBounds()});map.on('moveend zoomend',refresh);refresh();
  setTimeout(()=>map.invalidateSize(),150);
  return()=>{map.remove();mapRef.current=null;networkGroup.current=null;lineGroup.current=null;hectoGroup.current=null;markerGroup.current=null;nationalKmGroup.current=null;};
 },[]);
 // Camada nacional verdadeira, pré-integrada durante a compilação. Visível sem importar linhas.
 useEffect(()=>{if(!networkGroup.current)return;networkGroup.current.clearLayers();
  if(!Array.isArray(network?.linhas))return;
  for(const line of network.linhas)for(const seg of line.segmentos||[]){
   if(!Array.isArray(seg.coords)||seg.coords.length<2)continue;
   L.polyline(seg.coords,{color:'#647c8e',weight:2,opacity:0.5,interactive:false}).addTo(networkGroup.current);
  }
 },[network]);
 useEffect(()=>{
  if(!mapRef.current||!lineGroup.current)return;
  const map=mapRef.current,group=lineGroup.current;group.clearLayers();
  const all=[];
  if(showRail){
   const coords=route?.coords?.length?route.coords:null;
   if(coords){L.polyline(coords,{color:'#087e61',weight:6,opacity:.92}).on('click',e=>onPick(e.latlng)).bindTooltip('Selecionar PK no eixo').addTo(group);all.push(...coords);}
   else for(const segment of segments||[]){if(segment.coords?.length>1){L.polyline(segment.coords,{color:'#087e61',weight:3,opacity:.83}).on('click',e=>onPick(e.latlng)).bindTooltip('Eixo OSM — PK ainda não calibrado').addTo(group);all.push(...segment.coords);}}
  }
  for(const a of calibration?.anchors||[]){L.circleMarker([a.lat,a.lng],{radius:5,color:'#2269aa',fillColor:'#b0d8ff',fillOpacity:1}).bindTooltip(`Referência PK ${formatPK(a.pk)} · ${Math.round(a.snapDistance)} m do eixo`).addTo(group);}
  if(validGPS(selectedPoint?.lat,selectedPoint?.lng)){
   L.circleMarker([selectedPoint.lat,selectedPoint.lng],{radius:10,color:'#f0a31c',weight:3,fillColor:'#ffedba',fillOpacity:1}).bindPopup(`${selectedPoint.pk!=null?'PK '+formatPK(selectedPoint.pk):'Coordenada no eixo'} · ${coord(selectedPoint)}`).addTo(group);
  }
  if(all.length){map.fitBounds(L.latLngBounds(all).pad(.10),{maxZoom:12});}
  else{map.setView(defaultCenter,7);}
 },[route,segments,calibration,onPick,showRail]);
 // PK nacionais (quilómetros inteiros) aparecem em todas as linhas calibráveis.
 // Nos níveis regionais, reduzir a densidade para não tapar a cartografia.
 useEffect(()=>{
  const group=nationalKmGroup.current;if(!group)return;group.clearLayers();
  if(!showNationalKm)return;
  const zoom=viewport.zoom,bounds=viewport.bounds;
  const div=zoom<=7?20000:zoom===8?10000:zoom===9?5000:zoom===10?2000:1000;
  const raw=(nationalKm||[]).filter(m=>m.pk%div===0);
  const viewportBox=bounds?{south:bounds.getSouth(),north:bounds.getNorth(),west:bounds.getWest(),east:bounds.getEast()}:null;
  const markers=visibleNationalMarkers(raw,viewportBox,zoom,{maxVisible:zoom<=8?75:zoom<=10?170:350});
  for(const m of markers){
   const label=`${m.line} · PK ${m.label} — ${m.status}`;
   const shape=L.circleMarker([m.lat,m.lng],{radius:zoom>=12?5:4,color:m.verified?'#13764b':'#7742a8',weight:2,fillColor:m.verified?'#abf0ce':'#f0dcff',fillOpacity:0.95});
   shape.bindTooltip(`PK ${m.label}`,{permanent:zoom>=10,direction:'top',className:'rjp-national-km-label',opacity:.93});
   shape.bindPopup(`<strong>${m.line}</strong><div>PK ${m.label}</div><small>${m.status}</small>`);
   shape.addTo(group);
  }
 },[nationalKm,showNationalKm,viewport]);
 useEffect(()=>{
  const map=mapRef.current,virtual=hectoGroup.current,real=markerGroup.current;
  if(!map||!virtual||!real)return;
  virtual.clearLayers();real.clearLayers();
  if(!showHectometers)return;
  const bounds=viewport.bounds,zoom=viewport.zoom;
  // Evitar milhares de elementos DOM e rótulos sobrepostos no nível nacional.
  if(zoom>=10){
   for(const m of milestones){
    if(bounds&&!bounds.contains([m.lat,m.lng]))continue;
    const color=m.usable?'#1164a4':'#bc6b18';
    L.circleMarker([m.lat,m.lng],{radius:6,color:'#fff',weight:1.5,fillColor:color,fillOpacity:0.97})
     .bindTooltip(`Marco OSM · PK ${formatPK(m.pk)} · ${m.usable?'por validar':'inconsistente'}${m.physical?' · marco físico cartografado':''}`)
     .on('click',()=>onPick(L.latLng(m.lat,m.lng))).addTo(real);
   }
  }
  if(zoom>=11){
   // Apenas os hectómetros da área visível. Sem âncoras, não há hectómetros inventados.
   const visible=hectometers.filter(h=>!bounds||bounds.contains([h.lat,h.lng]));
   const stride=zoom>=14?1:zoom>=12?2:5;
   for(let i=0;i<visible.length;i+=stride){
    const h=visible[i];
    L.circleMarker([h.lat,h.lng],{radius:zoom>=14?4:3,color:'#7843a0',weight:1,fillColor:'#f0dcff',fillOpacity:0.9})
     .bindTooltip(`Hectómetro estimado · PK ${h.label} · não certificado`,{permanent:zoom>=15,direction:'right',opacity:0.9})
     .on('click',()=>onPick(L.latLng(h.lat,h.lng))).addTo(virtual);
   }
  }
 },[showHectometers,hectometers,milestones,viewport,onPick]);
 useEffect(()=>{if(validGPS(selectedPoint?.lat,selectedPoint?.lng)&&mapRef.current){mapRef.current.setView([selectedPoint.lat,selectedPoint.lng],Math.max(mapRef.current.getZoom(),13));}},[selectedPoint]);
 return <div ref={mapElement} className="leaflet-map national-map" aria-label="Mapa da Rede Ferroviária Nacional"/>;
}

export default function NationalNavigator({oesteRoute=null,obterGPS,network=null,networkLoading=false,networkError='',pkReferences=null,pkStatus='',focusLine='',gpsNear=null,initialLine='oeste'}){
 const [store,setStore]=useState(load),[lineId,setLineId]=useState(initialLine),[customName,setCustomName]=useState('');
 const [segmentIndex,setSegmentIndex]=useState(0);
 const [busy,setBusy]=useState(false),[milestoneBusy,setMilestoneBusy]=useState(false),[showHectometers,setShowHectometers]=useState(true),[showNationalKm,setShowNationalKm]=useState(true),[notice,setNotice]=useState(''),[searchPK,setSearchPK]=useState('115+350');
 const [selectedPoint,setSelectedPoint]=useState(null),[admin,setAdmin]=useState(null),[adminError,setAdminError]=useState(''),[road,setRoad]=useState(null),[roadBusy,setRoadBusy]=useState(false),[roadError,setRoadError]=useState('');
 const [anchorForm,setAnchorForm]=useState({pk:'',lat:'',lng:'',verified:false,note:''});
 const geoInput=useRef(),csvInput=useRef(),backupInput=useRef();
 const anchors=store.anchors||EMPTY_OBJECT,routes=store.routes||EMPTY_OBJECT,segmentsByLine=store.segments||EMPTY_OBJECT,names=store.names||EMPTY_OBJECT,milestonesByLine=store.milestones||EMPTY_OBJECT;
 const idForNetwork=(name)=>idForLine(name)||String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const nationalKmLayer=useMemo(()=>buildNationalKilometerLayer(network,{referenceSets:pkReferences?.lines||{},presets:NATIONAL_PRESETS}),[network,pkReferences]);
 const fromNetwork=(network?.linhas||[]).map(x=>({id:idForNetwork(x.nome),nome:x.nome}));
 const opts=[...fromNetwork,...RAIL_LINES,...Object.entries(names).map(([id,nome])=>({id,nome}))].filter((x,i,all)=>all.findIndex(v=>v.id===x.id)===i);
 const line=opts.find(x=>x.id===lineId)||opts[0]||RAIL_LINES[0];
 const networkLine=(network?.linhas||[]).find(x=>idForNetwork(x.nome)===lineId);
 const nationalSegments=networkLine?.segmentos||EMPTY_ARRAY;
 const currentSegments=segmentsByLine[lineId]?.length?segmentsByLine[lineId]:nationalSegments;
 const selectedNetworkSegment=nationalSegments[segmentIndex]||null;
 const currentRoute=useMemo(()=>{
  if(routes[lineId])return routes[lineId];
  if(selectedNetworkSegment?.coords?.length>1){
   try{return makeRoute(selectedNetworkSegment.coords,'Rede Ferroviária Nacional integrada — PK por validar');}catch{return null;}
  }
  return lineId==='oeste'?oesteRoute:null;
 },[routes,lineId,selectedNetworkSegment,oesteRoute]);
 const preset=NATIONAL_PRESETS?.[`${line.nome}|${segmentIndex}`];
 const convertedAnchors=useMemo(()=>(preset?.anchors||EMPTY_ARRAY).map(a=>a.position==='start'?{...a,lat:currentRoute?.coords?.[0]?.[0],lng:currentRoute?.coords?.[0]?.[1],verified:false}:
  a.position==='end'?{...a,lat:currentRoute?.coords?.at(-1)?.[0],lng:currentRoute?.coords?.at(-1)?.[1],verified:false}:{...a,verified:false}),[preset,currentRoute]);
 const lineAnchors=anchors[lineId]?.length>=2?anchors[lineId]:convertedAnchors;
 useEffect(()=>{setSegmentIndex(0)},[lineId]);
 useEffect(()=>{if(!focusLine)return;const id=idForNetwork(focusLine);if(opts.some(o=>o.id===id))setLineId(id);},[focusLine,network]);
 const markerKey=`${lineId}|${segmentIndex}`;
 const bundledMilestones=pkReferences?.lines?.[`${line.nome}|${segmentIndex}`]||EMPTY_ARRAY;
 const osmMilestones=milestonesByLine[markerKey]||milestonesByLine[lineId]||EMPTY_ARRAY;
 const combinedMilestones=useMemo(()=>{const ids=new Set();return [...bundledMilestones,...osmMilestones].filter(m=>{const k=m.osmId||`${m.pk}:${m.lat}:${m.lng}`;if(ids.has(k))return false;ids.add(k);return true;});},[bundledMilestones,osmMilestones]);
 const baseCalibration=useMemo(()=>calibrateReferences(currentRoute,lineAnchors),[currentRoute,lineAnchors]);
 const evaluatedMilestones=useMemo(()=>assessMilestones(combinedMilestones,baseCalibration),[combinedMilestones,baseCalibration]);
 const enhanced=useMemo(()=>improveCalibrationWithMilestones(currentRoute,lineAnchors,evaluatedMilestones),[currentRoute,lineAnchors,evaluatedMilestones]);
 const calibration=useMemo(()=>calibrateReferences(currentRoute,enhanced.anchors),[currentRoute,enhanced.anchors]);
 const diagnostics=useMemo(()=>calibrationDiagnostics(calibration),[calibration]);
 const hectometers=useMemo(()=>generateHectometers(calibration),[calibration]);
 const update=(patch)=>{const next={...store,...patch};if(!save(next)){setNotice('O armazenamento local está cheio. Exporta primeiro uma cópia e importa geometria simplificada.');return false;}setStore(next);return true;};
 const attemptedMilestones=useRef(new Set());
 useEffect(()=>{
  if(!currentRoute?.coords?.length||bundledMilestones.length>=2||Object.hasOwn(milestonesByLine,markerKey)||attemptedMilestones.current.has(markerKey))return;
  attemptedMilestones.current.add(markerKey);
  fetchMilestones(true);
 },[lineId,segmentIndex,currentRoute,bundledMilestones.length]);
 useEffect(()=>{setSelectedPoint(null);setAdmin(null);setRoad(null);setAdminError('');setRoadError('');},[lineId]);
 const getArea=async p=>{setAdmin(null);setAdminError('');try{const area=await reverseAdministrative(p);setAdmin(area);}catch(e){setAdminError('Freguesia/concelho/distrito indisponíveis sem serviço de consulta: '+e.message);}};
 const pick=React.useCallback((p)=>{
  const route=currentRoute,segs=currentSegments;
  const calibrationNow=calibration;
  const closest=route?nearestOnLine(p,route):null;
  if(route&&closest?.distance>120){setNotice(`Seleciona mais perto do eixo da linha; afastamento: ${Math.round(closest.distance)} m.`);return;}
  const found=pkForPoint(p,calibrationNow),snap=found||closest;
  const position=snap?{...snap,pk:found?.pk??null,status:found?.status||'PK indisponível — faltam referências',distance:closest?.distance??null}:{lat:p.lat,lng:p.lng,pk:null,status:'Eixo OSM visível, sem caminho contínuo calibrado'};
  setSelectedPoint(position);setAdmin(null);setRoad(null);setAdminError('');setRoadError('');
  getArea(position);
 },[lineId,currentRoute,currentSegments,calibration]);
 const persistRoute=(route)=>{update({routes:{...routes,[lineId]:route},segments:{...segmentsByLine,[lineId]:[]}});};
 const importRoute=async f=>{
  if(!f)return;try{const route=lineFromGeoJSON(JSON.parse(await f.text()));
   if(persistRoute(route))setNotice(`Eixo da ${line.nome} importado: ${(route.length/1000).toFixed(2)} km. É necessária calibração por PK.`);
  }catch(e){setNotice(`Não foi possível importar o traçado: ${e.message}`);}finally{if(geoInput.current)geoInput.current.value='';}
 };
 const importAnchors=async f=>{
  if(!f)return;try{const {anchors:newAnchors,errors}=parseAnchorCSV(await f.text());
   const next={...anchors},newNames={...names};for(const a of newAnchors){next[a.lineId]=[...(next[a.lineId]||[]).filter(x=>x.pk!==a.pk),a];if(!RAIL_LINES.some(x=>x.id===a.lineId))newNames[a.lineId]=a.lineName;}
   if(update({anchors:next,names:newNames}))setNotice(`${newAnchors.length} referências PK/GPS importadas para ${new Set(newAnchors.map(x=>x.lineId)).size} linhas. ${errors.length} registos ignorados. Os dados CSV ainda carecem de validação técnica.`);
  }catch(e){setNotice('Erro no CSV: '+e.message);}finally{if(csvInput.current)csvInput.current.value='';}
 };
 const addAnchor=()=>{
  const pk=parsePK(anchorForm.pk),lat=Number(anchorForm.lat.replace(',','.')),lng=Number(anchorForm.lng.replace(',','.'));
  if(pk==null||anchorForm.lat.trim()===''||anchorForm.lng.trim()===''||lat<36||lat>43||lng< -10||lng> -5.5){setNotice('PK/GPS inválidos para Portugal. Preenche PK, latitude e longitude WGS84.');return;}
  if(anchorForm.verified&&!confirm('Tens uma fonte topográfica/IP que confirma a correspondência exata deste PK e destas coordenadas?'))return;
  const a={lineId,pk,lat,lng,source:anchorForm.note||'Registo manual',verified:anchorForm.verified};
  const next={...anchors,[lineId]:[...lineAnchors.filter(x=>x.pk!==pk),a].sort((x,y)=>x.pk-y.pk)};
  if(update({anchors:next})){setNotice(`Referência PK ${formatPK(pk)} guardada na ${line.nome}.`);setAnchorForm({pk:'',lat:'',lng:'',verified:false,note:''});}
 };
 const addCustom=()=>{const name=customName.trim();if(name.length<4)return setNotice('Indica o nome da linha/ramal.');const id=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(update({names:{...names,[id]:name}})){setLineId(id);setCustomName('');setNotice(`Linha «${name}» adicionada. Importa o eixo e as referências para obter PK.`);}
 };
 async function fetchLineOSM(){
  setBusy(true);setNotice('A procurar relação cartográfica da linha no OpenStreetMap; pode demorar...');
  try{
   const first=await fetchOverpass(relationSearchQuery(line.nome));const relations=first.elements.filter(x=>x.type==='relation');
   if(!relations.length)throw Error('Não foi encontrada uma relação ferroviária com este nome. Podes importar GeoJSON oficial ou usar outra designação de linha.');
   const matching=relations.find(x=>String(x.tags?.name||'').toLowerCase()===line.nome.toLowerCase())||relations[0];
   if(relations.length>1)setNotice(`${relations.length} relações encontradas; usada ${matching.id} (${matching.tags?.name}). Confirmar itinerário.`);
   const second=await fetchOverpass(relationWaysQuery(matching.id));const segs=waysToSegments(second.elements);
   if(!segs.length)throw Error('Não foi possível obter geometrias ferroviárias da relação OSM.');
   // A visualização segmentada é segura, mas para calibrar é obrigatório eixo contínuo.
   let route=null;const refs=[...lineAnchors].sort((a,b)=>a.pk-b.pk);
   if(refs.length>=2){try{route=pathBetweenAnchors(second.elements,refs[0],refs.at(-1));}catch(e){setNotice(`Linha OSM recebida, mas sem caminho contínuo calibrável: ${e.message}`);}}
   const slim=segs.map(({coords,id})=>({id,coords}));
   if(update({segments:{...segmentsByLine,[lineId]:slim},routes:route?{...routes,[lineId]:route}:routes})){
    setNotice(`${line.nome}: ${segs.length} segmentos OSM carregados.${route?' Eixo contínuo entre referências criado.':' Para localizar PK falta eixo contínuo e duas referências.'} Dados cartográficos não certificados.`);
   }
  }catch(e){setNotice(`Consulta OSM falhou: ${e.message}`);}finally{setBusy(false);}
 }
 async function fetchMilestones(silent=false,routeOverride=null){
  const active=routeOverride||currentRoute;
  if(!active?.coords?.length){if(!silent)setNotice('Para procurar marcos, primeiro carrega um eixo contínuo para esta linha.');return;}
  if(milestoneBusy)return;
  setMilestoneBusy(true);
  if(!silent)setNotice(`A procurar marcos ferroviários OSM da ${line.nome}. A consulta pode demorar.`);
  try{
   const result=await fetchOverpass(milestoneQueryForRoute(active));
   const raw=parseMilestoneOSM(result.elements,active,{maxDistance:45});
   const assessed=assessMilestones(raw,calibrateReferences(active,lineAnchors));
   const upgraded=improveCalibrationWithMilestones(active,lineAnchors,assessed);
   const stored={...milestonesByLine,[markerKey]:assessed};
   if(update({milestones:stored}))setNotice(`Marcos OSM: ${raw.length} georreferenciados, ${upgraded.accepted.length} referências adicionais compatíveis e ${upgraded.rejected.length} rejeitadas. Dados OSM não certificados.`);
  }catch(e){setNotice(`Não foi possível obter os marcos OSM: ${e.message}. Mantém-se a calibração anterior.`);}
  finally{setMilestoneBusy(false);}
 }
 function findPK(){const pk=parsePK(searchPK);if(pk==null){setNotice('Introduz o PK, por exemplo 115+350.');return;}
  const result=pointForPK(pk,calibration);
  if(!result){setSelectedPoint(null);setAdmin(null);setRoad(null);setNotice(!calibration.ready?calibration.reason:`O PK ${formatPK(pk)} está fora do intervalo calibrado (${formatPK(calibration.span[0])} a ${formatPK(calibration.span[1])}). Não vamos extrapolar.`);return;}
  setSelectedPoint(result);setRoad(null);getArea(result);setNotice(`${line.nome}, PK ${formatPK(pk)}: ${result.status}.`);
 }
 async function findRoad(withGps=false){if(!validGPS(selectedPoint?.lat,selectedPoint?.lng))return;setRoadBusy(true);setRoadError('');setRoad(null);
  try{const origin=withGps&&obterGPS?await obterGPS():null;const result=await findRoadAccess(selectedPoint,origin);setRoad(result.recommended);}catch(e){setRoadError(e.message);}finally{setRoadBusy(false);}
 }
 const exportJSON=()=>downloadText(JSON.stringify({version:'4.2.4',exportedAt:new Date().toISOString(),...store},null,2),'RJP_Navigator_RFN_Calibracao_Backup.json','application/json');
 const exportCSV=()=>{const items=Object.entries(anchors).flatMap(([id,refs])=>refs.map(a=>[names[id]||RAIL_LINES.find(x=>x.id===id)?.nome||id,formatPK(a.pk),a.lat,a.lng,a.verified?'Sim':'Não',a.source]));
  const csv='\uFEFF'+[['linha','pk','latitude','longitude','validado','fonte'],...items].map(row=>row.map(v=>'"'+String(v||'').replaceAll('"','""')+'"').join(';')).join('\r\n');downloadText(csv,'RJP_Navigator_RFN_Referencias.csv','text/csv;charset=utf-8');};
 const importBackup=async f=>{if(!f)return;try{const data=JSON.parse(await f.text());if(!data||typeof data!=='object'||!data.anchors||!data.routes)throw Error('Formato inválido');
  if(!confirm('Substituir os dados nacionais guardados neste dispositivo pelos do backup?'))return;
  if(update({anchors:data.anchors,routes:data.routes,segments:data.segments||{},names:data.names||{},milestones:data.milestones||{}}))setNotice('Backup nacional importado.');
 }catch(e){setNotice('Backup inválido: '+e.message);}finally{if(backupInput.current)backupInput.current.value='';}};
 const routeStatus=calibration.ready?`Calibração estimada entre ${formatPK(calibration.span[0])} e ${formatPK(calibration.span[1])} — ${calibration.anchors.length} referências${calibration.verified?' verificadas':' (algumas por validar)'}`:calibration.reason;
 const linesWithAnchors=new Set([...Object.entries(anchors).filter(([,a])=>a.length>=2).map(([k])=>k),...Object.entries(pkReferences?.lines||{}).filter(([,a])=>a.length>=2).map(([key])=>key.split('|')[0])]).size;
 return <main className="national-view">
  <section className="card national-lead"><div><h2>Rede Ferroviária Nacional · V4.2.4</h2><p>Geometria de toda a rede incorporada na WebApp/APK e motor de calibração por linha. A Linha do Oeste mantém a sua área de responsabilidade no separador original.</p></div>
   <div className="national-stats"><span><b>{opts.length}</b> linhas no catálogo</span><span><b>{nationalKmLayer.calibrated}/{nationalKmLayer.segments}</b> troços com PK indicativos</span><span><b>{linesWithAnchors}</b> com ≥2 referências</span><span><b>{(network?.linhas||[]).reduce((n,l)=>n+(l.segmentos?.filter(s=>s.coords?.length>1).length||0),0)}</b> segmentos nacionais disponíveis</span></div>
  </section>
  <p className="footnote national-pk-load"><strong>Referências quilométricas nacionais:</strong> {pkStatus||"A verificar…"}. Apenas referências compatíveis com o troço são utilizadas; os marcos OSM não são certificados.</p>
  <section className="national-layout">
   <div className="card national-side">
    {networkLoading&&<p>A carregar a geometria de toda a rede ferroviária…</p>}
    {networkError&&<p className="warning">{networkError}</p>}
    <h3>Selecionar linha</h3><select aria-label="Linha ferroviária" value={lineId} onChange={e=>setLineId(e.target.value)}>{opts.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select>
    {nationalSegments.length>1&&<label>Troço da linha <select aria-label="Troço ferroviário" value={segmentIndex} onChange={e=>setSegmentIndex(Number(e.target.value))}>{nationalSegments.map((seg,i)=><option value={i} key={i}>Troço {i+1} · {Array.isArray(seg.coords)?seg.coords.length:0} vértices</option>)}</select></label>}
    <p className="footnote">{network?.linhas?.length||0} linhas na base nacional, {nationalSegments.length} troços na linha selecionada. A geometria é integrada no pacote; PK estimados apenas entre referências compatíveis.</p>
    <p className="footnote">{NATIONAL_CATALOGUE_NOTE}</p>
    <p><strong>Estado:</strong> {routeStatus}</p>
    <p className="footnote">O eixo nacional vem do pacote compilado, sem importação manual. As imagens de ruas (OpenStreetMap) e a atualização de estradas continuam a precisar de internet.</p>
    <button type="button" disabled={busy} onClick={fetchLineOSM}>{busy?'A consultar OSM...':'Procurar eixo OSM desta linha'}</button>
    <button type="button" disabled={milestoneBusy||!currentRoute} onClick={()=>fetchMilestones(false)}>{milestoneBusy?'A procurar marcos...':'Procurar marcos PK no OpenStreetMap'}</button>
    <label className="national-check national-km-toggle"><input type="checkbox" checked={showNationalKm} onChange={e=>setShowNationalKm(e.target.checked)}/> Mostrar quilómetros (PK) de toda a Rede Nacional</label>
    <p className="footnote">PK nacionais desenhados: {nationalKmLayer.markers.length} pontos de quilómetro inteiro em {nationalKmLayer.calibrated} troços; {nationalKmLayer.withoutPK} troços sem referências adequadas. Aproxima o mapa para veres mais rótulos. <strong>Valores estimados, não certificados</strong> salvo validação explícita.</p>
    <label className="national-check hecto-toggle"><input type="checkbox" checked={showHectometers} onChange={e=>setShowHectometers(e.target.checked)}/> Mostrar hectométricos (100 m) e marcos OSM da linha selecionada</label>
    <p className="footnote">Hectómetros estimados: {hectometers.length} · Marcos OSM na linha/troço: {combinedMilestones.length} (incorporados: {bundledMilestones.length}) · Aceites como referências adicionais: {enhanced.accepted.length}. Os marcadores são desenhados ao aproximar o mapa (zoom 11+).</p>
    {calibration.ready&&<p className="footnote">Calibração: {diagnostics.quality}; {diagnostics.warnings} intervalos com alertas; maior distância entre âncoras: {Math.round(diagnostics.worstGapMeters||0)} m. Nenhum marco OSM é certificado automaticamente.</p>}
    <label className="file-action national-file">Importar eixo GeoJSON WGS84<input ref={geoInput} type="file" accept=".geojson,.json" onChange={e=>importRoute(e.target.files?.[0])}/></label>
    <div className="national-separator"><h3>PK nesta linha</h3>
     <div className="inline-fields"><input aria-label="PK nacional" value={searchPK} onChange={e=>setSearchPK(e.target.value)} placeholder="Ex.: 115+350"/><button type="button" onClick={findPK}>Localizar PK</button></div>
     <p className="footnote">Nunca se extrapola um PK para fora de dois pontos de referência. Não são confundidos quilómetros de linhas diferentes.</p>
    </div>
    <div className="national-separator"><h3>Adicionar linha/ramal</h3><div className="inline-fields"><input aria-label="Nome nova linha" value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Designação ferroviária"/><button onClick={addCustom}>Adicionar</button></div></div>
   </div>
   <section className="card national-map-card"><h3>Mapa ferroviário de Portugal</h3>
    {gpsNear&&<div className="national-message"><strong>GPS: {gpsNear.line}</strong> · {gpsNear.pkLabel?'PK '+gpsNear.pkLabel+' (estimado)':'PK sem calibração'} · {gpsNear.offsetMeters} m até ao eixo. {gpsNear.calibrationStatus}</div>}
    <NationalMap route={calibration.route||currentRoute} segments={currentSegments} network={network} calibration={calibration} selectedPoint={selectedPoint} onPick={pick} showHectometers={showHectometers} hectometers={hectometers} milestones={evaluatedMilestones} nationalKm={nationalKmLayer.markers} showNationalKm={showNationalKm}/>
    <p className="footnote">Toca no eixo realçado para obter coordenadas. Camada opcional: roxo = hectómetros virtuais de 100 m (visíveis com zoom ≥ 11); azul = marcos OSM coerentes por validar; laranja = marcos OSM discordantes. A posição não substitui a referenciação oficial.</p>
    {notice&&<div className="national-message">{notice}<button onClick={()=>setNotice('')} aria-label="Fechar aviso">×</button></div>}
    {selectedPoint&&<div className="national-result"><h3>{selectedPoint.pk!=null?`PK ${formatPK(selectedPoint.pk)}`:'Ponto ferroviário (PK ainda não calibrado)'}</h3>
     <dl><dt>Linha</dt><dd>{line.nome}</dd><dt>GPS ferroviário</dt><dd>{coord(selectedPoint)}</dd><dt>Estado</dt><dd>{selectedPoint.status}</dd>
      <dt>Freguesia</dt><dd>{admin?.freguesia||'Por determinar'}</dd><dt>Concelho</dt><dd>{admin?.concelho||'Por determinar'}</dd><dt>Distrito</dt><dd>{admin?.distrito||'Por determinar'}</dd></dl>
     {adminError&&<p className="warning">{adminError}</p>}
     <div className="actions"><a href={osmLink(selectedPoint)} target="_blank" rel="noreferrer">OpenRailwayMap</a><button onClick={()=>findRoad(false)} disabled={roadBusy}>{roadBusy?'A procurar estrada...':'Procurar estrada próxima'}</button><button onClick={()=>findRoad(true)} disabled={roadBusy}>Comparar acessos com GPS</button></div>
     {roadError&&<p className="warning">{roadError}</p>}
     {road&&<div className="road-result"><h3>Estrada sugerida · {Math.round(road.gapMeters)} m em linha reta do eixo</h3><p>{road.name||'Estrada'} · Acesso não validado{road.durationMin!=null?` · ${road.durationMin} min de condução estimada (sem trânsito)`:''}</p><div className="actions"><a href={maps(road)} target="_blank" rel="noreferrer">Google Maps</a><a href={waze(road)} target="_blank" rel="noreferrer">Waze</a></div><p className="road-caution">Confirmar no terreno se é via pública e existe acesso legal e seguro à ferrovia.</p></div>}
    </div>}
   </section>
  </section>
  <section className="card national-data"><h2>Calibração nacional por referências PK/GPS</h2><p>Importa de uma só vez referências de várias linhas. Cada par de coordenadas é associado à respetiva linha, e as estimativas são interpoladas apenas entre referências coerentes.</p>
   <div className="actions"><label className="file-action">Importar CSV de referências<input ref={csvInput} type="file" accept=".csv,.txt,text/csv" onChange={e=>importAnchors(e.target.files?.[0])}/></label><button onClick={exportCSV}>Exportar referências CSV</button><button onClick={exportJSON}>Backup nacional JSON</button><label className="file-action">Restaurar backup JSON<input ref={backupInput} type="file" accept=".json" onChange={e=>importBackup(e.target.files?.[0])}/></label></div>
   <code>linha;pk;latitude;longitude</code><pre className="national-csv">Linha do Oeste;21+191;38.7975269;-9.3131841{String.fromCharCode(10)}Linha do Oeste;191+191;40.0099762;-8.8131480</pre>
   <p className="footnote"><strong>Exemplo de formato, não dados certificados.</strong> Os extremos do Oeste vieram de imagens com sistema de coordenadas ainda por confirmar; não ficam automaticamente classificados como verificados.</p>
   <div className="national-separator"><h3>Adicionar referência individual — {line.nome}</h3>
    <div className="national-fields"><input aria-label="PK da referência" placeholder="PK (ex.: 25+378)" value={anchorForm.pk} onChange={e=>setAnchorForm({...anchorForm,pk:e.target.value})}/><input aria-label="Latitude da referência" placeholder="Latitude WGS84" value={anchorForm.lat} onChange={e=>setAnchorForm({...anchorForm,lat:e.target.value})}/><input aria-label="Longitude da referência" placeholder="Longitude WGS84" value={anchorForm.lng} onChange={e=>setAnchorForm({...anchorForm,lng:e.target.value})}/><input aria-label="Fonte da referência" placeholder="Fonte / observações" value={anchorForm.note} onChange={e=>setAnchorForm({...anchorForm,note:e.target.value})}/></div>
    <label className="national-check"><input type="checkbox" checked={anchorForm.verified} onChange={e=>setAnchorForm({...anchorForm,verified:e.target.checked})}/> Referência PK/GPS confirmada em levantamento ou fonte oficial comprovada</label>
    <button onClick={addAnchor}>Guardar referência</button>
   </div>
   <div className="table-scroll"><table><thead><tr><th>PK</th><th>Latitude</th><th>Longitude</th><th>Estado</th><th>Fonte</th></tr></thead><tbody>{[...lineAnchors].sort((a,b)=>a.pk-b.pk).map((a,i)=><tr key={i}><td>{formatPK(a.pk)}</td><td>{a.lat}</td><td>{a.lng}</td><td>{a.verified?'Confirmado':'Por validar'}</td><td>{a.source||'—'}</td></tr>)}{lineAnchors.length===0&&<tr><td colSpan="5">Nenhuma referência disponível nesta linha.</td></tr>}</tbody></table></div>
   <p className="footnote">Fontes: Infraestruturas de Portugal (RFN, estações e PK verificados), Direção-Geral do Território (CAOP) e OpenStreetMap/OpenRailwayMap. A V4.2 ainda não inclui um cadastro nacional oficial completo dos PK; não é apropriado usar estimativas como coordenadas de segurança operacional.</p>
  </section>
 </main>;
}
