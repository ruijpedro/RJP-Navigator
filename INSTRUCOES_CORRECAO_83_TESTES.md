# RJP Navigator V4.1.1 — reparação de regressões

## Origem do erro
A V4.1 substituiu o inventário atualizado (103 PN) por uma base antiga de 59 PN, retirou a cartografia offline IP, substituiu a API nacional V4.0 e omitiu a chamada de sincronização central na interface. Os testes revelaram 20 falhas (63 passaram em 83).

## Solução
A V4.1.1 preserva o código hectométrico e repõe de forma **verificável** os módulos e dados do commit público e imutável `8d895423409a7ef003498e31e53344429ab01c9d` do próprio repositório, que compilou em 15/10/2026. O script `scripts/restore-v40-compat.mjs` obtém os ficheiros originais através do GitHub durante a primeira compilação, verifica 103 PN e o eixo IP >4000 vértices, e só então altera o projeto.

- Não se desativam nem eliminam testes.
- A `main.jsx` V4.1 mantém a camada hectométrica e recebe novamente a sincronização central por Apps Script.
- A biblioteca `national.js` mantém o motor V4.1 e reexporta a API V4.0, sem destruir os métodos novos.
- O processo `npm run prepare:maps` não sobrescreve a cartografia IP offline com um descarregamento falhado.

## Instalação
1. Faz uma cópia de segurança dos dados exportados pela aplicação.
2. Extrai e copia o conteúdo deste ZIP para a raiz do teu repositório GitHub, incluindo `.github/workflows` e `scripts`.
3. Em **Actions**, executa `Build RJP Navigator APK V4.1.1` ou `Build RJP Navigator WebApp V4.1.1`.
4. A etapa **Repor dados e funções V4.0** requer acesso do runner ao GitHub público. Se não conseguir descarregar, falha com erro explícito — não fabrica dados.
5. A etapa `npm test` efetua também verificação/recuperação automática. A APK/WebApp usa os ficheiros restaurados no build.

**Limitação:** o ZIP é um projeto com reparação durante a compilação, não uma prova de 83 testes aprovados. O resultado do GitHub Actions deve ser confirmado. A geometria IP e os marcos hectométricos continuam estimados quando faltam referências quilométricas oficiais.
