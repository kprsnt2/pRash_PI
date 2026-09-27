import type { ModelInfo, ProviderId } from "./types";

/** Parse a comma/space separated env list, trimming empties. */
function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  const parts = value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : fallback;
}

const DEFAULT_OPENAI = ["gpt-5-mini", "gpt-5-nano", "gpt-5", "gpt-4.1-mini"];
const DEFAULT_GEMINI = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];
const DEFAULT_NVIDIA = [
  "meta/llama-3.3-70b-instruct",
  "meta/llama-3.1-8b-instruct",
  "deepseek-ai/deepseek-r1",
];
const DEFAULT_GROQ = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "qwen/qwen3-32b",
];

function prettyModel(provider: ProviderId, model: string): string {
  const prefix = { openai: "OpenAI", gemini: "Gemini", nvidia: "NVIDIA", groq: "Groq" }[
    provider
  ];
  return `${prefix} · ${model}`;
}

/** Heuristics so newly added models still get sensible capability flags. */
function detectVision(provider: ProviderId, model: string): boolean {
  const m = model.toLowerCase();
  if (provider === "gemini") return true;
  if (provider === "openai") {
    // GPT-4o/4.1/5 families and o-series support images.
    return /gpt-4|gpt-5|o1|o3|o4/.test(m);
  }
  if (provider === "groq") return /vision|scout|maverick/.test(m);
  if (provider === "nvidia") return /vision|vila|neva/.test(m);
  return false;
}

export interface ProviderConfig {
  id: ProviderId;
  baseUrl: string;
  apiKey: string | undefined;
  models: string[];
}

function readProviders(): Record<ProviderId, ProviderConfig> {
  return {
    openai: {
      id: "openai",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
      models: list(process.env.OPENAI_MODELS, DEFAULT_OPENAI),
    },
    gemini: {
      id: "gemini",
      baseUrl:
        process.env.GEMINI_BASE_URL ||
        "https://generativelanguage.googleapis.com/v1beta",
      apiKey:
        process.env.GEMINI_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim() ||
        undefined,
      models: list(process.env.GEMINI_MODELS, DEFAULT_GEMINI),
    },
    nvidia: {
      id: "nvidia",
      baseUrl:
        process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
      apiKey: process.env.NVIDIA_API_KEY?.trim() || undefined,
      models: list(process.env.NVIDIA_MODELS, DEFAULT_NVIDIA),
    },
    groq: {
      id: "groq",
      baseUrl:
        process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY?.trim() || undefined,
      models: list(process.env.GROQ_MODELS, DEFAULT_GROQ),
    },
  };
}

export function getProviders(): Record<ProviderId, ProviderConfig> {
  return readProviders();
}

/** All models across all providers, in display order. */
export function getAllModels(): ModelInfo[] {
  const providers = readProviders();
  const order: ProviderId[] = ["openai", "gemini", "groq", "nvidia"];
  const out: ModelInfo[] = [];
  for (const pid of order) {
    const p = providers[pid];
    for (const model of p.models) {
      out.push({
        id: `${pid}:${model}`,
        provider: pid,
        model,
        label: prettyModel(pid, model),
        vision: detectVision(pid, model),
        pdf: pid === "gemini",
        note: p.apiKey ? undefined : "key not configured",
      });
    }
  }
  return out;
}

export function resolveModel(id: string): ModelInfo | undefined {
  return getAllModels().find((m) => m.id === id);
}

/** Which providers actually have an API key configured. */
export function configuredProviders(): ProviderId[] {
  const providers = readProviders();
  return (Object.keys(providers) as ProviderId[]).filter(
    (id) => !!providers[id].apiKey,
  );
}

export interface RouteOptions {
  /** if a concrete model id ("provider:model") or "auto" */
  modelId?: string;
  isPrivate?: boolean;
  needsVision?: boolean;
  needsPdf?: boolean;
  /** agent's preferred model, used first in auto mode when available */
  prefer?: string;
}

/**
 * Build the ordered list of candidate models to try.
 * - Explicit non-auto model -> just that one.
 * - Private mode -> Gemini only (the key that does not train on data).
 * - Auto -> OpenAI (default) -> Gemini (backup) -> Groq -> NVIDIA,
 *   filtered to providers with keys and models that can handle attachments.
 */
export function buildCandidates(opts: RouteOptions): ModelInfo[] {
  const all = getAllModels();
  const byId = new Map(all.map((m) => [m.id, m]));
  const providers = readProviders();
  const hasKey = (p: ProviderId) => !!providers[p].apiKey;

  const filterCaps = (list: ModelInfo[]): ModelInfo[] =>
    list.filter((m) => {
      if (opts.needsPdf && !m.pdf) return false;
      if (opts.needsVision && !m.vision) return false;
      return true;
    });

  // Privacy mode: Gemini only.
  if (opts.isPrivate) {
    const gem = filterCaps(
      all.filter((m) => m.provider === "gemini" && hasKey("gemini")),
    );
    if (gem.length) return gem.slice(0, 3);
    // No Gemini key -> nothing safe to use.
    return [];
  }

  if (opts.modelId && opts.modelId !== "auto") {
    const m = byId.get(opts.modelId);
    if (m && hasKey(m.provider)) return [m];
    // fall through to auto if unavailable
  }

  const explicit = list(process.env.AUTO_ROUTE, []);
  let chain: ModelInfo[];
  if (explicit.length) {
    chain = explicit
      .map((id) => byId.get(id))
      .filter((m): m is ModelInfo => !!m);
  } else {
    const pick = (p: ProviderId, n = 1) =>
      all.filter((m) => m.provider === p).slice(0, n);
    chain = [
      ...pick("openai", 2),
      ...pick("gemini", 1),
      ...pick("groq", 1),
      ...pick("nvidia", 1),
    ];
  }

  // Agent preference first, if configured and available.
  if (opts.prefer) {
    const preferred = byId.get(opts.prefer);
    if (preferred) chain = [preferred, ...chain];
  }

  const seen = new Set<string>();
  const result: ModelInfo[] = [];
  for (const m of chain) {
    if (!hasKey(m.provider)) continue;
    if (seen.has(m.id)) continue;
    if (opts.needsPdf && !m.pdf) continue;
    if (opts.needsVision && !m.vision) continue;
    seen.add(m.id);
    result.push(m);
  }

  // Last resort for vision/pdf: any capable model with a key.
  if (!result.length && (opts.needsVision || opts.needsPdf)) {
    return filterCaps(all.filter((m) => hasKey(m.provider)));
  }
  return result;
}
