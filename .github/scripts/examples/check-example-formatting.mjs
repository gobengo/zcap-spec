#!/usr/bin/env node
// check-example-formatting.mjs
// Check -- and optionally fix -- the formatting of the JSON examples embedded
// in the spec.
//
// See <https://github.com/w3c-ccg/zcap-spec/issues/105>. The examples were
// written over several years in several different styles, which makes a
// content change to any one of them hard to review: the diff mixes the
// substance with the reflow. This script pins the style down so that never
// happens again.
//
// It reads each `<pre class="example ...">` block out of the HTML and reprints
// it with ./format-jsonc.mjs. By default it only reports what differs, so the
// formatter cannot quietly mangle an example; `--fix` writes the reprinted
// examples back into the file. Either way an example is only ever touched if
// reprinting provably preserves its data, and `--fix` re-checks the whole
// document in memory before it writes, so a formatter bug fails loudly
// instead of landing in the spec.
//
// Blocks it deliberately leaves alone:
//
//   - `<pre>` without an `example` class, which holds ID templates and other
//     non-JSON text
//   - `class="example http"`, whose body is a wire-format HTTP message: the
//     chunked example prefixes its body with a byte count, so reflowing the
//     JSON there would make the example wrong
//   - any block marked `data-example-format="ignore"`, the escape hatch for
//     an example whose layout is the point
//   - anything that is not valid JSON, which is reported rather than guessed
//     at, since reformatting cannot be safe when parsing already failed

import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format, parseJsonc, JsoncSyntaxError } from "./format-jsonc.mjs";

const DOC = `
Usage: check-example-formatting.mjs [options] [FILE...]

Check that the JSON examples embedded in FILE (default: index.html) all use
the project's canonical formatting. Prints a diff for each example that does
not match and exits 1; exits 0 when everything matches.

Options:
  -h, --help     Show this message.
      --fix      Rewrite FILE with the examples reformatted, instead of just
                 reporting them. Examples that are not valid JSON are still
                 reported and left untouched.
  -q, --quiet    Print only the summary line, not the diffs.
      --indent=N Indent examples by N spaces (default: 2), or "tab" for
                 one tab per level.
`;

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

function encodeEntities(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function attribute(tag, name) {
  const match = new RegExp(`${name}\\s*=\\s*"([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

function countLines(text) {
  let lines = 1;
  for (const char of text) {
    if (char === "\n") lines++;
  }
  return lines;
}

/**
 * Find the example blocks in an HTML document.
 *
 * Per block: `source` is the example itself, with the padding the markup puts
 * around it removed; `line` is the 1-based line where `source` starts; `start`
 * and `end` bound the whole `<pre>` body, and `leading`/`trailing` are the
 * padding to put back around a reformatted `source`, so that a rewrite changes
 * the example and nothing else about the markup.
 */
export function extractExamples(html) {
  const examples = [];

  for (const match of html.matchAll(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g)) {
    const [, attributes, body] = match;

    const className = attribute(attributes, "class") ?? "";
    const classes = className.split(/\s+/).filter(Boolean);
    if (!classes.includes("example")) continue;
    if (classes.includes("http")) continue;
    if (attribute(attributes, "data-example-format") === "ignore") continue;

    const start = match.index + match[0].indexOf(body, attributes.length);

    // The newline after `>` and the indentation in front of `</pre>` belong to
    // the HTML, not to the example. Both are normalized on the way back out:
    // one newline after the opening tag, and one newline plus the closing
    // tag's own indentation before it.
    const rawLeading = /^[ \t]*\n/.exec(body)?.[0] ?? "";
    const withoutLeading = body.slice(rawLeading.length);
    const rawTrailing = /\s+$/.exec(withoutLeading)?.[0] ?? "";
    const source = rawTrailing === "" ? withoutLeading : withoutLeading.slice(0, -rawTrailing.length);

    examples.push({
      line: countLines(html.slice(0, start + rawLeading.length)),
      title: attribute(attributes, "title"),
      source,
      start,
      end: start + body.length,
      leading: "\n",
      trailing: `\n${rawTrailing.split("\n").pop()}`,
    });
  }

  return examples;
}

/**
 * Reprint every example in `html` and say what became of it: "ok" if it was
 * already canonical, "misformatted" with the text it should have, or "error"
 * with a reason it could not be handled. Both checking and fixing read from
 * this, so the two can never disagree about what needs changing.
 */
function reviewExamples(path, html, { indent }) {
  return extractExamples(html).map((example) => {
    const location = `${path}:${example.line}`;
    const label = example.title ? `${location} (${example.title})` : location;
    const source = decodeEntities(example.source);

    try {
      const expected = format(source, { indent });

      // Guard against a bug in the printer itself: reformatting must never
      // change what the example says.
      if (JSON.stringify(parseJsonc(source)) !== JSON.stringify(parseJsonc(expected))) {
        return {
          example,
          label,
          status: "error",
          reason: "internal error: reformatting would change this example's data",
        };
      }

      const encoded = encodeEntities(expected);
      return encoded === example.source
        ? { example, label, status: "ok" }
        : { example, label, status: "misformatted", expected: encoded };
    } catch (error) {
      if (error instanceof JsoncSyntaxError) {
        return { example, label, status: "error", reason: `not valid JSON: ${error.message}` };
      }
      throw error;
    }
  });
}

/**
 * A minimal unified-style diff, so a failure report says exactly which lines
 * to change. Examples are small, so the quadratic LCS table is free.
 */
function diff(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");

  const lengths = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] =
        a[i] === b[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const output = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      output.push({ marker: " ", text: a[i] });
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      output.push({ marker: "-", text: a[i] });
      i++;
    } else {
      output.push({ marker: "+", text: b[j] });
      j++;
    }
  }
  while (i < a.length) output.push({ marker: "-", text: a[i++] });
  while (j < b.length) output.push({ marker: "+", text: b[j++] });

  return output;
}

function visibleWhitespace(text) {
  // Indentation is the whole point here, so make it visible in the report:
  // a tab-vs-spaces difference is otherwise invisible on a terminal.
  const indent = /^[ \t]*/.exec(text)[0];
  const visible = indent.replace(/ /g, "·").replace(/\t/g, "→   ");
  return visible + text.slice(indent.length);
}

/**
 * Report the examples in `path` that are not canonically formatted. Reads
 * only; see fixFile to rewrite them.
 */
export function checkFile(path, { indent }) {
  const reviews = reviewExamples(path, readFileSync(path, "utf8"), { indent });

  const failures = reviews
    .filter((review) => review.status !== "ok")
    .map((review) =>
      review.status === "misformatted"
        ? { label: review.label, reason: "formatting", diff: diff(review.example.source, review.expected) }
        : { label: review.label, reason: review.reason },
    );

  return { checked: reviews.length, failures };
}

/**
 * Rewrite `path` with its examples reformatted. Returns the labels of the
 * examples that changed, plus any that could not be handled at all -- those
 * are left exactly as they were, so a malformed example never gets a guess
 * written over it.
 *
 * Throws without writing if the result would not itself pass the check, which
 * would mean the formatter is not idempotent on this input.
 */
export function fixFile(path, { indent }) {
  const html = readFileSync(path, "utf8");
  const reviews = reviewExamples(path, html, { indent });

  const rewrites = reviews.filter((review) => review.status === "misformatted");
  const failures = reviews
    .filter((review) => review.status === "error")
    .map((review) => ({ label: review.label, reason: review.reason }));

  // Splice from the end of the document backwards, so each replacement leaves
  // the offsets of the ones before it untouched.
  let updated = html;
  for (const review of [...rewrites].reverse()) {
    const { start, end, leading, trailing } = review.example;
    updated = updated.slice(0, start) + leading + review.expected + trailing + updated.slice(end);
  }

  if (rewrites.length > 0) {
    const unresolved = reviewExamples(path, updated, { indent }).filter(
      (review) => review.status === "misformatted",
    );
    if (unresolved.length > 0) {
      throw new Error(
        `Refusing to write ${path}: ${unresolved.length} example(s) would still be ` +
          `misformatted after reformatting (${unresolved.map((r) => r.label).join(", ")}). ` +
          `This is a bug in format-jsonc.mjs, not in the document.`,
      );
    }
    writeFileSync(path, updated);
  }

  return { checked: reviews.length, fixed: rewrites.map((review) => review.label), failures };
}

function reportFailures(failures, quiet) {
  if (quiet) return;

  for (const failure of failures) {
    console.error("");
    if (failure.reason === "formatting") {
      console.error(`${failure.label}: does not match the canonical formatting`);
      for (const { marker, text } of failure.diff) {
        console.error(`  ${marker} ${visibleWhitespace(text)}`);
      }
    } else {
      console.error(`${failure.label}: ${failure.reason}`);
    }
  }

  if (failures.some((failure) => failure.reason === "formatting")) {
    console.error("");
    console.error(
      `Legend: "-" is the current text, "+" is what it should be; ` +
        `"→" marks a tab and "·" a space. Re-run with --fix to apply this.`,
    );
  }
}

function main(argv) {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(DOC.trim());
    return 0;
  }

  const quiet = argv.includes("-q") || argv.includes("--quiet");
  const fix = argv.includes("--fix");

  const indentArgument = argv.find((argument) => argument.startsWith("--indent="))?.slice(9);
  let indent = "  ";
  if (indentArgument !== undefined) {
    if (indentArgument === "tab") {
      indent = "\t";
    } else if (/^\d+$/.test(indentArgument)) {
      indent = " ".repeat(Number(indentArgument));
    } else {
      console.error(`Unrecognized --indent value: ${indentArgument}`);
      return 2;
    }
  }

  const paths = argv.filter((argument) => !argument.startsWith("-"));
  if (paths.length === 0) paths.push("index.html");

  let checked = 0;
  let failures = [];
  let fixed = [];
  for (const path of paths) {
    const result = fix ? fixFile(path, { indent }) : checkFile(path, { indent });
    checked += result.checked;
    failures = failures.concat(result.failures);
    fixed = fixed.concat(result.fixed ?? []);
  }

  if (fix) {
    if (fixed.length === 0) {
      console.log(`All ${checked} example(s) were already consistently formatted.`);
    } else {
      console.log(`Reformatted ${fixed.length} of ${checked} example(s):`);
      for (const label of fixed) console.log(`  ${label}`);
    }
  }

  if (failures.length === 0) {
    if (!fix) console.log(`All ${checked} example(s) are consistently formatted.`);
    return 0;
  }

  reportFailures(failures, quiet);

  console.error("");
  console.error(
    `${failures.length} of ${checked} example(s) need attention` +
      `${fix ? " and could not be fixed automatically" : ""}. ` +
      `See ${basename(import.meta.filename)} for the formatting rules.`,
  );
  return 1;
}

// Only run when invoked as a program; the exports above are also imported by
// the tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
