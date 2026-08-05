#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { Validator } from '@cfworker/json-schema';
import type { Schema, SchemaDraft, OutputUnit } from '@cfworker/json-schema';
import stripJsonComments from 'strip-json-comments';
import { fileURLToPath } from 'url';

const HELP_TEXT = `zcap example validator

Validates one or more zcap JSON documents against a JSON Schema.

Usage:
  ./scripts/examples/validate.ts [options] [file...]
  node scripts/examples/validate.ts [options] [file...]

If one or more bare file arguments are given (e.g. via shell globbing —
"./scripts/examples/validate.ts examples/*.zcap.json"), exactly those
files are validated and --input-dir/--input-path-suffix are ignored.
Otherwise, --input-dir is scanned for files ending in --input-path-suffix.

Options:
  -i, --input-dir <dir>       Directory to scan for input files, used only
                              when no file arguments are given.
                              (default: "./examples/")
      --input-path-suffix <s> Only validate entries in --input-dir whose
                              filename ends with this suffix.
                              (default: ".zcap.json")
  -s, --schema <path>         Path to the JSON Schema to validate against.
                              (default: "./zcap-spec.schema.json")
  -q, --quiet                 Only print a final summary line and any errors.
  -v, --verbose                Print the matched-file list and, on failure,
                              every JSON Schema error detail (not just the
                              innermost one).
      --no-color              Disable colored output.
  -h, --help                  Show this help text and exit.

Exit codes:
  0  every matched file validated successfully (or no files matched)
  1  one or more files failed validation
  2  usage error, or the schema/input dir/a given file could not be read

Examples:
  ./scripts/examples/validate.ts
  ./scripts/examples/validate.ts examples/*.zcap.json
  ./scripts/examples/validate.ts --input-dir ./fixtures --input-path-suffix .json
  ./scripts/examples/validate.ts -s ./my-schema.json -i ./fixtures
`;

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const INPUT_DIR_DEFAULT = fileURLToPath(new URL('../examples/', import.meta.url));
const SCHEMA_PATH_DEFUALT = fileURLToPath(new URL('./zcap-spec.schema.json', import.meta.url));

interface CliOptions {
  inputDir: string;
  inputPathSuffix: string;
  schema: string;
  files: string[];
  quiet: boolean;
  verbose: boolean;
  color: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    inputDir: INPUT_DIR_DEFAULT,
    inputPathSuffix: '.zcap.json',
    schema: SCHEMA_PATH_DEFUALT,
    files: [],
    quiet: false,
    verbose: false,
    color: process.stdout.isTTY === true,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-q':
      case '--quiet':
        options.quiet = true;
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '--no-color':
        options.color = false;
        break;
      case '-i':
      case '--input-dir':
        options.inputDir = requireValue(argv, ++i, arg);
        break;
      case '--input-path-suffix':
        options.inputPathSuffix = requireValue(argv, ++i, arg);
        break;
      case '-s':
      case '--schema':
        options.schema = requireValue(argv, ++i, arg);
        break;
      default:
        if (arg.startsWith('--input-dir=')) {
          options.inputDir = arg.slice('--input-dir='.length);
        } else if (arg.startsWith('--input-path-suffix=')) {
          options.inputPathSuffix = arg.slice('--input-path-suffix='.length);
        } else if (arg.startsWith('--schema=')) {
          options.schema = arg.slice('--schema='.length);
        } else if (arg.startsWith('-') && arg !== '-') {
          usageError(`Unrecognized argument: ${arg}`);
        } else {
          // A bare (non-flag) argument is a file path — this is what lets
          // shell globbing work, e.g.:
          //   ./scripts/examples/validate.ts examples/*.zcap.json
          options.files.push(arg);
        }
    }
  }

  return options;
}

function requireValue(argv: string[], index: number, flagName: string): string {
  const value = argv[index];
  if (value === undefined) {
    usageError(`Missing value for ${flagName}`);
  }
  return value as string;
}

function usageError(message: string): never {
  process.stderr.write(`error: ${message}\n\n`);
  process.stderr.write(HELP_TEXT);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Input file discovery — plain directory listing filtered by filename
// suffix. No glob engine needed since --input-dir only ever looks one
// level deep.
// ---------------------------------------------------------------------------

function findInputFiles(inputDir: string, suffix: string): string[] {
  const entries = fs.readdirSync(inputDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => path.join(inputDir, entry.name))
    .sort();
}

// ---------------------------------------------------------------------------
// JSON-with-comments reading — both the schema and every input file are
// allowed to contain // line comments and /* block */ comments.
// ---------------------------------------------------------------------------

function readJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(stripJsonComments(raw));
}

// ---------------------------------------------------------------------------
// Schema draft detection — @cfworker/json-schema needs to be told which
// JSON Schema draft a document is written against; it doesn't sniff
// $schema itself. Fall back to 2020-12, which is what
// ./zcap-spec.schema.json is written against.
// ---------------------------------------------------------------------------

const SCHEMA_DRAFT_BY_URI: Record<string, SchemaDraft> = {
  'https://json-schema.org/draft/2020-12/schema': '2020-12',
  'https://json-schema.org/draft/2019-09/schema': '2019-09',
  'http://json-schema.org/draft-07/schema#': '7',
  'http://json-schema.org/draft-04/schema#': '4',
};

function detectDraft(schema: Schema): SchemaDraft {
  const schemaUri = schema.$schema;
  return (schemaUri && SCHEMA_DRAFT_BY_URI[schemaUri]) || '2020-12';
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function colorize(useColor: boolean, code: string, text: string): string {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(HELP_TEXT);
    process.exit(0);
  }

  const cwd = process.cwd();
  const schemaPath = path.resolve(cwd, options.schema);

  let schema: Schema;
  try {
    schema = readJsonFile(schemaPath) as Schema;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: could not read/parse schema "${options.schema}": ${message}\n`);
    process.exit(2);
  }

  const validator = new Validator(schema, detectDraft(schema), false);

  let files: string[];
  if (options.files.length > 0) {
    // Bare file arguments were given (typically shell-expanded, e.g.
    // `examples/*.zcap.json`) — validate exactly those, in the order given.
    files = options.files;
    for (const file of files) {
      if (!fs.existsSync(path.resolve(cwd, file))) {
        process.stderr.write(`error: file not found: ${file}\n`);
        process.exit(2);
      }
    }
  } else {
    const inputDirPath = path.resolve(cwd, options.inputDir);
    try {
      files = findInputFiles(inputDirPath, options.inputPathSuffix).map((f) => path.relative(cwd, f) || f);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`error: could not read input dir "${options.inputDir}": ${message}\n`);
      process.exit(2);
      return;
    }

    if (files.length === 0) {
      process.stdout.write(
        `No files ending in "${options.inputPathSuffix}" found in "${options.inputDir}". Nothing to validate.\n`,
      );
      process.exit(0);
    }
  }

  if (options.verbose) {
    process.stdout.write(`Schema: ${options.schema}\n`);
    process.stdout.write(`Matched ${files.length} file(s):\n`);
    for (const f of files) process.stdout.write(`  - ${f}\n`);
    process.stdout.write('\n');
  }

  let failureCount = 0;

  for (const file of files) {
    const absPath = path.resolve(cwd, file);
    let data: unknown;
    try {
      data = readJsonFile(absPath);
    } catch (err) {
      failureCount++;
      const message = err instanceof Error ? err.message : String(err);
      process.stdout.write(`${colorize(options.color, '31', '✗')} ${file} — invalid JSON: ${message}\n`);
      continue;
    }

    const result = validator.validate(data);
    if (result.valid) {
      if (!options.quiet) {
        process.stdout.write(`${colorize(options.color, '32', '✓')} ${file}\n`);
      }
    } else {
      failureCount++;
      process.stdout.write(`${colorize(options.color, '31', '✗')} ${file}\n`);
      // In non-verbose mode, skip the generic "does not match every
      // subschema" / "does not match then schema" wrapper errors and show
      // only the concrete, actionable ones (e.g. a specific missing
      // required property or a format mismatch).
      const errors: OutputUnit[] = options.verbose
        ? result.errors
        : result.errors.filter((e) => e.keyword !== 'allOf' && e.keyword !== 'if');
      for (const error of errors) {
        const where = error.instanceLocation === '#' ? '(root)' : error.instanceLocation.replace(/^#/, '');
        process.stdout.write(`    ${where}: ${error.error}\n`);
      }
    }
  }

  const passCount = files.length - failureCount;
  process.stdout.write(
    `\n${passCount}/${files.length} file(s) valid` + (failureCount > 0 ? `, ${failureCount} failed` : '') + '\n',
  );

  process.exit(failureCount > 0 ? 1 : 0);
}

main();
