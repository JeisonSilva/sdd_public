# SDD — Software Development com Agentes em Markdown

Sistema de agentes de IA para apoiar o desenvolvimento de software,
orquestrado **exclusivamente via arquivos Markdown** lidos pelo LLM do chat
(Cursor, Claude Code, VS Code + Continue, etc.).

**Sem código. Sem plugins. Sem API.**
Só o LLM do chat lendo os arquivos como contexto de instrução.

---

## Como funciona

```
Usuário digita no chat
        ↓
LLM lê CLAUDE.md (ou .cursor/rules/sdd.mdc)
        ↓
Detecta a intenção → seleciona o agente
        ↓
Lê .sdd/agents/[agente].md  ← papel + comportamento + formato
        ↓
Lê .sdd/skills/[skill].md   ← checklist + template da tarefa
        ↓
Responde no formato definido pelo agente
```

---

## Estrutura

```
.sdd/
├── agents/
│   ├── requirements.md    # Analista de requisitos
│   ├── architecture.md    # Arquiteto de software
│   ├── code_generator.md  # Engenheiro de software
│   ├── reviewer.md        # Revisor de código
│   ├── test.md            # Engenheiro de qualidade
│   └── debug.md           # Especialista em debugging
└── skills/
    ├── user_story.md      # Template de User Story
    ├── adr.md             # Architecture Decision Record
    ├── security_check.md  # Checklist OWASP
    ├── generate_tests.md  # Estrutura de geração de testes
    └── explain_code.md    # Como explicar código

CLAUDE.md                  # Auto-carregado pelo Claude Code
.cursor/rules/sdd.mdc      # Auto-carregado pelo Cursor
```

---

## Uso no Cursor

O arquivo `.cursor/rules/sdd.mdc` é carregado automaticamente.
Basta escrever normalmente no chat:

```
Preciso de autenticação com Google OAuth
→ Ativa: agents/requirements.md + skills/user_story.md

Implemente o endpoint de login JWT
→ Ativa: agents/code_generator.md + skills/security_check.md

Revise este arquivo: @src/auth/service.py
→ Ativa: agents/reviewer.md + skills/security_check.md

AttributeError: 'NoneType' has no attribute 'id'
→ Ativa: agents/debug.md
```

## Uso no Claude Code

O `CLAUDE.md` é carregado automaticamente ao abrir o projeto.
Mesma sintaxe acima. Para forçar um agente específico:

```
@.sdd/agents/architecture.md Como estruturar o módulo de pagamentos?
@.sdd/agents/test.md @src/payments/service.py gere testes para este arquivo
```

## Uso em qualquer outro chat com LLM

Cole o conteúdo do `CLAUDE.md` como system prompt,
depois cole o agente ou skill desejado antes da sua pergunta.

---

## Adicionando agentes e skills

Crie um novo arquivo `.sdd/agents/meu_agente.md` com:

```markdown
# Agente: [Nome]

## Papel
[Quem é e o que faz]

## Comportamento
[Passo a passo do que fazer ao receber uma mensagem]

## Formato de saída
[Template markdown da resposta]

## Regras
[O que nunca fazer]
```

Adicione na tabela de roteamento do `CLAUDE.md` e pronto.

---

## Por que Markdown como agentes?

- **Portável**: funciona em qualquer LLM com contexto de arquivo
- **Versionável**: git diff mostra exatamente o que mudou no comportamento
- **Legível**: qualquer dev lê e entende o que o agente faz
- **Sem lock-in**: não depende de nenhuma plataforma ou API específica
- **Iterável**: ajusta o comportamento editando texto, não código
