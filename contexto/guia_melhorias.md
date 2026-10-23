# Guia de melhorias — Portal do Ponto Focal

## Estado do guia

Este é um rascunho técnico baseado na leitura estática de `index.html`, `style.css` e `script.js`. Houve conversa com Antigravity: 10 rodadas de entendimento concluídas e 17 rodadas respondidas sobre melhorias; a rodada 28 ficou pendente e as rodadas 29–30 não ocorreram. O [registro da conversa](conversa_antigravity.md) contém o resumo. O filtro por situação da data e a ordenação cronológica foram implementados; as demais sugestões continuam sendo propostas, não decisões de produto aprovadas.

## 1. Filtro e ordenação por data

**Estado:** implementado. A lista pode ser filtrada por cards que contêm data de hoje ou que não contêm data de hoje, além de manter a busca por texto. A ordenação pode seguir a ordem atual ou cronológica crescente/decrescente; usa a data mais antiga encontrada na legenda ou no conteúdo, colocando cards sem data ao final.

**Arquivos:** `index.html`, `script.js` e `style.css`.

## 2. Validação da importação Excel

**Objetivo:** tratar arquivos inválidos com mensagens compreensíveis.

**Como implementar quando solicitado:**

1. Separar a leitura da planilha da gravação em `cardsData`: criar uma função que devolva cabeçalhos, registros e avisos de validação.
2. Validar presença das colunas de título/legenda, linhas em branco, cabeçalhos duplicados e registros sem título.
3. Importar diretamente, sem prévia ou etapa de confirmação.
4. Exibir erro no `#app-notice` e preservar os dados atuais se a leitura falhar.
5. Tratar arquivos sem linhas e biblioteca XLSX indisponível com mensagem útil.

## 3. Feedback da persistência local

**Objetivo:** informar quando mudanças foram salvas e preservar dados em falha de armazenamento.

**Como implementar quando solicitado:**

1. Fazer `saveToLocalStorage()` retornar sucesso/erro com `try/catch` para `JSON.stringify` e `localStorage.setItem`.
2. Nas operações de criar, editar, excluir e importar, só atualizar a interface após salvar com sucesso, ou manter cópia para restaurar o estado se a gravação falhar.
3. Usar `#app-notice` (`role="status"`, `aria-live="polite"`) para mensagens curtas de sucesso/erro sem depender apenas do popover de status.
4. Ao recuperar JSON inválido, avisar e não sobrescrever silenciosamente a chave corrompida.
5. Atualizar o nome da planilha e os dados persistidos de forma consistente ao importar/editar.

## 5. Acessibilidade de navegação e cards

**Objetivo:** permitir completar os fluxos por teclado e tecnologias assistivas.

**Como implementar quando solicitado:**

1. Substituir `div` clicável e `span.link-hint` por `<button>` ou `<a>` real para abrir detalhes.
2. Garantir rótulos explícitos para ícones/indicadores e não usar apenas cor para comunicar a situação: apresentar texto “Data hoje”/“Sem data de hoje” junto ao ponto.
3. Adicionar estados `:focus-visible` coerentes em `style.css` para navegação, ações, filtros, formulário e controles do popover.
4. Garantir ordem de tabulação previsível e que mudanças de seção/detalhe levem o foco a um título ou região adequada sem prender o foco.
5. Usar `aria-expanded` no controle de status e garantir que o popover feche com Escape e tenha foco previsível.
6. Revisar contraste dos botões e cores nos dois temas.

## 7. Robustez de dados e busca

**Objetivo:** lidar com registros parcialmente preenchidos ou vindos de planilhas inconsistentes.

**Como implementar quando solicitado:**

1. Criar uma função de normalização na entrada que transforme título, legenda e valores em strings seguras; normalizar conteúdo ausente para objeto.
2. Usar coerção consistente (`String(valor ?? '')`) na pesquisa antes de chamar `toLowerCase()`.
3. Definir estratégia para cabeçalhos duplicados/vazios na importação (avisar, renomear ou ignorar) sem descartar valores de forma silenciosa.
4. Gerar IDs únicos também para linhas importadas, sem depender apenas do mesmo timestamp combinado com índice em arquivos importados repetidamente.
5. Manter o escape de HTML em toda renderização e evitar inserir texto externo em atributos inline; migrar os eventos inline para `addEventListener` quando os componentes forem reorganizados.

## 8. Dependência SheetJS e operação sem rede

**Objetivo:** tornar previsível a disponibilidade de abrir/salvar Excel.

**Como implementar quando solicitado:**

1. Primeiro detectar se `window.XLSX` está disponível antes de usar as funções de importação/exportação e informar claramente quando não estiver.
2. Para operação offline, decidir entre armazenar uma cópia local da biblioteca no projeto ou adotar outra estratégia compatível com a licença e distribuição do portal.
3. Se continuar com CDN, tratar erro de carregamento e deixar explícito que as funções Excel dependem da rede.
4. Conferir a política de atualização da dependência e evitar alterar versão sem revisar compatibilidade.

## Ordem sugerida para execução

1. **Filtro estruturado** — atende diretamente ao pedido e reutiliza a regra de data existente.
2. **Validação da importação** — explica problemas em arquivos inválidos.
3. **Feedback de persistência** — deixa claro se as alterações sobreviveram ao navegador.
4. **Acessibilidade** — melhora o uso por teclado e leitor de tela.
5. **Robustez de dados** — reduz problemas com planilhas inconsistentes e registros incompletos.
6. **Operação offline da biblioteca** — decidir conforme o ambiente de implantação.

A ordem é uma recomendação inicial. As melhorias não devem incluir etapas de confirmação nem ajustes para celular.
