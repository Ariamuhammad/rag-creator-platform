import {
  AutoModelForCausalLM,
  AutoTokenizer,
  env,
  pipeline,
  TextStreamer,
} from '@huggingface/transformers';
import type { Tensor } from '@huggingface/transformers';
import {
  BROWSER_EMBEDDING_MODEL,
  BROWSER_LLM_MODEL,
  BROWSER_LITE_LLM_MODEL,
} from '../../../src/common/browser-ai';
import type { AiMessage } from '../../../src/common/browser-ai';

env.allowLocalModels = false;
env.backends.onnx.wasm!.numThreads = 1;

let generator:
  | Promise<{
      tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
      model: Awaited<ReturnType<typeof AutoModelForCausalLM.from_pretrained>>;
    }>
  | undefined;
let embeddings: ReturnType<typeof pipeline<'feature-extraction'>> | undefined;
let phase = 'load';
const status = (text: string, nextPhase = phase) => {
  phase = nextPhase;
  self.postMessage({ status: text, phase });
};
const progress = (info: {
  status: string;
  file?: string;
  progress?: number;
}) => {
  if (info.status === 'progress')
    status(
      `Mengunduh model otomatis: ${Math.round(info.progress ?? 0)}% (${info.file ?? ''})`,
      'download',
    );
  if (info.status === 'done') {
    phase = 'load';
    self.postMessage({ phase });
  }
};

async function loadGenerator(profile: 'auto' | 'cpu' | 'lite') {
  generator ??= (async () => {
    status(
      'Menyiapkan model bahasa di perangkat Anda. Unduhan pertama disimpan di cache browser.',
    );
    const gpu = (
      navigator as Navigator & {
        gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> };
      }
    ).gpu;
    const adapter =
      profile === 'auto' ? await gpu?.requestAdapter().catch(() => null) : null;
    const modelId =
      profile === 'lite' ? BROWSER_LITE_LLM_MODEL : BROWSER_LLM_MODEL;
    status(
      profile === 'lite'
        ? 'Mencoba model lokal ringkas (sekitar 145 MB)...'
        : 'Mencoba model utama pada perangkat Anda...',
      'load',
    );
    const tokenizer = await AutoTokenizer.from_pretrained(modelId, {
      progress_callback: progress,
    });
    const model = await AutoModelForCausalLM.from_pretrained(modelId, {
      dtype:
        profile === 'lite'
          ? 'q8'
          : adapter?.features.has('shader-f16')
            ? 'q4f16'
            : adapter
              ? 'q4'
              : 'q8',
      device: adapter ? 'webgpu' : 'wasm',
      progress_callback: progress,
    });
    return { tokenizer, model };
  })().catch((error) => {
    generator = undefined;
    throw error;
  });
  return generator;
}

// Serial execution keeps simultaneous UI actions from sharing a running model session.
let queue = Promise.resolve();
self.onmessage = ({
  data,
}: MessageEvent<{
  id: number;
  type: 'embed' | 'generate';
  text?: string;
  messages?: AiMessage[];
  draft?: boolean;
  profile?: 'auto' | 'cpu' | 'lite';
}>) => {
  queue = queue.then(async () => {
    try {
      let result: unknown;
      if (data.type === 'embed') {
        status('Menghitung embedding di perangkat Anda...', 'embed');
        embeddings ??= pipeline('feature-extraction', BROWSER_EMBEDDING_MODEL, {
          dtype: 'q8',
          device: 'wasm',
          progress_callback: progress,
        }).catch((error) => {
          embeddings = undefined;
          throw error;
        });
        const tensor = await (
          await embeddings
        )(data.text!, { pooling: 'mean', normalize: true });
        result = Array.from(tensor.data, Number);
      } else {
        const { tokenizer, model } = await loadGenerator(
          data.profile || 'auto',
        );
        status(
          'Menyusun jawaban menggunakan komputasi perangkat Anda...',
          'generate',
        );
        const options = {
          add_generation_prompt: true,
          tokenize: false,
          enable_thinking: false,
        };
        const prompt = tokenizer.apply_chat_template(
          data.profile === 'lite'
            ? data.messages!.map((message) => ({
                ...message,
                content:
                  message.role === 'system'
                    ? message.content.slice(0, 800)
                    : message.content.length > 1800
                      ? message.content.slice(0, 1200) +
                        '\n…\n' +
                        message.content.slice(-600)
                      : message.content,
              }))
            : data.messages!,
          options,
        ) as string;
        const inputs = tokenizer(prompt, { add_special_tokens: false });
        const output = (await model.generate({
          ...inputs,
          max_new_tokens:
            data.profile === 'lite'
              ? data.draft
                ? 384
                : 192
              : data.draft
                ? 768
                : 384,
          do_sample: false,
          repetition_penalty: 1.1,
          streamer: new TextStreamer(tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: () => {},
            token_callback_function: () =>
              self.postMessage({ phase: 'generate' }),
          }),
        })) as Tensor;
        const tokens = output.tolist()[0] as bigint[];
        result = tokenizer
          .decode(tokens.slice((inputs.input_ids as Tensor).dims[1]), {
            skip_special_tokens: true,
          })
          .trim();
        if (!result) throw new Error('Model tidak menghasilkan jawaban.');
      }
      status('AI siap di perangkat Anda.');
      self.postMessage({ id: data.id, result });
    } catch (error) {
      const message = `AI di perangkat gagal: ${error instanceof Error ? error.message : String(error)}. Periksa koneksi unduhan model, memori, dan dukungan browser.`;
      status(message);
      self.postMessage({
        id: data.id,
        error: message,
        kind: /fetch|network|HTTP|download|Unauthorized|Forbidden/i.test(
          String(error),
        )
          ? 'download'
          : 'device',
      });
    }
  });
};
