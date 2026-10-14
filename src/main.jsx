import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {estacoesLinhaOeste} from './data/estacoes.js';
import {passagensNivelLinhaOeste} from './data/passagensNivel.js';
import {marcosKmLinhaOeste,marcosPrincipaisLinhaOeste} from './data/marcosKm.js';
import limite from './data/limites.json';
import {PK_START,PK_END,parsePK,formatPK,validGPS,parseRouteGeoJSON,orientAndValidateRoute,interpolatePK,deriveAssetLocation,downloadText,makeKML} from './lib/rail.js';
import {fetchOverpass,createRouteFromOSM,parseOSMAssets,associateOSM,closestOnRoute,REL_QUERY,ASSET_QUERY} from './lib/osm.js';
import {fetchBundledCartography} from './lib/preload.js';
import {findRoadAccess} from './lib/access.js';

const REF_START={lat:limite.responsibility_segment.points[0].wgs84.latitude,lng:limite.responsibility_segment.points[0].wgs84.longitude};
const REF_END={lat:limite.responsibility_segment.points[1].wgs84.latitude,lng:limite.responsibility_segment.points[1].wgs84.longitude};
const K={extras:'rjp_nav_locais_extra_v1',desloc:'rjp_nav_deslocacoes_v1',gps:'rjp_nav_gps_ativos_v2',pk:'rjp_nav_pk_ativos_v3',access:'rjp_nav_acessos_v3',route:'rjp_nav_traçado_v3',osm:'rjp_nav_osm_ativos_v33'};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const persist=(key,val)=>{try{localStorage.setItem(key,JSON.stringify(val));return true;}catch{alert('Sem espaço para guardar os dados neste dispositivo. Exporta os dados JSON e reduz o ficheiro de traçado.');return false;}};
const coord=(p)=>`${p.lat},${p.lng}`;
const pointMaps=(p)=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord(p))}`;
const routeMaps=(p)=>`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coord(p))}&travelmode=driving`;
const waze=(p)=>`https://waze.com/ul?ll=${encodeURIComponent(coord(p))}&navigate=yes`;
const railMap=(p)=>`https://www.openrailwaymap.org/?style=standard&lat=${p.lat}&lon=${p.lng}&zoom=15`;
const isPositioned=a=>validGPS(a?.lat,a?.lng);
const getBase=()=>[
 {id:'limite-inicial',key:'ref-inicial',titulo:'Limite inicial · PK 21+191',nome:'Início do troço de responsabilidade',pk:'21+191',categoria:'Marco Quilométrico',lat:REF_START.lat,lng:REF_START.lng,observacoes:'Coordenada fornecida pelo utilizador, conversão EPSG:3763 assumida e por confirmar.'},
 {id:'limite-final',key:'ref-final',titulo:'Limite final · PK 191+191',nome:'Fim do troço de responsabilidade',pk:'191+191',categoria:'Marco Quilométrico',lat:REF_END.lat,lng:REF_END.lng,observacoes:'Coordenada fornecida pelo utilizador, conversão EPSG:3763 assumida e por confirmar.'},
 ...estacoesLinhaOeste.map(s=>({...s,key:`est-${s.id}`,titulo:s.nome})),
 ...estacoesLinhaOeste.filter(s=>s.tipo.includes('Estação')).map(s=>({...s,key:`edf-${s.id}`,categoria:'Edifício',titulo:`EDF · ${s.nome}`,observacoes:'Edifício associado à estação; a posição do edifício tem de ser confirmada separadamente do eixo ferroviário.'})),
 ...passagensNivelLinhaOeste.map(p=>({...p,key:`pn-${p.id}`,titulo:`PN · PK ${p.pk} · ${p.nome}`})),
 ...marcosKmLinhaOeste.map(p=>({...p,key:`km-${p.id}`,titulo:p.nome}))
];
// Leaflet distribuído com a APK/WebApp: não depende de carregar JavaScript por CDN.
function ensureLeaflet(){return Promise.resolve(L);}
function Mapa({assets,route,selected,onSelect,roadAccess=null,railTarget=null}){
 const el=useRef(null),instance=useRef(null),overlay=useRef(null),layers=useRef(null);
 const [err,setErr]=useState('');const [railLayer,setRailLayer]=useState(true);
 useEffect(()=>{let alive=true;ensureLeaflet().then(L=>{if(!alive||!el.current)return;
  const map=L.map(el.current,{preferCanvas:true,scrollWheelZoom:false});
  map.fitBounds(L.latLngBounds([REF_START.lat,REF_START.lng],[REF_END.lat,REF_END.lng]).pad(.12));
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  overlay.current=L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',{maxZoom:19,opacity:.76,attribution:'© OpenRailwayMap / © OpenStreetMap contributors'});
  if(railLayer)overlay.current.addTo(map);
  layers.current=L.layerGroup().addTo(map);instance.current=map;
  L.control.scale({imperial:false}).addTo(map);
  setTimeout(()=>map.invalidateSize(),100);
  drawMap();
 }).catch(e=>alive&&setErr(e.message));return()=>{alive=false;if(instance.current){instance.current.remove();instance.current=null;}};
 },[]);
 useEffect(()=>{if(!instance.current||!overlay.current)return;if(railLayer&&!instance.current.hasLayer(overlay.current))overlay.current.addTo(instance.current);if(!railLayer&&instance.current.hasLayer(overlay.current))instance.current.removeLayer(overlay.current);},[railLayer]);
 function drawMap(){if(!layers.current)return;layers.current.clearLayers();
  if(route?.coords?.length>1)L.polyline(route.coords,{color:'#00b3b7',weight:5,opacity:.92}).bindTooltip('Linha do Oeste — eixo cartografado; PK por interpolação aproximada').addTo(layers.current);
  for(const [pk,p,name] of [[formatPK(PK_START),REF_START,'Início da responsabilidade'],[formatPK(PK_END),REF_END,'Fim da responsabilidade']]){
    L.circleMarker([p.lat,p.lng],{radius:9,color:'#0f4131',fillColor:'#ffda7c',weight:3,fillOpacity:1}).bindPopup(`${name}<br>PK ${pk}`).addTo(layers.current);
  }
  for(const a of assets){if(!isPositioned(a)||a.categoria==='Marco Quilométrico')continue;
   const color=a.gpsStatus==='Confirmado no terreno'?'#148657':a.gpsStatus?.startsWith('OSM')?'#3268b8':'#e3a02a';
   L.circleMarker([Number(a.lat),Number(a.lng)],{radius:a.key===selected?.key?8:5,color:'#fff',weight:1.5,fillColor:color,fillOpacity:.95})
    .bindTooltip(`${a.titulo} · ${a.gpsStatus}`).on('click',()=>onSelect(a.key)).addTo(layers.current);
  }
  if(isPositioned(railTarget))L.circleMarker([Number(railTarget.lat),Number(railTarget.lng)],{radius:10,color:'#ed8a15',weight:3,fillColor:'#ffdb92',fillOpacity:1}).bindPopup('PK ferroviário pesquisado — localização aproximada').addTo(layers.current);
  if(isPositioned(roadAccess)){
   L.circleMarker([Number(roadAccess.lat),Number(roadAccess.lng)],{radius:10,color:'#1460ae',weight:3,fillColor:'#b6defe',fillOpacity:1}).bindPopup(`Destino rodoviário sugerido · ${Math.round(roadAccess.gapMeters)} m em linha reta ao PK. Acesso não confirmado.`).addTo(layers.current);
  }
  if(isPositioned(selected)){L.circleMarker([Number(selected.lat),Number(selected.lng)],{radius:11,weight:3,color:'#004e33',fillColor:'#fff',fillOpacity:0.4}).addTo(layers.current);}
 }
 useEffect(()=>{if(!instance.current)return;drawMap(); },[assets,route,selected?.key,selected?.lat,selected?.lng,roadAccess?.lat,roadAccess?.lng,railTarget?.lat,railTarget?.lng]);
 useEffect(()=>{if(!instance.current)return;
  if(isPositioned(roadAccess)&&isPositioned(railTarget))instance.current.fitBounds(L.latLngBounds([[Number(railTarget.lat),Number(railTarget.lng)],[Number(roadAccess.lat),Number(roadAccess.lng)]]).pad(.55),{maxZoom:16});
  else if(isPositioned(selected)) instance.current.setView([Number(selected.lat),Number(selected.lng)],14);
  else if(route?.coords?.length>1)instance.current.fitBounds(L.latLngBounds(route.coords).pad(.07));
  else instance.current.fitBounds(L.latLngBounds([REF_START.lat,REF_START.lng],[REF_END.lat,REF_END.lng]).pad(.12));
  },[selected?.key,route,roadAccess?.lat,roadAccess?.lng,railTarget?.lat,railTarget?.lng]);
 return <div className="map-shell"><label className="check"><input type="checkbox" checked={railLayer} onChange={e=>setRailLayer(e.target.checked)}/> Realçar a rede ferroviária (OpenRailwayMap)</label>
   <div className="leaflet-map" ref={el} aria-label="Mapa interativo da Linha do Oeste"></div>{err&&<div className="warning">{err}. <a href={railMap(REF_START)} target="_blank" rel="noreferrer">Abrir mapa ferroviário externo</a>.</div>}
   <p className="footnote">O mapa abre diretamente; os dados completos são pré-carregados na APK quando a fonte responder durante a compilação, ou obtidos automaticamente. Amarelo = interpolação; azul = correspondência OSM; verde = GPS confirmado no terreno. As coordenadas OSM não equivalem a certificação IP. Acesso rodoviário deve ser confirmado.</p></div>;
}
function App(){
 const [tab,setTab]=useState('mapa'),[q,setQ]=useState(''),[tipo,setTipo]=useState('todos'),[selKey,setSelKey]=useState(''),[notice,setNotice]=useState('');
 const [loadingOSM,setLoadingOSM]=useState(false),[osmError,setOsmError]=useState(''),[preloadStatus,setPreloadStatus]=useState('A carregar mapa predefinido...');
 const [gps,setGps]=useState(null),[extras,setExtras]=useState(()=>read(K.extras,[])),[desloc,setDesloc]=useState(()=>read(K.desloc,[])),[gpsAtivos,setGpsAtivos]=useState(()=>read(K.gps,{})),[pkAtivos,setPkAtivos]=useState(()=>read(K.pk,{})),[accessos,setAccessos]=useState(()=>read(K.access,{})),[route,setRoute]=useState(()=>read(K.route,null)),[osmPoints,setOsmPoints]=useState(()=>read(K.osm,[]));
 const [accessLoading,setAccessLoading]=useState(false),[roadResult,setRoadResult]=useState(null),[roadError,setRoadError]=useState(''),[roadChoice,setRoadChoice]=useState('');
 const [pkBusca,setPkBusca]=useState('115+350'),[consulta,setConsulta]=useState(null),[pkEdit,setPkEdit]=useState(''),[manualEdit,setManualEdit]=useState({lat:'',lng:''}),[accessEdit,setAccessEdit]=useState({lat:'',lng:'',nota:''});
 useEffect(()=>{setManualEdit({lat:'',lng:''});setPkEdit('');},[selKey]);
 const [form,setForm]=useState({categoria:'Passagem de Nível',nome:'',pk:'',localidade:'',concelho:'',freguesia:'',observacoes:''});
 const importRef=useRef(null),jsonRef=useRef(null);
 const base=useMemo(()=>[...getBase(),...extras.map((x,i)=>({...x,key:x.key||`extra-${i}`,titulo:x.nome||x.pk||'Local registado'}))], [extras]);
 const gpsAnchors=useMemo(()=>{
  if(!route)return [];
  return base.filter(a=>parsePK(pkAtivos[a.key]||a.pk)!=null&&gpsAtivos[a.key]&&gpsAtivos[a.key].origin!=='manual'&&validGPS(gpsAtivos[a.key].lat,gpsAtivos[a.key].lng)).map(a=>{
   const p=closestOnRoute(gpsAtivos[a.key],route);return p&&p.distance<=200?{pk:parsePK(pkAtivos[a.key]||a.pk),along:p.along}:null;
  }).filter(Boolean);
 },[base,gpsAtivos,pkAtivos,route]);
 const osmAssociations=useMemo(()=>associateOSM(base,route,osmPoints),[base,route,osmPoints]);
 const assets=useMemo(()=>base.map(a=>deriveAssetLocation(a,gpsAtivos,pkAtivos,route,osmAssociations,gpsAnchors)),[base,gpsAtivos,pkAtivos,route,osmAssociations,gpsAnchors]);
 const indexed=useMemo(()=>new Map(assets.map(a=>[a.key,a])),[assets]);
 const countConfirmed=assets.filter(a=>a.gpsStatus==='Confirmado no terreno').length;
 const countEstimated=assets.filter(a=>a.gpsStatus?.includes('Estimado')||a.gpsStatus?.startsWith('OSM')).length;
 const osmMatched=Object.keys(osmAssociations).length;
 const filtered=useMemo(()=>assets.filter(a=>{
  const visible=tab==='pn'?a.categoria==='Passagem de Nível':tab==='km'?a.categoria==='Marco Quilométrico':true;
  const filter=tipo==='todos'||a.categoria===tipo;
  const text=[a.titulo,a.nome,a.pk,a.localidade,a.concelho,a.freguesia].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const search=q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return visible&&filter&&text.includes(search);
 }).sort((a,b)=>(parsePK(a.pk)??Number.MAX_SAFE_INTEGER)-(parsePK(b.pk)??Number.MAX_SAFE_INTEGER)),[assets,q,tipo,tab]);
 const selected=indexed.get(selKey)||null;const current=selected&&filtered.some(a=>a.key===selKey)?selected:filtered[0]||null;
 const access=current?accessos[current.key]:null;
 const estimatedPK=consulta!=null?interpolatePK(consulta,route,gpsAnchors):null;
 const pkSearchStatus=consulta==null?'':!estimatedPK?'A obter automaticamente o traçado da Linha do Oeste. É necessária internet caso a cartografia não tenha vindo incluída na APK.':'PK aproximado sobre a geometria ferroviária; confirmar com marcos/levantamento de campo antes de usar em obra.';
 function changeTab(next){setTab(next);setQ('');setTipo('todos');}
 async function localizarAcesso(point,origin=gps){
  if(!isPositioned(point)){setRoadError('Sem coordenada do PK: aguarda pelo traçado ferroviário.');return;}
  setAccessLoading(true);setRoadResult(null);setRoadError('');setRoadChoice('');
  try{
   const result=await findRoadAccess({lat:Number(point.lat),lng:Number(point.lng)},origin);
   setRoadResult(result);setRoadChoice(result.recommended.id);
   if(result.source==='osrm-fallback')setNotice('Ponto rodoviário encontrado por aproximação OSRM. Confirma a estrada antes de ir.');
  }catch(e){setRoadError(e.message||'Não foi possível calcular ponto rodoviário.');}
  finally{setAccessLoading(false);}
 }

 function setSelection(key){setSelKey(key);}
 async function obterGPS(){try{
  let pos;
  if(window.Capacitor?.isNativePlatform?.()){
   const {Geolocation}=await import('@capacitor/geolocation');const perm=await Geolocation.requestPermissions({permissions:['location']});
   if(!['granted'].includes(perm.location)&&!['granted'].includes(perm.coarseLocation))throw Error('Permissão de localização recusada.');
   pos=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:16000,maximumAge:0});
  }else{
   if(!navigator.geolocation)throw Error('Geolocalização indisponível.');
   pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:16000,maximumAge:0}));
  }
  const g={lat:Number(pos.coords.latitude.toFixed(7)),lng:Number(pos.coords.longitude.toFixed(7)),acc:Math.round(pos.coords.accuracy),time:new Date().toISOString()};setGps(g);setNotice(`GPS atualizado, precisão aproximada ±${g.acc} m.`);return g;
 }catch(e){alert(`Não foi possível obter GPS: ${e.message||'confirma as permissões de localização'}`);return null;}}
 function guardarGPS(a){if(!gps){alert('Carrega primeiro em «Atualizar GPS».');return;}
  if(!confirm(`Confirmas que estás fisicamente junto ao ativo ${a.titulo}? O GPS será marcado como localização confirmada no terreno.`))return;
  const next={...gpsAtivos,[a.key]:{...gps,data:new Date().toLocaleDateString('pt-PT'),hora:new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}};
  setGpsAtivos(next);persist(K.gps,next);setNotice('GPS de campo guardado com prioridade sobre estimativas.');}
 function guardarGPSManual(a){
  const lat=Number(manualEdit.lat.trim().replace(',','.')),lng=Number(manualEdit.lng.trim().replace(',','.'));
  if(!manualEdit.lat.trim()||!manualEdit.lng.trim()||!validGPS(lat,lng)){alert('Indica latitude e longitude válidas.');return;}
  if(!confirm('Guardar coordenada manual como não validada? Só um levantamento de campo pode confirmar a posição precisa.'))return;
  const next={...gpsAtivos,[a.key]:{lat,lng,origin:'manual',data:new Date().toISOString()}};
  setGpsAtivos(next);persist(K.gps,next);setNotice('Coordenadas introduzidas e assinaladas como não validadas.');
 }
 function guardarPK(a){const parsed=parsePK(pkEdit);if(parsed==null||parsed<PK_START||parsed>PK_END){alert('Introduz um PK válido entre 21+191 e 191+191.');return;}
  const next={...pkAtivos,[a.key]:formatPK(parsed)};setPkAtivos(next);persist(K.pk,next);setNotice('PK corrigido localmente. Podes exportar a base de dados JSON.');}
 function guardarAcesso(a){const lat=Number(accessEdit.lat.replace(',','.')),lng=Number(accessEdit.lng.replace(',','.'));
  if(!validGPS(lat,lng)||accessEdit.lat.trim()===''||accessEdit.lng.trim()===''){alert('Introduz latitude e longitude válidas do acesso rodoviário.');return;}
  if(!confirm('Confirma que este ponto é um acesso rodoviário público e autorizado. Não colocar a localização ferroviária como destino de condução.'))return;
  const next={...accessos,[a.key]:{lat,lng,nota:accessEdit.nota,confirmadoEm:new Date().toISOString()}};setAccessos(next);persist(K.access,next);setNotice('Acesso rodoviário registado para este ativo.');}
 function adicionarLocal(){if(!form.nome&&!form.pk){alert('Indica pelo menos um nome ou PK.');return;}
  if(parsePK(form.pk)==null){alert('Indica o PK no formato 115+350.');return;}
  const id=`extra-${Date.now()}`;const next=[{...form,id,key:id,linha:'Linha do Oeste',lat:gps?.lat||'',lng:gps?.lng||''},...extras];
  setExtras(next);persist(K.extras,next);setSelKey(id);changeTab('locais');setForm({categoria:'Passagem de Nível',nome:'',pk:'',localidade:'',concelho:'',freguesia:'',observacoes:''});}
 function registarDeslocacao(a){const next=[{id:Date.now(),data:new Date().toLocaleDateString('pt-PT'),hora:new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}),destino:a.titulo,pk:a.pk,gps:gps?coord(gps):''},...desloc];setDesloc(next);persist(K.desloc,next);setNotice('Deslocação registada.');}
 function exportarJSON(){downloadText(JSON.stringify({versao:'3.5.0',limites:limite,locaisExtras:extras,gpsAtivos,pkAtivos,accessos,deslocacoes:desloc,tracado:route,osmPontos:osmPoints},null,2),'RJP_Navigator_Linha_do_Oeste_Dados.json','application/json');}
 function exportarCSV(){
  const data=[['Categoria','Designação','PK','Latitude','Longitude','Origem GPS','Observações'],...assets.map(a=>[a.categoria,a.titulo,a.pk||'',isPositioned(a)?Number(a.lat).toFixed(7):'',isPositioned(a)?Number(a.lng).toFixed(7):'',a.gpsStatus||'',a.gpsNote||a.observacoes||''])];
  const csv='\uFEFF'+data.map(line=>line.map(cell=>'"'+String(cell??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
  downloadText(csv,'RJP_Navigator_PN_EDF_Estacoes_PK_GPS.csv','text/csv;charset=utf-8');
 }
 async function importarBackup(file){if(!file)return;try{const payload=JSON.parse(await file.text());if(!confirm('A importação substitui os teus registos locais atuais. Continua?'))return;
  for(const [key,state,fn,v] of [[K.extras,payload.locaisExtras,setExtras,[]],[K.gps,payload.gpsAtivos,setGpsAtivos,{}],[K.pk,payload.pkAtivos,setPkAtivos,{}],[K.access,payload.accessos,setAccessos,{}],[K.desloc,payload.deslocacoes,setDesloc,[]],[K.route,payload.tracado,setRoute,null],[K.osm,payload.osmPontos,setOsmPoints,[]]]){
   const val=state??v;persist(key,val);fn(val);
  }setNotice('Cópia JSON importada.');}catch(e){alert('JSON de backup inválido: '+e.message);}finally{if(jsonRef.current)jsonRef.current.value='';}}
 async function importarTracado(file){if(!file)return;try{const obj=JSON.parse(await file.text());const raw=parseRouteGeoJSON(obj);const geo=orientAndValidateRoute(raw,[REF_START.lat,REF_START.lng],[REF_END.lat,REF_END.lng]);
  const output={...geo,sourceFile:file.name,importedAt:new Date().toISOString()};if(!persist(K.route,output))return;setRoute(output);
  setNotice(`Traçado importado (${geo.coords.length} vértices / ${(geo.length/1000).toFixed(1)} km). Coordenadas de PK estimadas, ainda sem calibração intermédia.`);
 }catch(e){alert('Erro no traçado: '+e.message);}finally{if(importRef.current)importRef.current.value='';}}
 async function atualizarCartografia(silent=false,preferredRoute=null,needAssets=true){
  if(loadingOSM)return;
  setLoadingOSM(true);setOsmError('');
  if(!silent)setNotice('A descarregar a linha ferroviária real e os pontos OSM. Pode demorar até alguns minutos.');
  try{
   let activeRoute=preferredRoute||route;
   if(!activeRoute){
    const res=await fetchOverpass(REL_QUERY);
    activeRoute=createRouteFromOSM(res.elements,[REF_START.lat,REF_START.lng],[REF_END.lat,REF_END.lng]);
    if(!persist(K.route,activeRoute))throw Error('Sem espaço para guardar traçado.');
    setRoute(activeRoute);
   }
   let points=needAssets ? null : osmPoints;
   if(needAssets){
    const pointsRes=await fetchOverpass(ASSET_QUERY);
    points=parseOSMAssets(pointsRes.elements);
    if(points.length){persist(K.osm,points);setOsmPoints(points);}
   }
   setPreloadStatus('Traçado carregado e guardado neste dispositivo');
   setNotice(`Cartografia carregada: ${(activeRoute.length/1000).toFixed(1)} km de geometria e ${points?.length||0} elementos OSM. Coordenadas PK aproximadas.`);
  }catch(e){setOsmError(e.message);setNotice(`Não foi possível atualizar cartografia: ${e.message}`);}
  finally{setLoadingOSM(false);}
 }
 // Primeiro arranque: carregar o traçado que veio na APK/WebApp, antes de consultar a internet.
 // Os dados GPS e os ficheiros GeoJSON do utilizador têm prioridade sobre o mapa predefinido.
 useEffect(()=>{let cancelled=false;
  async function iniciarMapa(){
   let installedRoute=route,installedAssets=osmPoints;
   const data=await fetchBundledCartography(`${import.meta.env.BASE_URL}data/linha-oeste-preload.json`);
   if(cancelled)return;
   if(data?.route&&!installedRoute){installedRoute=data.route;setRoute(installedRoute);persist(K.route,installedRoute);}
   if(data?.osmPoints?.length&&!installedAssets.length){installedAssets=data.osmPoints;setOsmPoints(installedAssets);persist(K.osm,installedAssets);}
   if(installedRoute){
    setPreloadStatus(data?.route?'Mapa da linha incluído na aplicação':'Traçado guardado no dispositivo');
   }else setPreloadStatus('A descarregar o traçado automaticamente (necessita de internet)');
   if(!installedRoute||!installedAssets.length){
    if(navigator.onLine===false){setOsmError('Sem ligação: mapa ferroviário online e traçado detalhado dependem de internet no primeiro carregamento.');return;}
    await atualizarCartografia(true,installedRoute,!installedAssets.length);
   }
  }
  iniciarMapa().catch(e=>{if(!cancelled)setOsmError(e.message);});return()=>{cancelled=true;};
 },[]);
 function exportarKML(){downloadText(makeKML(route,assets),'RJP_Navigator_Linha_Oeste_Google_My_Maps.kml','application/vnd.google-earth.kml+xml');}
 function procurarPK(){const val=parsePK(pkBusca);if(val===null||val<PK_START||val>PK_END){alert('PK fora do troço (21+191 a 191+191).');return;}setConsulta(val);setRoadResult(null);setRoadError('');setRoadChoice('');changeTab('mapa');}
 const confirmMatch=consulta!==null?assets.find(a=>parsePK(a.pk)===consulta&&(a.gpsStatus==='Confirmado no terreno'||a.key==='ref-inicial'||a.key==='ref-final')):null;
 const consultPoint=confirmMatch||estimatedPK;
 const chosenRoad=roadResult?.alternatives.find(x=>x.id===roadChoice)||roadResult?.recommended||null;
 const confirmedAccess=consulta!==null?accessos[`pk-${consulta}`]:null;
 // A procura de estrada só arranca quando o PK possui uma coordenada ferroviária.
 // As pesquisas não atualizam o armazenamento de acessos confirmados.
 useEffect(()=>{if(consulta===null||!isPositioned(consultPoint))return;
  let cancelled=false;
  setAccessLoading(true);setRoadError('');setRoadResult(null);setRoadChoice('');
  findRoadAccess({lat:Number(consultPoint.lat),lng:Number(consultPoint.lng)},gps)
    .then(r=>{if(cancelled)return;setRoadResult(r);setRoadChoice(r.recommended.id);})
    .catch(e=>{if(!cancelled)setRoadError(e.message||'Pesquisa de estradas indisponível.');})
    .finally(()=>{if(!cancelled)setAccessLoading(false);});
  return()=>{cancelled=true;};
 },[consulta,consultPoint?.lat,consultPoint?.lng]);
 async function localizarComGPS(){const newGps=await obterGPS();if(newGps&&consultPoint)await localizarAcesso(consultPoint,newGps);}
 function guardarAcessoPK(){if(!chosenRoad||consulta===null)return;
  if(!confirm('Só assinalar como confirmado se verificaste fisicamente que esta via é transitável, que é permitido parar e que existe acesso autorizado. Confirmas?'))return;
  const pkKey=`pk-${consulta}`;const data={lat:chosenRoad.lat,lng:chosenRoad.lng,nota:chosenRoad.name,confirmadoEm:new Date().toISOString()};
  const next={...accessos,[pkKey]:data};setAccessos(next);persist(K.access,next);setNotice(`Acesso rodoviário do PK ${formatPK(consulta)} validado e guardado.`);
 }

 const selectedOnMap=consulta!==null&&consultPoint?{...consultPoint,key:`pk-consulta-${consulta}`,titulo:`PK ${formatPK(consulta)}`}:selKey&&isPositioned(current)?current:null;
 return <div className="app">
  <header><img src="./icon-192.png" alt="RJP"/><div><h1>RJP Navigator <span>V3.5</span></h1><p>Linha do Oeste · PK 21+191 — PK 191+191</p></div><div className="header-pill">Navegação técnica ferroviária</div></header>
  <nav>{[['inicio','Início'],['locais','Locais'],['pn','Passagens de nível'],['km','PK/Km'],['mapa','Mapa ferroviário'],['novo','Novo local'],['desloc','Deslocações']].map(([k,t])=><button key={k} className={tab===k?'on':''} onClick={()=>changeTab(k)}>{t}</button>)}</nav>
  {notice&&<div className="notice" role="status">{notice}<button title="Fechar" onClick={()=>setNotice('')}>×</button></div>}
  <section className="quicksearch"><div><b>Localizar um quilómetro</b><small>Ex.: 115+350 — localizar o PK e a estrada mais próxima</small></div><input aria-label="PK a localizar" value={pkBusca} onChange={e=>setPkBusca(e.target.value)} onKeyDown={e=>e.key==='Enter'&&procurarPK()}/><button onClick={procurarPK}>Localizar PK</button></section>
  {tab==='inicio'&&<main className="grid dashboard">
   <section className="card hero"><h2>O teu troço da Linha do Oeste</h2><p>Do PK <strong>21+191 (Belas / Sintra)</strong> ao PK <strong>191+191 (Carriço / Pombal)</strong>, com 170 km de referência.</p><p>O traçado ferroviário pode ser realçado no mapa. A geolocalização de cada PK exige geometria ferroviária georreferenciada e calibração.</p><div className="stats">{[['59','Passagens de nível'],['38','Estações / apeadeiros'],[String(countConfirmed),'GPS confirmados em campo'],[String(countEstimated),'Coordenadas por cartografia/estimativa'],[String(osmMatched),'Ativos associados ao OSM'],[route?'Disponível':'Pendente','Traçado georreferenciado']].map(([n,lab])=><div key={lab}><b>{n}</b><span>{lab}</span></div>)}</div></section>
   <section className="card"><h3>GPS atual</h3><p>{gps?`${gps.lat}, ${gps.lng} (±${gps.acc} m)`:'Ainda sem posição GPS do dispositivo.'}</p><button onClick={obterGPS}>Atualizar GPS</button><p className="footnote">O GPS guardado sobrepõe-se às estimativas e é conservado entre atualizações, desde que os dados locais da app sejam mantidos.</p></section>
   <section className="card"><h3>Ações rápidas</h3><div className="stack"><button onClick={()=>changeTab('mapa')}>Ver mapa e traçado</button><button disabled={loadingOSM} onClick={()=>atualizarCartografia()}>{loadingOSM?'A atualizar...':'Atualizar cartografia OSM'}</button><button onClick={()=>changeTab('pn')}>Ver 59 PN</button><button onClick={exportarKML}>Exportar para Google My Maps</button><button onClick={exportarCSV}>Exportar coordenadas CSV</button><button onClick={exportarJSON}>Guardar cópia JSON</button></div></section>
  </main>}
  {['locais','pn','km','mapa'].includes(tab)&&<main className={tab==='mapa'?'map-layout':'layout'}>
   <aside className="card list"><div className="filters"><input aria-label="Pesquisar locais" placeholder="Pesquisar por PK, nome, concelho..." value={q} onChange={e=>setQ(e.target.value)}/>
    <select aria-label="Filtrar categoria" value={tipo} onChange={e=>setTipo(e.target.value)}>{[['todos','Todos'],['Passagem de Nível','Passagens de nível'],['Estação/Apeadeiro','Estações/Apeadeiros'],['Edifício','Edifícios'],['Marco Quilométrico','PK/Km']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></div>
    <small className="muted">{filtered.length} registos · {countConfirmed} GPS de campo</small>
    <div className="items">{filtered.map(a=><button className={`item ${current?.key===a.key?'selected':''}`} key={a.key} onClick={()=>setSelection(a.key)}><strong>{a.titulo}</strong><span>{a.pk||'PK por indicar'} · {a.gpsStatus==='Estimado pelo traçado'?'◌ estimado':a.gpsStatus==='Confirmado no terreno'?'✓ confirmado':a.gpsStatus?.startsWith('OSM')?'◇ OSM':a.gpsStatus==='GPS de origem'?'GPS original':'sem GPS'}</span></button>)}</div>
   </aside>
   <section className="right-col">
    {tab==='mapa'&&<section className="card map-card"><div className="map-head"><div><h2>Mapa da Linha do Oeste</h2><p>PK 21+191 — 191+191 · carregamento automático, sem importar ficheiros</p><p className="map-preload-status">{preloadStatus}{loadingOSM?' · a atualizar dados...':''}</p></div><a href={railMap(isPositioned(current)?current:REF_START)} target="_blank" rel="noreferrer" className="secondary-action">Mapa ferroviário externo ↗</a></div>
      <Mapa assets={assets} route={route} selected={selectedOnMap} onSelect={setSelection} roadAccess={chosenRoad} railTarget={consulta!==null?consultPoint:null}/>
      {consulta!==null&&<div className="result-box"><h3>PK {formatPK(consulta)} — estrada mais próxima</h3><p>{pkSearchStatus}</p>
       {consultPoint?<p><b>Ponto ferroviário:</b> {Number(consultPoint.lat).toFixed(7)}, {Number(consultPoint.lng).toFixed(7)} <a href={pointMaps(consultPoint)} target="_blank" rel="noreferrer">Ver eixo no Google Maps</a></p>:<p>A obter coordenada ferroviária. Sem eixo válido não inventamos coordenadas.</p>}
       {confirmedAccess&&<div className="road-confirmed"><strong>Acesso validado por ti para este PK</strong><p>{coord(confirmedAccess)} · {confirmedAccess.nota||'Sem notas'}</p><a href={routeMaps(confirmedAccess)} target="_blank" rel="noreferrer">Navegar para acesso validado</a></div>}
       {consultPoint&&<div className="road-result"><h3>Acesso rodoviário sugerido</h3>
        {accessLoading?<p>A procurar a estrada mais próxima e os tempos de condução...</p>:null}
        {roadError?<p className="warning">{roadError} <button type="button" onClick={()=>localizarAcesso(consultPoint)}>Tentar novamente</button></p>:null}
        {chosenRoad&&!accessLoading&&<>
         <div className="road-distance"><strong>{Math.round(chosenRoad.gapMeters)} m</strong><span>Distância em linha reta entre a estrada e o PK (não é percurso pedonal)</span></div>
         <p><b>Via:</b> {chosenRoad.name} · {chosenRoad.source}</p>
         <p>{Number.isFinite(chosenRoad.durationMin)?<><b>Condução estimada:</b> {chosenRoad.durationMin} min{chosenRoad.driveKm!=null?` · ${chosenRoad.driveKm.toFixed(1)} km`:''}</>:<span>Para estimar a duração desde onde estás, atualiza o GPS. A navegação Google Maps calculará o percurso.</span>}</p>
         {chosenRoad.warning&&<p className="warning">{chosenRoad.warning}</p>}
         <div className="actions"><a href={routeMaps(chosenRoad)} target="_blank" rel="noreferrer">Navegar por Google Maps</a><a href={waze(chosenRoad)} target="_blank" rel="noreferrer">Navegar por Waze</a><button type="button" onClick={localizarComGPS}>Atualizar GPS e tempo</button><button type="button" onClick={guardarAcessoPK}>Marcar como acesso validado</button></div>
         {roadResult?.alternatives?.length>1&&<div className="road-choices"><label htmlFor="rjp-access-choice">Outras estradas próximas (ordem por distância ao PK)</label><select id="rjp-access-choice" value={roadChoice} onChange={e=>setRoadChoice(e.target.value)}>{roadResult.alternatives.map(x=><option key={x.id} value={x.id}>{x.name} · {Math.round(x.gapMeters)} m{x.durationMin!=null?` · ${x.durationMin} min condução`:''}</option>)}</select></div>}
         {roadResult?.recommended?.id!==roadResult?.near?.id&&<p className="footnote">A via recomendada pode não ser a mais próxima em linha reta: entre as alternativas a menos de 300 m de distância adicional ao PK, privilegiámos o menor tempo estimado de condução.</p>}
         <p className="road-caution"><b>Atenção:</b> destino apenas na estrada próxima. Não confirma estacionamento, passagem a pé, acesso autorizado nem entrada na plataforma ferroviária. O percurso rodoviário e o tráfego são recalculados pelo Google Maps/Waze.</p>
        </>}
        {!accessLoading&&!chosenRoad&&!roadError&&<button type="button" onClick={()=>localizarAcesso(consultPoint)}>Encontrar estrada mais próxima</button>}
       </div>}
      </div>}
      <div className="map-tools"><button disabled={loadingOSM} onClick={()=>atualizarCartografia()}>{loadingOSM?'A descarregar cartografia...':'Recarregar dados OSM'}</button><label className="file-action">Importar traçado (GeoJSON)<input ref={importRef} type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={e=>importarTracado(e.target.files?.[0])}/></label>
       <button onClick={exportarKML}>Exportar KML</button><button onClick={exportarCSV}>Exportar CSV com PN/EDF</button><a href="https://www.google.com/mymaps" target="_blank" rel="noreferrer">Abrir Google My Maps ↗</a>
       {route&&<button className="danger-secondary" onClick={()=>{if(confirm('Apagar o traçado importado? Os GPS guardados permanecerão intactos.')){persist(K.route,null);setRoute(null);}}}>Remover traçado</button>}
      </div><p className="footnote">Para ver <b>a linha e os pontos no Google Maps</b>, exporta o ficheiro KML e importa-o no Google My Maps. A aplicação Google Maps comum não aceita uma linha personalizada através de um simples link.</p>
      {osmError&&<p className="warning">Erro de cartografia: {osmError}. Também podes importar um GeoJSON manualmente.</p>}
      <p className="footnote">Para confirmação topográfica, consultar a Infraestruturas de Portugal / dados.gov.pt (Rede Ferroviária Nacional), convertida para GeoJSON WGS84 e limitada ao teu troço. A importação requer uma LineString contínua no sentido de um dos extremos; dados projetados EPSG:3763 devem ser convertidos antes.</p>
     </section>}
    {current&&<section className="card detail"><div className="detail-title"><div><h2>{current.titulo}</h2><span className="pill">{current.categoria}</span></div><span className={`status ${current.gpsStatus==='Confirmado no terreno'?'confirmed':current.gpsStatus==='Estimado pelo traçado'?'estimated':''}`}>{current.gpsStatus}</span></div>
     <dl><dt>PK ferroviário</dt><dd>{current.pk||'Por definir'}</dd><dt>Localidade</dt><dd>{current.localidade||current.nome||'—'}</dd><dt>Concelho</dt><dd>{current.concelho||'—'}</dd><dt>Freguesia</dt><dd>{current.freguesia||'—'}</dd><dt>GPS ferroviário</dt><dd>{isPositioned(current)?`${Number(current.lat).toFixed(7)}, ${Number(current.lng).toFixed(7)}`:'Sem coordenadas verificadas'}</dd><dt>Fiabilidade</dt><dd>{current.gpsStatus}{current.gpsNote?` · ${current.gpsNote}`:''}</dd></dl>
     <p className="footnote">{current.observacoes}</p><div className="actions"><button onClick={obterGPS}>Atualizar GPS</button><button onClick={()=>guardarGPS(current)}>Guardar GPS no ativo</button><button onClick={()=>registarDeslocacao(current)}>Registar deslocação</button>{parsePK(current.pk)!=null&&<button onClick={()=>{setPkBusca(current.pk);setConsulta(parsePK(current.pk));changeTab('mapa');}}>Procurar estrada para este PK</button>}{isPositioned(current)&&<a target="_blank" rel="noreferrer" href={pointMaps(current)}>Ver ponto no Google Maps</a>}{isPositioned(current)&&<a target="_blank" rel="noreferrer" href={railMap(current)}>Ver ferrovia no mapa</a>}</div>
     <div className="edit-line"><h3>Corrigir coordenadas manualmente</h3><p className="footnote">Podes introduzir coordenadas GPS de uma carta/levantamento. São guardadas separadamente das estimativas OSM e ficam por validar até confirmação no terreno.</p><div className="inline-fields"><input aria-label="Latitude do ativo" placeholder="Latitude (ex.: 39.123456)" value={manualEdit.lat} onChange={e=>setManualEdit({...manualEdit,lat:e.target.value})}/><input aria-label="Longitude do ativo" placeholder="Longitude (ex.: -9.123456)" value={manualEdit.lng} onChange={e=>setManualEdit({...manualEdit,lng:e.target.value})}/></div><button onClick={()=>guardarGPSManual(current)}>Guardar coordenada</button></div>
     {current.categoria!=='Passagem de Nível'&&<div className="edit-line"><h3>Corrigir PK de estação / edifício</h3><div className="inline-fields"><input aria-label="Corrigir PK" placeholder="Ex.: 115+350" value={pkEdit} onChange={e=>setPkEdit(e.target.value)}/><button onClick={()=>guardarPK(current)}>Guardar PK</button></div><p className="footnote">Estações sem PK não recebem coordenadas estimadas até se introduzir uma referência quilométrica fiável.</p></div>}
     <div className="edit-line"><h3>Acesso rodoviário validado</h3>{access&&<p className="ok">Acesso registado: {coord(access)} · {access.nota||'sem observações'}</p>}
      <div className="inline-fields"><input aria-label="Latitude do acesso" placeholder="Latitude" value={accessEdit.lat} onChange={e=>setAccessEdit({...accessEdit,lat:e.target.value})}/><input aria-label="Longitude do acesso" placeholder="Longitude" value={accessEdit.lng} onChange={e=>setAccessEdit({...accessEdit,lng:e.target.value})}/></div><input aria-label="Notas do acesso" placeholder="Estrada, caminho permitido, observações" value={accessEdit.nota} onChange={e=>setAccessEdit({...accessEdit,nota:e.target.value})}/><button onClick={()=>guardarAcesso(current)}>Guardar acesso confirmado</button>
      {access&&<div className="actions"><a href={routeMaps(access)} target="_blank" rel="noreferrer">Navegar pelo Google Maps</a><a href={waze(access)} target="_blank" rel="noreferrer">Navegar pelo Waze</a></div>}
      <p className="footnote">Não se criam percursos automáticos até à linha férrea: o acesso rodoviário tem de ser confirmado para evitar caminhos privados, terrenos sem estrada ou atravessamentos não autorizados.</p></div>
    </section>}
   </section>
  </main>}
  {tab==='novo'&&<main className="card form"><h2>Adicionar local ou ativo</h2><p>Associa um PK a um ponto GPS obtido no terreno.</p><button onClick={obterGPS}>Atualizar GPS</button>{gps&&<p className="ok">GPS: {coord(gps)} (±{gps.acc} m)</p>}{Object.keys(form).map(k=><label key={k}>{k==='pk'?'PK (ex.: 115+350)':k}<input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<button onClick={adicionarLocal}>Guardar local</button></main>}
  {tab==='desloc'&&<main className="card records"><h2>Deslocações e cópia de dados</h2><div className="actions"><button onClick={exportarJSON}>Exportar JSON</button><label className="file-action">Importar cópia JSON<input ref={jsonRef} type="file" accept="application/json,.json" onChange={e=>importarBackup(e.target.files?.[0])}/></label></div>
   {desloc.length===0?<p>Sem deslocações registadas.</p>:<div className="table-scroll"><table><thead><tr><th>Data</th><th>Hora</th><th>Destino</th><th>PK</th><th>GPS</th></tr></thead><tbody>{desloc.map(d=><tr key={d.id}><td>{d.data}</td><td>{d.hora}</td><td>{d.destino}</td><td>{d.pk}</td><td>{d.gps}</td></tr>)}</tbody></table></div>}
   <p className="footnote">Exporta um JSON antes de desinstalar ou limpar os dados da app. As coordenadas de campo, PK corrigidos e acessos são guardados localmente no dispositivo.</p></main>}
  <footer>RJP Navigator V3.5 · Linha do Oeste · PK 21+191 a 191+191 · Cartografia OSM: coordenadas por PK aproximadas, validar no terreno · Não substitui os procedimentos de segurança ferroviária.</footer>
 </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
