"""
Registro de agentes disponíveis no sistema SDD.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

import anthropic

from src.agents.base import BaseAgent

if TYPE_CHECKING:
    from src.context.session import SessionContext


def get_agent(
    name: str,
    client: anthropic.AsyncAnthropic,
    session: "SessionContext",
) -> BaseAgent:
    """Factory: retorna instância do agente pelo nome."""
    from src.agents.requirements import RequirementsAgent
    from src.agents.architecture import ArchitectureAgent
    from src.agents.code_generator import CodeGeneratorAgent
    from src.agents.test import TestAgent
    from src.agents.reviewer import ReviewerAgent
    from src.agents.debug import DebugAgent

    registry: dict[str, type[BaseAgent]] = {
        "requirements":    RequirementsAgent,
        "architecture":    ArchitectureAgent,
        "code_generator":  CodeGeneratorAgent,
        "test":            TestAgent,
        "reviewer":        ReviewerAgent,
        "debug":           DebugAgent,
    }

    agent_class = registry.get(name)
    if agent_class is None:
        raise ValueError(f"Agente '{name}' não encontrado. Disponíveis: {list(registry.keys())}")

    return agent_class(client, session)
