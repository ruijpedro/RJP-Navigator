# RJP Navigator V3.5 — PK → estrada próxima → navegação

A versão V3.5 acrescenta a pesquisa automática do ponto de estrada mais próximo de um PK pedido no troço **21+191–191+191** da Linha do Oeste. O traçado ferroviário pré-carregado na compilação (quando disponível) ou descarregado pela app fornece uma **estimativa** da coordenada do PK. Depois, a app obtém do OpenStreetMap vias rodoviárias próximas, exclui algumas categorias inadequadas, projeta a coordenada ferroviária na estrada, mostra a **distância em linha reta** e permite abrir a navegação de automóvel no Google Maps ou Waze.

Quando a localização GPS do utilizador está disponível, consulta o serviço público OSRM para calcular tempos de condução estimados até alternativas próximas. Prioriza estradas perto da ferrovia; entre opções até 300 m mais afastadas do PK que a estrada mais próxima, recomenda a que tem menor tempo estimado de condução. **Não utiliza trânsito em tempo real; o Google Maps/Waze recalcula o percurso.**

Se o Overpass estiver indisponível, tenta localizar a estrada navegável mais próxima pelo serviço OSRM Nearest (resultado não validado). Se ambos falharem, a app apresenta o erro sem fabricar coordenadas. A visualização do mapa base, pesquisa de estradas e rotas requer internet. O eixo ferroviário só ficará empacotado na APK se o passo `prepare:maps` conseguir obtê-lo na compilação.

**Importante:** estar perto da linha não garante via pública, estacionamento, acesso pedonal nem autorização para entrada em domínio ferroviário. Apenas um acesso explicitamente confirmado pelo utilizador é guardado como validado. As estimativas de PK também precisam de calibração com marcos oficiais / GPS de campo.

Para gerar APK: copiar conteúdo para a raiz do repositório; executar GitHub Actions **Build RJP Navigator APK V3.5**. Para funcionar como atualização sem desinstalar, a APK deve ter a mesma assinatura Android da app instalada; fazer backup JSON antes.

## Créditos e licenças

© OpenStreetMap contributors — ODbL. Overlay OpenRailwayMap / Leaflet. Routing estimativo: OSRM demo público, sujeito a limites e disponibilidade; não apropriado para utilização profissional intensiva sem serviço próprio.

---

# RJP Navigator V3.4 — Mapas carregados por defeito

**O mapa abre automaticamente**, com OpenRailwayMap ligada e o troço de responsabilidade PK 21+191–191+191 já enquadrado. Não é preciso importar GeoJSON nem tocar no botão «Atualizar cartografia».

### Duas formas de receber o mapa

1. **Na compilação GitHub Actions:** `npm run prepare:maps` procura obter o eixo real da relação OpenStreetMap 2076345, valida a continuidade e os limites e grava o traçado e os pontos cartografados em `public/data/linha-oeste-preload.json`. O Vite empacota esse ficheiro diretamente na APK e WebApp.
2. **Na primeira abertura:** se a API pública não tiver respondido durante a compilação, a aplicação descarrega o eixo automaticamente com ligação à internet e guarda-o localmente, sem configuração manual.

O mapa rodoviário e a camada gráfica de OpenRailwayMap são mosaicos da internet e **não funcionam totalmente offline**. O motor do mapa (Leaflet) passou a fazer parte da APK, deixando de depender de CDN. Caso o serviço de cartografia fique indisponível tanto na compilação como no telemóvel, os registos PK/PN/EDF mantêm-se consultáveis, mas o PK não poderá ser geolocalizado até ser obtido um traçado fiável. Não são inventadas coordenadas.

Os dois limites geográficos foram convertidos assumindo EPSG:3763. A interpolação dos PK exige pontos de calibração ao longo da linha para ser considerada rigorosa. Acesso por estrada só por pontos confirmados. A cartografia OSM é disponibilizada sob ODbL com atribuição © OpenStreetMap contributors; eventuais dados IP têm CC BY 4.0 e exigem atribuição se adicionados posteriormente.

### Instalar

Extrair o ZIP e copiar o conteúdo para a raiz de `ruijpedro/RJP-Navigator`. A Action `Build RJP Navigator APK V3.4` gera os dados, compila a WebApp e a APK. No GitHub, consultar no log a mensagem `Dados cartográficos guardados: sim` para confirmar que o mapa foi efetivamente embutido. Se disser `não`, a aplicação tentará a alternativa online. Não é obrigatório instalar o ZIP separadamente no telemóvel.

---

# RJP Navigator V3.3 — Linha do Oeste / PK e coordenadas GPS

## Corrige a funcionalidade de localização

A V3.2 não localizava PK sem que o utilizador importasse previamente um traçado em GeoJSON. A V3.3 tenta obter automaticamente a geometria da **relação OSM 2076345** (Linha do Oeste) e os pontos OSM (PN, estações e edifícios de estação) através da **Overpass API**, quando existe ligação à internet. Inclui o botão **Atualizar cartografia OSM**. O primeiro carregamento pode demorar; se houver erro, o utilizador pode tentar novamente ou importar GeoJSON.

- Mantém os **59 registos de PN**, **38 estações/apeadeiros** e edifícios associados da versão anterior. Inclui exportação CSV (origem GPS/fiabilidade).
- Mantém os limites de referência fornecidos pelo utilizador: **PK 21+191** a **PK 191+191**, com o CRS original **EPSG:3763 assumido, não confirmado**.
- Permite localizar PK intermédios por **interpolação sobre a geometria real do eixo**, em vez de unir os pontos iniciais/finais por uma linha reta.
- Calcula posições aproximadas dos PK sem correspondência direta; acrescenta coordenadas OSM de PN **apenas quando a correspondência é geometricamente inequívoca**.
- Procura estações/apeadeiros pelo nome no OSM. Os edifícios ferroviários sem cartografia específica **não são considerados localizados com precisão**: a localização junto à estação é apenas uma referência provisória.
- Guarda coordenadas digitadas manualmente com o rótulo **por validar**, ou o GPS registado em campo como confirmado. Estes valores têm prioridade sobre as estimativas e podem servir de pontos de calibração se forem GPS de campo.
- O botão **Localizar PK** usa agora o traçado descarregado; há ligações para Google Maps (ponto) e exportação KML para **Google My Maps** (linha e pontos).
- Mantém o registo dos acessos rodoviários validados separadamente da coordenada ferroviária.
- Mantém backup JSON e compatibilidade com as chaves de armazenamento da V3.2.

## Limitações importantes

**Não são coordenadas topográficas oficiais**. Os dois pontos limites não bastam para calibrar todos os PK de forma exata: o eixo OSM fornece uma estimativa e os marcos intermédios/IP ou levantamentos GNSS permitem validar as posições. Os ativos OSM e os EDF próximos podem estar incompletos ou desatualizados. Não apresentar estas estimativas como coordenadas certas nem usar para acesso ferroviário sem validação. Para um traçado de engenharia rigoroso usar o shapefile RFN oficial (PT-TM06/ETRS89) e referências PK oficiais da IP.

A geometria e os ativos não estão embutidos no ZIP (não foi possível obter aqui um dataset completo auditado). A recolha é feita **em tempo de execução, com internet**. A disponibilidade/limites da Overpass API podem causar falhas; a app indica o erro e suporta importação manual de GeoJSON.

A aplicação Google Maps normal não permite desenhar uma linha arbitrária só com um URL; para visualizar o eixo e pontos sobre mapa Google, exportar KML e importá-lo em https://www.google.com/mymaps .

### Licenças de dados

OpenStreetMap contributors — ODbL, https://www.openstreetmap.org/copyright . Leaflet / OpenRailwayMap sujeitos às respetivas condições de utilização. Os dados fornecidos pelo utilizador são usados só localmente.

## Compilação

O workflow `.github/workflows/build-android.yml` incorpora as correções npm e Android SDK anteriores, e cria APK debug com `pt.rjp.navigator`. Ao instalar como atualização, a assinatura Android tem de ser a mesma da app anterior; caso contrário é preciso backup/restauro.

```bash
npm install --include=dev --legacy-peer-deps --no-audit --no-fund
npm test
npm run build
```

## Testes

Testes determinísticos para projeção de PK sobre geometria, grafo de segmentos ferroviários, correspondência OSM, persistência/prioridade de GPS e falhas de fontes remotas. **A API Overpass não foi testada ao vivo neste ambiente**, por isso uma compilação bem-sucedida não garante que a fonte pública responda no telemóvel.

# RJP Navigator V3.2 — Linha do Oeste

Pacote **completo de código fonte** para WebApp e APK Android, baseado nas listas de ativos do repositório `ruijpedro/RJP-Navigator` (branch `main`, v2.2.0), com novos módulos de pesquisa por PK, importação do traçado e navegação rodoviária por acessos confirmados.

## Inclui
- Troço de responsabilidade PK **21+191–191+191**, pontos inicial/final a partir de imagens fornecidas; coordenadas geográficas calculadas pressupondo EPSG:3763 **a confirmar**.
- **59 passagens de nível** e **38 estações/apeadeiros** herdados da base, e edifícios associados às estações.
- Lista de marcos quilométricos, pesquisa por PK, filtros e registos de deslocações.
- Mapa OpenStreetMap com camada **OpenRailwayMap** para realçar a rede ferroviária online.
- Importação de **uma LineString contínua** em GeoJSON, **WGS84 [longitude,latitude]**, correspondente apenas ao troço de responsabilidade; poderá estar invertida que a app orienta-a.
- Localização **estimada** por interpolação da distância do traçado importado. **Não são coordenadas oficiais nem marcos geodésicos**; falta calibrar o traçado com PK intermédios conhecidos.
- Correção manual de PK e gravação GPS de campo das PN, estações e edifícios; os dados locais sobrepõem-se às estimativas.
- Pontos de **acesso rodoviário confirmados**, independentes dos pontos ferroviários, com abertura de rota no Google Maps ou Waze.
- Exportação **KML** para **Google My Maps**, incluindo o traçado caso tenha sido importado; Google Maps normal não desenha um traçado arbitrário por URL.
- Backup/importação JSON de dados pessoais e do traçado. Dados persistidos no armazenamento local do dispositivo, até limpeza/desinstalação.

## Importantíssimo sobre coordenadas
Não foram preenchidas coordenadas inventadas nas PN/edifícios. O repositório de origem apenas tinha PK de PN e dois PK de estações, mas faltam os restantes PK/levantamentos. Antes de importar e calibrar o traçado, as PN continuam **sem GPS**, salvo gravação no terreno. A camada OpenRailwayMap é cartográfica; não serve, por si, de calibração de PK. As estimativas após importação NÃO são suficientemente rigorosas para intervir na ferrovia sem validação.

## Instalar / compilar
1. Extrair o ZIP, copiar **todo o conteúdo** para a raiz do repositório GitHub.
2. GitHub → Actions → **Build RJP Navigator APK V3.2** → Run workflow.
3. Transferir `RJP_Navigator_V3_2_APK` de Artifacts, extrair, instalar APK.
4. WebApp local: `npm install && npm run dev` (ou `npm run build` para gerar `dist`).
5. Para sobrepor a APK existente sem desinstalar, é necessário manter `appId` e **a mesma chave de assinatura**. Uma APK *debug* do GitHub Actions pode usar uma chave diferente da instalada; nesse caso o Android não aceitará atualização direta. **Exportar backup primeiro**.

## Mapa e Google
Em **Mapa ferroviário**, a camada OpenRailwayMap realça a ferrovia. O botão **Exportar KML** gera ficheiro a importar em <https://www.google.com/mymaps> para ver o traçado e marcadores por cima do mapa da Google. Sem a importação do GeoJSON, o KML inclui apenas os ativos com coordenadas e os pontos de referência (estes são indicados no mapa da app). Os serviços de mapas necessitam de Internet.

## GeoJSON
Converter dados vetoriais da ferrovia para GeoJSON de 1 LineString no CRS WGS84. O GeoJSON deve começar/acabar próximo dos dois extremos indicados. **Não incluir o resto da rede**, nem confundir distâncias euclidianas com distância quilométrica da linha. É obrigatório levantamento de PK de referência distribuídos pelo troço para obter precisão de engenharia.

## Limites e responsabilidade
- PK inicial 21+191 · X=-102518, Y=-96007 (EPSG:3763 presumido) · latitude 38.79752688, longitude -9.31318410
- PK final 191+191 · X=-58063, Y=38163 (EPSG:3763 presumido) · latitude 40.00997619, longitude -8.81314803
- 170 000 m de diferença PK, **não distância rodoviária**.

## Segurança
Coordenadas ferroviárias não significam acessibilidade de viatura. Só abrir rotas automáticas para **acessos rodoviários confirmados e autorizados**. Não usar estimativas para aceder à via ferroviária.

## Correção de instalação npm / GitHub Actions (14/10/2026)

O workflow `.github/workflows/build-android.yml` inclui limpeza prévia de `node_modules` e `package-lock.json`, porque o repositório antigo continha um lockfile desatualizado com URLs de registry interno. Em seguida, configura o registry público npm e instala as dependências da V3.2.

Se estiveres a atualizar um repositório já existente, substitui `.github/workflows/build-android.yml` pelo incluído neste ZIP e remove o antigo `package-lock.json` do repositório. O workflow faz a remoção também durante a execução, pelo que a APK não depende desta ação manual.

O aviso de descontinuação `tar@6.2.1` é separado do erro `Exit handler never called!` e não implica, por si só, falha de compilação.


## V3.2.2 — Correção da compilação Android SDK (14/10/2026)

- Corrigido o erro `Warning: Failed to find package 'tools'` no GitHub Actions.
- A ação `android-actions/setup-android@v3` deixa de tentar instalar o pacote SDK obsoleto `tools`.
- Em vez disso, instala `platform-tools`, `platforms;android-35` e `build-tools;35.0.0`.
- Mantém-se a correção npm da V3.2.1, o código ferroviário, os dados e os ícones.
- Para compilar, envia os ficheiros deste ZIP para a raiz do repositório e executa
  **Actions → Build RJP Navigator APK V3.2 → Run workflow**.
- Esta correção foi validada na configuração do workflow, mas a APK requer
  uma nova execução do GitHub Actions para confirmação.
