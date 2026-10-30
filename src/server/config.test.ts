import { describe, expect, it } from "vitest";
import { config, MODEL_IDS, modelCatalog } from "./config";

describe("config", () => {
  it("has exactly one retry layer with at most one retry", () => {
    expect(config.retry.maxRetries).toBeLessThanOrEqual(1);
  });

  it("every configured and compared model is in the priced catalog", () => {
    for (const model of [...Object.values(config.models), ...config.evals.answerModels]) {
      expect(MODEL_IDS).toContain(model);
    }
  });

  it("every catalog entry has a source and a verifiedAt field", () => {
    for (const price of Object.values(modelCatalog)) {
      expect(price.source.length).toBeGreaterThan(0);
      expect(price).toHaveProperty("verifiedAt");
    }
  });

  it("unknown token prices are null in all three fields together, never 0", () => {
    for (const price of Object.values(modelCatalog)) {
      if (price.billing !== "tokens") continue;
      const fields = [
        price.inputUsdPerMillion,
        price.cachedInputUsdPerMillion,
        price.outputUsdPerMillion,
      ];
      expect(
        fields.every((f) => f === null) || fields.every((f) => typeof f === "number" && f > 0),
      ).toBe(true);
    }
  });

  it("text steps use token-billed models and transcription a duration-billed one", () => {
    for (const step of ["router", "answer", "notebook", "judge"] as const) {
      expect(modelCatalog[config.models[step]].billing).toBe("tokens");
    }
    expect(modelCatalog[config.models.transcribe].billing).toBe("audio_duration");
  });

  it("asks the provider not to store requests (ADR 0005)", () => {
    expect(config.openai.store).toBe(false);
  });

  it("the audio byte cap and duration cap are both set (2 minutes max)", () => {
    expect(config.limits.audio.maxSeconds).toBe(120);
    expect(config.limits.audio.maxBytes).toBeGreaterThan(0);
  });

  it("the notebook byte cap fits a full notebook in multi-byte UTF-8", () => {
    const { maxNotes, maxNoteChars, maxRequestBytes } = config.limits.notebook;
    expect(maxRequestBytes).toBeGreaterThanOrEqual(maxNotes * maxNoteChars * 4);
  });

  it("the router stays on the cheapest model during the answer-model comparison", () => {
    expect(config.models.router).toBe("gpt-6-luna");
  });

  it("the eval budget cap defaults to $2", () => {
    expect(config.evals.budgetCapUsd).toBe(2);
  });

  it("the request byte cap leaves room for a max-length message in multi-byte UTF-8", () => {
    expect(config.limits.maxRequestBytes).toBeGreaterThanOrEqual(config.limits.maxInputChars * 4);
  });
});
