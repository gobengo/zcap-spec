// report.mjs
// Turning a failed check into something a human can act on.

/**
 * A minimal unified-style diff, so a failure report says exactly which lines
 * to change. Examples are small, so the quadratic LCS table is free.
 */
export function diff(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");

  const lengths = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] =
        a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
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

/**
 * Make indentation visible. A tab-versus-spaces difference is otherwise
 * invisible on a terminal, which is a poor way to read a report about
 * indentation.
 */
export function visibleWhitespace(text) {
  const indent = /^[ \t]*/.exec(text)[0];
  const visible = indent.replace(/ /g, "·").replace(/\t/g, "→   ");
  return visible + text.slice(indent.length);
}

/** Render failures as lines of text, ready to print. */
export function renderFailures(failures) {
  const lines = [];

  for (const failure of failures) {
    lines.push("");
    if (failure.reason === "formatting") {
      lines.push(`${failure.label}: does not match the canonical formatting`);
      for (const { marker, text } of failure.diff) {
        lines.push(`  ${marker} ${visibleWhitespace(text)}`);
      }
    } else {
      lines.push(`${failure.label}: ${failure.reason}`);
    }
  }

  if (failures.some((failure) => failure.reason === "formatting")) {
    lines.push("");
    lines.push(
      `Legend: "-" is the current text, "+" is what it should be; ` +
        `"→" marks a tab and "·" a space. Re-run with --fix to apply this.`,
    );
  }

  return lines;
}
