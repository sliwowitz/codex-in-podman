import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "static", "index.html"), "utf8");

test("Commands tab renders preformatted monospace command blocks", () => {
  assert.match(
    indexHtml,
    /#commands\s*{[^}]*font-family:[^}]*monospace/i,
    "commands pane should enforce a monospace font family"
  );
  assert.match(
    indexHtml,
    /\.cmd\s*{[^}]*white-space:\s*pre-wrap/i,
    "command blocks should preserve newlines"
  );
  assert.match(
    indexHtml,
    /function\s+appendCommandBlock\([^)]*\)\s*{[^}]*document\.createElement\(['"]pre['"]/s,
    "command rendering should rely on <pre> blocks"
  );
});
