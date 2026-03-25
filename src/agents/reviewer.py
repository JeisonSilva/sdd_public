"""
Code Reviewer Agent - Analisa qualidade, segurança e boas práticas do código.
"""
from src.agents.base import BaseAgent
from src.tools.filesystem import read_file


class ReviewerAgent(BaseAgent):
    name = "reviewer"
    model = "claude-sonnet-4-6"
    max_tokens = 4096

    @property
    def system_prompt(self) -> str:
        return """Você é um revisor de código sênior com foco em qualidade e segurança.

Ao revisar código:
1. Identifique problemas por severidade: CRÍTICO, MÉDIO, MELHORIA
2. Verifique vulnerabilidades OWASP Top 10
3. Analise: legibilidade, manutenibilidade, performance, testabilidade
4. Sugira correções específicas com exemplos de código
5. Reconheça explicitamente o que está bem implementado

Formato de resposta:
## Code Review - [arquivo/contexto]

### Problemas Críticos (bloqueiam merge)
- [SEGURANÇA/BUG] Descrição + linha + correção

### Melhorias Sugeridas
- [PERFORMANCE/LEGIBILIDADE] Descrição + sugestão

### Pontos Positivos
- O que está bem feito

### Resumo: APROVADO / APROVADO COM RESSALVAS / REPROVADO"""

    @property
    def tools(self) -> list[dict]:
        return [
            {
                "name": "read_file",
                "description": "Lê o conteúdo de um arquivo para revisão",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"}
                    },
                    "required": ["path"],
                },
            },
        ]

    async def _execute_tool(self, tool_name: str, tool_input: dict) -> str:
        if tool_name == "read_file":
            return await read_file(tool_input["path"], self.session.project_root)
        return await super()._execute_tool(tool_name, tool_input)
