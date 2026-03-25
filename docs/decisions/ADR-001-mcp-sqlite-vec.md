# ADR-001: MCP Server com SQLite + sqlite-vec para contexto de documentos

**Data**: 2026-03-25
**Status**: Aceita

---

## Contexto

O sistema SDD usa arquivos Markdown como agentes de IA. Para que o LLM do Cursor
gere código consistente com o projeto, precisa de contexto: arquivos existentes,
decisões de arquitetura, padrões de código, documentos de produto.

O problema: o contexto do chat é limitado. Não dá para colar o projeto inteiro
a cada conversa. Precisamos de busca semântica local, sem dependência de API externa.

## Opções Consideradas

### Opção 1: MCP Server com SQLite + sqlite-vec ⭐ Escolhida
- **Prós**: local, sem API key, integra nativamente ao Cursor via MCP, persistente
- **Contras**: precisa compilar e rodar um processo Node.js

### Opção 2: Busca em texto plano (grep/ripgrep via MCP)
- **Prós**: zero dependências, simples
- **Contras**: busca por palavra-chave, não semântica — falha em sinônimos e contexto

### Opção 3: OpenAI Embeddings API + SQLite-vec
- **Prós**: embeddings de melhor qualidade
- **Contras**: custo por token, requer API key, dados do projeto saem da máquina

## Decisão

**Escolhemos**: Opção 1 — MCP Server TypeScript + SQLite + sqlite-vec + @xenova/transformers

**Justificativa**: embeddings locais com `all-MiniLM-L6-v2` (384 dim) são suficientes
para busca semântica de documentos técnicos. Zero custo, zero envio de dados externos,
integração nativa com Cursor via protocolo MCP.

## Consequências

**Positivas**:
- Contexto rico disponível em toda conversa do Cursor automaticamente
- Documentos categorizados (backend, frontend, arquitetura, etc.) para filtro preciso
- TopK=3 com threshold de distância evita ruído nos resultados

**Trade-offs aceitos**:
- Modelo baixa ~23MB na primeira execução
- Qualidade de embedding inferior a modelos de API (aceitável para o caso de uso)

**Riscos**:
- `sqlite-vec` ainda em versão alpha — monitorar atualizações que quebrem API

## Categorias de documento suportadas

`backend` | `frontend` | `dotnet` | `angular` | `arquitetura` | `design` | `discovery` | `geral`
