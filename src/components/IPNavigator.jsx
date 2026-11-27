import React,{useEffect,useMemo,useRef,useState} from 'react';
import L from 'leaflet';
import {nearest,normalize} from '../lib/ipSpatial.mjs';

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
