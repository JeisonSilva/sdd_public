# Integração com IDEs

## Estratégias de Integração

### Opção 1: MCP Server (Recomendada)

O **Model Context Protocol (MCP)** é suportado nativamente por Claude Code, Cursor e VS Code + Continue.dev.

```
IDE (Cursor/VS Code)
     │
     │ MCP Protocol (stdio / SSE)
     ▼
SDD MCP Server
     │
     ▼
Orchestrator Agent
```

**Configuração no Cursor (`~/.cursor/mcp.json`)**:
```json
{
  "mcpServers": {
    "sdd": {
      "command": "python",
      "args": ["-m", "src.ide_integration.mcp_server"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "SDD_PROJECT_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

**Tools MCP expostas**:
```python
@mcp.tool()
def analyze_codebase(path: str) -> dict:
    """Indexa e analisa a estrutura do projeto."""

@mcp.tool()
def chat(message: str, context_files: list[str] = []) -> str:
    """Envia mensagem ao orquestrador com contexto de arquivos."""

@mcp.tool()
def get_suggestions(current_file: str, cursor_position: int) -> list[dict]:
    """Sugestões proativas baseadas no arquivo e posição atual."""

@mcp.tool()
def apply_change(file_path: str, change: dict) -> bool:
    """Aplica mudança sugerida pelo agente (com confirmação)."""

@mcp.tool()
def explain_selection(file_path: str, start_line: int, end_line: int) -> str:
    """Explica código selecionado."""
```

---

### Opção 2: VS Code Extension

Para controle máximo da experiência do usuário.

**Estrutura da extensão**:
```
vscode-sdd/
├── src/
│   ├── extension.ts          # Entry point
│   ├── chat/
│   │   ├── ChatPanel.ts      # WebView com chat UI
│   │   └── ChatProvider.ts   # Comunica com SDD API
│   ├── providers/
│   │   ├── InlineCompletion.ts  # Sugestões inline
│   │   └── CodeLens.ts          # "Revisar" / "Explicar" botões
│   └── commands/
│       ├── generateCode.ts
│       ├── reviewFile.ts
│       └── debugError.ts
├── package.json
└── webview/                  # Chat UI (React)
```

**Comandos registrados**:
```json
{
  "contributes": {
    "commands": [
      { "command": "sdd.chat", "title": "SDD: Abrir Chat" },
      { "command": "sdd.reviewFile", "title": "SDD: Revisar Arquivo" },
      { "command": "sdd.generateTests", "title": "SDD: Gerar Testes" },
      { "command": "sdd.explainSelection", "title": "SDD: Explicar Seleção" },
      { "command": "sdd.fixError", "title": "SDD: Corrigir Erro" }
    ],
    "menus": {
      "editor/context": [
        { "command": "sdd.explainSelection", "when": "editorHasSelection" },
        { "command": "sdd.reviewFile" }
      ]
    }
  }
}
```

---

### Opção 3: CLI Tool

Para desenvolvedores que preferem terminal.

```bash
# Instalar
pip install sdd-cli

# Usar
sdd chat "implemente autenticação JWT em Python"
sdd review src/auth/service.py
sdd test src/auth/service.py
sdd debug --file error.log
sdd explain src/utils.py:42-58
```

---

## Comunicação em Tempo Real

### WebSocket para Streaming de Respostas

```python
# Cliente (IDE Extension / WebView)
ws = WebSocket("ws://localhost:8765/chat")

ws.send(json.dumps({
    "session_id": "abc123",
    "message": "Implemente autenticação JWT",
    "context": {
        "open_files": ["src/auth/service.py"],
        "project_root": "/home/user/myproject",
        "language": "python"
    }
}))

# Recebe tokens em streaming
async for msg in ws:
    data = json.loads(msg)
    if data["type"] == "token":
        print(data["content"], end="", flush=True)
    elif data["type"] == "tool_call":
        show_tool_indicator(data["tool_name"])
    elif data["type"] == "done":
        break
```

---

## Indexação do Codebase

Ao abrir um projeto, o SDD indexa o codebase para contexto:

```
1. Scan de arquivos (respeita .gitignore)
2. Parse AST por linguagem (Python: ast, TS: ts-morph)
3. Extração de:
   - Funções e classes com suas assinaturas
   - Imports e dependências
   - Docstrings e comentários
4. Geração de embeddings (text-embedding-3-small)
5. Armazenamento no Vector DB local
```

Isso permite que os agentes respondam perguntas como:
- "Onde está implementado o sistema de cache?"
- "Que funções existem para validação de dados?"
- "Mostre todos os endpoints da API"
