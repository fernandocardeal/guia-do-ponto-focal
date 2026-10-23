# Portal do Ponto Focal

Um portal leve para organizar, consultar e atualizar informações de pontos focais em cards. A interface funciona no navegador e permite importar e exportar os dados em planilhas Excel.

## O que você pode fazer

- Consultar cards em uma grade e abrir os detalhes de cada registro.
- Cadastrar, editar e excluir cards com campos personalizados.
- Buscar por título, legenda, nome de campo ou valor.
- Filtrar cards que contêm uma data de hoje e ordenar pela data encontrada.
- Alternar entre os temas claro e escuro.
- Importar uma planilha `.xlsx` ou `.xls` e exportar os cards para `.xlsx`.

## Começar

O projeto não precisa de instalação nem de etapa de build. Baixe ou clone o repositório e sirva a pasta por um servidor HTTP local. Por exemplo, com Python:

```bash
python -m http.server 8000
```

Depois, abra [http://localhost:8000](http://localhost:8000) no navegador.

O portal também pode ser publicado em qualquer hospedagem de arquivos estáticos. A biblioteca usada para Excel é carregada do jsDelivr, então os recursos de importação e exportação dependem de acesso à rede e da disponibilidade desse CDN.

## Importar e exportar Excel

Na importação, o portal lê a **primeira aba** da planilha e considera:

1. A primeira linha como cabeçalho.
2. A primeira coluna como título do card.
3. A segunda coluna como legenda.
4. As demais colunas como campos e informações do card.

A importação substitui os cards carregados no portal. Se quiser manter uma cópia dos dados atuais, exporte-os antes de abrir outra planilha. A exportação cria uma planilha `.xlsx` tabular com a união dos campos encontrados nos cards.

Datas reconhecidas em campos de texto, no formato brasileiro, ISO ou serial do Excel, podem ser usadas pelo filtro e pela ordenação. Valores que não forem reconhecidos como data continuam sendo apresentados como texto.

## Dados e privacidade

Os cards e as preferências de tema ficam no `localStorage` do navegador, associados à origem em que o portal foi aberto. Isso significa que os dados não são sincronizados entre pessoas, navegadores ou dispositivos. Limpar os dados do site no navegador também pode removê-los; exporte uma planilha para guardar uma cópia.

Os arquivos em `dados/` são exemplos de dados no repositório. O portal não os carrega automaticamente: para usar uma planilha própria, abra-a pelo botão **Abrir Excel**.

## Estrutura do projeto

```text
├── index.html                  # Estrutura da interface
├── style.css                   # Estilos e temas
├── script.js                   # Comportamento, cards e planilhas
├── dados/
│   ├── pessoas.json            # Exemplo de registros
│   └── vava.json               # Exemplo de conteúdo
└── contexto/
    ├── relatorio_projeto.md    # Relatório de leitura do projeto
    ├── guia_melhorias.md       # Sugestões e estado das melhorias
    └── conversa_antigravity.md # Registro de discussão técnica
```

## Tecnologias

- HTML, CSS e JavaScript sem framework.
- [SheetJS](https://sheetjs.com/) para leitura e geração de arquivos Excel, carregado via CDN.
- `localStorage` para persistência local no navegador.

## Documentação adicional

Consulte [`contexto/relatorio_projeto.md`](contexto/relatorio_projeto.md) para uma descrição do funcionamento atual e [`contexto/guia_melhorias.md`](contexto/guia_melhorias.md) para o histórico de melhorias discutidas e seu estado.
