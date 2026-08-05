# zcap-spec-json-schema

JSON Schema for Authorization Capabilities

## zcap-spec JSON Schema

zcap-spec defines how to represent zcaps using JSON.
zcap-spec.schema.json has informative JSON Schemas that match the requirements in zcap-spec.

Run `./validate.ts` to validate `../examples/*.zcap.json` using the JSON Schema.
When file paths are passed as positional args, `validate.ts` will validate only those files, e.g. `./validate.ts ../examples/*.zcap.json`.
