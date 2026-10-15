import React,{useEffect,useMemo,useRef,useState} from 'react';
import L from 'leaflet';
import {parsePK,formatPK,validGPS,downloadText,metersBetween} from './lib/rail.js';
import {segmentKey,defaultCalibration,geometryProfile,pointAt,locateNationalPK,locateGeometricDistance,calibrationReferences,nearestOnProfile} from './lib/national.js';
import {findRoadAccess} from './lib/access.js';

const LS_CAL='rjp_nav_nacional_calibracoes_v38';
const LS_POIS='rjp_nav_nacional_ativos_v38';
const LS_ROADS='rjp_nav_nacional_acessos_v38';
const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{alert('Armazenamento cheio. Exporta um backup JSON dos dados.');return false;}};
const googleRoute=p=>`https://www.google.com/maps/dir/?api=1&destination=${p.lat}%2C${p.lng}&travelmode=driving`;
const waze=p=>`https://waze.com/ul?ll=${p.lat}%2C${p.lng}&navigate=yes`;
const strCoord=p=>`${Number(p.lat).toFixed(7)}, ${Number(p.lng).toFixed(7)}`;

function NationalMap({linha,segmentIndex,target,road,points=[]}){
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
   L.polyline(seg.coords,{color:i===segmentIndex?'#007750':'#83ada0',weight:i===segmentIndex?5:3,opacity:i===segmentIndex?.95:.55})
    .bindTooltip(`${linha.nome}: ${seg.segmento}`).addTo(group);
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
 },[linha,segmentIndex,target,road,points]);
 return <div className="map-shell"><div className="leaflet-map national-map" ref={el} aria-label="Mapa ferroviário nacional interativo"/><p className="footnote">Eixos ferroviários IP incluídos na aplicação. Fundo OSM requer internet; pontos PK/estrada são aproximações distintas. Linha tracejada não representa percurso pedonal.</p></div>;
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
 useEffect(()=>{setSegmentIndex(0);setResult(null);setRoadResult(null);setMessage('');},[selectedLine]);
 useEffect(()=>{setResult(null);setRoadResult(null);setRoadError('');setMessage('');},[segmentIndex]);
 function updateCalibration(next){const updated={...calibrations,[key]:next};if(save(LS_CAL,updated)){setCalibrations(updated);setResult(null);setRoadResult(null);setMessage('Referências guardadas neste dispositivo. Exporta um backup para as conservar.');}}
 function locatePK(value=pkText){if(!profile)return setMessage('O troço ainda não possui geometria utilizável.');
  const located=locateNationalPK(value,profile,calibration);if(located.error){setMessage(located.error);setResult(null);}else{setResult(located);setMessage(`Coordenada estimada: ${strCoord(located)}. Ainda não é um PK topograficamente certificado.`);}setRoadResult(null);setRoadError('');}
 function locateGeom(){if(!profile)return;const v=Number(geomText.replace(',','.'));const res=locateGeometricDistance(v,profile);
  if(res.error){setMessage(res.error);setResult(null);}else{setResult(res);setMessage('Localização por distância geométrica desde o extremo A; não equivale ao PK oficial.');}setRoadResult(null);setRoadError('');}
 async function findRoad(){if(!result?.lat)return;setRoadLoading(true);setRoadError('');setRoadResult(null);
  try{const r=await findRoadAccess({lat:result.lat,lng:result.lng},gps);setRoadResult(r);setRoadChoice(r.recommended.id);}catch(err){setRoadError(err?.message||'Serviço de estradas indisponível.');}
  finally{setRoadLoading(false);}}
 function addReference(){if(!profile)return;const pk=parsePK(refPK);if(pk===null||pk<0){setMessage('Introduz PK válido, por exemplo 20+150.');return;}
  const next={pk:formatPK(pk),source:refSource.trim()||'Registo manual (não validado)'};
  if(refMode!=='gps')next.position=refMode;
  else {const lat=Number(refLat.replace(',','.')),lng=Number(refLng.replace(',','.'));if(!refLat.trim()||!refLng.trim()||!validGPS(lat,lng)){setMessage('Coordenadas GPS inválidas.');return;}next.lat=lat;next.lng=lng;}
  const all=[...(calibration.anchors||[]),next];const checked=calibrationReferences(profile,{anchors:all});if(checked.error){setMessage('Referência não guardada: '+checked.error);return;}
  updateCalibration({...calibration,anchors:all,note:'Referências editadas pelo utilizador; validar PK no terreno.'});setRefPK('');setRefLat('');setRefLng('');}
 function addPoi(){const pk=parsePK(poiPK);if(!poiName.trim()||pk===null||pk<0){setMessage('Introduz o nome e o PK do ativo.');return;}
  if(pois.some(p=>p.segmentKey===key&&p.nome.trim().toLowerCase()===poiName.trim().toLowerCase()&&p.pk===formatPK(pk))){setMessage('Este ativo já existe.');return;}
  const updated=[...pois,{id:`nac-${Date.now()}`,segmentKey:key,linha:selectedLine,segmento:segment?.segmento,nome:poiName.trim(),pk:formatPK(pk),categoria:poiType}];if(save(LS_POIS,updated)){setPois(updated);setMessage('Ativo registado; as coordenadas são calculadas quando houver referências suficientes.');setPoiName('');setPoiPK('');}}
 function confirmRoad(){if(!chosenRoad||!result?.pk)return;
  if(!window.confirm('Confirmas que verificaste a estrada no terreno, e que existe acesso e paragem autorizados?'))return;
  const saved={lat:chosenRoad.lat,lng:chosenRoad.lng,name:chosenRoad.name,recordedAt:new Date().toISOString()};const updated={...accesses,[`${key}|${result.pk}`]:saved};if(save(LS_ROADS,updated)){setAccesses(updated);setMessage('Acesso rodoviário registado como confirmado por ti.');}}
 function backup(){downloadText(JSON.stringify({schema:'rjp.navigator.nacional.v38',calibrations,pois,accesses},null,2),'RJP_Navigator_Rede_Nacional_Backup.json','application/json');}
 async function importBackup(file){if(!file)return;try{const j=JSON.parse(await file.text());if(j.schema!=='rjp.navigator.nacional.v38'||!j.calibrations||!Array.isArray(j.pois)||!j.accesses)throw Error('Formato incompatível.');
  if(!window.confirm('Importar e SUBSTITUIR as referências e ativos nacionais que já guardaste?'))return;
  if(save(LS_CAL,j.calibrations)&&save(LS_POIS,j.pois)&&save(LS_ROADS,j.accesses)){setCalibrations(j.calibrations);setPois(j.pois);setAccesses(j.accesses);setResult(null);setMessage('Backup nacional importado.');}}
  catch(e){setMessage('Importação falhou: '+e.message);}}
 return <div className="national-nav"><h2>Pesquisa nacional — linha, troço e PK</h2>
  <p>Seleciona uma linha ferroviária. O eixo já vem incluído na aplicação e funciona sem descarregar cartografia. A pesquisa de estradas necessita de internet.</p>
  <div className="national-fields">
   <label>Linha ferroviária<select value={selectedLine} onChange={e=>onLineChange(e.target.value)}>{(network?.linhas||[]).map(l=><option key={l.nome} value={l.nome}>{l.nome}</option>)}</select></label>
   <label>Troço da linha<select value={segmentIndex} onChange={e=>setSegmentIndex(Number(e.target.value))}>{segments.map((s,i)=><option value={i} key={i}>{s.segmento}</option>)}</select></label>
  </div>
  <p className="muted">{network?.linhas?.length??0} linhas/designações · {segments.length} troço(s) nesta linha · {profile?`${(profile.length/1000).toFixed(2)} km de geometria`:'Sem eixo disponível'}.</p>
  {profile&&<>
   <div className="national-fields national-search">
    <label>PK oficial (ex.: 115+350)<input value={pkText} placeholder="115+350" onChange={e=>setPkText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&locatePK()}/></label>
    <button onClick={()=>locatePK()}>Localizar PK</button>
   </div>
   {locatable?<p className="ok">{refs.references.length} referências disponíveis — PK pesquisáveis no intervalo {formatPK(Math.min(...refs.references.map(r=>r.pk)))} a {formatPK(Math.max(...refs.references.map(r=>r.pk)))}. Resultado estimado sobre o eixo.</p>:<p className="road-caution">Sem calibração suficiente para localizar PK oficiais neste troço. Junta duas referências de PK conhecidas; até lá usa a distância geométrica (não oficial).</p>}
   <div className="national-fields national-geometry">
    <label>Distância geométrica desde o extremo A (metros, não é PK)<input value={geomText} onChange={e=>setGeomText(e.target.value)}/></label>
    <button className="secondary-btn" onClick={locateGeom}>Localizar pela geometria</button>
   </div>
   {message&&<p className="national-message" role="status">{message}</p>}
   {result?.lat&&<div className="result-box"><h3>{result.displayPK?'PK '+result.displayPK:'Distância geométrica'} — coordenadas calculadas</h3>
    <p><strong>{strCoord(result)}</strong></p><p>{result.status}. {result.confidence||''}</p>
    <div className="actions"><a href={`https://www.google.com/maps/search/?api=1&query=${result.lat}%2C${result.lng}`} target="_blank" rel="noreferrer">Ver ponto na ferrovia</a><button onClick={findRoad} disabled={roadLoading}>{roadLoading?'A procurar estradas…':'Procurar estrada mais próxima'}</button></div>
    {roadError&&<p className="warning">Não foi possível calcular o acesso: {roadError}</p>}
    {savedRoad&&<p className="road-confirmed">Acesso anteriormente confirmado: {strCoord(savedRoad)}. <a href={googleRoute(savedRoad)} target="_blank" rel="noreferrer">Navegar pelo Google Maps</a></p>}
    {roadResult&&<div className="road-result"><h3>Possíveis acessos rodoviários</h3><p>Estrada mais próxima: {Math.round(roadResult.near.gapMeters)} m em linha reta. A opção recomendada pode ter melhor tempo de viagem, se o teu GPS estiver disponível.</p>
     <label className="national-choice">Escolher aproximação rodoviária<select value={roadChoice} onChange={e=>setRoadChoice(e.target.value)}>{roadResult.alternatives.map(a=><option key={a.id} value={a.id}>{a.name} · {Math.round(a.gapMeters)} m{a.durationMin!=null?` · ${a.durationMin} min condução`:''}</option>)}</select></label>
     {chosenRoad&&<><p>{chosenRoad.warning||'Tipo de estrada e autorização de acesso por confirmar.'}</p><div className="actions"><a target="_blank" rel="noreferrer" href={googleRoute(chosenRoad)}>Google Maps — conduzir</a><a target="_blank" rel="noreferrer" href={waze(chosenRoad)}>Waze — conduzir</a>{result.pk!=null&&<button onClick={confirmRoad}>Guardar acesso confirmado</button>}</div></>}
     <p className="road-caution">Não conduz à via ferroviária; mostra um ponto de aproximação na estrada. A existência de passagem pedonal, autorização e possibilidade de parar não estão garantidas.</p>
    </div>}
   </div>}
   <NationalMap linha={networkLine} segmentIndex={segmentIndex} target={result} road={chosenRoad} points={relevantPOI}/>
   <details className="national-panel"><summary>Referências PK e calibração deste troço ({calibration.anchors?.length||0})</summary>
    <p>{calibration.note||preset.note}</p>{preset.source&&<p><a href={preset.source} target="_blank" rel="noreferrer">Documento utilizado como referência</a></p>}
    {refs.error&&<p className="warning">{refs.error}</p>}
    <div className="reference-list">{(calibration.anchors||[]).map((a,i)=><div key={`${a.pk}-${i}`}><span><strong>{a.pk}</strong> — {a.position==='start'?'Extremo A':a.position==='end'?'Extremo B':`GPS ${a.lat}, ${a.lng}`}<small>{a.source}</small></span><button className="danger-secondary" onClick={()=>updateCalibration({...calibration,anchors:calibration.anchors.filter((_,j)=>j!==i)})}>Eliminar</button></div>)}</div>
    <h3>Adicionar referência de PK conhecida</h3><p>O PK tem de corresponder exatamente ao extremo selecionado ou a uma coordenada conhecida sobre a linha; não inventar PK dos extremos.</p>
    <div className="national-fields"><label>PK<input value={refPK} placeholder="20+150" onChange={e=>setRefPK(e.target.value)}/></label><label>Tipo<select value={refMode} onChange={e=>setRefMode(e.target.value)}><option value="gps">Coordenadas GPS de um PK conhecido</option><option value="start">Extremo A (início da geometria)</option><option value="end">Extremo B (fim da geometria)</option></select></label></div>
    {refMode==='gps'&&<div className="national-fields"><label>Latitude<input value={refLat} onChange={e=>setRefLat(e.target.value)} placeholder="39.123456"/></label><label>Longitude<input value={refLng} onChange={e=>setRefLng(e.target.value)} placeholder="-8.123456"/></label><button onClick={async()=>{const g=await onGetGPS();if(g){setRefLat(String(g.lat));setRefLng(String(g.lng));}}}>Usar GPS do dispositivo</button></div>}
    <label>Fonte / observações<input value={refSource} onChange={e=>setRefSource(e.target.value)} placeholder="Ex.: marco quilométrico confirmado no terreno"/></label>
    <div className="actions"><button onClick={addReference}>Guardar referência</button><button className="secondary-btn" onClick={()=>updateCalibration(preset)}>Restaurar referências iniciais</button></div>
   </details>
   <details className="national-panel"><summary>PN, estações e edifícios deste troço ({relevantPOI.length} registos locais)</summary>
    <p>Regista um ativo com o respetivo PK. O Navigator calcula a coordenada quando a calibração estiver disponível; não assume que o edifício esteja exatamente sobre o eixo da via.</p>
    <div className="national-fields"><label>Tipo de ativo<select value={poiType} onChange={e=>setPoiType(e.target.value)}><option>Passagem de Nível</option><option>Estação/Apeadeiro</option><option>Edifício</option><option>Outro</option></select></label><label>Nome<input value={poiName} onChange={e=>setPoiName(e.target.value)}/></label><label>PK<input value={poiPK} placeholder="40+000" onChange={e=>setPoiPK(e.target.value)}/></label><button onClick={addPoi}>Adicionar ativo</button></div>
    {relevantPOI.map(p=><div className="national-poi" key={p.id}><span><strong>{p.categoria} · {p.nome}</strong> · {p.pk} · {p.lat?strCoord(p):'sem coordenadas calculadas'}</span><div className="actions"><button onClick={()=>{setPkText(p.pk);locatePK(p.pk);}}>Localizar</button><button className="danger-secondary" onClick={()=>{const updated=pois.filter(x=>x.id!==p.id);save(LS_POIS,updated);setPois(updated);}}>Eliminar</button></div></div>)}
   </details>
   <div className="actions national-backup"><button onClick={backup}>Exportar backup da rede nacional</button><label className="file-action">Importar backup JSON<input type="file" accept=".json,application/json" onChange={e=>{importBackup(e.target.files?.[0]);e.target.value='';}}/></label></div>
  </>}
 </div>;
}
