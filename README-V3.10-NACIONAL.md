# RJP Navigator V3.10 — Navegação rodoviária nacional

## O que mudou

- Em **Rede nacional / PK**, a pesquisa PK identifica o troço calibrado da linha (quando possível) e inicia **automaticamente** a consulta de estradas próximas, tal como no painel da Linha do Oeste.
- Painel de acessos com distância em linha reta, via sugerida, alternativas, condução estimada com GPS e links Google Maps/Waze.
- Botão «Atualizar GPS e tempo». Acessos confirmados pelo utilizador ficam guardados por linha, troço e PK, com backup JSON compatível com V3.8/3.9.
- Tocar no eixo ferroviário no mapa ou introduzir distância geométrica inicia a mesma pesquisa em **todas as 43 linhas/designações** com traçado. Estes pontos **NÃO são PK oficiais**.
- A pesquisa por PK oficial exige pelo menos 2 referências PK/GPS por troço (ou as referências documentais predefinidas). Sem estas, o Navigator não inventa coordenadas PK.
- Pesquisa por PK localiza automaticamente o troço certo dentro de uma linha, quando há calibração em vários troços.
- Pedidos em curso são invalidados ao mudar de linha/troço ou iniciar outra pesquisa (evita apresentar estrada de um PK anterior).

## Informação importante

A cartografia IP descreve os eixos ferroviários, mas não fornece a quilometragem PK oficial de todos os pontos da rede. A maioria das linhas ainda não tem uma calibração PK suficiente. A consulta de estradas usa serviços externos OSM/OSRM e pode sofrer indisponibilidade/HTTP 429; o mapa ferroviário permanece offline, mas o fundo e o serviço rodoviário necessitam de internet.

**Estrada próxima não equivale a acesso ferroviário autorizado.** Verificar transitabilidade, passagem a pé, paragem e autorização antes de usar operacionalmente.

## Atualização

Carregar todos os ficheiros do ZIP no repositório (incluindo `public/data`, `src`, `tests` e `.github/workflows`). Publicar a WebApp pelo workflow «Publicar RJP Navigator WebApp» ou compilar Android pelo workflow «Build RJP Navigator APK V3.10». Os dados locais e backups nacionais mantêm o formato anterior.
