# EDF_Oeste — Onde ajustar logótipos e ícones

## Logótipo do cabeçalho da app

Substituir:

```text
public/ip-logo.png
```

Este é o logótipo que aparece no topo da app.

---

## Ícone Android

Substituir:

```text
assets/icon.png
```

Recomendado:
- PNG
- 1024 x 1024 px
- quadrado
- com símbolo IP + EDF

O workflow gera automaticamente os ícones Android com:

```bash
npx capacitor-assets generate --android
```

---

## Splash screen

Substituir:

```text
assets/splash.png
```

Pode ser igual ao `icon.png`.

---

## Ícones WebApp/PWA

Substituir:

```text
public/favicon.png
public/icon-192.png
public/icon-512.png
```

---

## Cores da app

Editar:

```text
src/style.css
```

Variáveis principais:

```css
:root {
  --main: #17B5A4;
  --dark: #0F2A2A;
  --mint: #9AD7CA;
  --soft: #E9F7F4;
}
```

---

## Nome da app

Editar:

```text
capacitor.config.json
index.html
public/manifest.webmanifest
```

---

## Depois de alterar logótipos

No GitHub:

```text
Actions > Build EDF_Oeste APK > Run workflow
```

Se o telemóvel continuar com o ícone antigo:
1. Desinstalar a app antiga.
2. Reiniciar o telemóvel.
3. Instalar a nova APK.
