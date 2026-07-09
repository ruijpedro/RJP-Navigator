import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import { estacoesLinhaOeste } from './data/estacoes.js'
import { passagensNivelLinhaOeste } from './data/passagensNivel.js'
import { marcosKmLinhaOeste, marcosPrincipaisLinhaOeste } from './data/marcosKm.js'

const LS_LOCAIS = 'rjp_nav_locais_extra_v1'
const LS_DESLOC = 'rjp_nav_deslocacoes_v1'
const mapsUrl = (item) => {
  const q = item.lat && item.lng ? `${item.lat},${item.lng}` : `${item.nome || item.indice || ''} ${item.localidade || ''} ${item.concelho || ''} Portugal`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
const wazeUrl = (item) => {
  const q = item.lat && item.lng ? `${item.lat},${item.lng}` : `${item.nome || item.indice || ''} ${item.localidade || ''} ${item.concelho || ''} Portugal`
  return `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`
}
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(d)) } catch { return d } }
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const today = () => new Date().toISOString().slice(0, 10)

function App(){
  const [tab,setTab] = useState('dashboard')
  const [q,setQ] = useState('')
  const [tipo,setTipo] = useState('todos')
  const [sel,setSel] = useState(null)
  const [gps,setGps] = useState(null)
  const [extras,setExtras] = useState(load(LS_LOCAIS, []))
  const [desloc,setDesloc] = useState(load(LS_DESLOC, []))
  const [form,setForm] = useState({categoria:'Passagem de Nível',nome:'',indice:'',pk:'',localidade:'',concelho:'',freguesia:'',observacoes:''})

  const ativos = useMemo(()=>[
    ...estacoesLinhaOeste.map(x=>({ ...x, key:'est-'+x.id, titulo:x.nome })),
    ...passagensNivelLinhaOeste.map(x=>({ ...x, key:'pn-'+x.id, titulo:`${x.indice} · PK ${x.pk}` })),
    ...marcosKmLinhaOeste.map(x=>({ ...x, key:'km-'+x.id, titulo:x.nome })),
    ...extras.map((x,i)=>({ ...x, key:'extra-'+i, titulo:x.nome || x.indice || 'Local registado' }))
  ],[extras])

  const filtrados = useMemo(()=>ativos.filter(a=>{
    const text = JSON.stringify(a).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    const query = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    const okTipo = tipo === 'todos' || a.categoria === tipo || (tipo === 'desativadas' && a.estado === 'Desativada')
    return okTipo && text.includes(query)
  }).sort((a,b)=>String(a.pk || a.km || '').localeCompare(String(b.pk || b.km || ''), 'pt')),[ativos,q,tipo])

  function obterGPS(){
    if(!navigator.geolocation){ alert('GPS não disponível neste dispositivo.'); return }
    navigator.geolocation.getCurrentPosition(
      p=>setGps({lat:p.coords.latitude.toFixed(6), lng:p.coords.longitude.toFixed(6), acc:Math.round(p.coords.accuracy)}),
      ()=>alert('Não foi possível obter a localização. Confirma permissões de GPS.'),
      {enableHighAccuracy:true, timeout:10000}
    )
  }
  function registarDeslocacao(item){
    const row = {id:Date.now(), data:today(), hora:new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}), destino:item.titulo || item.nome || item.indice, categoria:item.categoria, pk:item.pk || item.km || '', gps:gps ? `${gps.lat}, ${gps.lng}` : '', obs:''}
    const novo = [row, ...desloc]
    setDesloc(novo); save(LS_DESLOC, novo); alert('Deslocação registada.')
  }
  function adicionarLocal(){
    const novo = {...form, id:'local-'+Date.now(), linha:'Linha do Oeste', lat:gps?.lat || '', lng:gps?.lng || '', estado:'Ativa'}
    const lista = [novo, ...extras]
    setExtras(lista); save(LS_LOCAIS, lista)
    setForm({categoria:'Passagem de Nível',nome:'',indice:'',pk:'',localidade:'',concelho:'',freguesia:'',observacoes:''})
    setTab('locais')
  }
  function exportarJSON(){
    const blob = new Blob([JSON.stringify({locais:ativos, deslocacoes:desloc}, null, 2)], {type:'application/json'})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='rjp-navigator-dados.json'; a.click()
  }

  const current = sel || filtrados[0]
  return <div className="app">
    <header>
      <img src="/ip-logo.png" onError={e=>e.currentTarget.style.display='none'} />
      <div><h1>RJP Navigator</h1><p>Navegador técnico · Linha do Oeste</p></div>
    </header>

    <nav>
      {[['dashboard','Início'],['locais','Locais'],['pn','PN'],['km','PK/Km'],['mapa','Mapa'],['novo','Novo'],['desloc','Deslocações']].map(([k,t])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{t}</button>)}
    </nav>

    {tab==='dashboard' && <main className="grid">
      <section className="card hero"><h2>RJP Rail Navigator</h2><p>Base local para consulta e navegação dos ativos ferroviários da Linha do Oeste.</p><div className="stats"><b>{estacoesLinhaOeste.length}</b><span>Estações/Apeadeiros</span><b>{passagensNivelLinhaOeste.length}</b><span>Passagens de Nível</span><b>{marcosKmLinhaOeste.length}</b><span>Marcos PK/Km</span><b>{extras.length}</b><span>Locais adicionados</span></div></section>
      <section className="card"><h3>GPS</h3><p>{gps ? `Lat ${gps.lat} · Lng ${gps.lng} · precisão ${gps.acc} m` : 'Ainda sem posição GPS.'}</p><button onClick={obterGPS}>Atualizar GPS</button></section>
      <section className="card"><h3>Ações rápidas</h3><button onClick={()=>setTab('pn')}>Ver Passagens de Nível</button><button onClick={()=>setTab('km')}>Ver PK/Km</button><button onClick={()=>setTab('novo')}>Adicionar PN com GPS</button><button onClick={exportarJSON}>Exportar JSON</button></section>
    </main>}

    {(tab==='locais' || tab==='pn' || tab==='km' || tab==='mapa') && <main className="layout">
      <aside className="card list">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar por PK, OE, localidade..." />
        <select value={tipo} onChange={e=>setTipo(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="Estação/Apeadeiro">Estações/Apeadeiros</option>
          <option value="Passagem de Nível">Passagens de Nível</option>
          <option value="Marco Quilométrico">Marcos PK/Km</option>
          <option value="desativadas">PN desativadas</option>
        </select>
        {filtrados.map(item=><button key={item.key} className={'row '+(current?.key===item.key?'sel':'')} onClick={()=>setSel(item)}><b>{item.titulo}</b><small>{item.categoria} · {item.localidade || item.nome || ''} · {item.concelho || ''}</small></button>)}
      </aside>
      <section className="card detail">
        {current && <>
          <h2>{current.titulo}</h2>
          <p className="pill">{current.categoria}</p>
          <dl>
            <dt>PK/Km</dt><dd>{current.pk || current.km || '-'}</dd><dt>Tipo</dt><dd>{current.tipo || '-'}</dd><dt>Lado</dt><dd>{current.lado || '-'}</dd><dt>Localidade</dt><dd>{current.localidade || current.nome || '-'}</dd><dt>Concelho</dt><dd>{current.concelho || '-'}</dd><dt>Freguesia</dt><dd>{current.freguesia || '-'}</dd><dt>Estado</dt><dd>{current.estado || '-'}</dd><dt>Observações</dt><dd>{current.observacoes || '-'}</dd>
          </dl>
          {tab==='km' && <div className="pkbox"><h3>Referências rápidas</h3>{marcosPrincipaisLinhaOeste.map(m=><button key={m.pk} className="tag" onClick={()=>setQ(m.pk)}>{m.pk} · {m.nome}</button>)}</div>}
          {tab==='mapa' && <iframe title="mapa" className="map" src={`https://www.openstreetmap.org/export/embed.html?bbox=-9.45%2C38.55%2C-8.65%2C39.95&layer=mapnik&marker=${current.lat || 39.743}%2C${current.lng || -8.807}`}></iframe>}
          <div className="actions"><a href={mapsUrl(current)} target="_blank">Abrir Google Maps</a><a href={wazeUrl(current)} target="_blank">Abrir Waze</a><button onClick={()=>registarDeslocacao(current)}>Registar deslocação</button></div>
        </>}
      </section>
    </main>}

    {tab==='novo' && <main className="card form"><h2>Adicionar novo local / PN</h2><p>Usa o GPS no terreno e preenche os dados conhecidos.</p><button onClick={obterGPS}>Usar GPS atual</button>{gps && <p className="ok">GPS: {gps.lat}, {gps.lng}</p>}{['categoria','nome','indice','pk','localidade','concelho','freguesia','observacoes'].map(k=><label key={k}>{k}<input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<button onClick={adicionarLocal}>Guardar local</button></main>}

    {tab==='desloc' && <main className="card"><h2>Deslocações</h2>{desloc.length===0 && <p>Sem deslocações registadas.</p>}<table><thead><tr><th>Data</th><th>Hora</th><th>Destino</th><th>PK</th><th>GPS</th></tr></thead><tbody>{desloc.map(d=><tr key={d.id}><td>{d.data}</td><td>{d.hora}</td><td>{d.destino}</td><td>{d.pk}</td><td>{d.gps}</td></tr>)}</tbody></table></main>}

    <footer>RJP Navigator V1.1 · uso interno/académico · dados editáveis em src/data</footer>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
