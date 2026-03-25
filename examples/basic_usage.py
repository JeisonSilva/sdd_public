"""
Exemplo básico de uso do SDD via Python.
"""
import asyncio
import os
import anthropic

from src.context.session import SessionStore
from src.orchestrator.orchestrator import Orchestrator


async def main():
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    sessions = SessionStore()

    # Cria sessão para o projeto atual
    session = sessions.create(
        project_root=os.getcwd(),
        language="python",
    )

    orchestrator = Orchestrator(client, session)

    # Exemplos de interação com diferentes agentes
    messages = [
        "Preciso implementar autenticação de usuário com JWT em FastAPI",
        "Crie a função de geração de token JWT",
        "Gere testes unitários para a função create_access_token",
        "Revise o código de autenticação que geramos",
    ]

    for msg in messages:
        print(f"\n{'='*60}")
        print(f"Usuário: {msg}")
        print(f"{'='*60}")
        print("SDD: ", end="", flush=True)

        async for chunk in orchestrator.handle(msg):
            print(chunk, end="", flush=True)

        print()  # nova linha


if __name__ == "__main__":
    asyncio.run(main())
