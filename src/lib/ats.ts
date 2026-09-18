import {
  ATS_ATTEMPT_TIMEOUT_MS,
  ATS_MAX_ATTEMPTS,
  ATS_RETRY_BACKOFF_MS,
} from "./ats-budget";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const MAX_RESUME_CHARS = 40_000;
const MAX_JOB_CHARS = 20_000;
const MAX_OUTPUT_TOKENS = 1024;

const ATS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    tips: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
    },
    dimensions: {
      type: "object",
      properties: {
        keywords: { type: "integer", minimum: 0, maximum: 100 },
        experience: { type: "integer", minimum: 0, maximum: 100 },
        skills: { type: "integer", minimum: 0, maximum: 100 },
        formatting: { type: "integer", minimum: 0, maximum: 100 },
        qualifications: { type: "integer", minimum: 0, maximum: 100 },
        roleFit: { type: "integer", minimum: 0, maximum: 100 },
      },
      required: [
        "keywords",
        "experience",
        "skills",
        "formatting",
        "qualifications",
        "roleFit",
      ],
    },
  },
  required: ["score", "summary", "tips", "dimensions"],
} as const;

const ATS_SYSTEM_PROMPT =
  "You are an ATS (Applicant Tracking System) resume reviewer for Seek jobs in Australia and New Zealand. " +
  "Compare the candidate resume to the job description. Be practical and specific. " +
  "Give an overall score 0-100 plus six dimension scores 0-100: keywords, experience, skills, formatting, qualifications, roleFit. " +
  "Return only structured data matching the schema. Tips must be 1-5 actionable tips.";

type AtsDimensions = {
  keywords: number;
  experience: number;
  skills: number;
  formatting: number;
  qualifications: number;
  roleFit: number;
};

export type AtsInput = {
  resumeText: string;
  jobText: string;
  jobId?: string | null;
};

export type AtsUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AtsResult = {
  score: number;
  summary: string;
  tips: string[];
  dimensions: AtsDimensions;
  model: string;
  usage: AtsUsage;
};

export type GeminiRequest = {
  url: string;
  init: RequestInit;
};

export class AtsError extends Error {
  code: string;

  constructor(code: string, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "AtsError";
    this.code = code;
  }
}

type GeminiResponse = {
  modelVersion?: unknown;
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: unknown;
    candidatesTokenCount?: unknown;
    totalTokenCount?: unknown;
  };
};

function fail(code: string, cause?: unknown): never {
  throw new AtsError(code, { cause });
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function clipText(value: string, max: number): string {
  return value.slice(0, max);
}

function requireEnv(name: string): string {
  const value = normalizeText(process.env[name]);
  if (!value) fail("SERVER_MISCONFIGURED");
  return value;
}

function promptText(input: AtsInput): string {
  return [
    "Score how well this resume matches the job for ATS screening.",
    "Include overall score and all six dimension scores.",
    "",
    "=== JOB DESCRIPTION ===",
    input.jobText,
    "",
    "=== RESUME ===",
    input.resumeText,
  ].join("\n");
}

/**
 * Only real numbers and numeric strings are scores. `null`, `""`, booleans, and
 * arrays all coerce to 0 through Number() and must not become a valid score.
 */
function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("MODEL_RESPONSE_INVALID");
    return value;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) fail("MODEL_RESPONSE_INVALID");
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) fail("MODEL_RESPONSE_INVALID");
    return parsed;
  }
  return fail("MODEL_RESPONSE_INVALID");
}

function toBoundedInteger(value: unknown): number {
  const rounded = Math.round(toFiniteNumber(value));
  if (rounded < 0 || rounded > 100) fail("MODEL_RESPONSE_INVALID");
  return rounded;
}

function toNonEmptyString(value: unknown): string {
  const text = normalizeText(value);
  if (!text) fail("MODEL_RESPONSE_INVALID");
  return text;
}

function toTips(value: unknown): string[] {
  if (!Array.isArray(value)) fail("MODEL_RESPONSE_INVALID");
  const tips = value
    .map((tip) => normalizeText(tip))
    .filter(Boolean)
    .slice(0, 5);
  if (tips.length < 1) fail("MODEL_RESPONSE_INVALID");
  return tips;
}

function toDimensions(value: unknown): AtsDimensions {
  if (!value || typeof value !== "object") fail("MODEL_RESPONSE_INVALID");
  const dims = value as Record<string, unknown>;
  return {
    keywords: toBoundedInteger(dims.keywords),
    experience: toBoundedInteger(dims.experience),
    skills: toBoundedInteger(dims.skills),
    formatting: toBoundedInteger(dims.formatting),
    qualifications: toBoundedInteger(dims.qualifications),
    roleFit: toBoundedInteger(dims.roleFit),
  };
}

function toUsage(value: GeminiResponse["usageMetadata"]): AtsUsage {
  if (!value) fail("MODEL_RESPONSE_INVALID");
  return {
    promptTokens: toNonNegativeInteger(value.promptTokenCount),
    completionTokens: toNonNegativeInteger(value.candidatesTokenCount),
    totalTokens: toNonNegativeInteger(value.totalTokenCount),
  };
}

function toNonNegativeInteger(value: unknown): number {
  const rounded = Math.round(toFiniteNumber(value));
  if (rounded < 0) fail("MODEL_RESPONSE_INVALID");
  return rounded;
}

function extractCandidateText(value: GeminiResponse): string {
  const parts = value.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) fail("MODEL_RESPONSE_INVALID");
  const text = parts
    .map((part) => normalizeText(part?.text))
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) fail("MODEL_RESPONSE_INVALID");
  return text;
}

export function validateAtsInput(value: unknown): AtsInput {
  if (!value || typeof value !== "object") fail("INVALID_INPUT");
  const raw = value as Record<string, unknown>;
  const resumeText = clipText(normalizeText(raw.resumeText), MAX_RESUME_CHARS);
  const jobText = clipText(normalizeText(raw.jobText), MAX_JOB_CHARS);
  const jobId = normalizeText(raw.jobId) || null;

  if (!resumeText || !jobText) fail("INVALID_INPUT");

  return { resumeText, jobText, jobId };
}

export function buildGeminiRequest(input: AtsInput): GeminiRequest {
  const normalized = validateAtsInput(input);
  const key = requireEnv("GEMINI_API_KEY");

  return {
    url: GEMINI_URL,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      signal: AbortSignal.timeout(ATS_ATTEMPT_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ATS_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: promptText(normalized) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
          responseJsonSchema: ATS_RESPONSE_SCHEMA,
        },
      }),
    },
  };
}

export function parseGeminiResponse(value: unknown): AtsResult {
  try {
    const body = (value || {}) as GeminiResponse;
    const parsed = JSON.parse(extractCandidateText(body)) as Record<string, unknown>;
    return {
      score: toBoundedInteger(parsed.score),
      summary: toNonEmptyString(parsed.summary),
      tips: toTips(parsed.tips),
      dimensions: toDimensions(parsed.dimensions),
      model: normalizeText(body.modelVersion) || GEMINI_MODEL,
      usage: toUsage(body.usageMetadata),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "MODEL_RESPONSE_INVALID") {
      throw error;
    }
    fail("MODEL_RESPONSE_INVALID");
  }
}

function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * 400/401/403 from Gemini means our key, project, or billing is wrong - never
 * the caller's resume. Surface it as our own misconfiguration.
 */
export function upstreamFailureCode(status: number): string {
  if (status === 400 || status === 401 || status === 403) {
    return "SERVER_MISCONFIGURED";
  }
  return "MODEL_RESPONSE_INVALID";
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestGeminiAts(
  value: unknown,
  fetchImpl: typeof fetch = fetch,
  sleepImpl: (ms: number) => Promise<void> = defaultSleep,
): Promise<AtsResult> {
  const input = validateAtsInput(value);
  const lastAttempt = ATS_MAX_ATTEMPTS - 1;

  for (let attempt = 0; attempt < ATS_MAX_ATTEMPTS; attempt += 1) {
    const request = buildGeminiRequest(input);
    let response: Response;
    try {
      response = await fetchImpl(request.url, request.init);
    } catch (error) {
      if (attempt === lastAttempt) {
        fail("MODEL_BUSY", error);
      }
      await sleepImpl(ATS_RETRY_BACKOFF_MS);
      continue;
    }
    if (response.ok) {
      return parseGeminiResponse(await response.json());
    }
    if (!isTransientStatus(response.status)) {
      fail(upstreamFailureCode(response.status));
    }
    if (attempt === lastAttempt) {
      fail("MODEL_BUSY");
    }
    await sleepImpl(ATS_RETRY_BACKOFF_MS);
  }

  fail("MODEL_BUSY");
}
