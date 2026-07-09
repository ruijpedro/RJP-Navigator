# RJP Navigator V1.5 — Fix Vite Definitivo

Esta versão instala o Vite como dependência normal e o workflow chama diretamente `./node_modules/.bin/vite build`, evitando o erro `vite: not found` e o `npx vite@8`.

# RJP Navigator V1.2 — Linha do Oeste

Aplicação React/Vite/Capacitor para navegação técnica ferroviária.

## Inclui

- Estações e apeadeiros da Linha do Oeste
- Passagens de Nível fornecidas pelo Rui
- Separador PK/Km, com marcos de 22+000 a 191+000
- Pesquisa por PK, OE, localidade, concelho e freguesia
- GPS do dispositivo
- Abertura no Google Maps e Waze
- Registo local de deslocações
- Novo ícone Android/PWA aplicado
- Recursos Android `mipmap` e adaptive icon em `android-res/`

## GitHub / APK

1. Extrair o ZIP.
2. Fazer upload dos ficheiros para o repositório GitHub.
3. Executar a action **Build RJP Navigator APK**.
4. A action cria o projeto Android, copia os ícones e gera a APK debug.

## Notas

A app não substitui o Google Maps/Waze. Funciona como navegador técnico interno para localizar ativos e abrir a navegação externa quando necessário.


## V1.4 Fix Build
- Vite fixado em 5.4.11.
- @vitejs/plugin-react fixado em 4.3.4.
- Workflows passam a instalar explicitamente o Vite antes do build.


## V1.6
- Ícone Android aplicado no workflow através de cópia direta para `android/app/src/main/res`.
- Lista de PN simplificada: apenas Km, localidade, concelho e freguesia.
- Separação mantida para Estações/Apeadeiros e Edifícios ferroviários.


## V2.0
- Guarda coordenadas GPS diretamente em cada ativo.
- Exporta JSON com locais, GPS guardado e deslocações.
- PN simplificadas por Km/localidade/concelho/freguesia.
- Edifícios, estações e apeadeiros mantidos.
- Ícone Android/WebApp aplicado.


## Correção V2.1 — permissões de localização Android

A APK passa a incluir `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION` no AndroidManifest e usa `@capacitor/geolocation` para pedir a permissão de localização diretamente no telemóvel quando se carrega em **Atualizar GPS** ou **Usar GPS atual**.


## V2.2
- Corrigido AndroidManifest.xml: permissões de GPS inseridas corretamente dentro da tag `<manifest>`.
- Mantém ícone Android e dados PN/EDF/Estações.
