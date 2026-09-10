// format-jsonc.mjs
// A tiny, dependency-free JSONC (JSON + `//` and `/* */` comments)
// tokenizer and pretty-printer.
//
// The spec's examples are JSON with explanatory comments, so no stock JSON
// formatter can round-trip them. This module tokenizes the text and reprints
// the token stream in the canonical house style, keeping comments attached
// where the author put them.
//
// Canonical style (see <https://github.com/w3c-ccg/zcap-spec/issues/105>):
//
//   - two spaces per level of indentation, which is what all but the oldest
//     examples already used
//   - `{`/`[` end their line; the matching `}`/`]` gets a line of its own,
//     so `}}` and `}]` never appear
//   - every object member and array element starts its own line
//   - `"key": value` -- no space before the colon, exactly one after
//   - empty `{}` and `[]` stay on one line
//   - a comment written on its own line stays on its own line, indented with
//     the member that follows it; a comment written after a value stays on
//     that value's line, separated by one space
//   - a blank line the author left between two members is kept, because it
//     groups the example for the reader; runs of blank lines collapse to one,
//     and blank lines padding the inside of a `{}` or `[]` are dropped

const PUNCTUATION = new Set(["{", "}", "[", "]", ":", ","]);
const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);

export class JsoncSyntaxError extends Error {
  constructor(message, line, column) {
    super(`${message} (line ${line}, column ${column})`);
    this.name = "JsoncSyntaxError";
    this.line = line;
    this.column = column;
  }
}

/**
 * Split JSONC text into tokens.
 *
 * Each token is `{ type, text, line, endLine }`, where `type` is one of
 * "punctuation", "string", "number", "literal", "lineComment" or
 * "blockComment", `text` is the exact source text of the token, and the line
 * numbers are 1-based and relative to the start of `source`. The line numbers
 * are what let the printer tell a comment that trails a value from one that
 * was written on its own line.
 *
 * Throws JsoncSyntaxError on anything it cannot tokenize, which is the check
 * we want: an example that does not tokenize is malformed, not merely
 * misformatted.
 */
export function tokenize(source) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let column = 1;

  function advance(count) {
    for (let i = 0; i < count; i++) {
      if (source[index] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
      index++;
    }
  }

  while (index < source.length) {
    const char = source[index];

    if (WHITESPACE.has(char)) {
      advance(1);
      continue;
    }

    const startLine = line;

    if (char === "/" && source[index + 1] === "/") {
      const newline = source.indexOf("\n", index);
      const end = newline === -1 ? source.length : newline;
      // Trailing whitespace inside a comment is not meaningful, and keeping
      // it would make the formatter's output depend on invisible characters.
      const text = source.slice(index, end).trimEnd();
      advance(end - index);
      tokens.push({ type: "lineComment", text, line: startLine, endLine: startLine });
      continue;
    }

    if (char === "/" && source[index + 1] === "*") {
      const close = source.indexOf("*/", index + 2);
      if (close === -1) {
        throw new JsoncSyntaxError("Unterminated block comment", line, column);
      }
      const text = source.slice(index, close + 2);
      advance(text.length);
      tokens.push({ type: "blockComment", text, line: startLine, endLine: line });
      continue;
    }

    if (PUNCTUATION.has(char)) {
      advance(1);
      tokens.push({ type: "punctuation", text: char, line: startLine, endLine: startLine });
      continue;
    }

    if (char === '"') {
      let cursor = index + 1;
      while (cursor < source.length && source[cursor] !== '"') {
        if (source[cursor] === "\\") {
          cursor += 2;
        } else if (source[cursor] === "\n") {
          throw new JsoncSyntaxError("Unterminated string", startLine, column);
        } else {
          cursor += 1;
        }
      }
      if (cursor >= source.length) {
        throw new JsoncSyntaxError("Unterminated string", startLine, column);
      }
      const text = source.slice(index, cursor + 1);
      advance(text.length);
      tokens.push({ type: "string", text, line: startLine, endLine: startLine });
      continue;
    }

    const number = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(source.slice(index));
    if (number) {
      advance(number[0].length);
      tokens.push({ type: "number", text: number[0], line: startLine, endLine: startLine });
      continue;
    }

    const literal = /^(true|false|null)\b/.exec(source.slice(index));
    if (literal) {
      advance(literal[0].length);
      tokens.push({ type: "literal", text: literal[0], line: startLine, endLine: startLine });
      continue;
    }

    throw new JsoncSyntaxError(`Unexpected character ${JSON.stringify(char)}`, line, column);
  }

  return tokens;
}

function isComment(token) {
  return token.type === "lineComment" || token.type === "blockComment";
}

/**
 * Reprint tokenized JSONC in the canonical style. Returns a string with no
 * trailing newline.
 */
export function format(source, { indent = "  " } = {}) {
  // Validate before reprinting, so that `format` is total over valid JSONC
  // and every other input leaves by the same door: a JsoncSyntaxError naming
  // the position. Without this a trailing comma would be faithfully
  // reprinted, and the checker would call invalid JSON well formatted.
  parseJsonc(source);

  const tokens = tokenize(source);

  const lines = [];
  let current = "";
  let depth = 0;

  // True when the author left at least one blank line before `token`.
  function precededByBlankLine(token, previous) {
    return previous !== undefined && token.line - previous.endLine >= 2;
  }

  // Reproduce one such blank line, unless it would pad the inside of a
  // container -- a blank line straight after `{` or `[` is padding, not
  // grouping.
  function keepBlankLine() {
    if (current !== "" || lines.length === 0) return;
    if (/[{[]$/.test(lines[lines.length - 1])) return;
    if (lines[lines.length - 1] === "") return;
    lines.push("");
  }

  function newline() {
    if (current !== "") {
      lines.push(current.trimEnd());
      current = "";
    }
  }

  // Start a token on the current line, indenting first if the line is empty.
  function write(text) {
    if (current === "") {
      current = indent.repeat(depth);
    }
    current += text;
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const previous = tokens[i - 1];
    const next = tokens[i + 1];

    if (isComment(token)) {
      // A comment on the same source line as the token before it was written
      // as a trailing comment, so keep it trailing.
      if (previous && previous.endLine === token.line && current !== "") {
        current += ` ${token.text}`;
      } else {
        newline();
        if (precededByBlankLine(token, previous)) keepBlankLine();
        write(token.text);
      }
      newline();
      continue;
    }

    if (token.text === "{" || token.text === "[") {
      if (precededByBlankLine(token, previous)) keepBlankLine();
      const closer = token.text === "{" ? "}" : "]";
      // Keep an empty container on one line; there is nothing to indent.
      if (next && next.text === closer) {
        write(token.text + closer);
        i++;
        continue;
      }
      write(token.text);
      depth++;
      newline();
      continue;
    }

    if (token.text === "}" || token.text === "]") {
      // A blank line before a closer is padding; drop it.
      depth--;
      newline();
      write(token.text);
      continue;
    }

    if (token.text === ":") {
      current += ": ";
      continue;
    }

    if (token.text === ",") {
      current += ",";
      // Hold the line open if a trailing comment follows the comma, so that
      // `1, // note` stays intact.
      if (!(next && isComment(next) && next.line === token.line)) {
        newline();
      }
      continue;
    }

    if (precededByBlankLine(token, previous)) keepBlankLine();
    write(token.text);
  }

  newline();
  return lines.join("\n");
}

/**
 * Strip comments and parse, so callers can prove a reformat preserved the
 * data. Replacing each comment with spaces of the same length keeps every
 * later offset intact, which makes JSON.parse's error positions meaningful.
 */
export function parseJsonc(source) {
  let stripped = "";
  let cursor = 0;
  for (const token of tokenize(source)) {
    if (!isComment(token)) continue;
    const start = source.indexOf(token.text, cursor);
    stripped += source.slice(cursor, start);
    stripped += token.text.replace(/[^\n]/g, " ");
    cursor = start + token.text.length;
  }
  stripped += source.slice(cursor);

  try {
    return JSON.parse(stripped);
  } catch (error) {
    // Re-raise as our own error type so callers have one thing to catch, and
    // so the reported position refers to the example the author wrote.
    const position = /line (\d+) column (\d+)/.exec(error.message);
    throw new JsoncSyntaxError(
      error.message.replace(/ in JSON at position \d+.*$/, ""),
      position ? Number(position[1]) : 1,
      position ? Number(position[2]) : 1,
    );
  }
}
