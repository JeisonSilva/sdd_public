# Arquitetura Detalhada - SDD AI Agents

## 1. Visão de Alto Nível

```
┌──────────────────────────────────────────────────────────────────┐
│                         CHAT INTERFACE                            │
│   VS Code Extension │ Cursor Plugin │ Web UI │ CLI               │
└─────────────────────────────┬────────────────────────────────────┘
                              │ WebSocket / HTTP
┌─────────────────────────────▼────────────────────────────────────┐
│                        API GATEWAY (FastAPI)                      │
│   Auth │ Rate Limiting │ Session Management │ WebSocket Hub       │
└─────────────────────────────┬────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                     ORCHESTRATOR AGENT                            │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ Intent      │  │ Agent Router │  │ Context Manager         │ │
│  │ Classifier  │→ │              │→ │ (session + codebase)    │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
└──────┬──────┬──────┬──────┬──────┬──────┬───────────────────────┘
       │      │      │      │      │      │
       ▼      ▼      ▼      ▼      ▼      ▼
┌──────────────────────────────────────────────────────────────────┐
│                     SPECIALIZED AGENTS                            │
│                                                                   │
│  [Requirements] [Architecture] [CodeGen] [Test] [Review] [Debug] │
│                                                                   │
│  Cada agente possui:                                              │
│   • System Prompt especializado                                   │
│   • Ferramentas específicas (tools)                               │
│   • Acesso ao contexto compartilhado                              │
└─────────────────────────┬────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│                      TOOL LAYER                                   │
│                                                                   │
│  [File System] [Git] [Terminal] [LSP] [Search] [Web Fetch]       │
└─────────────────────────┬────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│                    CONTEXT & MEMORY LAYER                         │
│                                                                   │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │ Short-term   │  │ Long-term        │  │ Codebase Index    │  │
│  │ (Redis TTL)  │  │ (Vector DB)      │  │ (pgvector/AST)    │  │
│  └──────────────┘  └──────────────────┘  └───────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Fluxo de uma Mensagem

```
1. Usuário escreve no chat:
   "Crie uma função para autenticar usuário com JWT"

2. API Gateway recebe via WebSocket
   → autentica sessão
   → cria/recupera contexto da sessão

3. Orchestrator Agent processa:
   a) Intent Classifier → detecta: CODE_GENERATION + SECURITY
   b) Context Manager → carrega: linguagem do projeto, libs existentes
   c) Agent Router → seleciona: CodeGenerator + Reviewer (pipeline)

4. CodeGenerator Agent executa:
   → recebe contexto do projeto
   → usa tool: read_file (verifica padrões existentes)
   → gera código JWT authentication
   → retorna código + explicação

5. Reviewer Agent valida automaticamente:
   → verifica vulnerabilidades de segurança
   → sugere melhorias (ex: token expiry, refresh tokens)

6. Response consolidada enviada ao chat
   → código formatado
   → sugestões do reviewer
   → próximos passos sugeridos
```

## 3. Gerenciamento de Contexto

### Três Camadas de Memória

```
SHORT-TERM (Redis, TTL: 1h)
├── Histórico da conversa atual
├── Arquivos abertos/mencionados
└── Decisões tomadas na sessão

LONG-TERM (Vector DB)
├── Padrões aprendidos do projeto
├── Preferências do desenvolvedor
├── Arquitetura documentada
└── Bugs históricos e soluções

CODEBASE INDEX (AST + Embeddings)
├── Estrutura de arquivos
├── Funções, classes, interfaces
├── Dependências entre módulos
└── Padrões de código existentes
```

## 4. Protocolo MCP (Model Context Protocol)

O sistema expõe um **MCP Server** para integração nativa com VS Code/Cursor:

```
MCP Tools disponíveis:
├── sdd/analyze_codebase   → indexa o projeto atual
├── sdd/chat               → envia mensagem ao orquestrador
├── sdd/get_suggestions    → sugestões proativas baseadas no arquivo aberto
├── sdd/apply_changes      → aplica mudanças sugeridas pelo agente
└── sdd/explain_code       → explica código selecionado
```

## 5. Decisões Arquiteturais

### Por que Multi-Agent vs. Single Agent?

| Aspecto | Single Agent | Multi-Agent |
|---------|-------------|-------------|
| Especialização | Genérico | Alta especialização por domínio |
| Contexto | Acumula tokens | Contexto focado por agente |
| Paralelismo | Sequencial | Agentes podem operar em paralelo |
| Manutenção | Prompt monolítico | Prompts modulares e testáveis |
| Escalabilidade | Limitada | Adiciona agentes sem refatorar |

### Por que Claude API?

- Suporte nativo a **tool use** (function calling)
- **Extended thinking** para decisões arquiteturais complexas
- **Claude Agent SDK** para orquestração de agentes
- Contexto de até 200K tokens (codebase inteiro)

## 6. Segurança

- Execução de código em **sandbox isolado** (Docker/e2b)
- Sem acesso a credenciais do projeto (leitura de `.env` bloqueada)
- Confirmação do usuário antes de **write operations**
- Audit log de todas as ações dos agentes
