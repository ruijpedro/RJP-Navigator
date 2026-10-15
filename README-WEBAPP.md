# WebApp RJP Navigator V3.12

A WebApp e a APK partilham a base do projeto. Instalação web gratuita:

1. Carrega o conteúdo completo do ZIP no repositório `ruijpedro/RJP-Navigator`.
2. Em **Settings > Pages > Source**, seleciona **GitHub Actions**.
3. Em **Actions > Publicar RJP Navigator WebApp > Run workflow**, inicia a publicação.
4. Depois de obter `Success`, visita https://ruijpedro.github.io/RJP-Navigator/ .

Em **Rede nacional / PK**, escolhe linha e PK para localizar o troço calibrado e procurar automaticamente a estrada mais próxima. Em qualquer linha, toca na geometria ferroviária (eixo verde) ou escolhe uma distância geométrica para consultar acessos sem representar o ponto como PK oficial. As linhas do Norte, Minho, Cascais, Cintura e Oeste têm referências documentais iniciais. Para as outras linhas, usa a distância geométrica ou adiciona referências PK/GPS, que ficam guardadas no dispositivo. O Shapefile IP já está integrado; não são necessários pedidos Overpass para obter a rede ferroviária.

**Não utilizar posições de PK ou estradas sugeridas como levantamento certificado ou autorização de acesso.**


PN da Linha do Oeste: listagem atualizada com 103 PK em 15/10/2026. Limite do GPS calculado mantém-se em 191+191.

## PN sincronizadas com Google Drive (V3.12)

Na área Passagens de Nível, expande **Configurar ligação à folha PN_LO_Atual**, guarda o endereço Web `/exec` do Apps Script publicado pelo titular da folha e pressiona **Sincronizar agora**. Depois as PN atualizam sem republicar a WebApp. Guia completo: `GUIA-SINCRONIZACAO-PN.md`.

### V3.12 — Configuração única para todos os dispositivos
A APK e a WebApp consultam `https://ruijpedro.github.io/RJP-Navigator/config/pn-sync.json`. **Após publicares o Apps Script uma vez, coloca o URL `/exec` nesse ficheiro e ativa `enabled: true`.** Cada dispositivo sincroniza automaticamente sem introduzir URLs. O ZIP inclui a configuração ainda **desativada** até terminares essa publicação inicial. Consulta `GUIA-SINCRONIZACAO-PN.md`.
