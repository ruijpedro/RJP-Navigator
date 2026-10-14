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
