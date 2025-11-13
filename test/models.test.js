import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsModuleHref = pathToFileURL(path.join(__dirname, "..", "lib", "models.js")).href;

const originalFetch = global.fetch;
const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY
};

test.afterEach(() => {
  if (originalEnv.OPENAI_API_KEY === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
  }
  global.fetch = originalFetch;
});

async function loadModelsModule({ apiKey, fetchImpl } = {}) {
  if (apiKey === undefined || apiKey === null) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = apiKey;
  }
  if (fetchImpl === undefined) {
    global.fetch = originalFetch;
  } else if (fetchImpl === null) {
    global.fetch = undefined;
  } else {
    global.fetch = fetchImpl;
  }
  const href = `${modelsModuleHref}?t=${randomUUID()}`;
  return import(href);
}

test("getAvailableModels merges remote data with fallbacks and caches calls", async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          data: [
            { id: "gpt-zeta" },
            { id: "ft:skip-me" },
            { id: "o4" },
            { id: "deprecated-model" }
          ]
        };
      }
    };
  };
  const { getAvailableModels } = await loadModelsModule({ apiKey: "token", fetchImpl: mockFetch });
  const first = await getAvailableModels();
  const second = await getAvailableModels();
  assert.equal(callCount, 1, "remote fetch should run only once due to caching");
  assert.deepEqual(first, second, "cached result should be reused");
  assert.ok(first.includes("gpt-zeta"), "new remote models should be included");
  assert.ok(first.includes("gpt-4o"), "fallback models should always be present");
  assert.ok(!first.includes("ft:skip-me"), "fine-tune models should be filtered out");
  assert.ok(!first.includes("deprecated-model"), "deprecated models should be filtered out");
});

test("updateModelSelection normalizes values and preserves manual effort when invalid input is ignored", async () => {
  const { updateModelSelection, getModelSettings } = await loadModelsModule({ fetchImpl: null });

  updateModelSelection({ model: "  custom-model  " });
  let settings = await getModelSettings();
  assert.equal(settings.model, "custom-model", "model names should be trimmed");

  updateModelSelection({ effort: "HIGH" });
  settings = await getModelSettings();
  assert.equal(settings.effort, "high", "effort should be normalized");

  updateModelSelection({ model: "", effort: "ultra" });
  settings = await getModelSettings();
  assert.equal(settings.model, null, "empty strings clear the manual model override");
  assert.equal(settings.effort, "high", "invalid effort leaves the previous value untouched");

  updateModelSelection({ model: null, effort: "" });
  settings = await getModelSettings();
  assert.equal(settings.model, null, "explicit null resets the manual model");
  assert.equal(settings.effort, null, "empty strings clear manual effort overrides");
  assert.ok(
    Array.isArray(settings.availableModels) && settings.availableModels.includes("gpt-4o"),
    "model settings should always expose at least the fallback models"
  );
});
