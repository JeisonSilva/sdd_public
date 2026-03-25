"""
MCP Server do SDD - Integração nativa com VS Code / Cursor via Model Context Protocol.

Para usar no Cursor (~/.cursor/mcp.json):
{
  "mcpServers": {
    "sdd": {
      "command": "python",
      "args": ["-m", "src.ide_integration.mcp_server"],
      "env": { "ANTHROPIC_API_KEY": "..." }
    }
  }
}
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

import anthropic

from src.context.session import SessionStore
from src.orchestrator.orchestrator import Orchestrator
from src.tools.filesystem import read_file, list_files


# ─── MCP Protocol (stdio) ─────────────────────────────────────────────────────

class MCPServer:
    """
    Implementação simplificada do MCP Server via stdio.
    Em produção, use o SDK oficial: https://github.com/modelcontextprotocol/python-sdk
    """

    def __init__(self):
        self.session_store = SessionStore()
        self.client = anthropic.AsyncAnthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY", "")
        )
        self._sessions: dict[str, str] = {}  # workspace -> session_id

    def get_tools(self) -> list[dict]:
        """Define as tools disponíveis via MCP."""
        return [
            {
                "name": "sdd_chat",
                "description": "Envia uma mensagem ao orquestrador SDD e recebe resposta dos agentes especializados",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "message": {
                            "type": "string",
                            "description": "Mensagem ou pergunta sobre o código"
                        },
                        "workspace": {
                            "type": "string",
                            "description": "Caminho raiz do projeto"
                        },
                        "open_files": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Arquivos atualmente abertos no IDE"
                        },
                    },
                    "required": ["message"],
                },
            },
            {
                "name": "sdd_explain",
                "description": "Explica um trecho de código selecionado",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string"},
                        "code": {"type": "string", "description": "Código selecionado"},
                        "workspace": {"type": "string"},
                    },
                    "required": ["code"],
                },
            },
            {
                "name": "sdd_review_file",
                "description": "Faz code review de um arquivo completo",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string"},
                        "workspace": {"type": "string"},
                    },
                    "required": ["file_path", "workspace"],
                },
            },
        ]

    async def handle_tool(self, name: str, args: dict) -> str:
        """Executa a tool MCP solicitada."""
        workspace = args.get("workspace", os.getcwd())

        # Obtém ou cria sessão para o workspace
        if workspace not in self._sessions:
            session = self.session_store.create(project_root=workspace)
            self._sessions[workspace] = session.session_id
        else:
            session = self.session_store.get(self._sessions[workspace])

        orchestrator = Orchestrator(self.client, session)

        if name == "sdd_chat":
            for f in args.get("open_files", []):
                session.add_open_file(f)
            result = ""
            async for chunk in orchestrator.handle(args["message"]):
                result += chunk
            return result

        elif name == "sdd_explain":
            prompt = f"Explique este código de forma clara e concisa:\n\n```\n{args['code']}\n```"
            result = ""
            async for chunk in orchestrator.handle(prompt):
                result += chunk
            return result

        elif name == "sdd_review_file":
            file_content = await read_file(args["file_path"], workspace)
            prompt = f"Faça um code review completo do arquivo `{args['file_path']}`:\n\n```\n{file_content}\n```"
            result = ""
            async for chunk in orchestrator.handle(prompt):
                result += chunk
            return result

        return f"Tool '{name}' não reconhecida."

    async def run(self):
        """Loop principal do servidor MCP via stdio."""
        # Registra as tools disponíveis
        init_response = {
            "jsonrpc": "2.0",
            "result": {
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "sdd", "version": "0.1.0"},
            },
        }

        while True:
            line = sys.stdin.readline()
            if not line:
                break

            try:
                request = json.loads(line)
                method = request.get("method", "")
                req_id = request.get("id")

                if method == "initialize":
                    response = {**init_response, "id": req_id}
                elif method == "tools/list":
                    response = {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {"tools": self.get_tools()},
                    }
                elif method == "tools/call":
                    params = request.get("params", {})
                    result = await self.handle_tool(params["name"], params.get("arguments", {}))
                    response = {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {"content": [{"type": "text", "text": result}]},
                    }
                else:
                    response = {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {"code": -32601, "message": f"Método não suportado: {method}"},
                    }

                print(json.dumps(response), flush=True)

            except Exception as e:
                print(json.dumps({
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32603, "message": str(e)},
                }), flush=True)


if __name__ == "__main__":
    server = MCPServer()
    asyncio.run(server.run())
