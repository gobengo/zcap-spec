# zcap-spec-example-format

Keeps the JSON examples embedded in the ZCAP spec formatted the same way, so
that a diff to an example shows what changed about the example rather than how
it was reflowed.

Motivation and the original proposal:
[w3c-ccg/zcap-spec#105](https://github.com/w3c-ccg/zcap-spec/issues/105).

The examples in `index.html` were written over several years in several
different styles. Some use hand-aligned continuation lines (`["a",` then a
column of spaces), some close two containers on one line (`}]`), some indent by
two spaces and some by four. Editing any one of them produces a diff in which
the substance and the reflow are mixed together.

This package has no dependencies and needs no install step. It is deliberately
self-contained so it can be lifted out of this repository and published on its
own; see [Extracting this package](#extracting-this-package).

## Usage

```sh
# report every example that is not canonically formatted, and exit 1 if any is
node lib/zcap-spec-example-format/bin/zcap-spec-example-format.mjs index.html

# rewrite index.html with those examples reformatted
node lib/zcap-spec-example-format/bin/zcap-spec-example-format.mjs --fix index.html
```

Or from inside this directory, `npm run check` and `npm run fix`, which point
at `../../index.html`. `npm test` runs the suite.

```
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
```

A failure names the example by line and prints the change to make, with
indentation made visible so a tabs-versus-spaces difference is not invisible on
a terminal:

```
index.html:180: does not match the canonical formatting
    {
  - ··"@context": ["https://w3id.org/zcap/v1",
  - ···············"https://w3id.org/security/data-integrity/v2"],
  + ··"@context": [
  + ····"https://w3id.org/zcap/v1",
  + ····"https://w3id.org/security/data-integrity/v2"
  + ··],
```

`.github/workflows/check-examples.yml` runs the check on every pull request.
It never runs `--fix`: CI reports, a human applies.

## The rules

- Two spaces per level of indentation.
- `{` and `[` end their line; the matching `}` and `]` get a line of their own,
  so `}}` and `}]` never appear.
- Every object member and array element starts its own line.
- `"key": value` — no space before the colon, exactly one after.
- Empty `{}` and `[]` stay on one line.
- A comment written on its own line stays on its own line, indented with the
  member that follows it. A comment written after a value stays on that
  value's line, one space away.
- A blank line the author left between two members is kept, because it groups
  the example for the reader. Runs of blank lines collapse to one, and blank
  lines padding the inside of a `{}` or `[]` are dropped.

Two spaces rather than the tabs originally proposed in issue #105: at the time
of writing, every indented line of every example in `index.html` used spaces,
and four of the nine examples were already byte-identical to canonical
two-space output. Tabs would have rewritten all nine and required a `tab-size`
CSS rule that the document has nowhere to put, since ReSpec supplies the
stylesheet. Nothing is lost if the group prefers tabs — `--indent=tab` is
already supported, so the decision is one flag in the workflow.

## What it does not touch

- `<pre>` without an `example` class, which holds ID templates and other
  non-JSON text.
- `class="example http"`, whose body is a wire-format HTTP message. The chunked
  example prefixes its body with a byte count, so reflowing the JSON inside it
  would make the example wrong.
- Any block marked `data-example-format="ignore"`, the escape hatch for an
  example whose layout is the point.
- Anything that is not valid JSON. That is reported, never guessed at:
  reformatting cannot be safe when parsing already failed.

The examples are JSON with `//` comments, which no stock JSON formatter will
round-trip, so `lib/jsonc.mjs` is a small tokenizer and pretty-printer that
keeps comments where the author put them.

## Safety

`--fix` rewrites part of a normative document, so three properties are enforced
in code and covered by tests:

- **An example's data never changes.** Before an example is called
  misformatted, the reprinted text is parsed and compared against the original;
  a mismatch is reported as an internal error rather than a formatting nit.
- **Nothing is written unless the result is clean.** After splicing the
  rewrites in memory, the whole document is re-checked, and `--fix` throws
  without writing if anything would still be misformatted. That can only mean a
  bug in the formatter, and it fails loudly instead of landing in the spec.
- **Only example bodies move.** Everything outside `<pre>` is byte-identical
  afterwards, and so are the blocks listed above.

## API

```js
import {
  format,             // reprint one JSONC string
  parseJsonc,         // parse JSONC, ignoring comments
  extractExamples,    // find the example blocks in an HTML string
  reviewExamples,     // per example: ok | misformatted | error
  formatExamplesIn,   // return the HTML with every example reformatted
  checkFile,          // report on a file, touching nothing
  fixFile,            // rewrite a file
} from "zcap-spec-example-format";
```

Every function except `checkFile` and `fixFile` is a pure function of a string.
All of them take an options object: `indent`, `exampleClass`, `skipClasses` and
`ignoreAttribute`, defaulting to the values in `DEFAULT_OPTIONS`.

## Layout

```
index.mjs                          the public surface
lib/jsonc.mjs                      JSONC tokenizer and pretty-printer
lib/examples.mjs                   finding and reviewing examples in HTML
lib/files.mjs                      the filesystem layer: check and fix
lib/report.mjs                     diffs, and making whitespace visible
bin/zcap-spec-example-format.mjs   the command-line front end
test/                              node:test suite, no test framework needed
```

## Extracting this package

Nothing here imports anything from outside this directory, and the only
runtime dependency is Node 20 or newer. To publish it separately:

- `git subtree split -P lib/zcap-spec-example-format` gives it its own history.
- `npm test` passes standalone. The tests in `test/spec.test.mjs` are the only
  ones that read the spec document alongside it, and they skip themselves when
  it is not there, so the suite stays green outside this repository.
- `package.json` already declares `bin`, `exports` and `files`, so the CLI
  works via `npx` once published.

If it is extracted, this repository should depend on it and the workflow should
call the installed binary instead of the path in `bin/`.

## License

Apache-2.0, as a sample implementation under the repository's
[LICENSE.md](../../LICENSE.md).
