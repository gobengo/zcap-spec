// format-jsonc.test.mjs
// Run with: node --test .github/scripts/examples/
//
// The formatter is only worth trusting if reprinting an example cannot change
// what it says, so most of these tests are round-trip properties rather than
// golden strings.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { format, parseJsonc, tokenize, JsoncSyntaxError } from "./format-jsonc.mjs";
import { extractExamples, checkFile, fixFile } from "./check-example-formatting.mjs";

const INDEX_HTML = new URL("../../../index.html", import.meta.url).pathname;

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

test("is idempotent", () => {
  const source = readFileSync(INDEX_HTML, "utf8");
  for (const example of extractExamples(source)) {
    let once;
    try {
      once = format(example.source);
    } catch (error) {
      if (error instanceof JsoncSyntaxError) continue;
      throw error;
    }
    assert.equal(format(once), once, `not idempotent: index.html:${example.line}`);
  }
});

test("never changes the data an example carries", () => {
  const source = readFileSync(INDEX_HTML, "utf8");
  let compared = 0;
  for (const example of extractExamples(source)) {
    let before;
    try {
      before = parseJsonc(example.source);
    } catch (error) {
      if (error instanceof JsoncSyntaxError) continue;
      throw error;
    }
    assert.deepEqual(parseJsonc(format(example.source)), before);
    compared++;
  }
  assert.ok(compared > 0, "no examples were compared");
});

test("never loses a comment", () => {
  const source = readFileSync(INDEX_HTML, "utf8");
  for (const example of extractExamples(source)) {
    let formatted;
    try {
      formatted = format(example.source);
    } catch (error) {
      if (error instanceof JsoncSyntaxError) continue;
      throw error;
    }
    const comments = (text) =>
      tokenize(text)
        .filter((token) => token.type.endsWith("Comment"))
        .map((token) => token.text);
    assert.deepEqual(comments(formatted), comments(example.source));
  }
});

test("rejects text that is not valid JSON", () => {
  assert.throws(() => format('{"a": 1,}'), JsoncSyntaxError, "trailing comma");
  assert.throws(() => format("{'a': 1}"), JsoncSyntaxError, "single-quoted string");
  assert.throws(() => format('{"a": 1'), JsoncSyntaxError, "unclosed object");
  assert.throws(() => format('{"a": /* unterminated'), JsoncSyntaxError, "unclosed comment");
});

test("checks only the example blocks", () => {
  const html = `
    <pre>urn:zcap:root:\${encodeURIComponent(target)}</pre>
    <pre class="example http">POST / HTTP/1.1\n\n{"a":1}</pre>
    <pre class="example json" data-example-format="ignore">{"a" :1}</pre>
    <pre class="example json">{\n  "a": 1\n}</pre>
  `;
  const examples = extractExamples(html);
  assert.equal(examples.length, 1);
  assert.equal(examples[0].source, '{\n  "a": 1\n}');
});

test("reports the line an example starts on", () => {
  const html = 'x\ny\n<pre class="example json">\n{}\n</pre>';
  assert.equal(extractExamples(html)[0].line, 4);
});

test("passes on a document whose examples are already canonical", (t) => {
  const html = readFileSync(INDEX_HTML, "utf8");
  const canonical = html.replace(
    /(<pre\b[^>]*class="[^"]*\bexample\b[^"]*"[^>]*>)([\s\S]*?)(<\/pre>)/g,
    (match, open, body, close) => {
      if (/\bhttp\b/.test(open)) return match;
      try {
        return `${open}\n${format(body)}\n${close}`;
      } catch {
        return match;
      }
    },
  );
  const directory = mkdtempSync(join(tmpdir(), "zcap-example-formatting-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "canonical.html");
  writeFileSync(path, canonical);

  const { failures } = checkFile(path, { indent: "  " });
  const formattingFailures = failures.filter((failure) => failure.reason === "formatting");
  assert.deepEqual(formattingFailures, []);
});

// --- --fix -------------------------------------------------------------

/** Copy `html` into a scratch file that the test cleans up after itself. */
function scratchFile(t, html) {
  const directory = mkdtempSync(join(tmpdir(), "zcap-example-formatting-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "index.html");
  writeFileSync(path, html);
  return path;
}

test("--fix makes the document pass the check", (t) => {
  const path = scratchFile(t, readFileSync(INDEX_HTML, "utf8"));

  const { fixed } = fixFile(path, { indent: "  " });
  assert.ok(fixed.length > 0, "nothing to fix, so this test proves nothing");

  const { failures } = checkFile(path, { indent: "  " });
  assert.deepEqual(failures, []);
});

test("--fix is idempotent", (t) => {
  const path = scratchFile(t, readFileSync(INDEX_HTML, "utf8"));

  fixFile(path, { indent: "  " });
  const afterFirst = readFileSync(path, "utf8");

  const second = fixFile(path, { indent: "  " });
  assert.deepEqual(second.fixed, []);
  assert.equal(readFileSync(path, "utf8"), afterFirst);
});

test("--fix changes nothing outside the example blocks", (t) => {
  const before = readFileSync(INDEX_HTML, "utf8");
  const path = scratchFile(t, before);
  fixFile(path, { indent: "  " });
  const after = readFileSync(path, "utf8");

  const outsideExamples = (html) => html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/g, "<pre/>");
  assert.equal(outsideExamples(after), outsideExamples(before));
});

test("--fix leaves the blocks the checker skips byte-identical", (t) => {
  const before = readFileSync(INDEX_HTML, "utf8");
  const path = scratchFile(t, before);
  fixFile(path, { indent: "  " });
  const after = readFileSync(path, "utf8");

  const skipped = (html) =>
    [...html.matchAll(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g)]
      .filter(([, attributes]) => !/\bexample\b/.test(attributes) || /\bhttp\b/.test(attributes))
      .map(([match]) => match);

  const skippedBefore = skipped(before);
  assert.ok(skippedBefore.length > 0, "no skipped blocks, so this test proves nothing");
  assert.deepEqual(skipped(after), skippedBefore);
});

test("--fix never rewrites an example that is not valid JSON", (t) => {
  const broken = '<pre class="example json">\n{"a": 1,}\n</pre>';
  const path = scratchFile(t, broken);

  const { fixed, failures } = fixFile(path, { indent: "  " });
  assert.deepEqual(fixed, []);
  assert.equal(failures.length, 1);
  assert.match(failures[0].reason, /not valid JSON/);
  assert.equal(readFileSync(path, "utf8"), broken, "the broken example was modified");
});

test("--fix keeps a valid example even when a sibling is broken", (t) => {
  const path = scratchFile(
    t,
    '<pre class="example json">\n{"a" :1}\n</pre>\n<pre class="example json">\n{"b": 2,}\n</pre>',
  );

  const { fixed, failures } = fixFile(path, { indent: "  " });
  assert.equal(fixed.length, 1);
  assert.equal(failures.length, 1);

  const after = readFileSync(path, "utf8");
  assert.ok(after.includes('{\n  "a": 1\n}'), after);
  assert.ok(after.includes('{"b": 2,}'), after);
});

test("--fix normalizes the padding around an example without moving the tags", (t) => {
  const path = scratchFile(t, '  <pre class="example json">   \n\n{"a" :1}\n\n    </pre>');
  fixFile(path, { indent: "  " });
  assert.equal(
    readFileSync(path, "utf8"),
    '  <pre class="example json">\n{\n  "a": 1\n}\n    </pre>',
  );
});
