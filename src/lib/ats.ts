import {
  ATS_ATTEMPT_TIMEOUT_MS,
  ATS_MAX_ATTEMPTS,
  ATS_RETRY_BACKOFF_MS,
} from "./ats-budget";
import { maskResumeContacts, scrubFeedbackText } from "./resume-privacy";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const MAX_RESUME_CHARS = 40_000;
const MAX_JOB_CHARS = 20_000;
const MAX_OUTPUT_TOKENS = 1024;

const FEEDBACK_LIMITS = {
  strengths: 3,
  gaps: 3,
  missingKeywords: 8,
  contactIssues: 4,
  formatting: 3,
  improvements: 3,
} as const;

function feedbackListSchema(minItems: number, maxItems: number) {
  return {
    type: "array",
    items: { type: "string" },
    minItems,
    maxItems,
  } as const;
}

const ATS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    overview: { type: "string" },
    strengths: feedbackListSchema(0, FEEDBACK_LIMITS.strengths),
    gaps: feedbackListSchema(0, FEEDBACK_LIMITS.gaps),
    missingKeywords: feedbackListSchema(0, FEEDBACK_LIMITS.missingKeywords),
    contactIssues: feedbackListSchema(0, FEEDBACK_LIMITS.contactIssues),
    formatting: feedbackListSchema(0, FEEDBACK_LIMITS.formatting),
    improvements: feedbackListSchema(1, FEEDBACK_LIMITS.improvements),
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
  required: [
    "score",
    "overview",
    "strengths",
    "gaps",
    "missingKeywords",
    "contactIssues",
    "formatting",
    "improvements",
    "dimensions",
  ],
} as const;

const ATS_SYSTEM_PROMPT = [
  "You are an ATS (Applicant Tracking System) resume reviewer. Compare the resume to the job listing and give practical, specific feedback.",
  "Give an overall score 0-100 plus six dimension scores 0-100: keywords, experience, skills, formatting, qualifications, roleFit.",
  'Write every sentence directly to the job seeker in second person ("Your resume...", "You show...", "Add..."). Never write "the candidate", "the applicant", "they", "he", or "she".',
  "Never mention the person's name, email address, phone number, street address, or any other personal identifier. Never quote contact details.",
  'overview: 1-2 sentences, at most 40 words, starting with "Your resume".',
  "strengths: up to 3 things that already match the job.",
  "gaps: up to 3 job requirements the resume does not show.",
  "missingKeywords: up to 8 job terms missing from the resume, 1-3 words each.",
  'contactIssues: check email, phone, location (city and state or country), and LinkedIn. List only what is missing, for example "Your phone number is missing." Placeholders such as [email provided] mean the detail is present. Do not flag a missing street address.',
  "formatting: up to 3 layout or ATS readability issues.",
  "improvements: 1-3 actionable changes, highest impact first.",
  "Keep each list item under 15 words. Use an empty list when a section has nothing to report. Return only structured data matching the schema.",
].join("\n");

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

export type AtsSections = {
  overview: string;
  strengths: string[];
  gaps: string[];
  missingKeywords: string[];
  contactIssues: string[];
  formatting: string[];
  improvements: string[];
};

export type AtsResult = {
  score: number;
  summary: string;
  tips: string[];
  sections: AtsSections;
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
    "Review this resume against the job listing for ATS screening.",
    "Return the overall score, all six dimension scores, and every feedback section.",
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

function toFeedbackList(value: unknown, max: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail("MODEL_RESPONSE_INVALID");
  return value
    .map((item) => scrubFeedbackText(normalizeText(item)))
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Older extension builds require a non-empty summary and at least one tip,
 * so overview and improvements are mandatory.
 */
function toSections(parsed: Record<string, unknown>): AtsSections {
  if (typeof parsed.overview !== "string") fail("MODEL_RESPONSE_INVALID");
  const overview = scrubFeedbackText(toNonEmptyString(parsed.overview));
  if (!overview) fail("MODEL_RESPONSE_INVALID");
  const improvements = toFeedbackList(
    parsed.improvements,
    FEEDBACK_LIMITS.improvements,
  );
  if (improvements.length < 1) fail("MODEL_RESPONSE_INVALID");
  return {
    overview,
    strengths: toFeedbackList(parsed.strengths, FEEDBACK_LIMITS.strengths),
    gaps: toFeedbackList(parsed.gaps, FEEDBACK_LIMITS.gaps),
    missingKeywords: toFeedbackList(
      parsed.missingKeywords,
      FEEDBACK_LIMITS.missingKeywords,
    ),
    contactIssues: toFeedbackList(
      parsed.contactIssues,
      FEEDBACK_LIMITS.contactIssues,
    ),
    formatting: toFeedbackList(parsed.formatting, FEEDBACK_LIMITS.formatting),
    improvements,
  };
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
  const resumeText = maskResumeContacts(
    clipText(normalizeText(raw.resumeText), MAX_RESUME_CHARS),
  );
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
    const sections = toSections(parsed);
    return {
      score: toBoundedInteger(parsed.score),
      summary: sections.overview,
      tips: sections.improvements.slice(),
      sections,
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
