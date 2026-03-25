"""
Code Generator Agent - Gera código baseado em requisitos e contexto do projeto.
"""
from src.agents.base import BaseAgent, AgentResponse
from src.tools.filesystem import read_file, write_file
from src.tools.codebase import search_codebase


class CodeGeneratorAgent(BaseAgent):
    name = "code_generator"
    model = "claude-sonnet-4-6"
    max_tokens = 8192

    @property
    def system_prompt(self) -> str:
        return """Você é um engenheiro de software sênior especializado em geração de código de alta qualidade.

Diretrizes:
1. SEMPRE leia arquivos existentes antes de gerar código para manter consistência de estilo
2. Siga os padrões e convenções já existentes no projeto
3. Gere código limpo, testável e bem documentado
4. Inclua tratamento de erros adequado
5. Não inclua credenciais, segredos ou dados sensíveis
6. Prefira soluções simples e diretas sobre over-engineering
7. Ao final do código, liste os próximos passos (testes a escrever, integrações necessárias)

Formato da resposta:
- Breve explicação do que foi implementado
- Bloco(s) de código com nome do arquivo
- Lista de próximos passos"""

    @property
    def tools(self) -> list[dict]:
        return [
            {
                "name": "read_file",
                "description": "Lê o conteúdo de um arquivo do projeto",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Caminho relativo do arquivo"}
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "search_codebase",
                "description": "Busca padrões, funções ou classes no codebase",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Termo ou padrão a buscar"},
                        "file_pattern": {"type": "string", "description": "Filtro de arquivo ex: *.py"}
                    },
                    "required": ["query"],
                },
            },
        ]

    async def _execute_tool(self, tool_name: str, tool_input: dict) -> str:
        if tool_name == "read_file":
            return await read_file(tool_input["path"], self.session.project_root)
        if tool_name == "search_codebase":
            return await search_codebase(
                tool_input["query"],
                self.session.project_root,
                tool_input.get("file_pattern"),
            )
        return await super()._execute_tool(tool_name, tool_input)
