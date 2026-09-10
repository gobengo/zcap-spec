// examples.mjs
// Find the JSON examples embedded in an HTML document, and say -- or decide --
// how they should be formatted.
//
// Everything here is a pure function of a string, so the same code backs the
// checker, the fixer and the tests without any of them touching a disk. See
// ./files.mjs for the thin filesystem layer over it.

import { format, parseJsonc, JsoncSyntaxError } from "./jsonc.mjs";

export const DEFAULT_OPTIONS = {
  // Two spaces per level: what all but the oldest examples in the spec
  // already used, and so the choice that makes the smallest diff.
  indent: "  ",
  // Only `<pre>` blocks carrying this class hold examples; the rest are
  // ID templates and other non-JSON text.
  exampleClass: "example",
  // `class="example http"` is a wire-format HTTP message. The chunked example
  // prefixes its body with a byte count, so reflowing the JSON inside it would
  // make the example wrong.
  skipClasses: ["http"],
  // Per-block escape hatch, for an example whose layout is the point:
  // `<pre class="example json" data-example-format="ignore">`.
  ignoreAttribute: "data-example-format",
};

function withDefaults(options) {
  return { ...DEFAULT_OPTIONS, ...options };
}

export function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

export function encodeEntities(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function attribute(tag, name) {
  const match = new RegExp(`${name}\\s*=\\s*"([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

function countLines(text) {
  let lines = 1;
  for (const character of text) {
    if (character === "\n") lines++;
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
export function extractExamples(html, options) {
  const { exampleClass, skipClasses, ignoreAttribute } = withDefaults(options);
  const examples = [];

  for (const match of html.matchAll(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g)) {
    const [, attributes, body] = match;

    const classes = (attribute(attributes, "class") ?? "").split(/\s+/).filter(Boolean);
    if (!classes.includes(exampleClass)) continue;
    if (skipClasses.some((name) => classes.includes(name))) continue;
    if (attribute(attributes, ignoreAttribute) === "ignore") continue;

    const start = match.index + match[0].indexOf(body, attributes.length);

    // The newline after `>` and the indentation in front of `</pre>` belong to
    // the HTML, not to the example. Both are normalized on the way back out:
    // one newline after the opening tag, and one newline plus the closing
    // tag's own indentation before it.
    const rawLeading = /^[ \t]*\n/.exec(body)?.[0] ?? "";
    const withoutLeading = body.slice(rawLeading.length);
    const rawTrailing = /\s+$/.exec(withoutLeading)?.[0] ?? "";
    const source =
      rawTrailing === "" ? withoutLeading : withoutLeading.slice(0, -rawTrailing.length);

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
 * Reprint every example in `html` and say what became of it:
 *
 *   - `ok`           -- already canonical
 *   - `misformatted` -- with `expected`, the text it should have
 *   - `error`        -- with `reason`; left alone rather than guessed at
 *
 * Checking and fixing both read from this, so the two can never disagree
 * about what needs changing.
 */
export function reviewExamples(html, options) {
  const { indent, ...rest } = withDefaults(options);

  return extractExamples(html, rest).map((example) => {
    const source = decodeEntities(example.source);

    try {
      const expected = format(source, { indent });

      // Guard against a bug in the printer itself: reformatting must never
      // change what the example says.
      if (JSON.stringify(parseJsonc(source)) !== JSON.stringify(parseJsonc(expected))) {
        return {
          example,
          status: "error",
          reason: "internal error: reformatting would change this example's data",
        };
      }

      const encoded = encodeEntities(expected);
      return encoded === example.source
        ? { example, status: "ok" }
        : { example, status: "misformatted", expected: encoded };
    } catch (error) {
      if (error instanceof JsoncSyntaxError) {
        return { example, status: "error", reason: `not valid JSON: ${error.message}` };
      }
      throw error;
    }
  });
}

/**
 * Return `html` with every example reformatted, along with the examples that
 * changed and the ones that could not be handled at all -- those are left
 * exactly as they were, so a malformed example never gets a guess written
 * over it.
 *
 * Throws without returning if the result would not itself pass the check,
 * which would mean the formatter is not idempotent on this input.
 */
export function formatExamplesIn(html, options) {
  const settings = withDefaults(options);
  const reviews = reviewExamples(html, settings);

  const rewrites = reviews.filter((review) => review.status === "misformatted");
  const failures = reviews.filter((review) => review.status === "error");

  // Splice from the end of the document backwards, so each replacement leaves
  // the offsets of the ones before it untouched.
  let updated = html;
  for (const review of [...rewrites].reverse()) {
    const { start, end, leading, trailing } = review.example;
    updated = updated.slice(0, start) + leading + review.expected + trailing + updated.slice(end);
  }

  if (rewrites.length > 0) {
    const unresolved = reviewExamples(updated, settings).filter(
      (review) => review.status === "misformatted",
    );
    if (unresolved.length > 0) {
      throw new Error(
        `Refusing to rewrite: ${unresolved.length} example(s) would still be misformatted ` +
          `afterwards (at line ${unresolved.map((review) => review.example.line).join(", ")}). ` +
          `This is a bug in the formatter, not in the document.`,
      );
    }
  }

  return {
    html: updated,
    checked: reviews.length,
    fixed: rewrites.map((review) => review.example),
    failures,
  };
}
