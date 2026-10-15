# RJP Navigator V3.12 — Sincronização centralizada, sem configuração por dispositivo

## O que está pronto

- Android e WebApp consultam automaticamente a configuração pública em `https://ruijpedro.github.io/RJP-Navigator/config/pn-sync.json` (com alternativa em `raw.githubusercontent.com`).
- **Não existe campo para configurar o Apps Script em cada telemóvel.** Todos usam a mesma fonte.
- Quando há internet, a aplicação procura uma nova configuração, carrega as PN do Google Drive, valida os registos e guarda uma cópia offline.
- Atualiza ao abrir, ao voltar ao primeiro plano, ao regressar a internet e a cada 15 minutos enquanto ativa. O botão `Sincronizar agora` força a tentativa.
- Se a configuração central ou o Google estiver temporariamente indisponível, mantém as PN já guardadas; se a configuração tinha sido ativada e validada, tenta também o último endereço guardado.

## Passo 1 — Uma vez: publicar o Google Apps Script

1. Abre `https://script.google.com/`, cria um novo projeto.
2. Cola todo o ficheiro `integrations/google-apps-script/Code.gs` (incluído no ZIP).
3. Confirma o ID da folha `1_GS7TqQjbb59UJXeVv-woQk2ho7OqkE65JKAFB68VkE` e o separador `PN_LO_Atual`.
4. Clica em **Implementar → Nova implementação → Aplicação Web**.
5. Seleciona **Executar como: Eu** e **Quem tem acesso: Qualquer pessoa**, se a tua conta permitir; concede apenas as permissões necessárias à leitura da folha.
6. Copia o URL de implementação que termina em **`/exec`**.

**Nota de privacidade:** o Apps Script expõe publicamente os campos técnicos de PN (PK, designação, localidade, concelho, freguesia, latitude, longitude e observações). Não publiques nesta folha informações pessoais, restritas ou operacionais sensíveis. A folha privada não é editável através do script e os dados são só de leitura.

## Passo 2 — Uma vez: ativar na configuração central (GitHub)

1. Abre o repositório: `https://github.com/ruijpedro/RJP-Navigator`.
2. Edita **`public/config/pn-sync.json`** na branch **main**. Este ficheiro está incluído no ZIP V3.12.
3. Troca `"enabled": false` por `"enabled": true`.
4. Preenche `"feedUrl": "https://script.google.com/macros/s/SEU_ID/exec"` com o endereço publicado no passo 1.
5. Faz commit. O workflow **Publicar RJP Navigator WebApp** deve publicar o ficheiro no GitHub Pages; confirma que o endereço `https://ruijpedro.github.io/RJP-Navigator/config/pn-sync.json` mostra `enabled: true` e o URL correto.
6. Abre a WebApp ou APK **V3.12** em qualquer aparelho e carrega em **Sincronizar agora** para verificar a mensagem das PN atualizadas. Os restantes aparelhos irão sincronizar automaticamente sem configurar nada.

**Importante:** a versão entregue vem com `enabled: false` e `feedUrl: ""` porque o Apps Script ainda não foi publicado. Não é possível obter um URL real `/exec` sem essa publicação na tua conta Google. **Não introduzas dados secretos no JSON público.**

## E depois?

Quando alterares o nome, PK, localidade ou outro campo de uma PN na folha `PN_LO_Atual`, a aplicação atualiza a listagem na sincronização seguinte. **Não é necessário compilar nem reinstalar a APK/WebApp para corrigir dados.** O PK é a chave de identificação da PN; ao alterar um PK, revê os GPS e acessos locais associados ao valor antigo.

O endereço do Apps Script fica no ficheiro central do GitHub e nunca tem de ser escrito em cada aparelho. Se voltares a publicar o Apps Script e o URL mudar, basta corrigir o ficheiro central (após publicação Web); os dispositivos atualizam sem reinstalação.

## Segurança e limitações

- A configuração é pública e contém **apenas o URL de leitura**, sem credenciais nem tokens.
- Só aceita URLs HTTPS oficiais `script.google.com/macros/s/.../exec`. Configuração inválida ou resposta PN incompleta é rejeitada.
- O Google Apps Script usa JSONP devido a CORS. Não insiras dados pessoais nos campos publicados. 
- A configuração é consultada online e guardada em cache local verificada, para tolerância a falhas.
- A cartografia ferroviária vem incluída; o fundo cartográfico e a pesquisa de acessos rodoviários dependem de internet.
- A pesquisa por PK não passa a ser automaticamente calibrada em todas as linhas ferroviárias: continua limitada às referências quilométricas disponíveis.
