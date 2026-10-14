# RJP Navigator V3.7 — Rede Ferroviária Nacional com cartografia IP incluída

Esta versão elimina a dependência do OpenStreetMap/Overpass para obter o **traçado da Linha do Oeste**, incorporando-o em `public/data/linha-oeste-preload.json`. O ficheiro `public/data/rede-ferroviaria-nacional.json` contém a restante geometria ferroviária extraída do ZIP `rede-ferroviaria.zip` fornecido pelo utilizador, convertida de **EPSG:3763** para **WGS84 EPSG:4326**.

## Confirmado no ficheiro entregue

- 59 registos/segmentos administrativos, 46 designações ferroviárias.
- 56 geometrias válidas em 43 designações; 3 registos sem geometria (Ramal da Figueira da Foz, Variante de Alcácer e Ramal EDP / Cinzas).
- Linha do Oeste de Agualva-Cacém até ao PK extremo com ~5 780 vértices no Shapefile.
- Pontos oficiais fornecidos pelo utilizador: PK 21+191 (X -102518, Y -96007) e PK 191+191 (X -58063, Y 38163). Projeção dos dois pontos sobre o eixo cartográfico: cerca de 3,7 m e 0,5 m. Entre as projeções, geometria de ~170,05 km em PT-TM06.
- **Precisão do PK**: ainda é **estimada por interpolação** entre os dois pontos conhecidos, apesar de o eixo ser oficial. Só marcos de quilometragem reais permitem exatidão ao longo de curvas, retificações e mudanças de kilometragem.

## Interface

- **Linha do Oeste:** PK, PN, estações, EDF e acesso rodoviário tal como na V3.6, agora com eixo cartográfico local incluído no APK.
- **Rede nacional:** seleção e apresentação da geometria das linhas presentes no Shapefile, mesmo sem Overpass. Mapa de fundo OSM requer internet (o traçado vetorial não).
- A consulta de PK e acesso rodoviário noutras linhas **ainda não está ativada** porque não há referência quilométrica nem inventário de PN/EDF para cada uma.
- Os dados OSM dos ativos podem continuar a ser atualizados manualmente quando a API estiver acessível.

## Instalação

1. Carregar o conteúdo deste ZIP no repositório `ruijpedro/RJP-Navigator` (incluindo `public/data`).
2. Em GitHub Actions, executar **Build RJP Navigator APK V3.7**.
3. A etapa `npm run prepare:maps` apenas valida os dados locais: **zero pedidos HTTP e sem erros 429**.
4. Instalar a APK gerada em Artifacts. Antes de trocar a instalação, exportar o backup JSON da aplicação existente.

## Nota sobre estradas e acessos

O ponto PK está no eixo ferroviário, não necessariamente numa estrada transitável. A avaliação dos melhores acessos e tempos de viagem continua a necessitar de internet ou de dados rodoviários específicos. Os acessos a zonas ferroviárias devem ser autorizados e confirmados no terreno.

**Origem cartográfica:** Rede Ferroviária Nacional, Infraestruturas de Portugal (ficheiro disponibilizado pelo utilizador). A informação não substitui levantamento topográfico nem referenciação ferroviária oficial de PK.
