/**
 * Pipeline de embeddings local usando @xenova/transformers.
 * Modelo: Xenova/all-MiniLM-L6-v2 — 384 dimensões, ~23MB, sem API key.
 *
 * O pipeline é um singleton: carregado uma vez na primeira chamada,
 * reutilizado em todas as subsequentes (~50ms por embed após carregamento).
 */
import { pipeline, env } from '@xenova/transformers';
import type { FeatureExtractionPipeline } from '@xenova/transformers';

// Permite baixar o modelo do Hugging Face Hub na primeira execução.
// Após o download, o cache fica em ~/.cache/huggingface/hub/
env.allowRemoteModels = true;
env.allowLocalModels = true;

// Silencia logs de progresso de download para não poluir o stdio do MCP.
env.backends.onnx.wasm.numThreads = 1;

let _pipeline: FeatureExtractionPipeline | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (_pipeline) return _pipeline;

  // all-MiniLM-L6-v2: rápido, leve (384 dim), excelente para busca semântica
  _pipeline = (await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
  )) as FeatureExtractionPipeline;

  return _pipeline;
}

/**
 * Gera embedding para um texto.
 * Retorna Float32Array de 384 dimensões (normalizado, pronto para cosine distance).
 */
export async function embed(text: string): Promise<Float32Array> {
  const pipe = await getPipeline();

  const output = await pipe(text, {
    pooling: 'mean',
    normalize: true,
  });

  // output.data é Float32Array com os 384 valores
  return output.data as Float32Array;
}

/** Gera embeddings em batch — mais eficiente para indexação de múltiplos chunks. */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const pipe = await getPipeline();
  const results: Float32Array[] = [];

  // @xenova/transformers processa um por vez internamente; iteramos explicitamente
  // para controle de erros por chunk
  for (const text of texts) {
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    results.push(output.data as Float32Array);
  }

  return results;
}
