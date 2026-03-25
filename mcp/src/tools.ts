/**
 * Handlers dos 6 tools MCP do SDD.
 *
 * Todos retornam string (texto ou JSON) para ser encapsulado em
 * { content: [{ type: 'text', text: resultado }] } pelo index.ts.
 */
import path from 'node:path';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import {
  CATEGORIES,
  type Category,
  deleteByPath,
  insertDocument,
  insertEmbedding,
  knnSearch,
  listDocuments,
} from './db.js';
import { embed, embedBatch } from './embeddings.js';
import { chunkText, DEFAULT_EXTENSIONS, DEFAULT_IGNORE, indexDirectory, indexFile } from './indexer.js';

// ─── Schemas Zod (usados como fonte de verdade para JSON Schema no index.ts) ──

export const IndexFileInput = z.object({
  path: z.string().describe('Caminho absoluto ou relativo ao arquivo para indexar'),
  category: z.enum(CATEGORIES).optional().default('geral').describe(
    'Categoria do documento: backend | frontend | dotnet | angular | arquitetura | design | discovery | geral',
  ),
  tags: z.array(z.string()).optional().describe('Tags opcionais para classificação adicional'),
});

export const IndexProjectInput = z.object({
  directory: z.string().describe('Diretório raiz para indexar recursivamente'),
  category: z.enum(CATEGORIES).optional().default('geral').describe(
    'Categoria padrão aplicada a todos os arquivos do diretório',
  ),
  extensions: z
    .array(z.string())
    .optional()
    .default(DEFAULT_EXTENSIONS)
    .describe('Extensões de arquivo a incluir'),
  ignore: z
    .array(z.string())
    .optional()
    .default(DEFAULT_IGNORE)
    .describe('Pastas/arquivos a ignorar'),
});

export const SearchInput = z.object({
  query: z.string().min(1).describe('Query em linguagem natural para busca semântica'),
  category: z
    .enum([...CATEGORIES, 'all'] as [string, ...string[]])
    .optional()
    .default('all')
    .describe('Filtrar por categoria. "all" retorna todas.'),
  top_k: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(3)
    .describe('Número máximo de resultados (padrão: 3)'),
  max_distance: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .default(0.6)
    .describe(
      'Distância cosseno máxima aceita (0=idêntico, 2=oposto). Padrão 0.6 — somente resultados relevantes.',
    ),
  path_prefix: z.string().optional().describe('Filtra resultados a caminhos com este prefixo'),
});

export const ListDocumentsInput = z.object({
  category: z
    .enum([...CATEGORIES, 'all'] as [string, ...string[]])
    .optional()
    .default('all'),
  path_prefix: z.string().optional(),
});

export const DeleteDocumentInput = z.object({
  path: z.string().describe('Caminho do documento a remover do índice'),
});

export const AddNoteInput = z.object({
  title: z.string().min(1).describe('Título curto da nota'),
  content: z.string().min(1).describe('Conteúdo da nota em texto ou Markdown'),
  category: z.enum(CATEGORIES).optional().default('geral').describe(
    'Categoria da nota: arquitetura, discovery, design, etc.',
  ),
  tags: z.array(z.string()).optional().describe('Ex: ["adr", "decisao", "jwt"]'),
});

// ─── Handler: index_file ──────────────────────────────────────────────────────

export async function handleIndexFile(
  db: Database.Database,
  args: z.infer<typeof IndexFileInput>,
): Promise<string> {
  const resolvedPath = path.resolve(
    process.env.SDD_PROJECT_ROOT ?? process.cwd(),
    args.path,
  );

  const { chunksCreated } = await indexFile(db, resolvedPath, {
    category: args.category as Category,
    tags: args.tags,
  });

  return `Indexado: ${args.path} — ${chunksCreated} chunk(s) criado(s) [categoria: ${args.category}]`;
}

// ─── Handler: index_project ───────────────────────────────────────────────────

export async function handleIndexProject(
  db: Database.Database,
  args: z.infer<typeof IndexProjectInput>,
): Promise<string> {
  const resolvedDir = path.resolve(
    process.env.SDD_PROJECT_ROOT ?? process.cwd(),
    args.directory,
  );

  const result = await indexDirectory(db, resolvedDir, {
    category: args.category as Category,
    extensions: args.extensions,
    ignore: args.ignore,
  });

  const lines = [
    `✅ ${result.filesIndexed} arquivo(s) indexado(s), ${result.chunksCreated} chunk(s) total`,
    `⏭️  ${result.skipped} arquivo(s) ignorado(s)`,
    `📁 Categoria: ${args.category}`,
  ];

  if (result.errors.length > 0) {
    lines.push(`\nErros:`);
    result.errors.slice(0, 5).forEach((e) => lines.push(`  - ${e.path}: ${e.reason}`));
    if (result.errors.length > 5) lines.push(`  ... e mais ${result.errors.length - 5}`);
  }

  return lines.join('\n');
}

// ─── Handler: search ──────────────────────────────────────────────────────────

export async function handleSearch(
  db: Database.Database,
  args: z.infer<typeof SearchInput>,
): Promise<string> {
  const queryEmbedding = await embed(args.query);

  const results = knnSearch(db, queryEmbedding, {
    topK: args.top_k,
    maxDistance: args.max_distance,
    category: args.category as Category | 'all',
    pathPrefix: args.path_prefix,
  });

  if (results.length === 0) {
    return JSON.stringify({
      query: args.query,
      total: 0,
      results: [],
      message: `Nenhum resultado relevante encontrado (max_distance=${args.max_distance}, categoria=${args.category}).`,
    }, null, 2);
  }

  // Converte distância cosseno em score de similaridade (0-100%)
  const formatted = results.map((r) => ({
    score: `${Math.round((1 - r.distance) * 100)}%`,
    distance: parseFloat(r.distance.toFixed(4)),
    path: r.path,
    title: r.title,
    category: r.category,
    chunk: `${r.chunk_index + 1}/${r.total_chunks}`,
    tags: r.tags ? JSON.parse(r.tags) : [],
    content: r.content,
  }));

  return JSON.stringify(
    {
      query: args.query,
      total: formatted.length,
      top_k: args.top_k,
      max_distance: args.max_distance,
      best_score: formatted[0]?.score,
      results: formatted,
    },
    null,
    2,
  );
}

// ─── Handler: list_documents ──────────────────────────────────────────────────

export async function handleListDocuments(
  db: Database.Database,
  args: z.infer<typeof ListDocumentsInput>,
): Promise<string> {
  const docs = listDocuments(db, {
    category: args.category as Category | 'all',
    pathPrefix: args.path_prefix,
  });

  if (docs.length === 0) {
    return 'Nenhum documento indexado ainda. Use index_file ou index_project para começar.';
  }

  // Agrupa por categoria para facilitar visualização
  const grouped = docs.reduce<Record<string, typeof docs>>((acc, doc) => {
    const cat = doc.category ?? 'geral';
    (acc[cat] ??= []).push(doc);
    return acc;
  }, {});

  return JSON.stringify(
    {
      total: docs.length,
      by_category: Object.fromEntries(
        Object.entries(grouped).map(([cat, items]) => [
          cat,
          items.map((d) => ({
            path: d.path,
            title: d.title,
            chunks: d.total_chunks,
            indexed_at: d.created_at,
          })),
        ]),
      ),
    },
    null,
    2,
  );
}

// ─── Handler: delete_document ─────────────────────────────────────────────────

export async function handleDeleteDocument(
  db: Database.Database,
  args: z.infer<typeof DeleteDocumentInput>,
): Promise<string> {
  const resolvedPath = path.resolve(
    process.env.SDD_PROJECT_ROOT ?? process.cwd(),
    args.path,
  );

  const deleted = deleteByPath(db, resolvedPath);

  if (deleted === 0) {
    return `Documento não encontrado no índice: ${args.path}`;
  }

  return `Removido: ${args.path} (${deleted} chunk(s) deletado(s))`;
}

// ─── Handler: add_note ────────────────────────────────────────────────────────

export async function handleAddNote(
  db: Database.Database,
  args: z.infer<typeof AddNoteInput>,
): Promise<string> {
  const slug = args.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const notePath = `note::${Date.now()}::${slug}`;
  const chunks = chunkText(args.content);

  if (chunks.length === 0) {
    return 'Conteúdo da nota está vazio.';
  }

  const embeddings = await embedBatch(chunks);

  const insertAll = db.transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      const docId = insertDocument(db, {
        path: notePath,
        title: args.title,
        content: chunks[i],
        chunkIndex: i,
        totalChunks: chunks.length,
        docType: 'note',
        category: args.category as Category,
        tags: args.tags,
      });
      insertEmbedding(db, docId, embeddings[i]);
    }
  });

  insertAll();

  return `Nota criada: "${args.title}" — ${chunks.length} chunk(s) [categoria: ${args.category}]`;
}
