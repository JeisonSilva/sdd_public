/**
 * SDD MCP Server — entry point
 *
 * Após server.connect(transport) NADA pode escrever em stdout.
 * O protocolo MCP usa stdout como canal de comunicação (JSON-RPC over stdio).
 * Use console.error() para logs/debug (vai para stderr).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getDb } from './db.js';
import {
  AddNoteInput,
  DeleteDocumentInput,
  IndexFileInput,
  IndexProjectInput,
  ListDocumentsInput,
  SearchInput,
  handleAddNote,
  handleDeleteDocument,
  handleIndexFile,
  handleIndexProject,
  handleListDocuments,
  handleSearch,
} from './tools.js';

// ─── Helpers: Zod → JSON Schema simplificado ─────────────────────────────────
// Evita dependência extra (zod-to-json-schema). Definimos os schemas
// diretamente como JSON Schema para o protocolo MCP.

const CATEGORY_ENUM = [
  'backend', 'frontend', 'dotnet', 'angular',
  'arquitetura', 'design', 'discovery', 'geral',
];

const CATEGORY_WITH_ALL = [...CATEGORY_ENUM, 'all'];

const TOOL_DEFINITIONS = [
  {
    name: 'index_file',
    description:
      'Indexa um arquivo no banco vetorial. Use antes de buscar documentos do projeto. ' +
      'Re-indexar o mesmo arquivo atualiza o conteúdo automaticamente.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do arquivo (absoluto ou relativo ao projeto)' },
        category: {
          type: 'string',
          enum: CATEGORY_ENUM,
          default: 'geral',
          description: 'Categoria do documento para filtro posterior',
        },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags opcionais' },
      },
      required: ['path'],
    },
  },
  {
    name: 'index_project',
    description:
      'Indexa todos os arquivos de um diretório recursivamente. ' +
      'Ideal para indexar o projeto inteiro na primeira vez ou após grandes mudanças.',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Diretório raiz' },
        category: {
          type: 'string',
          enum: CATEGORY_ENUM,
          default: 'geral',
          description: 'Categoria padrão para todos os arquivos do diretório',
        },
        extensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Extensões a incluir. Padrão: .md .ts .js .py .cs .json .txt',
        },
        ignore: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pastas/arquivos a ignorar. Padrão: node_modules .git dist',
        },
      },
      required: ['directory'],
    },
  },
  {
    name: 'search',
    description:
      'Busca semântica nos documentos indexados. ' +
      'Retorna os chunks mais relevantes com score de similaridade. ' +
      'Use para encontrar contexto relevante antes de implementar uma feature ou tomar uma decisão técnica.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Query em linguagem natural' },
        category: {
          type: 'string',
          enum: CATEGORY_WITH_ALL,
          default: 'all',
          description: 'Filtrar por categoria. "all" retorna todas.',
        },
        top_k: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          default: 3,
          description: 'Número de resultados (padrão: 3)',
        },
        max_distance: {
          type: 'number',
          minimum: 0,
          maximum: 2,
          default: 0.6,
          description:
            'Distância cosseno máxima. 0=idêntico, 2=oposto. ' +
            'Padrão 0.6 — filtra resultados pouco relevantes.',
        },
        path_prefix: { type: 'string', description: 'Filtra resultados por prefixo de caminho' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_documents',
    description: 'Lista todos os documentos indexados, agrupados por categoria.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: CATEGORY_WITH_ALL,
          default: 'all',
        },
        path_prefix: { type: 'string' },
      },
    },
  },
  {
    name: 'delete_document',
    description: 'Remove um documento do índice vetorial pelo caminho.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho do documento a remover' },
      },
      required: ['path'],
    },
  },
  {
    name: 'add_note',
    description:
      'Adiciona uma nota manual ao banco (decisões arquiteturais, contexto de produto, ADRs). ' +
      'Notas ficam disponíveis para busca semântica igual a qualquer documento.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título curto da nota' },
        content: { type: 'string', description: 'Conteúdo em texto ou Markdown' },
        category: {
          type: 'string',
          enum: CATEGORY_ENUM,
          default: 'geral',
          description: 'Ex: arquitetura, discovery, design',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ex: ["adr", "jwt", "decisao"]',
        },
      },
      required: ['title', 'content'],
    },
  },
];

// ─── Servidor MCP ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = getDb();

  const server = new Server(
    { name: 'sdd-search', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  // Lista as tools disponíveis
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  // Executa a tool chamada pelo LLM
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'index_file':
          result = await handleIndexFile(db, IndexFileInput.parse(args));
          break;
        case 'index_project':
          result = await handleIndexProject(db, IndexProjectInput.parse(args));
          break;
        case 'search':
          result = await handleSearch(db, SearchInput.parse(args));
          break;
        case 'list_documents':
          result = await handleListDocuments(db, ListDocumentsInput.parse(args));
          break;
        case 'delete_document':
          result = await handleDeleteDocument(db, DeleteDocumentInput.parse(args));
          break;
        case 'add_note':
          result = await handleAddNote(db, AddNoteInput.parse(args));
          break;
        default:
          return {
            content: [{ type: 'text', text: `Tool desconhecida: ${name}` }],
            isError: true,
          };
      }

      return { content: [{ type: 'text', text: result }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sdd-mcp] Erro na tool "${name}":`, message);
      return {
        content: [{ type: 'text', text: `Erro: ${message}` }],
        isError: true,
      };
    }
  });

  // Conecta via stdio — a partir daqui stdout pertence ao protocolo MCP
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[sdd-mcp] Servidor iniciado. DB:', process.env.SDD_DB_PATH ?? 'sdd_vectors.db');
}

main().catch((err) => {
  console.error('[sdd-mcp] Falha fatal:', err);
  process.exit(1);
});
