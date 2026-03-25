"""
Ferramentas de sistema de arquivos para os agentes SDD.
Toda operação de write requer confirmação explícita.
"""
from __future__ import annotations

import os
from pathlib import Path


MAX_FILE_SIZE_BYTES = 100_000  # 100KB - limita leitura de arquivos grandes
BLOCKED_PATTERNS = [".env", "*.key", "*.pem", "secrets", "credentials"]


def _is_blocked(path: str) -> bool:
    """Bloqueia leitura de arquivos com dados sensíveis."""
    name = Path(path).name.lower()
    return any(
        name == p.replace("*.", "") or name.endswith(p.lstrip("*"))
        for p in BLOCKED_PATTERNS
    )


async def read_file(relative_path: str, project_root: str) -> str:
    """
    Lê arquivo do projeto de forma segura.
    - Respeita o limite de tamanho
    - Bloqueia arquivos sensíveis
    - Restringe ao project_root (path traversal prevention)
    """
    if _is_blocked(relative_path):
        return f"[BLOQUEADO] Leitura de '{relative_path}' não permitida por segurança."

    root = Path(project_root).resolve()
    target = (root / relative_path).resolve()

    # Previne path traversal
    if not str(target).startswith(str(root)):
        return "[ERRO] Acesso fora do diretório do projeto não permitido."

    if not target.exists():
        return f"[ERRO] Arquivo não encontrado: {relative_path}"

    if target.stat().st_size > MAX_FILE_SIZE_BYTES:
        return f"[AVISO] Arquivo muito grande ({target.stat().st_size} bytes). Mostrando primeiras 200 linhas:\n" + \
               "\n".join(target.read_text(errors="replace").splitlines()[:200])

    return target.read_text(errors="replace")


async def write_file(relative_path: str, content: str, project_root: str) -> str:
    """
    Escreve arquivo no projeto.
    NOTA: Em produção, esta operação deve exigir confirmação do usuário via IDE.
    """
    root = Path(project_root).resolve()
    target = (root / relative_path).resolve()

    if not str(target).startswith(str(root)):
        return "[ERRO] Escrita fora do diretório do projeto não permitida."

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    return f"Arquivo salvo: {relative_path}"


async def list_files(directory: str, project_root: str, pattern: str = "**/*") -> str:
    """Lista arquivos em um diretório do projeto."""
    root = Path(project_root).resolve()
    target = (root / directory).resolve()

    if not str(target).startswith(str(root)):
        return "[ERRO] Acesso fora do diretório do projeto não permitido."

    files = [str(f.relative_to(root)) for f in target.glob(pattern) if f.is_file()]
    return "\n".join(sorted(files)[:100])  # limita a 100 arquivos
