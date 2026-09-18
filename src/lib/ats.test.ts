import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATS_ATTEMPT_TIMEOUT_MS,
  ATS_MAX_ATTEMPTS,
  ATS_PLATFORM_BUDGET_SECONDS,
  ATS_RETRY_BACKOFF_MS,
  ATS_ROUTE_MAX_DURATION_SECONDS,
  atsBoundedTotalMs,
} from "./ats-budget";
import {
  buildGeminiRequest,
  parseGeminiResponse,
  requestGeminiAts,
  upstreamFailureCode,
  validateAtsInput,
} from "./ats";

type JsonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function jsonResponse(status: number, body: unknown): JsonResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function okAtsResponse(score = 64) {
  return jsonResponse(200, {
    modelVersion: "gemini-3.1-flash-lite",
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                score,
                summary: "Solid base alignment.",
                tips: ["Mirror more role-specific keywords"],
                dimensions: {
                  keywords: 61,
                  experience: 67,
                  skills: 66,
                  formatting: 62,
                  qualifications: 63,
                  roleFit: 65,
                },
              }),
            },
          ],
        },
      },
    ],
    usageMetadata: {
      promptTokenCount: 200,
      candidatesTokenCount: 80,
      totalTokenCount: 280,
    },
  });
}

describe("validateAtsInput", () => {
  it("rejects empty resume text", () => {
    expect(() =>
      validateAtsInput({ resumeText: "   ", jobText: "Backend role" }),
    ).toThrowError("INVALID_INPUT");
  });

  it("rejects empty job text", () => {
    expect(() =>
      validateAtsInput({ resumeText: "Resume body", jobText: "" }),
    ).toThrowError("INVALID_INPUT");
  });
});

describe("buildGeminiRequest", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("clips input and builds the approved Gemini payload", () => {
    process.env.GEMINI_API_KEY = "test-key";
    const timeoutSignal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutSignal);

    const request = buildGeminiRequest({
      resumeText: `${"R".repeat(40000)}TRUNCATE_RESUME`,
      jobText: `${"J".repeat(20000)}TRUNCATE_JOB`,
      jobId: "seek-123",
    });

    expect(request.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
    );
    expect(request.init.method).toBe("POST");
    expect(request.init.signal).toBe(timeoutSignal);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);

    expect(request.init.headers).toEqual({
      "Content-Type": "application/json",
      "x-goog-api-key": "test-key",
    });

    const body = JSON.parse(String(request.init.body));
    const prompt = body.contents[0].parts[0].text as string;

    expect(body.generationConfig.temperature).toBe(0.2);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.maxOutputTokens).toBe(1024);
    expect(body.generationConfig.responseJsonSchema.required).toEqual([
      "score",
      "summary",
      "tips",
      "dimensions",
    ]);
    expect(
      body.generationConfig.responseJsonSchema.properties.dimensions.required,
    ).toEqual([
      "keywords",
      "experience",
      "skills",
      "formatting",
      "qualifications",
      "roleFit",
    ]);
    expect(body.systemInstruction.parts[0].text).toMatch(
      /six dimension scores 0-100/i,
    );
    expect(body.systemInstruction.parts[0].text).toMatch(/1-5 actionable tips/i);
    expect(prompt).toContain("=== JOB DESCRIPTION ===");
    expect(prompt).toContain("=== RESUME ===");
    expect(prompt).toContain("J".repeat(20000));
    expect(prompt).toContain("R".repeat(40000));
    expect(prompt).not.toContain("TRUNCATE_JOB");
    expect(prompt).not.toContain("TRUNCATE_RESUME");
  });
});

describe("parseGeminiResponse", () => {
  it("returns normalized ATS fields with usage metadata", () => {
    const result = parseGeminiResponse({
      modelVersion: "gemini-3.1-flash-lite",
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  score: 81.6,
                  summary: "Strong match with the role requirements.",
                  tips: ["Add more quantified achievements"],
                  dimensions: {
                    keywords: 88,
                    experience: 80,
                    skills: 90,
                    formatting: 70,
                    qualifications: 65,
                    roleFit: 84,
                  },
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 321,
        candidatesTokenCount: 123,
        totalTokenCount: 444,
      },
    });

    expect(result).toEqual({
      score: 82,
      summary: "Strong match with the role requirements.",
      tips: ["Add more quantified achievements"],
      dimensions: {
        keywords: 88,
        experience: 80,
        skills: 90,
        formatting: 70,
        qualifications: 65,
        roleFit: 84,
      },
      model: "gemini-3.1-flash-lite",
      usage: {
        promptTokens: 321,
        completionTokens: 123,
        totalTokens: 444,
      },
    });
  });

  it("rejects invalid model JSON", () => {
    expect(() =>
      parseGeminiResponse({
        candidates: [{ content: { parts: [{ text: "not-json" }] } }],
      }),
    ).toThrowError("MODEL_RESPONSE_INVALID");
  });

  function responseWithPayload(payload: unknown, usage?: unknown) {
    return {
      modelVersion: "gemini-3.1-flash-lite",
      candidates: [
        { content: { parts: [{ text: JSON.stringify(payload) }] } },
      ],
      usageMetadata:
        usage === undefined
          ? {
              promptTokenCount: 10,
              candidatesTokenCount: 5,
              totalTokenCount: 15,
            }
          : usage,
    };
  }

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      score: 70,
      summary: "Reasonable match.",
      tips: ["Add measurable outcomes"],
      dimensions: {
        keywords: 70,
        experience: 70,
        skills: 70,
        formatting: 70,
        qualifications: 70,
        roleFit: 70,
      },
      ...overrides,
    };
  }

  const emptyish: Array<[string, unknown]> = [
    ["null", null],
    ["empty string", ""],
    ["whitespace string", "   "],
    ["false", false],
    ["true", true],
    ["empty array", []],
    ["empty object", {}],
  ];

  it.each(emptyish)("rejects %s as an overall score", (_label, value) => {
    expect(() =>
      parseGeminiResponse(responseWithPayload(validPayload({ score: value }))),
    ).toThrowError("MODEL_RESPONSE_INVALID");
  });

  it.each(emptyish)("rejects %s as a dimension score", (_label, value) => {
    expect(() =>
      parseGeminiResponse(
        responseWithPayload(
          validPayload({
            dimensions: {
              keywords: 70,
              experience: 70,
              skills: 70,
              formatting: 70,
              qualifications: 70,
              roleFit: value,
            },
          }),
        ),
      ),
    ).toThrowError("MODEL_RESPONSE_INVALID");
  });

  it.each(emptyish)("rejects %s as a token usage count", (_label, value) => {
    expect(() =>
      parseGeminiResponse(
        responseWithPayload(validPayload(), {
          promptTokenCount: 10,
          candidatesTokenCount: value,
          totalTokenCount: 15,
        }),
      ),
    ).toThrowError("MODEL_RESPONSE_INVALID");
  });

  it("rejects a missing dimension key instead of defaulting it to zero", () => {
    expect(() =>
      parseGeminiResponse(
        responseWithPayload(
          validPayload({
            dimensions: {
              keywords: 70,
              experience: 70,
              skills: 70,
              formatting: 70,
              qualifications: 70,
            },
          }),
        ),
      ),
    ).toThrowError("MODEL_RESPONSE_INVALID");
  });

  it("still accepts a genuine zero score and zero token usage", () => {
    const result = parseGeminiResponse(
      responseWithPayload(
        validPayload({
          score: 0,
          dimensions: {
            keywords: 0,
            experience: 0,
            skills: 0,
            formatting: 0,
            qualifications: 0,
            roleFit: 0,
          },
        }),
        {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0,
        },
      ),
    );

    expect(result.score).toBe(0);
    expect(result.dimensions.roleFit).toBe(0);
    expect(result.usage.totalTokens).toBe(0);
  });

  it("accepts numeric strings the model may emit", () => {
    const result = parseGeminiResponse(
      responseWithPayload(validPayload({ score: "83" })),
    );

    expect(result.score).toBe(83);
  });
});

describe("ATS request budget", () => {
  it("keeps the bounded retry window under the route budget", () => {
    expect(atsBoundedTotalMs()).toBe(
      ATS_MAX_ATTEMPTS * ATS_ATTEMPT_TIMEOUT_MS +
        (ATS_MAX_ATTEMPTS - 1) * ATS_RETRY_BACKOFF_MS,
    );
    expect(atsBoundedTotalMs()).toBeLessThan(
      ATS_ROUTE_MAX_DURATION_SECONDS * 1000,
    );
  });

  it("keeps the route budget under the platform ceiling", () => {
    expect(ATS_ROUTE_MAX_DURATION_SECONDS).toBeLessThan(
      ATS_PLATFORM_BUDGET_SECONDS,
    );
    expect(ATS_ROUTE_MAX_DURATION_SECONDS).toBeGreaterThan(
      atsBoundedTotalMs() / 1000,
    );
  });

  it("uses a per-attempt timeout that fits two attempts plus backoff", () => {
    expect(ATS_ATTEMPT_TIMEOUT_MS).toBeLessThan(
      ATS_PLATFORM_BUDGET_SECONDS * 1000,
    );
    expect(ATS_MAX_ATTEMPTS).toBe(2);
    expect(ATS_RETRY_BACKOFF_MS).toBeGreaterThan(0);
    expect(ATS_RETRY_BACKOFF_MS).toBeLessThanOrEqual(2000);
  });
});

describe("upstreamFailureCode", () => {
  it.each([400, 401, 403])(
    "normalizes HTTP %s to SERVER_MISCONFIGURED",
    (status) => {
      expect(upstreamFailureCode(status)).toBe("SERVER_MISCONFIGURED");
    },
  );

  it.each([404, 409, 422, 451])(
    "leaves other non-transient HTTP %s as MODEL_RESPONSE_INVALID",
    (status) => {
      expect(upstreamFailureCode(status)).toBe("MODEL_RESPONSE_INVALID");
    },
  );
});

describe("requestGeminiAts", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it.each([429, 503])(
    "retries one transient %s response with a fresh timeout signal per attempt",
    async (status) => {
      process.env.GEMINI_API_KEY = "server-key";
      const firstSignal = new AbortController().signal;
      const secondSignal = new AbortController().signal;
      const timeoutSpy = vi
        .spyOn(AbortSignal, "timeout")
        .mockReturnValueOnce(firstSignal)
        .mockReturnValueOnce(secondSignal);

      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(status, { error: { message: "busy" } }))
        .mockResolvedValueOnce(okAtsResponse());
      const sleepImpl = vi.fn().mockResolvedValue(undefined);

      const result = await requestGeminiAts(
        { resumeText: "Resume body", jobText: "Job description body" },
        fetchImpl,
        sleepImpl,
      );

      expect(sleepImpl).toHaveBeenCalledTimes(1);
      expect(sleepImpl).toHaveBeenCalledWith(ATS_RETRY_BACKOFF_MS);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(timeoutSpy).toHaveBeenCalledTimes(2);
      expect(fetchImpl.mock.calls[0]?.[0]).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
      );
      expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": "server-key",
        },
        signal: firstSignal,
      });
      expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": "server-key",
        },
        signal: secondSignal,
      });
      expect(fetchImpl.mock.calls[0]?.[1]).not.toBe(fetchImpl.mock.calls[1]?.[1]);
      expect(result.model).toBe("gemini-3.1-flash-lite");
      expect(result.usage.totalTokens).toBe(280);
    },
  );

  it.each([400, 401, 403])(
    "normalizes bad-key/billing HTTP %s to SERVER_MISCONFIGURED without retrying",
    async (status) => {
      process.env.GEMINI_API_KEY = "server-key";
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(status, { error: { message: "API key not valid" } }),
        );
      const sleepImpl = vi.fn().mockResolvedValue(undefined);

      await expect(
        requestGeminiAts(
          { resumeText: "Resume body", jobText: "Job description body" },
          fetchImpl,
          sleepImpl,
        ),
      ).rejects.toThrowError("SERVER_MISCONFIGURED");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(sleepImpl).not.toHaveBeenCalled();
    },
  );

  it.each([404, 422])(
    "keeps other non-transient HTTP %s as MODEL_RESPONSE_INVALID",
    async (status) => {
      process.env.GEMINI_API_KEY = "server-key";
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(status, { error: { message: "nope" } }));

      await expect(
        requestGeminiAts(
          { resumeText: "Resume body", jobText: "Job description body" },
          fetchImpl,
          vi.fn().mockResolvedValue(undefined),
        ),
      ).rejects.toThrowError("MODEL_RESPONSE_INVALID");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    new DOMException("Request timed out", "TimeoutError"),
    new TypeError("fetch failed"),
  ])("normalizes fetch rejection %s to AtsError", async (cause) => {
    process.env.GEMINI_API_KEY = "server-key";
    const fetchImpl = vi.fn().mockRejectedValueOnce(cause).mockRejectedValueOnce(cause);
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestGeminiAts(
        { resumeText: "Resume body", jobText: "Job description body" },
        fetchImpl,
        sleepImpl,
      ),
    ).rejects.toMatchObject({
      name: "AtsError",
      message: "MODEL_BUSY",
      code: "MODEL_BUSY",
      cause,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(ATS_MAX_ATTEMPTS);
    expect(sleepImpl).toHaveBeenCalledTimes(ATS_MAX_ATTEMPTS - 1);
  });

  it("never exceeds the bounded attempt count on repeated transient failures", async () => {
    process.env.GEMINI_API_KEY = "server-key";
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(503, { error: { message: "busy" } }));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestGeminiAts(
        { resumeText: "Resume body", jobText: "Job description body" },
        fetchImpl,
        sleepImpl,
      ),
    ).rejects.toThrowError("MODEL_BUSY");
    expect(fetchImpl).toHaveBeenCalledTimes(ATS_MAX_ATTEMPTS);
    expect(sleepImpl).toHaveBeenCalledTimes(ATS_MAX_ATTEMPTS - 1);
  });

  it("builds each attempt with the per-attempt timeout", async () => {
    process.env.GEMINI_API_KEY = "server-key";
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(new AbortController().signal);
    const fetchImpl = vi.fn().mockResolvedValueOnce(okAtsResponse());

    await requestGeminiAts(
      { resumeText: "Resume body", jobText: "Job description body" },
      fetchImpl,
      vi.fn().mockResolvedValue(undefined),
    );

    expect(timeoutSpy).toHaveBeenCalledWith(ATS_ATTEMPT_TIMEOUT_MS);
  });
});
