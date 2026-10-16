# RJP Navigator V4.1 — Hectómetros e calibração assistida por marcos OSM

**Novidades**

- Separador **Rede Nacional**: interruptor **Mostrar hectométricos (100 m) e marcos OSM**, ligado por defeito, que oculta/mostra ambas as camadas.
- Hectómetros (PK X+000, X+100, X+200, …, X+900) distribuídos **ao longo da geometria real** e apenas **entre âncoras PK/GPS**. Nunca são extrapolados para zonas sem referências.
- O mapa apresenta os hectómetros em **roxo** ao aproximar (zoom ≥11), e com rótulos a partir de zoom 15. São **pontos virtuais interpolados, não marcos físicos confirmados**.
- Procura automática ao escolher uma linha com traçado contínuo, com botão **Procurar marcos PK no OpenStreetMap** para repetir a consulta. Usa etiquetas `railway=milestone`, `railway:position` e `railway:position:exact`.
- Marcos OSM em **azul** quando coerentes, em **laranja** quando incompatíveis; rejeita marcos a mais de 45 m do eixo, PK repetidos divergentes, sentidos contraditórios e escalas ferroviárias incoerentes.
- As referências OSM aceites melhoram a interpolação, mas **nunca são tratadas como validação oficial**. Permanece a distinção entre âncoras verificadas e estimadas.
- Resumo de qualidade por intervalo: tamanho máximo do intervalo de calibração, número de referências, alertas de escala e estado de verificação.
- Backup JSON nacional inclui os marcos OSM descarregados, para funcionarem mesmo sem nova consulta. O mapa de fundo continua a precisar de internet.
- Preserva funcionalidades da Linha do Oeste e do Navigator V4.0 (PK, PN, EDF, área geográfica, procura de acessos rodoviários e Maps/Waze).

**Limites técnicos reais**

Esta versão não certifica a calibração de toda a RFN. Para localizar PK nesta ou noutras linhas é necessário um **eixo contínuo e referências PK/GPS coerentes**. Algumas linhas do OSM não têm relação completa; outras podem ter variantes ou ramais com origem quilométrica diferente. Os marcos OSM podem estar incorretos ou ausentes. A camada hectométrica **não surge em linhas sem calibração suficiente**, em vez de inventar pontos.

A geometria da IP e um cadastro de referências PK verificado continuam a ser as melhores fontes; os dois extremos do Oeste fornecidos por imagem continuam por confirmar quanto ao sistema de coordenadas. O OSM é uma fonte complementar e não substitui a cartografia/topografia oficial ou verificação de acessos autorizados.

**Instalação:** substituir o conteúdo completo do repositório GitHub `ruijpedro/RJP-Navigator` pelo ZIP e executar `Build RJP Navigator APK V4.1` no GitHub Actions. Antes de instalar a APK, exportar backups da Linha do Oeste e da Rede Nacional. A APK debug de uma nova compilação pode usar assinatura diferente da app já instalada.

**Testes:** executar `npm test`; a compilação Android/Web é validada pelo workflow GitHub Actions, ainda não efetuada aqui. Serviços OSM online não foram validados ao vivo nesta entrega.

---

# Histórico: V4.0 — Rede Ferroviária Nacional

Esta versão **acrescenta a Rede Nacional** à V3.6, mantendo os dados e fluxos originais da **Linha do Oeste (PK 21+191–191+191)**: 59 passagens de nível, 38 estações/apeadeiros, edifícios associados, mapa ferroviário, identificação por toque, exportação KML, GPS, acessos rodoviários e backups.

## Novo separador: Rede Nacional

- Mapa de Portugal com a camada ferroviária **OpenRailwayMap**, carregada automaticamente quando há internet. Esta camada é uma visualização nacional, não um cadastro oficial de PK.
- Catálogo inicial de linhas e ramais, incluindo outros troços que podem estar desativados. Adiciona linhas não incluídas através do formulário.
- Pesquisa de relações ferroviárias nomeadas no **OpenStreetMap / Overpass**, sem impor importação manual como único método. Não há garantia de que cada linha tenha uma relação completa: em caso de falha, a app mostra o erro.
- Traçado por linha, guardado localmente depois da consulta ou da importação de uma **única LineString GeoJSON WGS84**.
- Motor de **calibração independente por linha**. Dois ou mais pares PK/GPS válidos são associados ao eixo; as posições intermédias são interpoladas ao longo do traçado, nunca por uma reta entre cidades. Não extrapola para fora do intervalo disponível.
- Rejeição de referências fora do eixo, sentidos inconsistentes e saltos muito grandes entre extensão do eixo e diferença de PK.
- Toque no eixo → posição ferroviária → PK quando calibrado → freguesia/concelho/distrito quando Nominatim responder → estrada próxima sugerida → Google Maps ou Waze.
- Importação nacional em lote de coordenadas PK/GPS **CSV**, exportação CSV e backup JSON nacional. Referências importadas ficam marcadas **por validar**, a menos que sejam posteriormente verificadas.
- As duas referências limite da Linha do Oeste foram preservadas como **não verificadas**, porque o CRS das capturas ainda não está confirmado.

## Limitação essencial — NÃO representa calibração oficial completa

A aplicação **não contém ainda uma base oficial validada dos marcos PK de toda a Rede Ferroviária Nacional**, nem o shapefile RFN oficial da IP embutido. Não foi possível descarregar e validar esses ficheiros nesta execução. O mapa geral cobre Portugal online, mas **PK automáticos só são possíveis nos intervalos de cada linha com traçado contínuo e referências PK/GPS coerentes**. O botão de consulta OSM ajuda a encontrar geometria, **não fornece os marcos PK oficiais**. A aplicação não deve tratar uma coordenada estimada como um ponto operacional topográfico certificado.

Para calibrar todas as linhas de forma rigorosa ainda são necessárias as tabelas **linha, PK, latitude/longitude**, com origem em marcos oficiais ou levantamentos verificados. O motor V4.0 aceita todas essas referências de uma vez num CSV nacional e permite reprocessá-las por linha. Obras, variantes, concordâncias e descontinuidades de quilometragem podem exigir mais de uma secção por linha, com calibrações separadas.

### Formato de importação

Codificação UTF-8, separador `;`, coordenadas **WGS84/EPSG:4326** em graus decimais. **Não introduzir X/Y PT-TM06 como latitude/longitude**.

```csv
linha;pk;latitude;longitude
Linha do Oeste;21+191;38.7975269;-9.3131841
Linha do Oeste;191+191;40.0099762;-8.8131480
```

Estes dois valores do exemplo **não foram verificados** (CRS projetado assumido). São uma demonstração da sintaxe, não dados oficiais para orientar uma intervenção ferroviária.

## Principais fontes

- **Infraestruturas de Portugal:** [Rede Ferroviária Nacional, dados.gov.pt](https://dados.gov.pt/pt/datasets/rede-ferroviaria-nacional/) — geometria em PT-TM06/ETRS89 (EPSG:3763), [Estações e Apeadeiros](https://dados.gov.pt/pt/datasets/estacoes-e-apeadeiros/). É necessário converter para WGS84 e, em seguida, separar os eixos contínuos por linha.
- **DGT:** CAOP, limites oficiais de distrito/concelho/freguesia. A aplicação **ainda usa Nominatim**, não a base oficial CAOP offline.
- **OpenStreetMap/OpenRailwayMap:** eixos públicos cartografados, mapa de fundo e visualização nacional. ODbL; atribuir © OpenStreetMap contributors. A consulta usa serviços públicos sujeitos a interrupções e limites de tráfego.

## Instalar / compilar

1. Faz **Exportar JSON** na V3.6 antes de substituir qualquer instalação.
2. Copia o conteúdo **completo** do ZIP para a raiz do repositório `ruijpedro/RJP-Navigator`, mantendo as pastas `.github`, `src`, `public`, `scripts`, `tests`, etc.
3. No GitHub: **Actions → Build RJP Navigator APK V4.0 → Run workflow**. O workflow executa `npm test`, tenta pré-carregar o mapa OSM do Oeste e compila a WebApp e a APK Android.
4. Descarrega o artefacto `RJP_Navigator_V4_0_APK` ou `RJP_Navigator_V4_0_WebApp`.

O workflow mantém as correções de npm (limpeza de lockfile antigo com URLs internas) e SDK Android (não instalar o pacote `tools` obsoleto). Para instalar como atualização sem remover a app é necessário manter a **mesma assinatura Android**. A APK debug do GitHub Actions pode mudar de chave entre compilações.

A nova área nacional guarda a sua configuração no dispositivo sob `rjp_nav_nacional_v4`. Os backups originais do Oeste continuam independentes. Se alterares de telemóvel ou desinstalares, exporta **ambos os backups** primeiro.

## Verificações locais desta entrega

- `npm test`: testes do Oeste e do motor nacional.
- Transpilação sintática JSX com TypeScript, sem erros de sintaxe.
- A WebApp/Vite e a APK Android **não foram compiladas localmente**, pois este ambiente não dispõe de acesso ao registry npm; a compilação real depende do workflow GitHub.
- Consultas reais aos serviços OSM/Overpass/Nominatim **não foram confirmadas neste ambiente**.

Uso técnico de apoio; nunca autoriza acesso à via nem substitui planos de segurança, cadastro da IP ou levantamento topográfico.

## Compilação WebApp V4.1 (workflow independente)

A pasta `.github/workflows/` inclui dois workflows diferentes:

- `build-android.yml`: compila a APK Android.
- `build-web.yml`: executa os testes, tenta preparar a cartografia e compila a WebApp com Vite (`npm run build`). Disponibiliza o artefacto `RJP_Navigator_V4_1_WebApp`, que contém os ficheiros estáticos `dist/`.

No GitHub abre **Actions → Build RJP Navigator WebApp V4.1 → Run workflow**. Depois de uma execução bem-sucedida, descarrega `RJP_Navigator_V4_1_WebApp` em **Artifacts**. É uma compilação da WebApp, não uma publicação automática online; os ficheiros têm de ser alojados num servidor web (ou GitHub Pages com configuração apropriada).

Se o pré-carregamento OSM falhar, a aplicação poderá precisar de internet para obter a cartografia no arranque. A compilação não confirma a precisão dos marcos PK.
