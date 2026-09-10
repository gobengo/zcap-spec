// A tiny JSONC (JSON + `//` and `/* */` comments) pretty-printer.
//
// The spec's examples are JSON with explanatory comments, so no stock JSON
// formatter can round-trip them. This tokenizes the text and reprints the
// token stream, which keeps comments where the author put them.
//
// The style, per <https://github.com/w3c-ccg/zcap-spec/issues/105>:
//
//   - two spaces per level of indentation
//   - `{`/`[` end their line; the matching `}`/`]` gets a line of its own,
//     so `}}` and `}]` never appear
//   - every object member and array element starts its own line
//   - `"key": value` -- no space before the colon, exactly one after
//   - empty `{}` and `[]` stay on one line
//   - a comment stays where it was written: on its own line, or trailing the
//     value it followed
//   - one blank line survives where the author grouped members; blank lines
//     padding the inside of a container are dropped

export const INDENT = "  ";

export class JsoncSyntaxError extends Error {
  constructor(message, line) {
    super(`${message} (line ${line})`);
    this.name = "JsoncSyntaxError";
    this.line = line;
  }
}

const PUNCTUATION = new Set(["{", "}", "[", "]", ":", ","]);

/**
 * Split JSONC into tokens: `{ type, text, start, line, newlinesBefore }`.
 * `newlinesBefore` is what lets the printer tell a comment that trails a
 * value from one on its own line, and spot a deliberate blank line.
 */
export function tokenize(source) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let newlines = 0;

  while (index < source.length) {
    const rest = source.slice(index);
    const character = source[index];

    if (/\s/.test(character)) {
      if (character === "\n") {
        line++;
        newlines++;
      }
      index++;
      continue;
    }

    let text;
    let type;

    if (rest.startsWith("//")) {
      type = "comment";
      text = (rest.match(/^[^\n]*/) ?? [""])[0].trimEnd();
    } else if (rest.startsWith("/*")) {
      type = "comment";
      const end = source.indexOf("*/", index + 2);
      if (end === -1) throw new JsoncSyntaxError("Unterminated block comment", line);
      text = source.slice(index, end + 2);
    } else if (PUNCTUATION.has(character)) {
      type = "punctuation";
      text = character;
    } else if (character === '"') {
      type = "value";
      text = (rest.match(/^"(?:[^"\\\n]|\\.)*"/) ?? [])[0];
      if (text === undefined) throw new JsoncSyntaxError("Unterminated string", line);
    } else {
      type = "value";
      text = (rest.match(/^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/) ?? [])[0];
      if (text === undefined) {
        throw new JsoncSyntaxError(`Unexpected character ${JSON.stringify(character)}`, line);
      }
    }

    tokens.push({ type, text, start: index, line, newlinesBefore: newlines });
    index += text.length;
    line += (text.match(/\n/g) ?? []).length;
    newlines = 0;
  }

  return tokens;
}

/**
 * Parse JSONC, ignoring comments. Comments are blanked out rather than cut so
 * that every later position is unchanged, which keeps JSON.parse's reported
 * line meaningful.
 */
export function parseJsonc(source) {
  let stripped = source;
  for (const token of tokenize(source)) {
    if (token.type !== "comment") continue;
    const blank = token.text.replace(/[^\n]/g, " ");
    stripped = stripped.slice(0, token.start) + blank + stripped.slice(token.start + blank.length);
  }

  try {
    return JSON.parse(stripped);
  } catch (error) {
    const line = /line (\d+)/.exec(error.message)?.[1] ?? "?";
    throw new JsoncSyntaxError(error.message.replace(/ in JSON at position \d+.*$/, ""), line);
  }
}

/** Reprint JSONC in the canonical style. Throws on anything invalid. */
export function format(source, indent = INDENT) {
  // Validate first, so that every invalid input leaves by the same door
  // instead of a trailing comma being faithfully reprinted.
  parseJsonc(source);

  const lines = [];
  let current = "";
  let depth = 0;

  const newline = () => {
    if (current !== "") lines.push(current.trimEnd());
    current = "";
  };

  // Start a token, indenting first if the line is empty, and reproducing a
  // blank line the author left -- unless it would only pad a container.
  const write = (token, text) => {
    if (current === "") {
      const last = lines.at(-1);
      if (token.newlinesBefore >= 2 && last !== undefined && last !== "" && !/[{[]$/.test(last)) {
        lines.push("");
      }
      current = indent.repeat(depth);
    }
    current += text;
  };

  const tokens = tokenize(source);

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const next = tokens[index + 1];

    if (token.type === "comment") {
      if (token.newlinesBefore === 0 && current !== "") current += ` ${token.text}`;
      else write(token, token.text);
      newline();
    } else if (token.text === "{" || token.text === "[") {
      // An empty container has nothing to indent, so keep it on one line.
      if (next?.text === (token.text === "{" ? "}" : "]")) {
        write(token, token.text + next.text);
        index++;
      } else {
        write(token, token.text);
        depth++;
        newline();
      }
    } else if (token.text === "}" || token.text === "]") {
      depth--;
      newline();
      // A blank line in front of a closer is padding, so it is not carried
      // over the way a blank line between members is.
      write({ ...token, newlinesBefore: 0 }, token.text);
    } else if (token.text === ":") {
      current += ": ";
    } else if (token.text === ",") {
      current += ",";
      // Hold the line open for a comment that trailed the comma.
      if (!(next?.type === "comment" && next.newlinesBefore === 0)) newline();
    } else {
      write(token, token.text);
    }
  }

  newline();
  return lines.join("\n");
}
