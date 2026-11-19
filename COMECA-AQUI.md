# RJP Navigator Auto — Google Play / Android Auto

## Instalação simples no GitHub

1. Descompacta este kit por cima do repositório `ruijpedro/RJP-Navigator` **sem apagar a aplicação atual**.
2. No GitHub, abre **Actions > RJP Navigator Auto - Google Play AAB**.
3. Em **Run workflow**, seleciona `diagnostico` para fazer uma compilação de prova.
4. Para obter o AAB de distribuição, consulta **GUIA-GOOGLE-PLAY-AUTO.md**: é preciso configurar 4 secrets de assinatura e voltar a executar com `google-play`.
5. Carrega o AAB na Play Console (RJP Navigator Auto / pacote `pt.rjp.navigator.auto`), no canal de testes internos, após configurar as declarações obrigatórias.

**Ícone oficial:** `play-auto/branding/rjp-auto-googleplay-512.png` (512 × 512 PNG).

**Conceito de ecrã de carro:** um título, uma lista de acessos rodoviários confirmados, um toque para iniciar navegação num navegador compatível. Sem menus ou campos de texto enquanto conduzes.

**Atenção:** não existe AAB assinado no ZIP; a assinatura é feita no GitHub Actions com a tua chave privada. OTA é usado para dados do inventário; código nativo atualizado pela Google Play. A app normal V4.2.4 não é substituída.
