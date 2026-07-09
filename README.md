# RJP Navigator V1.1

Aplicação React/Vite/Capacitor para navegação técnica na Linha do Oeste.

## Inclui

- Estações e apeadeiros da Linha do Oeste
- 58 Passagens de Nível fornecidas pelo Rui
- Pesquisa por PK, código OE, localidade, concelho e freguesia
- Separador de PN desativadas, sem opção "Ativas"
- Botão Google Maps
- Botão Waze
- Registo local de deslocações
- Adicionar nova PN/local com GPS atual
- Exportação JSON dos dados locais
- Base pronta para WebApp e APK Android

## Como usar no GitHub

1. Extrair o ZIP.
2. Enviar os ficheiros para o repositório.
3. Confirmar `vite.config.js` com `base: './'`.
4. Correr GitHub Actions `Build WebApp` ou `Build Android APK`.

## Comandos locais

```bash
npm install --legacy-peer-deps
npm run build
```

## Ficheiros principais

- `src/main.jsx` — aplicação principal
- `src/style.css` — visual
- `src/data/estacoes.js` — estações/apeadeiros
- `src/data/passagensNivel.js` — PN Linha do Oeste

Uso interno/académico. Dados sujeitos a validação no terreno.


## Atualização V1.1 — PK/Km

- Separador **PK/Km** adicionado.
- Marcos quilométricos de referência de **PK 22+000 a PK 191+000**.
- Pesquisa por PK, PN, estação, localidade e concelho.
- Marcos sem coordenadas reais; podem ser preenchidos em campo com GPS.
- Mantida a organização sem a opção “Ativas”.
