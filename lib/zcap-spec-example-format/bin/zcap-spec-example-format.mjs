#!/usr/bin/env node
// zcap-spec-example-format
// Check -- and optionally fix -- the formatting of the JSON examples embedded
// in a spec document.

import { basename } from "node:path";

import { checkFile, fixFile } from "../lib/files.mjs";
import { renderFailures } from "../lib/report.mjs";

const DOC = `
Usage: zcap-spec-example-format [options] [FILE...]

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

Exit codes:
  0  every example is canonically formatted (or, with --fix, now is)
  1  at least one example needs attention
  2  the arguments could not be understood
`;

function parseIndent(argv) {
  const value = argv.find((argument) => argument.startsWith("--indent="))?.slice("--indent=".length);
  if (value === undefined) return {};
  if (value === "tab") return { indent: "\t" };
  if (/^\d+$/.test(value)) return { indent: " ".repeat(Number(value)) };
  return { error: `Unrecognized --indent value: ${value}` };
}

export function main(argv, { out = console.log, err = console.error } = {}) {
  if (argv.includes("-h") || argv.includes("--help")) {
    out(DOC.trim());
    return 0;
  }

  const { indent, error } = parseIndent(argv);
  if (error) {
    err(error);
    return 2;
  }

  const quiet = argv.includes("-q") || argv.includes("--quiet");
  const fix = argv.includes("--fix");

  const unknown = argv.filter(
    (argument) =>
      argument.startsWith("-") &&
      !["-h", "--help", "-q", "--quiet", "--fix"].includes(argument) &&
      !argument.startsWith("--indent="),
  );
  if (unknown.length > 0) {
    err(`Unrecognized option: ${unknown[0]}`);
    return 2;
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
      out(`All ${checked} example(s) were already consistently formatted.`);
    } else {
      out(`Reformatted ${fixed.length} of ${checked} example(s):`);
      for (const one of fixed) out(`  ${one}`);
    }
  }

  if (failures.length === 0) {
    if (!fix) out(`All ${checked} example(s) are consistently formatted.`);
    return 0;
  }

  if (!quiet) {
    for (const line of renderFailures(failures)) err(line);
  }

  err("");
  err(
    `${failures.length} of ${checked} example(s) need attention` +
      `${fix ? " and could not be fixed automatically" : ""}. ` +
      `See the README in ${basename(new URL("..", import.meta.url).pathname)} ` +
      `for the formatting rules.`,
  );
  return 1;
}

process.exitCode = main(process.argv.slice(2));
