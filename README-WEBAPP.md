# RJP Navigator WebApp V3.7.1

A WebApp mantém a cartografia nacional IP integrada da V3.7 e a pesquisa aproximada de PK na Linha do Oeste (21+191 a 191+191), PN, EDF e acessos rodoviários.

## Publicar gratuitamente com GitHub Pages

1. Carrega todos os ficheiros deste ZIP na raiz do repositório `ruijpedro/RJP-Navigator`, mantendo as pastas (inclusive `.github/workflows/deploy-webapp.yml`, `public/data/`).
2. No repositório, abre **Settings → Pages → Build and deployment → Source** e seleciona **GitHub Actions**.
3. Em **Actions → Publicar RJP Navigator WebApp → Run workflow** executa a ação na branch `main`. Um `push` também publica automaticamente.
4. Depois do job **deploy** ficar verde, abre `https://ruijpedro.github.io/RJP-Navigator/`.
5. No Android (Chrome), usa **Instalar app / Adicionar ao ecrã principal** no menu. No iPhone (Safari), **Partilhar → Adicionar ao ecrã principal**.

O endereço acima só passa a funcionar depois da publicação. Os mapas de fundo OpenStreetMap e o cálculo dos acessos rodoviários exigem internet. A geometria ferroviária IP fica integrada e os dados podem ser consultados sem pedir novamente o traçado.

## Testar no PC

Node.js 22+, acesso ao npm:

```sh
npm install --no-audit --no-fund --legacy-peer-deps --package-lock=false
npm test
RJP_REQUIRE_MAPS=1 npm run prepare:maps
npm run dev
```

`npm run build` cria `dist/` (ficheiros prontos para alojamento estático). A pasta `dist/` não está incluída neste ZIP de código: é criada automaticamente no workflow do GitHub Pages.

## Atenção

- A localização de PK na Linha do Oeste é **estimada por interpolação** no eixo IP entre os dois limites calibrados. Não equivale a levantamento topográfico.
- A Rede Nacional está disponível para visualização, mas os PK das outras linhas ainda precisam de calibração.
- A PWA mantém cache local da geometria ferroviária após o primeiro carregamento, mas os fundos cartográficos e os serviços de rotas necessitam de internet.
- Os registos dos utilizadores são guardados **localmente em cada navegador**; exporta regularmente os dados JSON para segurança e transferência entre dispositivos.
- Antes de entrar em zonas ferroviárias, confirma acessos públicos e autorização.
