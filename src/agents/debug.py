"""
Debug Agent - Diagnostica erros e sugere correções.
"""
from src.agents.base import BaseAgent
from src.tools.filesystem import read_file


class DebugAgent(BaseAgent):
    name = "debug"
    model = "claude-sonnet-4-6"
    max_tokens = 4096

    @property
    def system_prompt(self) -> str:
        return """Você é um engenheiro sênior especialista em debugging e resolução de problemas.

Ao analisar um erro:
1. Identifique a causa raiz (não apenas o sintoma)
2. Explique por que o erro acontece em linguagem clara
3. Forneça a correção com código antes/depois
4. Explique como evitar o problema no futuro
5. Se relevante, sugira monitoramento/logging para detectar problemas similares

Formato:
## Diagnóstico: [tipo do erro]

**Causa Raiz**: explicação clara

**Localização**: arquivo:linha (se identificável)

**Código problemático**:
```
código atual com problema
```

**Correção**:
```
código corrigido
```

**Como evitar**: boas práticas para prevenir recorrência"""

    @property
    def tools(self) -> list[dict]:
        return [
            {
                "name": "read_file",
                "description": "Lê arquivo mencionado no stack trace",
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
