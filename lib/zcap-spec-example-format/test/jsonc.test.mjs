// jsonc.test.mjs -- the tokenizer and pretty-printer, in isolation.

import { test } from "node:test";
import assert from "node:assert/strict";

import { format, parseJsonc, tokenize, JsoncSyntaxError } from "../lib/jsonc.mjs";

test("indents by two spaces per level", () => {
  assert.equal(format('{"a":{"b":1}}'), '{\n  "a": {\n    "b": 1\n  }\n}');
});

test("indents by tabs when asked to", () => {
  assert.equal(format('{"a":{"b":1}}', { indent: "\t" }), '{\n\t"a": {\n\t\t"b": 1\n\t}\n}');
});

test("gives every closing brace its own line", () => {
  const formatted = format('{"a":{"b":{"c":1}},"d":[[1]]}');
  for (const line of formatted.split("\n")) {
    assert.ok(!/[}\]][^\n]*[}\]]/.test(line), `two closers on one line: ${line}`);
  }
});

test("breaks arrays onto one element per line", () => {
  assert.equal(format('{"a":[1,2]}'), '{\n  "a": [\n    1,\n    2\n  ]\n}');
});

test("keeps empty containers on one line", () => {
  assert.equal(format('{"a":{},"b":[]}'), '{\n  "a": {},\n  "b": []\n}');
});

test("puts exactly one space after a colon", () => {
  assert.equal(format('{"a"   :    1}'), '{\n  "a": 1\n}');
});

test("keeps a comment that was on its own line on its own line", () => {
  assert.equal(format('{\n// why\n"a": 1}'), '{\n  // why\n  "a": 1\n}');
});

test("keeps a comment that trailed a value trailing", () => {
  assert.equal(format('{"a": 1 // why\n}'), '{\n  "a": 1 // why\n}');
});

test("keeps a comment that trailed a comma trailing", () => {
  assert.equal(format('{"a": 1, // why\n"b": 2}'), '{\n  "a": 1, // why\n  "b": 2\n}');
});

test("keeps one blank line where the author grouped members", () => {
  assert.equal(format('{"a": 1,\n\n\n"b": 2}'), '{\n  "a": 1,\n\n  "b": 2\n}');
});

test("drops blank lines that only pad a container", () => {
  assert.equal(format('{\n\n"a": 1\n\n}'), '{\n  "a": 1\n}');
});

test("leaves strings alone, including ones that look like syntax", () => {
  const source = '{\n  "a": "a // comment, \\"quoted\\", {braced}"\n}';
  assert.equal(format(source), source);
});

test("rejects text that is not valid JSON", () => {
  assert.throws(() => format('{"a": 1,}'), JsoncSyntaxError, "trailing comma");
  assert.throws(() => format("{'a': 1}"), JsoncSyntaxError, "single-quoted string");
  assert.throws(() => format('{"a": 1'), JsoncSyntaxError, "unclosed object");
  assert.throws(() => format('{"a": /* unterminated'), JsoncSyntaxError, "unclosed comment");
});

test("parseJsonc ignores comments but keeps the data", () => {
  assert.deepEqual(parseJsonc('{\n// note\n"a": [1, 2] // more\n}'), { a: [1, 2] });
});

test("tokenize records the line each token came from", () => {
  const tokens = tokenize('{\n"a": 1 // why\n}');
  const comment = tokens.find((token) => token.type === "lineComment");
  assert.equal(comment.line, 2, "the comment shares a line with the value it follows");
});
