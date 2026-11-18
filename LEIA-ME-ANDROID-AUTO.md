# RJP Navigator — Android Auto beta (complemento para V4.2.4)

Este ZIP é um **complemento** ao repositório `ruijpedro/RJP-Navigator` V4.2.4. Não substitui a aplicação nem contém a base cartográfica (já existe no repositório). Não substituir o ZIP anterior com uma versão mais antiga.

## Objetivo e limite

A beta adiciona um serviço Android Auto com categoria **POI (pontos de interesse)**. Exibe no ecrã do carro **apenas acessos rodoviários que o utilizador confirmou no telemóvel**, ao selecionar uma linha + PK, procurar a estrada e confirmar a acessibilidade. Ao selecionar um desses acessos no carro, envia as suas **coordenadas de estrada**, não o PK ferroviário, a uma aplicação de navegação do Android Auto.

Não mostra o mapa ferroviário completo no carro, não faz orientação ferroviária em movimento e não aceita introdução livre de PK durante a condução. Não tem promessa de entrada autorizada em instalações ferroviárias. A pesquisa de estradas e a verificação no terreno são realizadas na aplicação de telemóvel.

## Instalação no GitHub

1. No repositório `ruijpedro/RJP-Navigator`, adicionar **as pastas `.github` e `android-auto` deste ZIP**, preservando a estrutura. Não apagar/substituir outros ficheiros do repo.
2. Abrir GitHub Actions → **RJP Navigator - Android Auto Beta** → **Run workflow**.
3. Se a compilação for verde, descarregar o artifact `RJP_Navigator_Android_Auto_Beta_APK` e instalar a APK beta no telemóvel. O nome é RJP Navigator, mas o package ID `pt.rjp.navigator.autobeta` é diferente do estável, para não alterar a V4.2.4 instalada.
4. Na APK beta, abrir a parte de navegação nacional. Selecionar um PK, procurar uma estrada e usar «Confirmar acesso». A funcionalidade só partilha com o Android Auto acessos validados pelo utilizador. Se houver backup dos acessos na aplicação estável, pode importar o JSON na beta.
5. Conectar Android Auto ao veículo. Procurar «RJP Navigator» na lista de aplicações. Se a beta não aparecer, consultar os requisitos de compatibilidade e de teste de aplicações de desenvolvimento; não é garantido que APK debug por instalação manual seja apresentada em todos os carros/telemóveis.
6. Não utilizar o telemóvel ou introduzir dados enquanto se conduz.

## Funcionamento do bridge

- `android-auto/scripts/patch-web.mjs`: integra na interface React uma chamada Capacitor após alterar a lista local de acessos confirmados.
- `android-auto/scripts/install-native.mjs`: instala classes Java `RjpCarBridge` e `RjpCarAppService` na compilação gerada pelo Capacitor, declaração Android Auto no Manifest, XML do host e dependências `androidx.car.app:app` e `app-projected` na versão estável 1.7.0.
- `.github/workflows/android-auto-beta.yml`: workflow separado, executado apenas manualmente, preserva as builds Android/Web existentes.

## Limitações e validação

Esta é uma **primeira integração de desenvolvimento**, ainda não compilada num emulador Android Auto nem num veículo. Necessita de validação real de UI, ciclo de vida, compatibilidade do dispositivo, certificação Google Play e regras de distração ao volante. APK debug pode precisar de opções de programador ou distribuição de teste; não prometer funcionamento garantido em qualquer carro.

Não há sincronização entre aplicações Android distintas: a beta guarda acessos confirmados no seu próprio armazenamento Android e apresenta-os no Android Auto. A folha Google Sheets contém ativos ferroviários, não pontos rodoviários confirmados; não é usada como fonte direta de destinos do carro.

O catálogo de acessos confirmados só existe no dispositivo, salvo exportação/importação manual. Uma próxima versão pode sincronizar apenas esses acessos através de um serviço central protegido, após validação de permissões e confidencialidade de dados operacionais.

Documentação Google:
- https://developer.android.com/training/cars/apps/poi
- https://developer.android.com/training/cars/apps/library/set-up-project
- https://developer.android.com/jetpack/androidx/releases/car-app
