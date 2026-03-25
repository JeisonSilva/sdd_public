import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  'backend',
  'frontend',
  'dotnet',
  'angular',
  'arquitetura',
  'design',
  'discovery',
  'geral',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface DocumentRow {
  id: number;
  path: string;
  title: string | null;
  content: string;
  chunk_index: number;
  total_chunks: number;
  doc_type: string;
  category: Category;
  tags: string | null;
  created_at: string;
}

export interface SearchResult extends DocumentRow {
  distance: number;
}

export interface InsertDocumentParams {
  path: string;
  title?: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  docType?: string;
  category?: Category;
  tags?: string[];
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS documents (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    path         TEXT    NOT NULL,
    title        TEXT,
    content      TEXT    NOT NULL,
    chunk_index  INTEGER NOT NULL DEFAULT 0,
    total_chunks INTEGER NOT NULL DEFAULT 1,
    doc_type     TEXT    NOT NULL DEFAULT 'file',
    category     TEXT    NOT NULL DEFAULT 'geral',
    tags         TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_documents_path     ON documents(path);
  CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);

  -- Coluna auxiliar +document_id armazena o ID sem fazer parte do índice vetorial
  CREATE VIRTUAL TABLE IF NOT EXISTS document_embeddings
    USING vec0(
      embedding    float[384] distance_metric=cosine,
      +document_id integer
    );

  CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO schema_version(version) VALUES (1);
`;

// ─── Singleton ────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath =
    process.env.SDD_DB_PATH ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sdd_vectors.db');

  const db = new Database(dbPath);
  sqliteVec.load(db);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);

  _db = db;
  return db;
}

// ─── Operações de escrita ─────────────────────────────────────────────────────

export function insertDocument(
  db: Database.Database,
  params: InsertDocumentParams,
): number {
  const stmt = db.prepare<unknown[], { id: number }>(`
    INSERT INTO documents (path, title, content, chunk_index, total_chunks, doc_type, category, tags)
    VALUES (@path, @title, @content, @chunkIndex, @totalChunks, @docType, @category, @tags)
    RETURNING id
  `);

  const row = stmt.get({
    path: params.path,
    title: params.title ?? null,
    content: params.content,
    chunkIndex: params.chunkIndex,
    totalChunks: params.totalChunks,
    docType: params.docType ?? 'file',
    category: params.category ?? 'geral',
    tags: params.tags ? JSON.stringify(params.tags) : null,
  });

  return row!.id;
}

export function insertEmbedding(
  db: Database.Database,
  documentId: number,
  embedding: Float32Array,
): void {
  db.prepare(`
    INSERT INTO document_embeddings (embedding, document_id)
    VALUES (?, ?)
  `).run(Buffer.from(embedding.buffer), documentId);
}

/** Remove todos os chunks de um caminho (para re-indexação segura). */
export function deleteByPath(db: Database.Database, filePath: string): number {
  // Busca IDs antes de deletar para remover embeddings vinculadas
  const ids = db
    .prepare<[string], { id: number }>('SELECT id FROM documents WHERE path = ?')
    .all(filePath)
    .map((r) => r.id);

  if (ids.length === 0) return 0;

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM document_embeddings WHERE document_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM documents WHERE path = ?`).run(filePath);

  return ids.length;
}

// ─── Operações de leitura ─────────────────────────────────────────────────────

/** KNN search — retorna os N chunks mais próximos da query, com filtros opcionais. */
export function knnSearch(
  db: Database.Database,
  queryEmbedding: Float32Array,
  opts: {
    topK?: number;
    maxDistance?: number;
    category?: Category | 'all';
    pathPrefix?: string;
  } = {},
): SearchResult[] {
  const { topK = 3, maxDistance = 0.6, category = 'all', pathPrefix } = opts;

  // O vec0 exige que o k seja passado como parâmetro na cláusula WHERE
  const knnQuery = `
    SELECT de.document_id, de.distance
    FROM document_embeddings de
    WHERE de.embedding MATCH ?
      AND de.k = ?
    ORDER BY de.distance
  `;

  const knnRows = db
    .prepare<[Buffer, number], { document_id: number; distance: number }>(knnQuery)
    .all(Buffer.from(queryEmbedding.buffer), topK * 4); // busca mais, filtra depois

  if (knnRows.length === 0) return [];

  const ids = knnRows.map((r) => r.document_id);
  const distanceMap = new Map(knnRows.map((r) => [r.document_id, r.distance]));

  // Monta filtros adicionais dinamicamente
  const conditions: string[] = [`d.id IN (${ids.map(() => '?').join(',')})`];
  const bindings: unknown[] = [...ids];

  if (category !== 'all') {
    conditions.push('d.category = ?');
    bindings.push(category);
  }
  if (pathPrefix) {
    conditions.push("d.path LIKE ?");
    bindings.push(`${pathPrefix}%`);
  }

  const rows = db
    .prepare<unknown[], DocumentRow>(
      `SELECT * FROM documents d WHERE ${conditions.join(' AND ')}`,
    )
    .all(...bindings);

  return rows
    .map((row) => ({ ...row, distance: distanceMap.get(row.id) ?? 1 }))
    .filter((r) => r.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, topK);
}

/** Lista documentos agrupados por path (um item por arquivo/nota). */
export function listDocuments(
  db: Database.Database,
  opts: { category?: Category | 'all'; pathPrefix?: string } = {},
): Array<{ path: string; title: string | null; total_chunks: number; doc_type: string; category: string; created_at: string }> {
  const { category = 'all', pathPrefix } = opts;

  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (category !== 'all') {
    conditions.push('category = ?');
    bindings.push(category);
  }
  if (pathPrefix) {
    conditions.push('path LIKE ?');
    bindings.push(`${pathPrefix}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return db
    .prepare<unknown[], { path: string; title: string | null; total_chunks: number; doc_type: string; category: string; created_at: string }>(
      `SELECT path, MAX(title) as title, MAX(total_chunks) as total_chunks,
              doc_type, category, MIN(created_at) as created_at
       FROM documents ${where}
       GROUP BY path
       ORDER BY created_at DESC`,
    )
    .all(...bindings);
}
