#!/usr/bin/env node
// Check -- and with --fix, correct -- the formatting of the JSON examples
// embedded in the spec, so that a diff to an example shows what changed about
// the example rather than how it was reflowed.
//
// See <https://github.com/w3c-ccg/zcap-spec/issues/105> and ./README.md.

import { readFileSync, writeFileSync } from "node:fs";

import { format, parseJsonc, JsoncSyntaxError } from "./format-jsonc.mjs";

/**
 * The examples, in source order. `source` is the example without the padding
 * the markup puts around it; `start`/`end` bound the whole `<pre>` body, and
 * `indent` is the closing tag's own indentation, so a rewrite can put the
 * padding back and change nothing else.
 *
 * `<pre>` without an `example` class holds ID templates and other non-JSON
 * text. `class="example http"` is a wire-format HTTP message: the chunked one
 * prefixes its body with a byte count, so reflowing that JSON would make the
 * example wrong. Both are left alone.
 */
export function extractExamples(html) {
  const examples = [];

  for (const match of html.matchAll(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g)) {
    const [block, attributes, body] = match;
    const classes = (/class\s*=\s*"([^"]*)"/.exec(attributes)?.[1] ?? "").split(/\s+/);
    if (!classes.includes("example") || classes.includes("http")) continue;

    // The body ends where "</pre>" begins.
    const start = match.index + block.length - "</pre>".length - body.length;
    const [leading] = /^[ \t]*\n/.exec(body) ?? [""];
    const [trailing] = /\s+$/.exec(body.slice(leading.length)) ?? [""];

    examples.push({
      line: html.slice(0, start + leading.length).split("\n").length,
      title: /title\s*=\s*"([^"]*)"/.exec(attributes)?.[1],
      source: body.slice(leading.length, body.length - trailing.length),
      start,
      end: start + body.length,
      indent: trailing.split("\n").pop(),
    });
  }

  return examples;
}

/**
 * Reprint every example and say what became of it: `ok` if it was already
 * canonical, `misformatted` with the text it should have, or `error` with a
 * reason. Checking and fixing both read from this, so they cannot disagree.
 */
export function review(html) {
  return extractExamples(html).map((example) => {
    try {
      const expected = format(example.source);

      // Guard against a bug in the printer: reformatting must never change
      // what an example says.
      if (JSON.stringify(parseJsonc(expected)) !== JSON.stringify(parseJsonc(example.source))) {
        throw new Error("reformatting would change this example's data");
      }

      return expected === example.source
        ? { example, status: "ok" }
        : { example, status: "misformatted", expected };
    } catch (error) {
      const reason = error instanceof JsoncSyntaxError ? `not valid JSON: ${error.message}` : error.message;
      return { example, status: "error", reason };
    }
  });
}

/**
 * Return `html` with every example reformatted, plus the reviews. Examples
 * that could not be handled are left exactly as they were, so a malformed one
 * never gets a guess written over it.
 */
export function fix(html) {
  const reviews = review(html);

  // Splice from the end backwards, so each replacement leaves the offsets of
  // the ones before it untouched.
  let updated = html;
  for (const { example, status, expected } of [...reviews].reverse()) {
    if (status !== "misformatted") continue;
    updated =
      updated.slice(0, example.start) +
      `\n${expected}\n${example.indent}` +
      updated.slice(example.end);
  }

  return { html: updated, reviews };
}

function describe(path, { example, status, reason }) {
  const title = example.title ? ` (${example.title})` : "";
  return `${path}:${example.line}${title} is ${status === "error" ? reason : "not formatted canonically"}`;
}

function main([...argv]) {
  const shouldFix = argv.includes("--fix");
  const paths = argv.filter((argument) => !argument.startsWith("-"));
  if (paths.length === 0) paths.push("index.html");

  let examples = 0;
  const problems = [];

  for (const path of paths) {
    const html = readFileSync(path, "utf8");
    const { html: updated, reviews } = fix(html);
    examples += reviews.length;

    if (shouldFix && updated !== html) {
      writeFileSync(path, updated);
      for (const review of reviews.filter((one) => one.status === "misformatted")) {
        console.log(`reformatted ${path}:${review.example.line}`);
      }
    }

    for (const review of reviews) {
      const unresolved = review.status === "error" || (!shouldFix && review.status === "misformatted");
      if (unresolved) problems.push(describe(path, review));
    }
  }

  if (problems.length === 0) {
    console.log(`${examples} examples are formatted consistently.`);
    return 0;
  }

  for (const problem of problems) console.error(problem);
  console.error(
    `\n${problems.length} of ${examples} examples need attention. ` +
      (shouldFix ? "Fix the JSON by hand." : "Re-run with --fix to reformat."),
  );
  return 1;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  process.exitCode = main(process.argv.slice(2));
}
