# 📈 ESTUDA TRADER

Plataforma pessoal de gestão de estudos para trading. Organize conceitos, registre sessões de estudo, faça anotações e acompanhe sua evolução com autoavaliações baseadas no Método ABC e Técnica de Feynman.

## 🚀 Como Usar

1. Abra o arquivo `index.html` no navegador (ou use [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) no VS Code)
2. Importe seus conceitos via arquivo CSV (modelo incluído em `data/conceitos.csv`)
3. Comece a organizar seus estudos!

> **Nota:** Não precisa de `npm install` nem build. O projeto roda direto no navegador.

## 📁 Estrutura

```
ESTUDA TRADER/
├── index.html          # Ponto de entrada
├── css/
│   ├── style.css           # Estilos customizados (scrollbar)
│   └── markdown-styles.css # Estilos para renderização markdown
├── js/
│   ├── app.js              # Bootstrap e state listener
│   ├── state.js            # Store reativa (localStorage)
│   ├── engine.js           # Ações de negócio (CRUD)
│   ├── router.js           # Navegação entre views
│   ├── dashboard.js        # View do dashboard
│   ├── concept-list.js     # Lista de conceitos com filtros
│   ├── concept-detail.js   # Detalhe do conceito + anotações + avaliações
│   ├── sessions.js         # Gestão de sessões de estudo
│   └── utils.js            # Utilitários (cn, parseCSV)
└── data/
    └── conceitos.csv       # Base de conceitos para importação
```

## 🛠 Tecnologias

- **HTML5 + JavaScript** (ES Modules, vanilla)
- **Tailwind CSS v4** (via CDN)
- **Lucide Icons** (via CDN)
- **Marked.js** (renderização markdown)
- **PapaParse** (parsing de CSV)
- **localStorage** para persistência dos dados

## 📊 Funcionalidades

- **Dashboard** com estatísticas por categoria ABC e visão geral do progresso
- **Gestão de Conceitos** com filtros (busca, macro-categoria, ABC)
- **Detalhamento** com anotações tipadas (Dúvida, Pergunta, Observação de Tela)
- **Autoavaliação** com scores de Flashcards + Quiz e Técnica de Feynman
- **Sessões de Estudo** vinculadas a conceitos, com controle de conclusão
- **Importação CSV** para carga inicial de conceitos

## 📄 Licença

Projeto pessoal para uso educacional.
