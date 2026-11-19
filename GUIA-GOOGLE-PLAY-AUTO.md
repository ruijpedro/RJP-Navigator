# RJP Navigator Auto — Google Play + Android Auto

**Projeto:** `ruijpedro/RJP-Navigator` (base V4.2.4). **App da Play Console:** RJP Navigator Auto.
**Nome de pacote definitivo para Play:** `pt.rjp.navigator.auto`.
**Distribuição:** teste interno na Google Play; aplicativo projetado Android Auto, **categoria POI**.

## 1. O que este ZIP contém

Este é um **pacote de integração (overlay)** para colocares sobre o repositório GitHub atual, e NÃO uma substituição da V4.2.4. Não elimina nem altera os outros workflows.

- `.github/workflows/android-auto-play.yml`: workflow novo para APK de diagnóstico e **AAB de lançamento assinado**.
- `android-auto/`: módulo Android Auto existente + serviço POI atualizado para uma lista minimalista de acessos.
- `play-auto/scripts/configure-play.mjs`: configura package, versão, API 36 e assinatura.
- `play-auto/branding/`: ícones para a APK e Google Play (512 x 512).
- `public/privacidade-auto.html`: política de privacidade para publicação em GitHub Pages.
- `play-auto/tests/`: testes de verificação, sem dependências extra.

## 2. Criar a aplicação Play Console

Abrir https://play.google.com/console e criar (se ainda não criada):

| Campo | Valor |
|---|---|
| Nome | RJP Navigator Auto |
| Pacote | `pt.rjp.navigator.auto` |
| Idioma | Português (Portugal) |
| Tipo | Aplicação |
| Preço | Gratuita |

O pacote não pode ser alterado depois da primeira publicação. Não usar `pt.rjp.navigator` da APK antiga.

## 3. Carregar o kit no GitHub

Na raiz do repositório `https://github.com/ruijpedro/RJP-Navigator`, colocar todas as pastas deste ZIP, **preservando os caminhos**. No GitHub, a opção `Add file -> Upload files` com arrastar pastas pode funcionar no PC. Alternativamente, usar `Code -> Codespaces` e carregar os ficheiros, ou GitHub Desktop.

Os dois workflows Android Auto coexistem. O novo aparece como:
**Actions -> RJP Navigator Auto - Google Play AAB**.

Primeira execução: selecionar `destino: diagnostico`. O workflow verifica testes, instala Android Auto POI, aplica o ícone e gera um APK para diagnóstico; esta APK *debug* não se destina à Play e pode não aparecer diretamente no automóvel.

## 4. Criar uma chave de UPLOAD segura (uma única vez)

Para obter um AAB instalável via Google Play é necessária uma **upload key** estável, distinta da chave de assinatura gerida pela Google.

Se tens Java/JDK no computador, abrir terminal na pasta pessoal (nunca dentro do repositório público):

```bash
keytool -genkeypair -keystore rjp-auto-upload.jks -alias rjpauto -keyalg RSA -keysize 3072 -validity 10000
```

Indicar uma palavra-passe forte para o cofre, os dados do certificado e a palavra-passe da chave. Guarda o ficheiro `.jks` e as palavras-passe em local privado, com cópia de segurança. Se não tens Java instalado, podes usar um terminal privado com JDK, por exemplo um ambiente temporário GitHub Codespaces; não faças commit nem publiques os dados privados.

Para converter a chave binária em base64 sem a expor publicamente:

- **PowerShell (Windows):** `[Convert]::ToBase64String([System.IO.File]::ReadAllBytes('C:\CAMINHO\rjp-auto-upload.jks'))`
- **Linux:** `base64 -w 0 rjp-auto-upload.jks`

Copia o valor diretamente para os GitHub Actions secrets, sem o guardar em `.txt` no repositório.

## 5. Definir 4 GitHub Actions secrets

No GitHub: `Settings -> Secrets and variables -> Actions -> New repository secret`.

| Secret | Valor |
|---|---|
| `RJP_PLAY_UPLOAD_KEYSTORE_B64` | Conteúdo base64 **completo** da tua chave `.jks` |
| `RJP_PLAY_STORE_PASSWORD` | Palavra-passe do ficheiro `.jks` |
| `RJP_PLAY_KEY_ALIAS` | Alias da chave, por exemplo `rjpauto` |
| `RJP_PLAY_KEY_PASSWORD` | Palavra-passe da própria chave |

**NUNCA** enviar estes segredos por chat, nem fazer commit da chave ou das palavras-passe. O workflow constrói o AAB usando variáveis de ambiente e apaga a cópia temporária no fim.

## 6. Gerar AAB e carregar para testes internos

1. Actions -> **RJP Navigator Auto - Google Play AAB** -> Run workflow.
2. Selecionar `destino: google-play`.
3. Quando a compilação terminar, descarregar o artifact `RJP_Navigator_Auto_GooglePlay_AAB_Assinado`.
4. Extrair `app-release.aab` do ZIP de artifacts.
5. Play Console -> RJP Navigator Auto -> **Testar e lançar -> Teste interno -> Criar lançamento** e carregar o `.aab`.
6. Configurar os testadores (incluindo a conta Google usada no telemóvel), preencher as declarações e tarefas exigidas, e ativar o formato **Android Auto** nas definições relevantes da aplicação.
7. Aguardar disponibilização/avaliação e instalar pela ligação da Google Play de teste. A aprovação e o aparecimento do ícone no Android Auto dependem da Google e do host do veículo.

Não confundir **Android Auto** (app projetada pelo telemóvel) com **Android Automotive OS** (app instalada no sistema operativo do carro).

## 7. Como fica o ecrã do carro

**Só duas situações, sem menus desnecessários:**

- **Sem acessos confirmados:** mensagem para abrir a app no telemóvel e guardar um acesso rodoviário.
- **Com acessos confirmados:** lista simples `Linha do Oeste · PK 115+350` e subtítulo da rua. Tocar envia o **ponto rodoviário** para uma app de navegação, não para a via férrea.

É necessário abrir a app **RJP Navigator Auto** no telemóvel, procurar PK e confirmar/guardar o acesso nela; os dados locais da V4.2.4 normal não são automaticamente partilhados entre dois pacotes Android diferentes.

## 8. Atualizações OTA

- **Dados e fichas dos ativos:** continuam a ser sincronizados pela aplicação com a folha central Google Sheets, sem reinstalação (sujeito à configuração central existente).
- **Acessos rodoviários locais:** a app sincroniza a lista guardada para o serviço Android Auto no mesmo dispositivo.
- **Interface/código nativo Android Auto e código da app:** novas versões através de AAB na Google Play. Não prometer instalação OTA de código executável fora da Play, para manter compatibilidade com as regras de distribuição.

## 9. Política de privacidade

Depois de carregar a pasta `public` e publicar GitHub Pages, a página poderá ficar disponível em:
`https://ruijpedro.github.io/RJP-Navigator/privacidade-auto.html`
Confirma o URL efetivo antes de o colocares na Play Console.

## Avisos

- A proximidade de um acesso à ferrovia **não prova** que a estrada é pública, transitável ou autorizada. Confirmar antes de encaminhar uma viatura.
- Não introduzir informação operacional confidencial na Google Sheet pública. A integração do Apps Script pode tornar os campos disponíveis a terceiros com o URL.
- A Play Console pode exigir revisão de categoria POI, política de privacidade, conteúdo e qualidade para Android Auto.
- O alvo Android 16 / API 36 resulta dos requisitos vigentes desde agosto de 2026 para novas apps Android projetadas. Fonte oficial: https://support.google.com/googleplay/android-developer/answer/11926878
- A compilação do AAB final ainda não foi executada neste ambiente: deve ser validada pelo workflow GitHub Actions com a chave de upload configurada.
