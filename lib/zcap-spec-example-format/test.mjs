// Run with: node --test lib/zcap-spec-example-format/test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import { format, parseJsonc, tokenize, JsoncSyntaxError } from "./format-jsonc.mjs";
import { extractExamples, review, fix } from "./check-examples.mjs";

// --- the printer -------------------------------------------------------

const RULES = [
  ["two spaces per level", '{"a":{"b":1}}', '{\n  "a": {\n    "b": 1\n  }\n}'],
  ["one element per line", '{"a":[1,2]}', '{\n  "a": [\n    1,\n    2\n  ]\n}'],
  ["closers on their own line", '{"a":{"b":1}}', '{\n  "a": {\n    "b": 1\n  }\n}'],
  ["empty containers stay inline", '{"a":{},"b":[]}', '{\n  "a": {},\n  "b": []\n}'],
  ["one space after the colon", '{"a"   :  1}', '{\n  "a": 1\n}'],
  ["a comment keeps its own line", '{\n// why\n"a": 1}', '{\n  // why\n  "a": 1\n}'],
  ["a trailing comment stays trailing", '{"a": 1 // why\n}', '{\n  "a": 1 // why\n}'],
  ["a comment after a comma stays put", '{"a": 1, // why\n"b": 2}', '{\n  "a": 1, // why\n  "b": 2\n}'],
  ["a grouping blank line survives", '{"a": 1,\n\n\n"b": 2}', '{\n  "a": 1,\n\n  "b": 2\n}'],
  ["padding blank lines are dropped", '{\n\n"a": 1\n\n}', '{\n  "a": 1\n}'],
  ["strings that look like syntax are left alone", '{\n  "a": "// {not code}"\n}', '{\n  "a": "// {not code}"\n}'],
];

for (const [name, source, expected] of RULES) {
  test(name, () => assert.equal(format(source), expected));
}

test("invalid JSON is rejected, not reprinted", () => {
  for (const source of ['{"a": 1,}', "{'a': 1}", '{"a": 1', '{"a": /* open']) {
    assert.throws(() => format(source), JsoncSyntaxError, source);
  }
});

test("a syntax error names the line it is on", () => {
  assert.throws(() => format('{\n  "a": 1,\n}'), /line 3/);
});

// --- finding examples --------------------------------------------------

const DOCUMENT = `<section>
  <pre class="example highlight javascript">
    {"@context": ["https://w3id.org/zcap/v1"],
     // a comment, to check that comments survive a reflow
     "id": "urn:uuid:1"}
  </pre>

  <pre class="example json" title="Already canonical">
{
  "id": "urn:uuid:2"
}
  </pre>

  <pre>urn:zcap:root:\${encodeURIComponent(invocationTarget)}</pre>

  <pre class="example http">POST / HTTP/1.1

1B
{"type":"ExampleApiAction"}
0
  </pre>
</section>`;

test("only example blocks are considered", () => {
  const examples = extractExamples(DOCUMENT);
  assert.equal(examples.length, 2, "the plain and http blocks must be skipped");
  assert.equal(examples[1].title, "Already canonical");
});

test("an example is located by line", () => {
  assert.equal(extractExamples('x\ny\n<pre class="example json">\n{}\n</pre>')[0].line, 4);
});

test("identical blocks are told apart", () => {
  const block = '<pre class="example json">\n{"a" :1}\n</pre>';
  const [first, second] = extractExamples(`${block}\n${block}`);
  assert.notEqual(first.start, second.start);
});

test("an already canonical example is left alone", () => {
  assert.equal(review(DOCUMENT)[1].status, "ok");
});

// --- fixing ------------------------------------------------------------

test("fixing makes the document pass the check", () => {
  const { html } = fix(DOCUMENT);
  assert.deepEqual(
    review(html).filter((one) => one.status !== "ok"),
    [],
  );
});

test("fixing is idempotent", () => {
  const once = fix(DOCUMENT).html;
  assert.equal(fix(once).html, once);
});

test("fixing changes nothing outside the examples", () => {
  const outside = (html) => html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/g, "<pre/>");
  assert.equal(outside(fix(DOCUMENT).html), outside(DOCUMENT));
});

test("fixing leaves the skipped blocks byte-identical", () => {
  const skipped = (html) =>
    [...html.matchAll(/<pre\b([^>]*)>[\s\S]*?<\/pre>/g)]
      .filter(([, attributes]) => !/example/.test(attributes) || /http/.test(attributes))
      .map(([block]) => block);

  assert.equal(skipped(DOCUMENT).length, 2);
  assert.deepEqual(skipped(fix(DOCUMENT).html), skipped(DOCUMENT));
});

test("an example that is not valid JSON is reported, never rewritten", () => {
  const broken = '<pre class="example json">\n{"a" :1}\n</pre>\n<pre class="example json">\n{\n  "b": 2,\n}\n</pre>';
  const { html, reviews } = fix(broken);

  assert.deepEqual(
    reviews.map((one) => one.status),
    ["misformatted", "error"],
  );
  assert.match(reviews[1].reason, /not valid JSON/);
  assert.ok(html.includes('{\n  "a": 1\n}'), "the valid example was not fixed");
  assert.ok(html.includes('{\n  "b": 2,\n}'), "the broken example was modified");
});

// --- the spec itself ---------------------------------------------------
// These skip themselves if this package is extracted from the spec
// repository, so the suite still passes standalone.

const SPEC = new URL("../../index.html", import.meta.url).pathname;
const skip = existsSync(SPEC) ? false : "index.html is not in this repository";

test("every example in the spec is canonically formatted", { skip }, () => {
  const problems = review(readFileSync(SPEC, "utf8")).filter((one) => one.status !== "ok");
  assert.deepEqual(problems.map((one) => one.example.line), []);
});

test("reprinting a spec example never changes its data or loses a comment", { skip }, () => {
  const comments = (text) => tokenize(text).filter((token) => token.type === "comment").map((token) => token.text);

  for (const { source, line } of extractExamples(readFileSync(SPEC, "utf8"))) {
    assert.deepEqual(parseJsonc(format(source)), parseJsonc(source), `data changed at line ${line}`);
    assert.deepEqual(comments(format(source)), comments(source), `comment lost at line ${line}`);
  }
});
