import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import L from 'leaflet';
import {parsePK,formatPK,validGPS,downloadText,metersBetween} from './lib/rail.js';
import {segmentKey,defaultCalibration,geometryProfile,pointAt,locateNationalPK,locateGeometricDistance,calibrationReferences,nearestOnProfile,resolveNationalLinePK} from './lib/national.js';
import {findRoadAccess} from './lib/access.js';

const LS_CAL='rjp_nav_nacional_calibracoes_v38';
const LS_POIS='rjp_nav_nacional_ativos_v38';
const LS_ROADS='rjp_nav_nacional_acessos_v38';
const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{alert('Armazenamento cheio. Exporta um backup JSON dos dados.');return false;}};
const googleRoute=p=>`https://www.google.com/maps/dir/?api=1&destination=${p.lat}%2C${p.lng}&travelmode=driving`;
const waze=p=>`https://waze.com/ul?ll=${p.lat}%2C${p.lng}&navigate=yes`;
const strCoord=p=>`${Number(p.lat).toFixed(7)}, ${Number(p.lng).toFixed(7)}`;

function NationalMap({linha,segmentIndex,target,road,points=[],onPickRail}){
 const el=useRef(null),mapRef=useRef(null),groupRef=useRef(null);
 useEffect(()=>{if(!el.current)return;const map=L.map(el.current,{preferCanvas:true,scrollWheelZoom:false});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);
  groupRef.current=L.layerGroup().addTo(map);mapRef.current=map;map.setView([39.7,-8.4],7);
  const t=setTimeout(()=>map.invalidateSize(),120);
  return()=>{clearTimeout(t);map.remove();mapRef.current=null;groupRef.current=null;};
 },[]);
 useEffect(()=>{const map=mapRef.current,group=groupRef.current;if(!map||!group||!linha)return;
  group.clearLayers();const bounds=[];
  for(let i=0;i<linha.segmentos.length;i++){
   const seg=linha.segmentos[i];if(!seg.coords?.length)continue;
   const path=L.polyline(seg.coords,{color:i===segmentIndex?'#007750':'#83ada0',weight:i===segmentIndex?6:3,opacity:i===segmentIndex?.95:.55});
   path.bindTooltip(`${linha.nome}: ${seg.segmento}${i===segmentIndex?' · tocar para escolher ponto':''}`).addTo(group);
   if(i===segmentIndex)path.on('click',e=>onPickRail?.({lat:e.latlng.lat,lng:e.latlng.lng}));
   if(i===segmentIndex)bounds.push(...seg.coords);
  }
  const chosen=linha.segmentos[segmentIndex];
  if(chosen?.coords?.length){
   for(const [p,title] of [[chosen.coords[0],'Extremo A da geometria'],[chosen.coords.at(-1),'Extremo B da geometria']])L.circleMarker(p,{radius:6,color:'#075f3d',fillColor:'#fff',fillOpacity:1}).bindTooltip(title).addTo(group);
  }
  for(const p of points.filter(p=>validGPS(p.lat,p.lng)))L.circleMarker([p.lat,p.lng],{radius:5,color:'#fff',weight:1.5,fillColor:'#f7a61d',fillOpacity:1}).bindTooltip(`${p.nome} · ${p.pk}`).addTo(group);
  if(validGPS(target?.lat,target?.lng))L.circleMarker([target.lat,target.lng],{radius:10,color:'#ae6b06',weight:3,fillColor:'#ffec94',fillOpacity:1}).bindPopup(`${target.displayPK?'PK '+target.displayPK:'Ponto geométrico'} — estimado sobre o eixo`).addTo(group);
  if(validGPS(road?.lat,road?.lng)){
   L.circleMarker([road.lat,road.lng],{radius:10,color:'#1557a5',weight:3,fillColor:'#c6dffe',fillOpacity:1}).bindPopup(`Estrada sugerida · ${Math.round(road.gapMeters)} m em linha reta ao PK. Acesso por validar.`).addTo(group);
   if(target)L.polyline([[target.lat,target.lng],[road.lat,road.lng]],{color:'#3268b8',weight:2,dashArray:'5,7'}).addTo(group);
  }
  if(road&&target)map.fitBounds(L.latLngBounds([[target.lat,target.lng],[road.lat,road.lng]]).pad(.7),{maxZoom:16});
  else if(target)map.setView([target.lat,target.lng],15);
  else if(bounds.length)map.fitBounds(L.latLngBounds(bounds).pad(.08),{maxZoom:13});
 },[linha,segmentIndex,target,road,points,onPickRail]);
 return <div className="map-shell"><div className="leaflet-map national-map" ref={el} aria-label="Mapa ferroviário nacional interativo"/><p className="footnote">Toca no eixo verde para escolher um ponto, mesmo numa linha sem PK calibrados. Cartografia IP integrada; mapa de fundo e pesquisa de estradas precisam de internet. A linha tracejada não é caminho pedonal.</p></div>;
}

export default function NationalNavigator({network,selectedLine,onLineChange,gps,onGetGPS}){
 const [segmentIndex,setSegmentIndex]=useState(0);
 const [calibrations,setCalibrations]=useState(()=>load(LS_CAL,{}));
 const [pois,setPois]=useState(()=>load(LS_POIS,[]));
 const [accesses,setAccesses]=useState(()=>load(LS_ROADS,{}));
 const [pkText,setPkText]=useState('115+350'),[geomText,setGeomText]=useState('1000');
 const [result,setResult]=useState(null),[message,setMessage]=useState(''),[roadResult,setRoadResult]=useState(null),[roadError,setRoadError]=useState(''),[roadLoading,setRoadLoading]=useState(false),[roadChoice,setRoadChoice]=useState('');
 const [refPK,setRefPK]=useState(''),[refMode,setRefMode]=useState('gps'),[refLat,setRefLat]=useState(''),[refLng,setRefLng]=useState(''),[refSource,setRefSource]=useState('');
 const [poiName,setPoiName]=useState(''),[poiPK,setPoiPK]=useState(''),[poiType,setPoiType]=useState('Passagem de Nível');
 const requestToken=useRef(0);
 const networkLine=network?.linhas?.find(l=>l.nome===selectedLine)||null;
 const segments=networkLine?.segmentos||[];
 const segment=segments[segmentIndex]||null;
 const key=segmentKey(selectedLine,segmentIndex);
 const preset=useMemo(()=>defaultCalibration(selectedLine,segmentIndex),[selectedLine,segmentIndex]);
 const calibration=calibrations[key]??preset;
 const profile=useMemo(()=>{try{return segment?.coords?.length?geometryProfile(segment.coords):null;}catch{return null;}},[segment]);
 const refs=useMemo(()=>calibrationReferences(profile,calibration),[profile,calibration]);
 const locatable=refs.references.length>=2&&!refs.error;
 const relevantPOI=useMemo(()=>pois.filter(p=>p.segmentKey===key).map(p=>({...p,location:profile?locateNationalPK(p.pk,profile,calibration):{}})).map(p=>({...p,lat:p.location.lat??null,lng:p.location.lng??null})),[pois,key,profile,calibration]);
 const chosenRoad=roadResult?.alternatives?.find(a=>a.id===roadChoice)||roadResult?.recommended||null;
 const savedRoad=result?.pk!=null?accesses[`${key}|${result.pk}`]:null;
 const calibratedSegments=useMemo(()=>segments.filter((s,i)=>{try{const p=geometryProfile(s.coords);return calibrationReferences(p,calibrations[segmentKey(selectedLine,i)]??defaultCalibration(selectedLine,i)).references.length>=2;}catch{return false;}}).length,[segments,selectedLine,calibrations]);

 const cancelRoad=useCallback(()=>{requestToken.current++;setRoadLoading(false);setRoadResult(null);setRoadChoice('');setRoadError('');},[]);
 useEffect(()=>{setSegmentIndex(0);setPkText(selectedLine==='Linha do Oeste'?'115+350':'');},[selectedLine]);
 useEffect(()=>{cancelRoad();setResult(null);setMessage('');},[key,cancelRoad]);

 const searchRoad=useCallback(async(point,origin=gps)=>{
  if(!validGPS(point?.lat,point?.lng))return;
  const ticket=++requestToken.current;
  setRoadLoading(true);setRoadResult(null);setRoadChoice('');setRoadError('');
  try{
   const r=await findRoadAccess({lat:Number(point.lat),lng:Number(point.lng)},origin);
   if(ticket!==requestToken.current)return;
   setRoadResult(r);setRoadChoice(r.recommended?.id||'');
  }catch(err){if(ticket===requestToken.current)setRoadError(err?.message||'Não foi possível consultar os serviços rodoviários.');}
  finally{if(ticket===requestToken.current)setRoadLoading(false);}
 },[gps]);

 function showLocated(loc,feedback){
  setResult(loc);setMessage(feedback||`Ponto aproximado no eixo: ${strCoord(loc)}. Confirmar no terreno.`);
  // Igual ao comportamento na Linha do Oeste: localizar automaticamente a estrada após localizar o PK.
  searchRoad(loc);
 }
 function locatePK(value=pkText){
  const r=resolveNationalLinePK(value,selectedLine,segments,calibrations,segmentIndex);
  if(r.error){cancelRoad();setResult(null);setMessage(r.error);return;}
  if(r.segmentIndex!==segmentIndex)setSegmentIndex(r.segmentIndex);
  // A mudança de troço desencadeia também um efeito de limpeza: procurar quando o troço estiver selecionado.
  if(r.segmentIndex!==segmentIndex){setPendingLocate({pk:value,index:r.segmentIndex});return;}
  showLocated(r.location,`PK ${r.location.displayPK} estimado sobre a geometria ferroviária (${strCoord(r.location)}); validar em campo antes de uso operacional.`);
 }
 const [pendingLocate,setPendingLocate]=useState(null);
 useEffect(()=>{
  if(!pendingLocate||pendingLocate.index!==segmentIndex)return;
  setPendingLocate(null);
  const located=locateNationalPK(pendingLocate.pk,profile,calibration);
  if(located.error){setMessage(located.error);return;}
  showLocated(located,`PK ${located.displayPK} estimado sobre a geometria ferroviária (${strCoord(located)}); validar em campo.`);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[pendingLocate,segmentIndex,profile,calibration]);
 function locateGeom(){if(!profile)return;
  const v=Number(geomText.trim().replace(',','.'));const r=locateGeometricDistance(v,profile);
  if(r.error){cancelRoad();setResult(null);setMessage(r.error);return;}
  showLocated(r,'Localização pela distância geométrica desde o extremo A — não corresponde a um PK ferroviário oficial.');
 }
 const pickRail=useCallback(raw=>{
  if(!profile)return;
  const nearest=nearestOnProfile(profile,raw);
  if(!nearest)return;
  const loc=locateGeometricDistance(nearest.along,profile);
  if(!loc.error){setGeomText(String(Math.round(nearest.along)));showLocated(loc,`Ponto escolhido diretamente no eixo (${strCoord(loc)}). Distância geométrica: ${Math.round(nearest.along)} m; não é PK oficial.`);}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[profile,gps]);
 function updateCalibration(next){const updated={...calibrations,[key]:next};if(save(LS_CAL,updated)){setCalibrations(updated);cancelRoad();setResult(null);setMessage('Referências guardadas neste dispositivo. Exporta um backup para as conservar.');}}
 function addReference(){if(!profile)return;const pk=parsePK(refPK);if(pk===null||pk<0){setMessage('Introduz PK válido, por exemplo 20+150.');return;}
  const next={pk:formatPK(pk),source:refSource.trim()||'Registo manual (não validado)'};
  if(refMode!=='gps')next.position=refMode;
  else{const lat=Number(refLat.replace(',','.')),lng=Number(refLng.replace(',','.'));if(!refLat.trim()||!refLng.trim()||!validGPS(lat,lng)){setMessage('Coordenadas GPS inválidas.');return;}next.lat=lat;next.lng=lng;}
  const all=[...(calibration.anchors||[]),next];const checked=calibrationReferences(profile,{anchors:all});if(checked.error){setMessage('Referência não guardada: '+checked.error);return;}
  updateCalibration({...calibration,anchors:all,note:'Referências editadas pelo utilizador; validar PK no terreno.'});setRefPK('');setRefLat('');setRefLng('');
 }
 function addPoi(){const pk=parsePK(poiPK);if(!poiName.trim()||pk===null||pk<0){setMessage('Introduz o nome e o PK do ativo.');return;}
  if(pois.some(p=>p.segmentKey===key&&p.nome.trim().toLowerCase()===poiName.trim().toLowerCase()&&p.pk===formatPK(pk))){setMessage('Este ativo já existe.');return;}
  const updated=[...pois,{id:`nac-${Date.now()}`,segmentKey:key,linha:selectedLine,segmento:segment?.segmento,nome:poiName.trim(),pk:formatPK(pk),categoria:poiType}];if(save(LS_POIS,updated)){setPois(updated);setMessage('Ativo registado; as coordenadas são calculadas quando houver referências suficientes.');setPoiName('');setPoiPK('');}
 }
 function confirmRoad(){if(!chosenRoad||result?.pk==null)return;
  if(!window.confirm('Confirmas que verificaste no terreno que esta via é pública/transitável e que há acesso e paragem autorizados?'))return;
  const saved={lat:chosenRoad.lat,lng:chosenRoad.lng,name:chosenRoad.name,recordedAt:new Date().toISOString(),note:'Acesso confirmado pelo utilizador'};
  const updated={...accesses,[`${key}|${result.pk}`]:saved};if(save(LS_ROADS,updated)){setAccesses(updated);setMessage('Acesso rodoviário registado como confirmado por ti.');}
 }
 async function updateGPSTime(){const newGPS=await onGetGPS();if(!newGPS){setRoadError('Não foi possível atualizar o GPS. Confirma as permissões de localização.');return;}
  if(result)searchRoad(result,newGPS);
 }
 function backup(){downloadText(JSON.stringify({schema:'rjp.navigator.nacional.v38',calibrations,pois,accesses},null,2),'RJP_Navigator_Rede_Nacional_Backup.json','application/json');}
 async function importBackup(file){if(!file)return;try{const j=JSON.parse(await file.text());if(j.schema!=='rjp.navigator.nacional.v38'||!j.calibrations||!Array.isArray(j.pois)||!j.accesses)throw Error('Formato incompatível.');
  if(!window.confirm('Importar e SUBSTITUIR as referências e ativos nacionais já guardados?'))return;
  if(save(LS_CAL,j.calibrations)&&save(LS_POIS,j.pois)&&save(LS_ROADS,j.accesses)){setCalibrations(j.calibrations);setPois(j.pois);setAccesses(j.accesses);cancelRoad();setResult(null);setMessage('Backup nacional importado.');}}
  catch(e){setMessage('Importação falhou: '+e.message);}}
 return <div className="national-nav">
  <h2>Rede Ferroviária Nacional — PK → estrada → navegação</h2>
  <p>Seleciona a linha, introduz o PK e a pesquisa da estrada começa automaticamente quando a posição ferroviária é calculável. <strong>Em qualquer linha</strong> também podes tocar no eixo verde do mapa para obter uma aproximação rodoviária, mesmo sem PK calibrados.</p>
  <div className="national-fields">
   <label>Linha ferroviária<select value={selectedLine} onChange={e=>onLineChange(e.target.value)}>{(network?.linhas||[]).map(l=><option key={l.nome} value={l.nome}>{l.nome}</option>)}</select></label>
   <label>Troço da linha<select value={segmentIndex} onChange={e=>{setPendingLocate(null);setSegmentIndex(Number(e.target.value));}}>{segments.map((s,i)=><option value={i} key={i}>{s.segmento}</option>)}</select></label>
  </div>
  <p className="muted">{network?.linhas?.length??0} linhas/designações · {segments.length} troço(s) nesta linha · {calibratedSegments} com referências PK suficientes · {profile?`${(profile.length/1000).toFixed(2)} km de geometria no troço selecionado`: 'Sem eixo disponível'}.</p>
  {profile&&<>
   <div className="national-fields national-search">
    <label>PK da linha (ex.: 115+350)<input value={pkText} placeholder="Introduzir PK" onChange={e=>setPkText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&locatePK()}/></label>
    <button onClick={()=>locatePK()}>Localizar PK e procurar estrada</button>
   </div>
   {locatable?<p className="ok">{refs.references.length} referências PK no troço · intervalo {formatPK(Math.min(...refs.references.map(r=>r.pk)))} a {formatPK(Math.max(...refs.references.map(r=>r.pk)))} · coordenadas estimadas.</p>:<p className="road-caution">PK oficiais ainda não calibrados neste troço. Podes utilizar a distância geométrica ou tocar no eixo no mapa; não será apresentado um PK inventado. É possível adicionar referências PK/GPS abaixo.</p>}
   <div className="national-fields national-geometry">
    <label>Distância geométrica desde o extremo A (m) — não é PK<input value={geomText} onChange={e=>setGeomText(e.target.value)}/></label>
    <button className="secondary-btn" onClick={locateGeom}>Localizar e procurar estrada</button>
   </div>
   {message&&<p className="national-message" role="status">{message}</p>}
   <NationalMap linha={networkLine} segmentIndex={segmentIndex} target={result} road={chosenRoad} points={relevantPOI} onPickRail={pickRail}/>
   {result?.lat&&<section className="result-box national-road-card" aria-label="Resultado PK e acesso rodoviário">
    <h3>{result.displayPK?'PK '+result.displayPK:'Ponto no eixo ferroviário'} — estrada mais próxima</h3>
    <p>{result.displayPK?'PK aproximado sobre a geometria ferroviária; confirmar com marcos/levantamento de campo antes de utilizar em obra.':'Localização por distância geométrica ou toque no mapa; NÃO corresponde a um PK oficial.'}</p>
    <p><strong>Ponto ferroviário:</strong> {strCoord(result)} <a href={`https://www.google.com/maps/search/?api=1&query=${result.lat}%2C${result.lng}`} target="_blank" rel="noreferrer">Ver eixo no Google Maps</a></p>
    {savedRoad&&<div className="road-confirmed"><strong>Acesso anteriormente validado por ti</strong><p>{savedRoad.name||'Via sem nome'} · {strCoord(savedRoad)}</p><div className="actions"><a href={googleRoute(savedRoad)} target="_blank" rel="noreferrer">Google Maps — acesso validado</a><a href={waze(savedRoad)} target="_blank" rel="noreferrer">Waze — acesso validado</a></div></div>}
    <div className="road-result"><h3>Acesso rodoviário sugerido</h3>
     {roadLoading&&<p role="status">A procurar a estrada mais próxima e, havendo GPS, a estimar o tempo de condução…</p>}
     {roadError&&<p className="warning" role="alert">{roadError} <button type="button" onClick={()=>searchRoad(result)}>Tentar novamente</button></p>}
     {chosenRoad&&!roadLoading&&<>
      <div className="road-distance"><strong>{Math.round(chosenRoad.gapMeters)} m</strong><span>Distância em linha reta entre a estrada e o ponto na via (não é percurso pedonal)</span></div>
      <p><strong>Via:</strong> {chosenRoad.name} · {chosenRoad.source}</p>
      <p>{Number.isFinite(chosenRoad.durationMin)?<><strong>Condução estimada:</strong> {chosenRoad.durationMin} min{chosenRoad.driveKm!=null?` · ${chosenRoad.driveKm.toFixed(1)} km`:''}</>:<>Para calcular o tempo desde a tua localização, atualiza o GPS. O Google Maps/Waze recalculará o percurso.</>}</p>
      {chosenRoad.warning&&<p className="warning">{chosenRoad.warning}</p>}
      <div className="actions"><a href={googleRoute(chosenRoad)} target="_blank" rel="noreferrer">Navegar por Google Maps</a><a href={waze(chosenRoad)} target="_blank" rel="noreferrer">Navegar por Waze</a><button type="button" onClick={updateGPSTime}>Atualizar GPS e tempo</button>{result.pk!=null&&<button type="button" onClick={confirmRoad}>Marcar como acesso validado</button>}</div>
      {roadResult?.alternatives?.length>1&&<div className="road-choices"><label htmlFor="national-road-choice">Outras estradas próximas (ordem por distância ao ponto)</label><select id="national-road-choice" value={roadChoice} onChange={e=>setRoadChoice(e.target.value)}>{roadResult.alternatives.map(a=><option key={a.id} value={a.id}>{a.name} · {Math.round(a.gapMeters)} m{a.durationMin!=null?` · ${a.durationMin} min condução`:''}</option>)}</select></div>}
      {roadResult?.source==='osrm-fallback'&&<p className="footnote">Sem resposta suficiente do Overpass: aproximação pela rede OSRM. Nome/tipo de estrada não confirmados.</p>}
      {roadResult?.roadTimeError&&<p className="footnote">Tempos rodoviários indisponíveis: {roadResult.roadTimeError}</p>}
      {roadResult?.recommended?.id!==roadResult?.near?.id&&<p className="footnote">A recomendada pode não ser a via mais próxima; quando há tempos de condução, comparamos alternativas dentro de 300 m adicionais.</p>}
     </>}
     {!roadLoading&&!chosenRoad&&!roadError&&<button type="button" onClick={()=>searchRoad(result)}>Procurar estrada mais próxima</button>}
     <p className="road-caution"><strong>Atenção:</strong> o destino é apenas um ponto na estrada próxima. Não confirma estacionamento, passagem a pé, acesso autorizado nem entrada na plataforma ferroviária. O Google Maps/Waze calcula o percurso rodoviário.</p>
    </div>
   </section>}
   <details className="national-panel"><summary>Referências PK e calibração deste troço ({calibration.anchors?.length||0})</summary>
    <p>{calibration.note||preset.note}</p>{preset.source&&<p><a href={preset.source} target="_blank" rel="noreferrer">Documento utilizado como referência</a></p>}
    {refs.error&&<p className="warning">{refs.error}</p>}
    <div className="reference-list">{(calibration.anchors||[]).map((a,i)=><div key={`${a.pk}-${i}`}><span><strong>{a.pk}</strong> — {a.position==='start'?'Extremo A':a.position==='end'?'Extremo B':`GPS ${a.lat}, ${a.lng}`}<small>{a.source}</small></span><button className="danger-secondary" onClick={()=>updateCalibration({...calibration,anchors:calibration.anchors.filter((_,j)=>j!==i)})}>Eliminar</button></div>)}</div>
    <h3>Adicionar referência de PK conhecida</h3><p>O PK tem de corresponder exatamente ao extremo selecionado ou a coordenadas conhecidas sobre a linha; não inventar PK dos extremos.</p>
    <div className="national-fields"><label>PK<input value={refPK} placeholder="20+150" onChange={e=>setRefPK(e.target.value)}/></label><label>Tipo<select value={refMode} onChange={e=>setRefMode(e.target.value)}><option value="gps">Coordenadas GPS de um PK conhecido</option><option value="start">Extremo A (início da geometria)</option><option value="end">Extremo B (fim da geometria)</option></select></label></div>
    {refMode==='gps'&&<div className="national-fields"><label>Latitude<input value={refLat} onChange={e=>setRefLat(e.target.value)} placeholder="39.123456"/></label><label>Longitude<input value={refLng} onChange={e=>setRefLng(e.target.value)} placeholder="-8.123456"/></label><button onClick={async()=>{const g=await onGetGPS();if(g){setRefLat(String(g.lat));setRefLng(String(g.lng));}}}>Usar GPS do dispositivo</button></div>}
    <label>Fonte / observações<input value={refSource} onChange={e=>setRefSource(e.target.value)} placeholder="Ex.: marco quilométrico confirmado no terreno"/></label>
    <div className="actions"><button onClick={addReference}>Guardar referência</button><button className="secondary-btn" onClick={()=>updateCalibration(preset)}>Restaurar referências iniciais</button></div>
   </details>
   <details className="national-panel"><summary>PN, estações e edifícios deste troço ({relevantPOI.length} registos locais)</summary>
    <p>Regista um ativo com o respetivo PK. A coordenada é estimada quando houver calibração; não assume que o edifício está exatamente no eixo.</p>
    <div className="national-fields"><label>Tipo de ativo<select value={poiType} onChange={e=>setPoiType(e.target.value)}><option>Passagem de Nível</option><option>Estação/Apeadeiro</option><option>Edifício</option><option>Outro</option></select></label><label>Nome<input value={poiName} onChange={e=>setPoiName(e.target.value)}/></label><label>PK<input value={poiPK} placeholder="40+000" onChange={e=>setPoiPK(e.target.value)}/></label><button onClick={addPoi}>Adicionar ativo</button></div>
    {relevantPOI.map(p=><div className="national-poi" key={p.id}><span><strong>{p.categoria} · {p.nome}</strong> · {p.pk} · {p.lat?strCoord(p):'sem coordenadas calculadas'}</span><div className="actions"><button onClick={()=>{setPkText(p.pk);locatePK(p.pk);}}>Localizar e procurar estrada</button><button className="danger-secondary" onClick={()=>{const updated=pois.filter(x=>x.id!==p.id);save(LS_POIS,updated);setPois(updated);}}>Eliminar</button></div></div>)}
   </details>
   <div className="actions national-backup"><button onClick={backup}>Exportar backup da rede nacional</button><label className="file-action">Importar backup JSON<input type="file" accept=".json,application/json" onChange={e=>{importBackup(e.target.files?.[0]);e.target.value='';}}/></label></div>
  </>}
 </div>;
}
