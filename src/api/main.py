"""
API Gateway do SDD - FastAPI com suporte a WebSocket para streaming.
"""
from __future__ import annotations

import json
import os

import anthropic
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.context.session import SessionStore
from src.orchestrator.orchestrator import Orchestrator

app = FastAPI(
    title="SDD - Software Development AI Agents",
    description="API para orquestração de agentes de IA no desenvolvimento de software",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção: listar origens permitidas
    allow_methods=["*"],
    allow_headers=["*"],
)

session_store = SessionStore()
anthropic_client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


# ─── REST Endpoints ────────────────────────────────────────────────────────────

class SessionCreateRequest(BaseModel):
    project_root: str = ""
    language: str = ""


class SessionResponse(BaseModel):
    session_id: str
    project_root: str
    language: str


@app.post("/sessions", response_model=SessionResponse)
async def create_session(req: SessionCreateRequest) -> SessionResponse:
    """Cria uma nova sessão de desenvolvimento."""
    session = session_store.create(
        project_root=req.project_root,
        language=req.language,
    )
    return SessionResponse(
        session_id=session.session_id,
        project_root=session.project_root,
        language=session.language,
    )


@app.get("/sessions/{session_id}")
async def get_session(session_id: str) -> dict:
    """Retorna informações de uma sessão existente."""
    session = session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return session.to_dict()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}


# ─── WebSocket - Chat em Tempo Real ───────────────────────────────────────────

@app.websocket("/chat")
async def chat_websocket(websocket: WebSocket):
    """
    WebSocket endpoint para chat em tempo real com os agentes.

    Protocolo de mensagens (JSON):

    Cliente → Servidor:
    {
        "session_id": "...",          # opcional, cria nova sessão se ausente
        "message": "Implemente...",
        "context": {
            "project_root": "/path",  # opcional
            "open_files": ["..."],    # arquivos abertos no IDE
            "language": "python"
        }
    }

    Servidor → Cliente:
    { "type": "token",    "content": "..." }  # chunk de resposta
    { "type": "agent",    "content": "code_generator" }  # agente ativo
    { "type": "tool",     "content": "read_file" }        # tool em execução
    { "type": "done",     "content": "" }                 # fim da resposta
    { "type": "error",    "content": "mensagem de erro" }
    """
    await websocket.accept()

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            message = data.get("message", "").strip()
            if not message:
                continue

            context = data.get("context", {})
            session = session_store.get_or_create(
                session_id=data.get("session_id"),
                project_root=context.get("project_root", ""),
                language=context.get("language", ""),
            )

            # Adiciona arquivos abertos ao contexto
            for f in context.get("open_files", []):
                session.add_open_file(f)

            orchestrator = Orchestrator(anthropic_client, session)

            try:
                async for chunk in orchestrator.handle(message):
                    await websocket.send_text(
                        json.dumps({"type": "token", "content": chunk})
                    )
                await websocket.send_text(json.dumps({"type": "done", "content": ""}))

            except Exception as e:
                await websocket.send_text(
                    json.dumps({"type": "error", "content": str(e)})
                )

    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
