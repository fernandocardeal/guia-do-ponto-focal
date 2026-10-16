# Portal do Ponto Focal

Portal web estático para consultar e manter cards informativos. A interface permite cadastrar, editar e excluir cards, visualizar seus detalhes e importar ou exportar os dados em JSON.

## Como usar

1. Abra `index.html` em um navegador moderno.
2. Selecione **Abrir JSON** para carregar uma lista de cards.
3. Consulte os cards ou use **Cadastrar Card** para adicionar um novo.
4. Use **Salvar alterações** para gravar as mudanças no arquivo associado ou exportar um JSON.

As alterações também são mantidas no armazenamento local (`localStorage`) do navegador. Os dados locais não substituem um backup JSON. O portal não carrega automaticamente os arquivos da pasta `dados`.

## Formato dos dados

O JSON deve conter uma lista de cards com os campos `id`, `titulo`, `legenda` e `conteudo`. `conteudo` pode ser um objeto de pares chave/valor ou um texto. Exemplo:

```json
[
  {
    "id": "exemplo-1",
    "titulo": "Informações de acesso",
    "legenda": "Orientações para a equipe",
    "conteudo": {
      "Sistema": "Portal interno",
      "Acesso": "Solicite autorização à equipe responsável"
    }
  }
]
```

O arquivo `dados/pessoas.json` contém 15 cards de exemplo e pode ser carregado pela opção **Abrir JSON**.

## Persistência e compatibilidade

O portal valida os arquivos JSON antes de importá-los. Ao salvar, navegadores compatíveis podem gravar no arquivo escolhido durante a sessão; em outros navegadores, o portal baixa um arquivo JSON. O identificador do arquivo escolhido não é preservado ao recarregar a página, então pode ser necessário selecionar o destino novamente.

## Arquivos do projeto

- `index.html`: estrutura e navegação da interface.
- `style.css`: estilos e layout responsivo.
- `script.js`: renderização, operações dos cards e importação/exportação.
- `dados/pessoas.json`: conjunto de dados de exemplo.
- `GUIA_DO_PROJETO.md`: documentação detalhada de funcionamento e manutenção.

Não há dependências, processo de build ou servidor configurado.
