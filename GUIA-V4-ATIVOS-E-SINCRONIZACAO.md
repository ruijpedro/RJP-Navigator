# RJP Navigator V4.0 — Inventário ferroviário e Google Sheets

## Folha central (já criada)

**RJP Navigator - Ativos Ferroviários**: https://docs.google.com/spreadsheets/d/1JBRHtWuFx-wMsCGimf28LhVVOjrL5mIX5Z_NGiJa0Dw/edit

A folha **Ativos** é a ÚNICA tabela de registo. Foram migradas **103 PN da Linha do Oeste**. A folha antiga PN_LO_Atual foi preservada sem alteração para conferência.

## Colunas da tabela

| ID | Linha | Tipo | PK | Designação | Localidade | Concelho | Freguesia | Latitude | Longitude | Estado | Observações | Fonte | AtualizadoEm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

- **ID**: identificador estável e único (ex.: `LO-PH-115350`), não reutilizar após eliminação.
- **Linha**: escrever a designação usada na aplicação (ex.: `Linha do Oeste`, `Linha do Norte`).
- **Tipo**: `PN`, `PH`, `PS`, `PI`, `ATR`, `VAL`, `GEO`, `OA`, `OUTROS`, ou outro código de 2–25 caracteres (maiúsculas, números, `-`, `_`).
- **PK**: `115+350`. Pode ficar vazio se há GPS; para pesquisa por PK depende de calibração da respetiva linha.
- **Latitude/Longitude**: WGS84 em graus decimais. Ambas vazias ou ambas preenchidas. Verificar em campo antes de uso operacional.
- **Estado**: `Ativo` por defeito; `Inativo`, `Desativado`, `Eliminado`, `Arquivado` ocultam o registo da pesquisa, mantendo histórico na folha.
- **Fonte** e **AtualizadoEm**: campos de rastreabilidade opcionais.

**Exemplo de linha nova (PH)**: `LO-PH-115350 | Linha do Oeste | PH | 115+350 | PH Ribeira (exemplo) | | | | | | Ativo | Coordenadas por confirmar | Levantamento |`

Para editar PN, corrigir diretamente a linha existente e manter o seu **ID**. Para criar um ativo, inserir nova linha com ID único, linha, tipo e PK ou GPS. O separador PN antigo já não é consultado pelo V4.0. Não preencher informações pessoais ou sensíveis: o feed é de leitura pública.

## Ativação ÚNICA do Google Apps Script (ainda necessária)

1. Abrir https://script.google.com/ e criar um projeto.
2. Copiar o conteúdo COMPLETO de `integrations/google-apps-script/Code.gs`.
3. Implementar > Nova implementação > Aplicação Web > Executar como **Eu** > Acesso **Qualquer pessoa** (apenas leitura de dados publicados). Confirmar que a política da organização permite publicar este inventário.
4. Copiar o URL real `https://script.google.com/macros/s/.../exec`.
5. No GitHub, editar `public/config/ativos-sync.json`: definir `enabled: true` e `feedUrl` com o URL `/exec` (não mexer no schema).
6. Publicar a WebApp / executar Actions. Todas as instalações V4.0 consultam a configuração central no arranque, no regresso à rede e a cada 15 minutos enquanto abertas.
7. Após alterar o Apps Script, é necessário implementar uma **nova versão** do script. **Alterações só na folha** entram na próxima sincronização e não exigem recompilar APK.

**Importante:** não existe ainda um URL real implementado; esta V4.0 está distribuída com a sincronização em modo de espera. Não inventar URL. Enquanto não ativado, as 103 PN ficam incluídas offline.

## Âmbito do navegador

- Inventário nacional por tipo, linha e PK, com botão para localizar o ativo e procurar estrada próxima.
- Para linhas sem calibração, coordenadas GPS verificadas na tabela permitem localizar diretamente. Sem GPS e sem calibração, a app declara indisponibilidade, não cria coordenadas falsas.
- O ponto rodoviário sugerido não representa entrada autorizada nas instalações ferroviárias.
- Acessos guardados e referências PK locais mantêm-se no dispositivo; não são escritos na folha central.
- Backend do Apps Script é apenas de leitura; a edição ocorre pela interface autenticada do Google Sheets.

## Build GitHub

Descompactar o ZIP sobre o repositório `ruijpedro/RJP-Navigator`, preservar a estrutura, e executar `.github/workflows/build-android.yml` para APK e `.github/workflows/deploy-webapp.yml` para GitHub Pages. A compilação local depende de `npm install`, que pode requerer ligação ao npm Registry.
