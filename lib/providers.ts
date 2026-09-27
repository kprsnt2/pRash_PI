import type { Attachment, ModelInfo, Role } from "./types";
import type { ProviderConfig } from "./models";

export class ProviderError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

export interface LlmMessage {
  role: Role;
  content: string;
  attachments?: Attachment[];
}

export interface StreamOptions {
  system: string;
  messages: LlmMessage[];
  signal?: AbortSignal;
}

const IMAGE_DATA_URL = /^data:([^;]+);base64,(.*)$/;

function splitDataUrl(dataUrl: string): { mime: string; data: string } | null {
  const m = IMAGE_DATA_URL.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], data: m[2] };
}

function textWithTextAttachments(msg: LlmMessage): string {
  const extra = (msg.attachments || [])
    .filter((a) => a.kind === "text" && a.text)
    .map((a) => `\n\n[Attached file: ${a.name}]\n${a.text}`)
    .join("");
  return msg.content + extra;
}

/* ------------------------------ SSE parsing ------------------------------ */

async function* readSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith(":")) continue;
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data && data !== "[DONE]") yield data;
        }
      }
    }
    if (buffer.trim().startsWith("data:")) {
      const data = buffer.trim().slice(5).trim();
      if (data && data !== "[DONE]") yield data;
    }
  } finally {
    reader.releaseLock();
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return (
        json?.error?.message ||
        json?.message ||
        json?.detail ||
        text.slice(0, 400)
      );
    } catch {
      return text.slice(0, 400);
    }
  } catch {
    return res.statusText;
  }
}

/* ------------------------- OpenAI-compatible APIs ------------------------ */

function toOpenAIMessages(opts: StreamOptions, vision: boolean) {
  const out: Array<Record<string, unknown>> = [
    { role: "system", content: opts.system },
  ];
  for (const m of opts.messages) {
    if (m.role === "system") continue;
    const text = textWithTextAttachments(m);
    const images = (m.attachments || []).filter(
      (a) => a.kind === "image" && a.dataUrl,
    );
    const pdfs = (m.attachments || []).filter((a) => a.kind === "pdf");
    if (pdfs.length) {
      throw new ProviderError(
        "This provider cannot read PDFs directly. Try Gemini for PDF files.",
      );
    }
    if (images.length && vision) {
      out.push({
        role: m.role,
        content: [
          { type: "text", text },
          ...images.map((a) => ({
            type: "image_url",
            image_url: { url: a.dataUrl },
          })),
        ],
      });
    } else {
      out.push({ role: m.role, content: text });
    }
  }
  return out;
}

async function* streamOpenAICompatible(
  model: ModelInfo,
  cfg: ProviderConfig,
  opts: StreamOptions,
): AsyncGenerator<string> {
  if (!cfg.apiKey) throw new ProviderError("Missing API key");
  const body = {
    model: model.model,
    stream: true,
    messages: toOpenAIMessages(opts, model.vision),
  };
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new ProviderError(await readError(res), res.status);
  }
  for await (const data of readSSE(res.body)) {
    try {
      const json = JSON.parse(data);
      const delta = json?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) yield delta;
      // some NVIDIA models emit reasoning_content separately; ignore.
    } catch {
      // ignore malformed keep-alive chunks
    }
  }
}

/* -------------------------------- Gemini --------------------------------- */

function toGeminiContents(opts: StreamOptions) {
  const contents: Array<Record<string, unknown>> = [];
  for (const m of opts.messages) {
    if (m.role === "system") continue;
    const parts: Array<Record<string, unknown>> = [];
    const text = textWithTextAttachments(m);
    if (text) parts.push({ text });
    for (const a of m.attachments || []) {
      if (a.kind === "image" && a.dataUrl) {
        const d = splitDataUrl(a.dataUrl);
        if (d) parts.push({ inlineData: { mimeType: d.mime, data: d.data } });
      } else if (a.kind === "pdf" && a.dataUrl) {
        const d = splitDataUrl(a.dataUrl);
        if (d) parts.push({ inlineData: { mimeType: d.mime, data: d.data } });
      }
    }
    if (!parts.length) parts.push({ text: "" });
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
  }
  return contents;
}

async function* streamGemini(
  model: ModelInfo,
  cfg: ProviderConfig,
  opts: StreamOptions,
): AsyncGenerator<string> {
  if (!cfg.apiKey) throw new ProviderError("Missing API key");
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(
    model.model,
  )}:streamGenerateContent?alt=sse`;
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: toGeminiContents(opts),
    generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": cfg.apiKey,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new ProviderError(await readError(res), res.status);
  }
  for await (const data of readSSE(res.body)) {
    try {
      const json = JSON.parse(data);
      const parts = json?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          if (typeof p?.text === "string" && p.text) yield p.text;
        }
      }
    } catch {
      // ignore
    }
  }
}

/* ------------------------------- Dispatcher ------------------------------ */

export function streamModel(
  model: ModelInfo,
  cfg: ProviderConfig,
  opts: StreamOptions,
): AsyncGenerator<string> {
  if (model.provider === "gemini") return streamGemini(model, cfg, opts);
  return streamOpenAICompatible(model, cfg, opts);
}
