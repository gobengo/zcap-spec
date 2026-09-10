// files.mjs
// The filesystem layer: read a document, review it, and either report or
// rewrite. The formatting itself lives in ./examples.mjs and knows nothing
// about paths.

import { readFileSync, writeFileSync } from "node:fs";

import { reviewExamples, formatExamplesIn } from "./examples.mjs";
import { diff } from "./report.mjs";

/** `path:line`, plus the block's title when it has one. */
export function label(path, example) {
  const location = `${path}:${example.line}`;
  return example.title ? `${location} (${example.title})` : location;
}

/**
 * Report the examples in `path` that are not canonically formatted, without
 * touching the file. Returns `{ checked, failures }`, where each failure is
 * either `reason: "formatting"` with a `diff`, or a `reason` explaining why
 * the example could not be handled.
 */
export function checkFile(path, options) {
  const reviews = reviewExamples(readFileSync(path, "utf8"), options);

  const failures = reviews
    .filter((review) => review.status !== "ok")
    .map((review) =>
      review.status === "misformatted"
        ? {
            label: label(path, review.example),
            reason: "formatting",
            diff: diff(review.example.source, review.expected),
          }
        : { label: label(path, review.example), reason: review.reason },
    );

  return { checked: reviews.length, failures };
}

/**
 * Rewrite `path` with its examples reformatted. Returns `{ checked, fixed,
 * failures }`, where `fixed` is the labels of the examples that changed.
 * Writes nothing when there is nothing to change, and nothing at all if the
 * result would not pass the check afterwards.
 */
export function fixFile(path, options) {
  const { html, checked, fixed, failures } = formatExamplesIn(readFileSync(path, "utf8"), options);

  if (fixed.length > 0) {
    writeFileSync(path, html);
  }

  return {
    checked,
    fixed: fixed.map((example) => label(path, example)),
    failures: failures.map((failure) => ({
      label: label(path, failure.example),
      reason: failure.reason,
    })),
  };
}
