"""
Orchestrator Agent - Coordenador central do sistema SDD.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncIterator

import anthropic

from src.context.session import SessionContext
from src.agents.base import AgentResponse


class Intent(str, Enum):
    REQUIREMENTS = "requirements"
    ARCHITECTURE = "architecture"
    CODE_GENERATION = "code_generation"
    TEST = "test"
    CODE_REVIEW = "code_review"
    DEBUG = "debug"
    GENERAL = "general"


# Mapa de intenção para sequência de agentes
INTENT_AGENT_PIPELINE: dict[Intent, list[str]] = {
    Intent.REQUIREMENTS:    ["requirements"],
    Intent.ARCHITECTURE:    ["architecture"],
    Intent.CODE_GENERATION: ["code_generator", "reviewer"],
    Intent.TEST:            ["test"],
    Intent.CODE_REVIEW:     ["reviewer"],
    Intent.DEBUG:           ["debug"],
    Intent.GENERAL:         ["requirements"],
}

ORCHESTRATOR_SYSTEM_PROMPT = """Você é o orquestrador de um sistema de agentes de IA para desenvolvimento de software.

Sua única tarefa é classificar a intenção do usuário em uma das categorias:
- requirements: usuário descreve necessidade de negócio ou feature
- architecture: perguntas sobre design, estrutura, "como arquitetar"
- code_generation: "implemente", "crie", "escreva código", "adicione"
- test: "teste para", "escreva testes", "cobertura"
- code_review: "revise", "analise", "o que você acha deste código"
- debug: erros, stack traces, "não funciona", exceptions
- general: qualquer outra coisa

Responda APENAS com o nome da categoria, sem explicações."""


@dataclass
class OrchestratorConfig:
    model: str = "claude-opus-4-6"
    max_tokens: int = 100
    agent_timeout: float = 60.0


class Orchestrator:
    """
    Agente orquestrador central.

    Exemplo de uso:
        orchestrator = Orchestrator(client, session_ctx)
        async for chunk in orchestrator.handle("Implemente login com JWT"):
            print(chunk, end="")
    """

    def __init__(
        self,
        client: anthropic.AsyncAnthropic,
        session: SessionContext,
        config: OrchestratorConfig | None = None,
    ):
        self.client = client
        self.session = session
        self.config = config or OrchestratorConfig()

    async def handle(self, user_message: str) -> AsyncIterator[str]:
        """Processa mensagem do usuário e retorna resposta em streaming."""
        # 1. Classifica intenção
        intent = await self._classify_intent(user_message)

        # 2. Atualiza histórico da sessão
        self.session.add_message("user", user_message)

        # 3. Obtém pipeline de agentes
        agent_names = INTENT_AGENT_PIPELINE.get(intent, ["requirements"])

        # 4. Executa agentes em sequência (pode ser paralelo no futuro)
        final_response = await self._run_pipeline(user_message, agent_names)

        # 5. Salva resposta no histórico
        self.session.add_message("assistant", final_response.content)

        yield final_response.content

    async def _classify_intent(self, message: str) -> Intent:
        """Usa Claude para classificar a intenção da mensagem."""
        response = await self.client.messages.create(
            model=self.config.model,
            max_tokens=self.config.max_tokens,
            system=ORCHESTRATOR_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": message}],
        )
        raw = response.content[0].text.strip().lower()
        try:
            return Intent(raw)
        except ValueError:
            return Intent.GENERAL

    async def _run_pipeline(
        self,
        message: str,
        agent_names: list[str],
    ) -> AgentResponse:
        """Executa sequência de agentes, passando output de um para o próximo."""
        from src.agents.registry import get_agent

        current_input = message
        last_response = AgentResponse(content="", agent=agent_names[0])

        for agent_name in agent_names:
            agent = get_agent(agent_name, self.client, self.session)
            last_response = await agent.run(current_input, self.session)
            current_input = last_response.content  # output alimenta próximo agente

        return last_response
