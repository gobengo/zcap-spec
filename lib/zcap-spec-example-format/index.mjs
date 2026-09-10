// index.mjs
// The package's public surface. See ./README.md for what it is for, and
// ./bin/zcap-spec-example-format.mjs for the command-line front end.

export { tokenize, format, parseJsonc, JsoncSyntaxError } from "./lib/jsonc.mjs";
export {
  DEFAULT_OPTIONS,
  extractExamples,
  reviewExamples,
  formatExamplesIn,
  decodeEntities,
  encodeEntities,
} from "./lib/examples.mjs";
export { checkFile, fixFile, label } from "./lib/files.mjs";
export { diff, visibleWhitespace, renderFailures } from "./lib/report.mjs";
