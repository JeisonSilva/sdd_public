"""
Classe base para todos os agentes especializados do SDD.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

import anthropic

if TYPE_CHECKING:
    from src.context.session import SessionContext


@dataclass
class AgentResponse:
    content: str
    agent: str
    metadata: dict = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class BaseAgent(ABC):
    """
    Agente base. Todos os agentes especializados herdam desta classe.

    Cada agente possui:
    - Um system prompt especializado
    - Ferramentas (tools) específicas para sua função
    - Acesso ao contexto compartilhado da sessão
    """

    name: str = "base"
    model: str = "claude-sonnet-4-6"
    max_tokens: int = 4096

    def __init__(
        self,
        client: anthropic.AsyncAnthropic,
        session: "SessionContext",
    ):
        self.client = client
        self.session = session

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """System prompt especializado do agente."""
        ...

    @property
    def tools(self) -> list[dict]:
        """Ferramentas disponíveis para o agente. Override para adicionar tools."""
        return []

    async def run(self, input_text: str, session: "SessionContext") -> AgentResponse:
        """Executa o agente com o input fornecido."""
        messages = self._build_messages(input_text, session)

        kwargs = dict(
            model=self.model,
            max_tokens=self.max_tokens,
            system=self.system_prompt,
            messages=messages,
        )
        if self.tools:
            kwargs["tools"] = self.tools

        response = await self.client.messages.create(**kwargs)

        # Processa tool calls se houver
        content = await self._process_response(response, messages)

        return AgentResponse(content=content, agent=self.name)

    def _build_messages(
        self, input_text: str, session: "SessionContext"
    ) -> list[dict]:
        """Constrói lista de mensagens com histórico relevante."""
        messages = []

        # Adiciona histórico recente da sessão (últimas 10 mensagens)
        for msg in session.recent_history(limit=10):
            messages.append({"role": msg["role"], "content": msg["content"]})

        # Adiciona mensagem atual se não duplicada
        if not messages or messages[-1]["content"] != input_text:
            messages.append({"role": "user", "content": input_text})

        return messages

    async def _process_response(
        self,
        response: anthropic.types.Message,
        messages: list[dict],
    ) -> str:
        """Extrai texto da resposta, processando tool calls se necessário."""
        result_parts = []

        for block in response.content:
            if block.type == "text":
                result_parts.append(block.text)
            elif block.type == "tool_use":
                # Executa a ferramenta e adiciona resultado
                tool_result = await self._execute_tool(block.name, block.input)
                result_parts.append(f"\n[Tool: {block.name}]\n{tool_result}")

        return "\n".join(result_parts)

    async def _execute_tool(self, tool_name: str, tool_input: dict) -> str:
        """Executa uma ferramenta pelo nome. Override para implementar tools específicas."""
        return f"Tool '{tool_name}' não implementada para o agente {self.name}."
