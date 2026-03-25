"""
Ferramentas de busca no codebase para os agentes SDD.
"""
from __future__ import annotations

import subprocess
from pathlib import Path


async def search_codebase(
    query: str,
    project_root: str,
    file_pattern: str | None = None,
) -> str:
    """
    Busca padrão ou texto no codebase usando ripgrep (se disponível) ou grep.
    Retorna as ocorrências encontradas com contexto.
    """
    root = Path(project_root)
    if not root.exists():
        return f"[ERRO] Diretório do projeto não encontrado: {project_root}"

    cmd = ["grep", "-r", "--include=*.py", "-n", "-l", query, str(root)]

    if file_pattern:
        ext = file_pattern.lstrip("*.")
        cmd = ["grep", "-r", f"--include=*.{ext}", "-n", query, str(root)]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10,
            cwd=str(root),
        )
        output = result.stdout.strip()
        if not output:
            return f"Nenhuma ocorrência de '{query}' encontrada no codebase."
        lines = output.splitlines()[:50]  # limita resultado
        return f"Ocorrências de '{query}':\n" + "\n".join(lines)
    except subprocess.TimeoutExpired:
        return "[ERRO] Busca no codebase excedeu o timeout."
    except FileNotFoundError:
        return "[ERRO] grep não disponível no ambiente."
