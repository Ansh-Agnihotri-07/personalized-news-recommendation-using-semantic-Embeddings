import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

export async function createEmbedder() {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = fileURLToPath(new URL('../.cache/models/', import.meta.url));
  await mkdir(env.cacheDir, { recursive: true });
  const extractor = await pipeline('feature-extraction', MODEL_ID, {
    dtype: 'q8',
    device: 'cpu',
    session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
  });
  const embed = async texts => {
    if (!texts.length) return [];
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    return output.tolist();
  };
  embed.dispose = () => extractor.dispose();
  return embed;
}
