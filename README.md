# RJP Navigator V3.8 — Navegação na Rede Ferroviária Nacional

WebApp instalável e aplicação Android (Capacitor). Desenvolvida sobre a V3.7.1, conserva a navegação da Linha do Oeste e acrescenta pesquisa de PK e aproximação rodoviária no separador **Rede nacional / PK**.

## Dados incluídos na aplicação

- **Infraestruturas de Portugal / Shapefile fornecido pelo utilizador**, convertido para WGS84: **43 designações de linhas com geometria, 56 segmentos contínuos**, em `public/data/rede-ferroviaria-nacional.json`. Restam três registos originais sem geometria.
- **Linha do Oeste**: 4 928 vértices no troço PK 21+191–191+191, incluídos em `public/data/linha-oeste-preload.json`. Mantém as 59 PN, estações e edifícios da base local.
- **Referências quilométricas documentais pré-carregadas** (ver `src/lib/national.js`):

| Linha/troço | Referências de PK usadas para estimar posição | Qualidade |
| --- | --- | --- |
| Linha do Oeste (troço da responsabilidade) | 21+191 e 191+191, referências fornecidas pelo utilizador | Estimativa no eixo entre dois pontos |
| Linha do Norte (Santa Apolónia / Campanhã) | 0+000 e 336+079 | Referências documentadas, interpolação indicativa |
| Linha do Minho (Campanhã / Valença Fronteira) | 0+000 e 131+449 | Referências documentadas, verificar edição corrente |
| Linha do Minho (Porto São Bento / Campanhã) | 2+618 e 0+000 (sentido decrescente) | Referências documentadas, interpolação indicativa |
| Linha de Cascais (Cais do Sodré / Cascais) | 0+000 e aprox. 25+400 | Fim aproximado na fonte |
| Linha de Cintura (Alcântara-Terra / Braço de Prata) | 0+000 e aprox. 10+500 | Fim aproximado na fonte |

**Importante:** a geometria IP não contém a quilometragem oficial de cada vértice. Os PK encontrados por interpolação não constituem levantamento topográfico; podem existir retificações e mudanças de quilometragem. Não apresentar como certificados.

## Como usar

1. Abre **Rede nacional / PK**. Escolhe a **linha** e o **troço** (linhas com vários segmentos mantêm troços independentes).
2. Nas linhas com duas referências disponíveis, introduz **PK 150+000** e clica **Localizar PK**. A aplicação mostra as coordenadas estimadas sobre o eixo e destaca a posição no mapa.
3. Seleciona **Procurar estrada mais próxima**. A app tenta listar candidatos transitáveis OpenStreetMap; em caso de indisponibilidade utiliza correspondências rodoviárias OSRM. Os resultados são **sugestões sem validação de acesso**; Waze ou Google Maps navegam para o candidato escolhido, nunca diretamente para a via ferroviária.
4. Nas linhas sem calibração, podes consultar **Distância geométrica desde o extremo A** (não equivale a PK oficial), ou abrir **Referências PK e calibração**, adicionando dois ou mais PK conhecidos ligados aos extremos da geometria ou às respetivas coordenadas GPS.
5. Para cada troço, podes registar **PN/estações/edifícios** locais pelo PK. Só aparecem no mapa quando existem referências para calcular coordenadas. A posição do edifício pode não coincidir com o eixo ferroviário.
6. Exporta regularmente o **backup nacional JSON** para copiar os teus novos pontos, referências e acessos entre dispositivos. Os dados locais anteriores da Linha do Oeste continuam na exportação própria **Deslocações**.

### Sobre os dados de referência

Fontes para os PK introduzidos na V3.8:
- [IP — Plano de Ação Linha do Norte I](https://www.infraestruturasdeportugal.pt/sites/default/files/ambiente-ruido/2020/norte_I.pdf)
- [IP — Plano de Ação Linha do Minho I](https://www.infraestruturasdeportugal.pt/sites/default/files/ambiente-ruido/2020/minho_I.pdf)
- [IP — Diretório da Rede 2019](https://www.infraestruturasdeportugal.pt/sites/default/files/inline-files/Diret%C3%B3rio%20da%20Rede%202019.pdf)
- [IP — Plano de Ação Linha de Cascais](https://www.infraestruturasdeportugal.pt/sites/default/files/ambiente-ruido/2020/cascais.pdf)
- [IP — Plano de Ação Linha de Cintura](https://www.infraestruturasdeportugal.pt/sites/default/files/ambiente-ruido/2020/cintura.pdf)

As fontes indicam extremos/PK e não substituem a validação da referência GPS oficial e marcos intermédios.

## Publicar a WebApp gratuitamente — GitHub Pages

1. Descompacta este ZIP na raiz do repositório `ruijpedro/RJP-Navigator`, mantendo pastas ocultas como `.github/`.
2. Em **Settings → Pages**, escolhe **GitHub Actions** como origem.
3. Em **Actions**, executa **Publicar RJP Navigator WebApp** (workflow `.github/workflows/deploy-webapp.yml`).
4. Após o job `deploy` concluir com sucesso, abre `https://ruijpedro.github.io/RJP-Navigator/`. O URL só estará disponível se o Pages tiver sido ativado/publicado.
5. No telemóvel usa **Instalar aplicação/Adicionar ao ecrã principal**.

O `vite.config.js` já define a base de GitHub Pages na compilação de publicação; o `sw.js` usa nova versão de cache para atualizar as instalações existentes.

## Criar APK Android

Em **Actions → Build RJP Navigator APK V3.8 → Run workflow**, espera pelo `android` verde e transfere o artefacto `RJP_Navigator_V3_8_APK`. O ID `pt.rjp.navigator` mantém-se; a instalação sobre a versão anterior depende também da assinatura Android. Exporta backups antes de substituir uma versão.

## Testes do projeto

```sh
npm install --no-audit --no-fund --legacy-peer-deps --package-lock=false
npm test
RJP_REQUIRE_MAPS=1 npm run prepare:maps
npm run build
```

`RJP_REQUIRE_MAPS=1 npm run prepare:maps` valida ficheiros **locais**, sem chamadas a serviços externos. A aplicação depende de internet para o fundo cartográfico e para procurar estradas/tempos de viagem. Mapa vetorial e motores de PK funcionam offline.

## Limites reais

- A V3.8 **não contém referências quilométricas validadas de todas as linhas**: seis troços têm referências documentais para uma **primeira estimativa**; nos restantes é necessário acrescentar pelo menos duas referências. Nunca apresenta um PK estimado como confirmado.
- A base nacional de PN/EDF não está preenchida automaticamente para todas as linhas; os ativos da Linha do Oeste continuam na base existente, e podem ser acrescentados por linha nos restantes troços.
- A proximidade de uma estrada ao eixo ferroviário não demonstra acessibilidade pública, legalidade de paragem, nem percurso pedonal seguro. Confirmar acesso antes de circular.
