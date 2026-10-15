# RJP Navigator V4.0 — Inventário de Ativos Ferroviários

Projeto completo **Android + WebApp**, com geometria ferroviária nacional integrada e pesquisa de estradas próximas.

## Novidade V4.0

- **Uma única tabela** Google Sheets [RJP Navigator - Ativos Ferroviários](https://docs.google.com/spreadsheets/d/1JBRHtWuFx-wMsCGimf28LhVVOjrL5mIX5Z_NGiJa0Dw/edit) com as 103 PN já migradas.
- Coluna **Tipo** para PN, PH, PS, PI, ATR, VAL, GEO, OA e futuros tipos.
- Separador **Ativos ferroviários** com filtros por linha, tipo e pesquisa; seleção do ativo inicia a localização e procura rodoviária.
- A **Linha do Oeste** continua com as 103 PN integradas no modo offline. As outras linhas continuam disponíveis no menu nacional.
- Sincronização automática centralizada (a ativar uma única vez por Apps Script); cópia offline nos aparelhos.

**Ativação inicial necessária:** ler `GUIA-V4-ATIVOS-E-SINCRONIZACAO.md`. O feed privado **não** é acessível diretamente pela APK; publicar Apps Script de **leitura pública** só se a folha não contiver informação confidencial. O código apenas devolve colunas permitidas.

## Testar e compilar

```bash
npm install --no-audit --no-fund --legacy-peer-deps
npm test
npm run prepare:maps
npm run build
```

GitHub Actions: `build-android.yml` e `deploy-webapp.yml`.

**Aviso operacional:** PK aproximado e estrada próxima não comprovam acesso autorizado. Validar pontos de campo e permissões antes de deslocação.
