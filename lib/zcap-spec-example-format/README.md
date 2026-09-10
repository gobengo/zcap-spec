# zcap-spec-example-format

Keeps the JSON examples embedded in `index.html` formatted the same way, so
that a diff to an example shows what changed about the example rather than how
it was reflowed. See
[w3c-ccg/zcap-spec#105](https://github.com/w3c-ccg/zcap-spec/issues/105).

No dependencies and no install step: three files, run with `node`.

## Usage

```sh
node lib/zcap-spec-example-format/check-examples.mjs index.html          # report
node lib/zcap-spec-example-format/check-examples.mjs --fix index.html    # rewrite
```

Exits 0 when every example is canonical, 1 when any needs attention.
`.github/workflows/check-examples.yml` runs the check on every pull request; it
never runs `--fix`, so CI reports and a human applies.

## The rules

- Two spaces per level of indentation.
- `{` and `[` end their line; the matching `}` and `]` get a line of their own,
  so `}}` and `}]` never appear.
- Every object member and array element starts its own line.
- `"key": value` — no space before the colon, exactly one after.
- Empty `{}` and `[]` stay on one line.
- A comment stays where it was written: on its own line, or trailing the value
  it followed.
- One blank line survives where the author grouped members; blank lines that
  only pad the inside of a container are dropped.

Two spaces rather than the tabs proposed in the issue: every indented line of
every example already used spaces, and four of the nine were already identical
to canonical two-space output, so this was the smaller diff. Tabs would also
need a `tab-size` rule, and ReSpec supplies the stylesheet. To switch, change
`INDENT` in `format-jsonc.mjs`.

## What it does not touch

- `<pre>` without an `example` class, which holds ID templates and other
  non-JSON text.
- `class="example http"`, a wire-format HTTP message — the chunked one prefixes
  its body with a byte count, so reflowing that JSON would make it wrong.
- Anything that is not valid JSON. That is reported, never guessed at: it is
  how the trailing comma in the invocation example came to light.

The examples are JSON with `//` comments, which no stock JSON formatter will
round-trip, so `format-jsonc.mjs` is a small tokenizer and printer that keeps
comments where the author put them. Before an example is called misformatted,
the reprinted text is parsed and compared against the original, so a bug in the
printer cannot silently change what an example says.

## Files

```
format-jsonc.mjs    JSONC tokenizer and pretty-printer
check-examples.mjs  finds the examples in the HTML; checks or rewrites them
test.mjs            node:test suite, no framework needed
```

Nothing here imports anything outside this directory, so it can be lifted out
and published on its own. The tests that read `../../index.html` skip
themselves when it is not there, so the suite stays green standalone.
