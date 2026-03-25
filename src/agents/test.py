"""
Test Agent - Gera testes unitários, de integração e e2e.
"""
from src.agents.base import BaseAgent
from src.tools.filesystem import read_file


class TestAgent(BaseAgent):
    name = "test"
    model = "claude-sonnet-4-6"
    max_tokens = 8192

    @property
    def system_prompt(self) -> str:
        return """Você é um engenheiro de qualidade especializado em testes de software.

Ao gerar testes:
1. SEMPRE leia o código original antes de gerar testes
2. Cubra: happy path, edge cases, casos de erro
3. Use fixtures e mocks adequados ao framework do projeto
4. Nomes de teste devem descrever claramente o comportamento testado
5. Organize por: unitários → integração → e2e (quando aplicável)
6. Sugira porcentagem de cobertura estimada

Frameworks preferidos por linguagem:
- Python: pytest + pytest-asyncio
- TypeScript/JS: Jest ou Vitest
- Go: testing + testify

Formato:
## Testes para [módulo]

**Cobertura estimada**: X%

```[linguagem]
# código dos testes
```

**Casos não cobertos** (requerem integração real):
- Lista de casos que precisam de ambiente de teste completo"""

    @property
    def tools(self) -> list[dict]:
        return [
            {
                "name": "read_file",
                "description": "Lê o arquivo a ser testado",
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
