# zcap-spec Change Log

## v0.4.0-draft

Non-normative (but normative adjacent)

* Clarify that a delegation `proof` requires a `capabilityChain`.
  refer to the value of `capabilityChain` as "capability ancestors array" instead of "capability delegation chain", to avoid ambiguity with the other way the spec uses "capability chain" referring to something else
  * This is considered a reasonably non-normative change, because it seems consistent with what prior zcap-spec versions intended based on examples 1 & 7.

Non-normative

* In `use-case/cloud-storage-delegation.md` Scenario 1, the Cloud Storage identifier document advertises where to deliver invocations
  as a service of type `CapabilityInvocationService` rather than a storage-product service type.
  This names the endpoint by what it accepts (capability invocations for this `invocationTarget`) instead of by what the service stores.

* Split `use-case/cloud-storage-delegation.md` into two scenarios of the same use case.
  Scenario 1 identifies the Cloud Storage by a DID `invocationTarget`, faithful to the original lds-ocap scenario where the Cloud Storage is `did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741` and independent of any storage location host.
  Scenario 2 identifies the Cloud Storage by an HTTPS URL `invocationTarget`, matching the style of the examples in the rest of the spec.
  Each scenario uses its own zcap identifiers, and each shows the whole chain from root zcap through invocation.

* Fix `use-case/cloud-storage-delegation.md` Cloud Storage identifier document so its `id` matches the identifier that resolves to it and the `controller` of its verification methods.
  Previously the document `id` was a DID while the invocation target and verification method controller were an HTTPS URL.

* Add `proof.capabilityChain` to every delegation example in `use-case/cloud-storage-delegation.md`,
  so each delegated zcap has a capability ancestors array whose first entry is the root zcap ID,
  whose intermediate entries are ancestor delegations by ID, and whose last entry is the fully embedded parent delegation.
  The invoked zcap embedded in the invocation proof's `capability` carries its chain too.

* Fix `use-case/cloud-storage-delegation.md` Cloud Storage identifier document example, which was not valid JSON (trailing comma after `service`).

* Fix `use-case/cloud-storage-delegation.md` Alice capability `id`, which was not a valid `urn:uuid:` URN.

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
