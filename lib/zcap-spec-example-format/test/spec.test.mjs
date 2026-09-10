// spec.test.mjs -- the same checks against the real document, when it is
// there. These are the tests that would have caught the trailing comma in the
// invocation example; they skip themselves if the package is extracted from
// the spec repository, so the suite still passes standalone.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import { format, parseJsonc, tokenize, JsoncSyntaxError } from "../lib/jsonc.mjs";
import { extractExamples, decodeEntities, formatExamplesIn } from "../lib/examples.mjs";
import { reviewExamples } from "../lib/examples.mjs";

const SPEC = new URL("../../../index.html", import.meta.url).pathname;
const skip = existsSync(SPEC) ? false : "index.html is not next to this package";

/** Every example in the spec that parses, as the formatter sees it. */
function parseableExamples() {
  return extractExamples(readFileSync(SPEC, "utf8"))
    .map((example) => ({ ...example, source: decodeEntities(example.source) }))
    .filter((example) => {
      try {
        parseJsonc(example.source);
        return true;
      } catch (error) {
        if (error instanceof JsoncSyntaxError) return false;
        throw error;
      }
    });
}

test("the spec has examples to check", { skip }, () => {
  assert.ok(extractExamples(readFileSync(SPEC, "utf8")).length > 0);
});

test("reformatting is idempotent on every example", { skip }, () => {
  for (const example of parseableExamples()) {
    const once = format(example.source);
    assert.equal(format(once), once, `not idempotent: index.html:${example.line}`);
  }
});

test("reformatting never changes the data an example carries", { skip }, () => {
  for (const example of parseableExamples()) {
    assert.deepEqual(
      parseJsonc(format(example.source)),
      parseJsonc(example.source),
      `data changed: index.html:${example.line}`,
    );
  }
});

test("reformatting never loses a comment", { skip }, () => {
  const comments = (text) =>
    tokenize(text)
      .filter((token) => token.type.endsWith("Comment"))
      .map((token) => token.text);

  for (const example of parseableExamples()) {
    assert.deepEqual(
      comments(format(example.source)),
      comments(example.source),
      `comment lost: index.html:${example.line}`,
    );
  }
});

test("fixing the spec leaves nothing misformatted", { skip }, () => {
  const { html } = formatExamplesIn(readFileSync(SPEC, "utf8"));
  const remaining = reviewExamples(html).filter((review) => review.status === "misformatted");
  assert.deepEqual(remaining, []);
});
