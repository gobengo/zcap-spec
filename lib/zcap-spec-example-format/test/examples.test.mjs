// examples.test.mjs -- extraction, checking and fixing, against fixtures that
// travel with the package, so these pass wherever the package ends up.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { extractExamples, reviewExamples, formatExamplesIn } from "../lib/examples.mjs";
import { checkFile, fixFile } from "../lib/files.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

/** Copy `html` into a scratch file that the test cleans up after itself. */
function scratchFile(t, html) {
  const directory = mkdtempSync(join(tmpdir(), "zcap-spec-example-format-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "index.html");
  writeFileSync(path, html);
  return path;
}

test("finds only the example blocks", () => {
  const examples = extractExamples(fixture("spec-like.html"));
  assert.equal(examples.length, 2, "the plain, http and ignored blocks must be skipped");
  assert.equal(examples[1].title, "Already canonical");
});

test("reports the line an example starts on", () => {
  assert.equal(extractExamples('x\ny\n<pre class="example json">\n{}\n</pre>')[0].line, 4);
});

test("leaves an already canonical example alone", () => {
  const reviews = reviewExamples(fixture("spec-like.html"));
  assert.equal(reviews[1].status, "ok");
});

test("flags an example in the old hand-aligned style", () => {
  const reviews = reviewExamples(fixture("spec-like.html"));
  assert.equal(reviews[0].status, "misformatted");
  assert.match(reviews[0].expected, /^\{\n {2}"@context": \[\n {4}"https:/);
});

test("decodes and re-encodes HTML entities around the example", () => {
  const html = '<pre class="example json">\n{"a" :"x &amp; y"}\n</pre>';
  const [review] = reviewExamples(html);
  assert.ok(review.expected.includes("&amp;"), review.expected);
  assert.ok(!review.expected.includes(" & "), "a bare ampersand would break the markup");
});

test("fixing makes the document pass the check", (t) => {
  const path = scratchFile(t, fixture("spec-like.html"));

  const { fixed } = fixFile(path, {});
  assert.equal(fixed.length, 1);

  assert.deepEqual(checkFile(path, {}).failures, []);
});

test("fixing is idempotent", (t) => {
  const path = scratchFile(t, fixture("spec-like.html"));

  fixFile(path, {});
  const afterFirst = readFileSync(path, "utf8");

  assert.deepEqual(fixFile(path, {}).fixed, []);
  assert.equal(readFileSync(path, "utf8"), afterFirst);
});

test("fixing changes nothing outside the example blocks", () => {
  const before = fixture("spec-like.html");
  const { html: after } = formatExamplesIn(before);

  const outside = (html) => html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/g, "<pre/>");
  assert.equal(outside(after), outside(before));
});

test("fixing leaves the blocks it skips byte-identical", () => {
  const before = fixture("spec-like.html");
  const { html: after } = formatExamplesIn(before);

  const skipped = (html) =>
    [...html.matchAll(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g)]
      .filter(([, attributes]) => !/\bexample\b/.test(attributes) || /\bhttp\b/.test(attributes))
      .map(([match]) => match);

  assert.equal(skipped(before).length, 2);
  assert.deepEqual(skipped(after), skipped(before));
});

test("never rewrites an example that is not valid JSON", (t) => {
  const before = fixture("broken.html");
  const path = scratchFile(t, before);

  const { fixed, failures } = fixFile(path, {});
  assert.equal(fixed.length, 1, "the valid sibling is still fixed");
  assert.equal(failures.length, 1);
  assert.match(failures[0].reason, /not valid JSON/);
  assert.match(failures[0].label, /\(Trailing comma\)$/);

  const after = readFileSync(path, "utf8");
  assert.ok(after.includes('{\n  "a": 1,\n}'), "the broken example was modified");
  assert.ok(after.includes('{\n  "needs": "reformatting"\n}'), after);
});

test("normalizes the padding around an example without moving the tags", (t) => {
  const path = scratchFile(t, '  <pre class="example json">   \n\n{"a" :1}\n\n    </pre>');
  fixFile(path, {});
  assert.equal(readFileSync(path, "utf8"), '  <pre class="example json">\n{\n  "a": 1\n}\n    </pre>');
});

test("honours a different indent all the way through", (t) => {
  const path = scratchFile(t, fixture("spec-like.html"));
  fixFile(path, { indent: "\t" });

  assert.deepEqual(checkFile(path, { indent: "\t" }).failures, []);
  assert.equal(checkFile(path, { indent: "  " }).failures.length, 2, "both examples now use tabs");
});

test("a check failure carries a diff that says what to change", () => {
  const [failure] = checkFile(
    new URL("./fixtures/spec-like.html", import.meta.url).pathname,
    {},
  ).failures;

  assert.equal(failure.reason, "formatting");
  assert.ok(failure.diff.some((line) => line.marker === "-"));
  assert.ok(failure.diff.some((line) => line.marker === "+"));
});
