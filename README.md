# SDD - Software Development with AI Agents

Sistema multi-agente para apoiar o desenvolvimento de software via chat (VS Code, Cursor, Web).

## Visão Geral

O SDD orquestra agentes de IA especializados que colaboram para auxiliar desenvolvedores em todo o ciclo de vida do software: desde a captura de requisitos até debug e revisão de código.

```
┌─────────────────────────────────────────────────────────┐
│                    CHAT INTERFACE                        │
│              (VS Code / Cursor / Web)                    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  ORCHESTRATOR AGENT                      │
│   • Interpreta intenção do usuário                      │
│   • Roteia para agentes especializados                  │
│   • Mantém contexto da sessão e codebase                │
└──┬──────┬──────┬──────┬──────┬──────┬──────────────────┘
   │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼
[REQ] [ARCH] [CODE] [TEST] [REVIEW] [DEBUG]
```

## Agentes

| Agente | Trigger | Responsabilidade |
|--------|---------|-----------------|
| **Requirements** | "preciso de uma feature...", "o sistema deve..." | Captura e refina requisitos |
| **Architecture** | "como arquitetar...", "qual a melhor estrutura..." | Design e decisões técnicas |
| **Code Generator** | "implemente...", "crie uma função..." | Geração de código |
| **Test** | "teste para...", "cobertura de..." | Testes unitários, integração, e2e |
| **Code Reviewer** | "revise...", "analise este código..." | Qualidade, segurança, boas práticas |
| **Debug** | "erro:", "não funciona...", stack traces | Diagnóstico e correção de bugs |

## Estrutura do Projeto

```
sdd_public/
├── src/
│   ├── orchestrator/      # Agente orquestrador central
│   ├── agents/            # Agentes especializados
│   │   ├── requirements/
│   │   ├── architecture/
│   │   ├── code_generator/
│   │   ├── test/
│   │   ├── reviewer/
│   │   └── debug/
│   ├── context/           # Gerenciamento de contexto e memória
│   ├── tools/             # Ferramentas (git, LSP, file system, terminal)
│   ├── api/               # API Gateway (FastAPI)
│   └── ide_integration/   # Extensão VS Code / MCP Server
├── docs/                  # Documentação da arquitetura
├── examples/              # Exemplos de uso
└── tests/                 # Testes do sistema
```

## Pilha Tecnológica

- **LLM**: Claude API (Anthropic)
- **Agent Framework**: Claude Agent SDK
- **Context/Memory**: Redis + Vector DB (pgvector)
- **Backend**: Python + FastAPI
- **IDE Integration**: VS Code Extension API + MCP Protocol
- **Comunicação**: WebSocket (tempo real) + REST

## Início Rápido

```bash
pip install -r requirements.txt
cp .env.example .env  # adicione sua ANTHROPIC_API_KEY
python -m src.api.main
```

## Documentação

- [Arquitetura Detalhada](docs/architecture.md)
- [Guia dos Agentes](docs/agents.md)
- [Integração com IDE](docs/ide_integration.md)
- [Protocolo de Contexto](docs/context_protocol.md)
