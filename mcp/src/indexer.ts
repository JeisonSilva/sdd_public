import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { type Category, deleteByPath, insertDocument, insertEmbedding } from './db.js';
import { embedBatch } from './embeddings.js';

// ─── Chunking ─────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 800;   // caracteres por chunk (~150-200 tokens)
const CHUNK_OVERLAP = 100; // sobreposição entre chunks adjacentes

/**
 * Divide texto em chunks com sobreposição para preservar contexto nas bordas.
 * Evita cortar palavras ao meio ajustando o final do chunk até o último espaço.
 */
export function chunkText(
  text: string,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;
    let chunk = text.slice(start, end);

    // Ajusta corte para não quebrar palavra no meio
    if (end < text.length) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > chunkSize * 0.5) {
        chunk = chunk.slice(0, lastSpace);
        end = start + lastSpace;
      }
    }

    const trimmed = chunk.trim();
    if (trimmed.length > 0) {
      chunks.push(trimmed);
    }

    start = end - overlap;
  }

  return chunks;
}

// ─── Detecção de arquivo binário ──────────────────────────────────────────────

function isBinary(content: string): boolean {
  return content.includes('\0');
}

// ─── Extensões e pastas ignoradas padrão ──────────────────────────────────────

export const DEFAULT_EXTENSIONS = ['.md', '.ts', '.js', '.tsx', '.jsx', '.py', '.cs', '.json', '.txt', '.yaml', '.yml'];
export const DEFAULT_IGNORE = ['node_modules', '.git', 'dist', '.next', 'build', 'obj', 'bin', '.cache'];

// ─── Indexação de arquivo único ───────────────────────────────────────────────

export interface IndexFileOptions {
  category?: Category;
  tags?: string[];
  docType?: string;
}

export interface IndexFileResult {
  path: string;
  chunksCreated: number;
}

export async function indexFile(
  db: Database.Database,
  filePath: string,
  opts: IndexFileOptions = {},
): Promise<IndexFileResult> {
  const content = fs.readFileSync(filePath, 'utf-8');

  if (isBinary(content)) {
    throw new Error(`Arquivo binário ignorado: ${filePath}`);
  }

  const title = path.basename(filePath);
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    throw new Error(`Arquivo vazio: ${filePath}`);
  }

  // Remove versão anterior (re-indexação segura)
  deleteByPath(db, filePath);

  // Gera todos os embeddings em batch
  const embeddings = await embedBatch(chunks);

  // Insere no banco dentro de uma transação para atomicidade
  const insertAll = db.transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      const docId = insertDocument(db, {
        path: filePath,
        title,
        content: chunks[i],
        chunkIndex: i,
        totalChunks: chunks.length,
        docType: opts.docType ?? 'file',
        category: opts.category ?? 'geral',
        tags: opts.tags,
      });
      insertEmbedding(db, docId, embeddings[i]);
    }
  });

  insertAll();

  return { path: filePath, chunksCreated: chunks.length };
}

// ─── Indexação de diretório ───────────────────────────────────────────────────

export interface IndexDirectoryOptions extends IndexFileOptions {
  extensions?: string[];
  ignore?: string[];
}

export interface IndexDirectoryResult {
  filesIndexed: number;
  chunksCreated: number;
  skipped: number;
  errors: Array<{ path: string; reason: string }>;
}

export async function indexDirectory(
  db: Database.Database,
  dirPath: string,
  opts: IndexDirectoryOptions = {},
): Promise<IndexDirectoryResult> {
  const extensions = opts.extensions ?? DEFAULT_EXTENSIONS;
  const ignore = opts.ignore ?? DEFAULT_IGNORE;

  const result: IndexDirectoryResult = {
    filesIndexed: 0,
    chunksCreated: 0,
    skipped: 0,
    errors: [],
  };

  const files = collectFiles(dirPath, extensions, ignore);

  for (const filePath of files) {
    try {
      const { chunksCreated } = await indexFile(db, filePath, opts);
      result.filesIndexed++;
      result.chunksCreated += chunksCreated;
    } catch (err) {
      result.skipped++;
      result.errors.push({
        path: filePath,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

// ─── Walk de diretório ────────────────────────────────────────────────────────

function collectFiles(
  dirPath: string,
  extensions: string[],
  ignore: string[],
): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      // Verifica se algum segmento do caminho está na lista de ignore
      if (ignore.some((pattern) => entry.name === pattern || entry.name.startsWith(pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dirPath);
  return files;
}
