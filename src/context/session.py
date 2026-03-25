"""
Gerenciamento de contexto de sessão para o sistema SDD.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import TypedDict


class Message(TypedDict):
    role: str       # "user" | "assistant"
    content: str
    timestamp: str
    agent: str | None


@dataclass
class SessionContext:
    """
    Contexto de uma sessão de chat com o SDD.

    Mantém:
    - Histórico de mensagens
    - Raiz do projeto atual
    - Arquivos relevantes mencionados
    - Metadados da sessão
    """
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    project_root: str = ""
    language: str = ""
    framework: str = ""
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    _messages: list[Message] = field(default_factory=list, repr=False)
    _open_files: list[str] = field(default_factory=list, repr=False)

    def add_message(
        self,
        role: str,
        content: str,
        agent: str | None = None,
    ) -> None:
        self._messages.append(
            Message(
                role=role,
                content=content,
                timestamp=datetime.utcnow().isoformat(),
                agent=agent,
            )
        )

    def recent_history(self, limit: int = 10) -> list[Message]:
        """Retorna as últimas `limit` mensagens."""
        return self._messages[-limit:]

    def add_open_file(self, path: str) -> None:
        if path not in self._open_files:
            self._open_files.append(path)

    @property
    def open_files(self) -> list[str]:
        return list(self._open_files)

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "project_root": self.project_root,
            "language": self.language,
            "framework": self.framework,
            "created_at": self.created_at,
            "message_count": len(self._messages),
        }


class SessionStore:
    """
    Armazena sessões em memória (substituir por Redis em produção).
    """

    def __init__(self):
        self._sessions: dict[str, SessionContext] = {}

    def create(self, project_root: str = "", language: str = "") -> SessionContext:
        session = SessionContext(project_root=project_root, language=language)
        self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> SessionContext | None:
        return self._sessions.get(session_id)

    def get_or_create(self, session_id: str | None, **kwargs) -> SessionContext:
        if session_id and session_id in self._sessions:
            return self._sessions[session_id]
        return self.create(**kwargs)
