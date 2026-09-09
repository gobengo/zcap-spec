# zcap-spec Change Log

## v0.4.0-draft

Non-normative (but normative adjacent)

* Clarify that a delegation `proof` requires a `capabilityChain`.
  refer to the value of `capabilityChain` as "capability ancestors array" instead of "capability delegation chain", to avoid ambiguity with the other way the spec uses "capability chain" referring to something else
  * This is considered a reasonably non-normative change, because it seems consistent with what prior zcap-spec versions intended based on examples 1 & 7.

Non-normative

* Add the Cloud Storage Delegation use case, from the original
  ["Linked Data Capabilities" by Webber, Miller at RWOT5](https://github.com/WebOfTrustInfo/rwot5-boston/blob/master/draft-documents/lds-ocap/lds-ocap.md)
  that inspired zcaps, as `use-case/cloud-storage-delegation.md`, included as an appendix of the specification
  and published on its own at `use-case/cloud-storage.html`.
  It works the use case through two complete scenarios, each showing every capability from the root zcap through the invocation:
  one where the `invocationTarget` is an HTTPS URL, and one where it is a DID, as in the original.
  The DID scenario shows that the whole delegation chain and the invocation can be created offline,
  with the invocation delivered either over an unspecified channel or over HTTP via a published `CapabilityInvocationService`.

* Fix examples of delegations `@context` to start with the required value `https://w3id.org/zcap/v1`.
  Previously, some values started with URLs to other contexts like `example.org`.

* add `capabilityChain` to delegation proofs in examples 3 & 4

* Fix example 1 `parentCapability` and `proof.capabilityChain` to identify the parent root capability by a URN.
  Before, the example text identified the parent capability using an HTTPS URL.
  After, example 1 conforms to the requirement that delegations identify root capabilities using a URN.
  * Pull Request: <https://github.com/w3c-ccg/zcap-spec/pull/66>

* Fix example 6 root capability `@context` value to be a string, as required. Previously it was an array.
  * Pull Request: <https://github.com/w3c-ccg/zcap-spec/pull/60>

* Fix respec warning "Document uses RFC2119 keywords but lacks a conformance section." by adding a minimal conformance section.
  * Pull Request: <https://github.com/w3c-ccg/zcap-spec/pull/59>

* Replaced all usage of RsaSignature2016 in examples with [DataIntegrityProof](https://www.w3.org/TR/vc-data-integrity/#dataintegrityproof),
  which use the property named proofValue (instead of the formerly used signatureValue) for the output of the algorithm used by the verification method.
  This makes the examples a better reflection of the kind of proofs described by the rest of the spec.

* Added contexts/zcap-v1.jsonld, a representation of the JSON-LD Context that the zcap-spec assumes is resolvable at <https://w3id.org/zcap/v1>, the location required in zcap JSON-LD `@context` property values.
