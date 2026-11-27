import React,{useEffect,useMemo,useState} from 'react';
import {nearest,normalize} from '../lib/ipSpatial.mjs';

const base=import.meta.env.BASE_URL;
const load=async (path)=>{const res=await fetch(base+path,{cache:'force-cache'});if(!res.ok)throw new Error(path);return res.json();};
export default function IPNavigator({gps,onGPS}){
 const [rail,setRail]=useState([]),[roads,setRoads]=useState([]),[stations,setStations]=useState([]);
 const [status,setStatus]=useState('A carregar dados locais…'),[kind,setKind]=useState('rail'),[q,setQ]=useState('');
 useEffect(()=>{let alive=true;
  Promise.allSettled([
   load('data/ip/rail.json').catch(async()=>{const data=await load('data/rede-ferroviaria-nacional.json');return (data.linhas||[]).flatMap(l=>(l.segmentos||[]).map(s=>({name:l.nome,detail:s.segmento,points:s.coords})));}),
   load('data/ip/road.json'),
   load('data/ip/stations.json')
  ]).then(([r,d,s])=>{if(!alive)return;
   setRail(r.status==='fulfilled'?r.value:[]);
   setRoads(d.status==='fulfilled'?d.value:[]);
   setStations(s.status==='fulfilled'?s.value:[]);
   setStatus(r.status==='fulfilled'?'Cartografia ferroviária local disponível':'Ficheiro ferroviário offline indisponível');
  });return()=>{alive=false;};
 },[]);
 const data={rail,road:roads,stations},items=data[kind]||[];
 const filtered=useMemo(()=>items.filter(x=>normalize([x.name,x.line,x.detail,x.municipality].join(' ')).includes(normalize(q))).slice(0,60),[items,q]);
 const close=useMemo(()=>gps?Object.fromEntries(Object.entries(data).map(([key,list])=>[key,nearest(gps,list)])):null,[gps,rail,roads,stations]);
 return <section className="card" aria-label="Cartografia IP">
  <h2>Cartografia IP</h2><p>{status}. Dados apresentados sem ligação aos mapas online.</p>
  <p><b>Ferrovia:</b> {rail.length} segmentos · <b>Rodovia:</b> {roads.length} segmentos · <b>Estações:</b> {stations.length}</p>
  <button type="button" onClick={onGPS}>Atualizar GPS</button>
  {close&&Object.entries(close).map(([name,result])=>result&&<p key={name}><b>{({rail:'Linha',road:'Estrada',stations:'Estação'})[name]} próxima:</b> {result.item.name||result.item.line} — {Math.round(result.distance)} m</p>)}
  <p className="footnote">Distâncias geográficas aproximadas; não equivalem a PK oficiais. O GPS deve ser validado no terreno.</p>
  <label>Filtrar <select value={kind} onChange={e=>setKind(e.target.value)}><option value="rail">Linhas ferroviárias</option><option value="road">Estradas</option><option value="stations">Estações/apeadeiros</option></select></label>
  <input value={q} onChange={e=>setQ(e.target.value)} aria-label="Pesquisar cartografia IP" placeholder="Nome, linha, concelho…"/>
  {((kind==='road'&&!roads.length)||(kind==='stations'&&!stations.length))&&<p>Esta camada ainda não está disponível no pacote experimental. Mantém-se a rede ferroviária existente.</p>}
  <div style={{maxHeight:280,overflowY:'auto'}}>{filtered.map((x,i)=><div key={i} style={{padding:'6px 0',borderBottom:'1px solid #9994'}}><strong>{x.name}</strong> <small>{x.detail||x.line||x.municipality||''}</small></div>)}</div>
 </section>;
}
