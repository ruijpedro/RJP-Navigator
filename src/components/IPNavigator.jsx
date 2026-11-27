import React,{useEffect,useMemo,useRef,useState} from 'react';
import L from 'leaflet';
import {nearest,normalize,projectCorridor,pkStatus} from '../lib/ipSpatial.mjs';

const base=import.meta.env.BASE_URL;
async function load(path){
 const response=await fetch(base+path,{cache:'force-cache'});
 if(!response.ok)throw new Error('HTTP '+response.status+': '+path);
 return response.json();
}
function railFallback(data){
 return (data.linhas||[]).flatMap(line=>(line.segmentos||[]).map(s=>({name:line.nome,detail:s.segmento,points:s.coords}))).filter(x=>x.points?.length>1);
}
const keys={rail:'Linha ferroviária',road:'Estrada',stations:'Estação/apeadeiro'};
export default function IPNavigator({gps,onGPS}){
 const [data,setData]=useState({rail:[],road:[],stations:[]});
 const [status,setStatus]=useState('A carregar cartografia offline…');
 const [kind,setKind]=useState('rail'),[query,setQuery]=useState(''),[selected,setSelected]=useState(null);
 const [anchors,setAnchors]=useState(()=>{try{return JSON.parse(localStorage.getItem('rjp-ip-pk-v1')||'{}')||{}}catch{return {}}});
 const [pkInput,setPkInput]=useState(''),[calMessage,setCalMessage]=useState('');
 const mapEl=useRef(null),mapRef=useRef(null),layersRef=useRef(null);
 useEffect(()=>{
  let active=true;
  Promise.allSettled([
   load('data/ip/rail.json').catch(async()=>railFallback(await load('data/rede-ferroviaria-nacional.json'))),
   load('data/ip/road.json'),
   load('data/ip/stations.json')
  ]).then(([rail,road,stations])=>{
   if(!active)return;
   const next={rail:rail.status==='fulfilled'?rail.value:[],road:road.status==='fulfilled'?road.value:[],stations:stations.status==='fulfilled'?stations.value:[]};
   setData(next);
   setStatus(next.rail.length&&next.road.length&&next.stations.length?'Cartografia nacional disponível offline':'Atenção: uma ou mais camadas não estão disponíveis neste pacote');
  });
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  if(!mapEl.current)return;
  const map=L.map(mapEl.current,{preferCanvas:true,scrollWheelZoom:false}).setView([39.6,-8.2],7);
  const layers=L.layerGroup().addTo(map);
  mapRef.current=map;layersRef.current=layers;
  L.control.scale({imperial:false}).addTo(map);
  return()=>{map.remove();mapRef.current=null;layersRef.current=null};
 },[]);
 const items=data[kind]||[];
 const hits=useMemo(()=>items.filter(x=>normalize([x.name,x.detail,x.line,x.municipality,x.district].join(' ')).includes(normalize(query))).slice(0,60),[items,query]);
 const near=useMemo(()=>gps?Object.fromEntries(Object.entries(data).map(([k,list])=>[k,nearest(gps,list)])):null,[gps,data]);
 const rail=near?.rail?.item;
 const railKey=rail?JSON.stringify([rail.name,rail.detail,rail.points[0],rail.points.at(-1),rail.points.length]):null;
 const projection=useMemo(()=>{
  if(!rail||!gps)return null;
  const sy=111195,sx=sy*Math.cos(39.5*Math.PI/180);
  const xy=([lat,lng])=>[lng*sx,lat*sy];
  return projectCorridor(xy([+gps.lat,+gps.lng]),rail.points.map(xy));
 },[rail,gps]);
 const localAnchors=railKey?(anchors[railKey]||[]):[];
 const pk=pkStatus(near?.rail?.distance<=30?projection?.chainage:NaN,localAnchors);
 function saveAnchors(list){
  const next={...anchors,[railKey]:list};
  try{localStorage.setItem('rjp-ip-pk-v1',JSON.stringify(next));setAnchors(next);setCalMessage('Calibração guardada neste dispositivo.')}catch{setCalMessage('Não foi possível guardar a calibração.')}
 }
 function exportCalibration(){
  const blob=new Blob([JSON.stringify({schema:1,anchors},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rjp-pk-calibracao.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function importCalibration(event){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{
   if(file.size>2000000)throw Error('Ficheiro demasiado grande');
   const payload=JSON.parse(await file.text());
   if(payload.schema!==1||!payload.anchors||typeof payload.anchors!=='object'||Array.isArray(payload.anchors))throw Error('Formato inválido');
   const validKeys=new Set(data.rail.map(r=>JSON.stringify([r.name,r.detail,r.points[0],r.points.at(-1),r.points.length])));
   const next={...anchors};let count=0;
   for(const [key,list] of Object.entries(payload.anchors)){
    if(!validKeys.has(key)||!Array.isArray(list)||list.length>10000)throw Error('Corredor incompatível ou lista inválida');
    const sorted=[...list].sort((a,b)=>a.chainage-b.chainage);
    if(sorted.some(a=>!a||!Number.isFinite(a.chainage)||a.chainage<0||!Number.isFinite(a.pk)||a.pk<0))throw Error('Referência inválida');
    const ds=sorted.slice(1).map((a,i)=>a.pk-sorted[i].pk);
    if(sorted.some((a,i)=>i>0&&a.chainage-sorted[i-1].chainage<5)||(ds.length&&!(ds.every(d=>d>0)||ds.every(d=>d<0))))throw Error('Calibração incoerente');
    if(Object.hasOwn(next,key)&&JSON.stringify(next[key])!==JSON.stringify(sorted))throw Error('Conflito com calibração local; exporte e resolva antes de importar');
    next[key]=sorted;count+=sorted.length;
   }
   localStorage.setItem('rjp-ip-pk-v1',JSON.stringify(next));setAnchors(next);setCalMessage(count+' pontos importados, sem substituir calibrações existentes.');
  }catch(e){setCalMessage('Importação rejeitada: '+e.message);}
 }
 function addAnchor(){
  const value=Number(pkInput.replace(',','.'))*1000;
  if(!railKey||!projection||near.rail.distance>30||!pkInput.trim()||!Number.isFinite(value)||value<0){setCalMessage('Introduza um PK válido em km e aproxime-se a menos de 30 m do corredor.');return;}
  if(localAnchors.some(a=>Math.abs(a.chainage-projection.chainage)<5)){setCalMessage('Já existe um ponto de calibração a menos de 5 m.');return;}
  const next=[...localAnchors,{chainage:projection.chainage,pk:value}].sort((a,b)=>a.chainage-b.chainage);
  const deltas=next.slice(1).map((a,i)=>a.pk-next[i].pk);
  if(deltas.length&&!(deltas.every(d=>d>0)||deltas.every(d=>d<0))){setCalMessage('PK incoerentes: os valores devem crescer ou decrescer ao longo do corredor. Verifique os pontos.');return;}
  saveAnchors(next);setPkInput('');
 }
 const access=useMemo(()=>{
  if(!selected||!data.road.length)return null;
  const point=selected.point||selected.points?.[0];
  return point?nearest({lat:point[0],lng:point[1]},data.road):null;
 },[selected,data.road]);
 useEffect(()=>{
  const group=layersRef.current,map=mapRef.current;
  if(!group||!map)return;
  group.clearLayers();
  for(const segment of data.rail){
   if(segment.points?.length>1)L.polyline(segment.points,{color:'#168369',weight:2,interactive:false}).addTo(group);
  }
  if(gps&&Number.isFinite(+gps.lat)&&Number.isFinite(+gps.lng))
   L.circleMarker([+gps.lat,+gps.lng],{color:'#2563eb',radius:7,fillOpacity:1}).addTo(group);
  if(selected){
   const p=selected.points;
   const marker=p?.length>1?L.polyline(p,{color:'#e78a18',weight:5}).addTo(group):
    selected.point?L.circleMarker(selected.point,{color:'#e78a18',radius:9}).addTo(group):null;
   if(marker){
    if(p?.length>1)map.fitBounds(marker.getBounds(),{padding:[18,18]});
    else map.setView(selected.point,14);
   }
  }
 },[data,gps,selected]);
 const changeKind=k=>{setKind(k);setSelected(null)};
 return <section className="card" aria-label="Cartografia IP">
  <h2>Cartografia IP</h2>
  <p>{status}. Base geográfica sem necessidade de mosaicos online.</p>
  <p><b>{data.rail.length}</b> segmentos ferroviários · <b>{data.road.length}</b> troços rodoviários · <b>{data.stations.length}</b> estações e apeadeiros</p>
  <button type="button" onClick={onGPS}>Atualizar GPS</button>
  {near&&Object.entries(near).map(([k,x])=>x&&<p key={k}><b>{keys[k]} mais próxima:</b> {x.item.name} · {Math.round(x.distance)} m</p>)}
  <div className="card">
   <h3>Calibração local de PK</h3>
   <p>Corredor GPS: {rail?.name||'Indisponível'} {rail?.detail||''}</p>
   <p><b>{pk.status==='calibrated'?'PK calibrado localmente: '+(pk.pk/1000).toFixed(3):'PK indisponível'}</b></p>
   <label>PK conhecido (km) <input inputMode="decimal" value={pkInput} onChange={e=>setPkInput(e.target.value)} placeholder="Ex.: 123,456"/></label>
   <button type="button" disabled={!railKey} onClick={addAnchor}>Guardar ponto GPS + PK</button>
   <button type="button" onClick={exportCalibration}>Exportar calibrações JSON</button>
   <label>Importar calibrações <input type="file" accept=".json,application/json" disabled={!data.rail.length} onChange={importCalibration}/></label>
   <p>{calMessage}</p>
   {localAnchors.map((a,i)=><p key={a.chainage}>PK {(a.pk/1000).toFixed(3)} <button type="button" onClick={()=>saveAnchors(localAnchors.filter((_,j)=>i!==j))}>Remover</button></p>)}
   <small>São necessários dois pontos no mesmo corredor. Confirme a linha e o PK no terreno. Calibração local, não certificada; não utilizar como referência de segurança ferroviária.</small>
  </div>
  <p className="footnote">Distâncias aproximadas. A presença de uma estrada próxima não confirma acesso autorizado. A cartografia não contém PK oficiais associados a cada vértice.</p>
  <label>Categoria <select value={kind} onChange={e=>changeKind(e.target.value)}>
   <option value="rail">Ferrovia</option><option value="road">Rodovia</option><option value="stations">Estações e apeadeiros</option>
  </select></label>
  <input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Pesquisar cartografia IP" placeholder="Pesquisar nome, estrada, linha ou distrito"/>
  <div style={{maxHeight:220,overflowY:'auto'}}>{hits.map((x,i)=><button type="button" key={i} style={{display:'block',width:'100%',textAlign:'left',padding:6}} onClick={()=>setSelected(x)}>{x.name} · {x.detail||x.line||x.municipality||''}</button>)}</div>
  <div ref={mapEl} style={{height:380,background:'#e5e7eb',borderRadius:8}} role="img" aria-label="Mapa vetorial offline de corredores ferroviários e pontos selecionados"/>
  {access&&<p>Estrada próxima do ponto selecionado: <b>{access.item.name}</b> ({Math.round(access.distance)} m). Acesso rodoviário não validado.</p>}
 </section>;
}
