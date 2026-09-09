# zcap-spec Change Log

## v0.4.0-draft

Non-normative (but normative adjacent)

* Clarify that a delegation `proof` requires a `capabilityChain`.
  refer to the value of `capabilityChain` as "capability ancestors array" instead of "capability delegation chain", to avoid ambiguity with the other way the spec uses "capability chain" referring to something else
  * This is considered a reasonably non-normative change, because it seems consistent with what prior zcap-spec versions intended based on examples 1 & 7.

Non-normative

* Remove the "This Candidate Solution is incomplete" issue from `use-case/cloud-storage-delegation.md`.
  Everything it asked for is now shown: Bob delegates to Dummy Bot, Dummy Bot creates the invocation, and Dummy Bot delivers it to the invocation target in both scenarios.

* In `use-case/cloud-storage-delegation.md` Scenario 2, show two ways an invocation reaches the invocation target:
  first over an unspecified non-HTTP channel, which needs no published DID document and no `CapabilityInvocationService` at all,
  then over HTTP, where publishing a `CapabilityInvocationService` is what makes delivery explicit and interoperable.
  The invocation document is identical in both; only delivery differs.

* In `use-case/cloud-storage-delegation.md` Scenario 2, show the Cloud Storage creating its DID offline and delegating offline,
  and only publishing its identifier document to a verifiable data registry after the first delegations exist.
  The `CapabilityInvocationService` URL is chosen at publication time, not before, and Dummy Bot discovers it by resolving the DID at invocation time.
  This demonstrates that a DID `invocationTarget` lets the whole delegation chain be created without a network, a server, or a decision about where invocations will be received.

* In `use-case/cloud-storage-delegation.md` Scenario 2, the Cloud Storage identifier document advertises where to deliver invocations
  as a service of type `CapabilityInvocationService` rather than a storage-product service type.
  This names the endpoint by what it accepts (capability invocations for this `invocationTarget`) instead of by what the service stores.

* Split `use-case/cloud-storage-delegation.md` into two scenarios of the same use case.
  Scenario 1 identifies the Cloud Storage by an HTTPS URL `invocationTarget`, matching the style of the examples in the rest of the spec. It is the simpler case, so it is shown first, and its introduction says plainly that it is not consistent with the original lds-ocap scenario.
  Scenario 2 identifies the Cloud Storage by a DID `invocationTarget`, faithful to the original lds-ocap scenario where the Cloud Storage is `did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741` and independent of any storage location host.
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
