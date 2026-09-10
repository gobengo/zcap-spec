# Use Case: Cloud Storage Delegation

This use case originated in ["Linked Data Capabilities" by Webber, Miller at RWOT5](https://github.com/WebOfTrustInfo/rwot5-boston/blob/master/draft-documents/lds-ocap/lds-ocap.md).

> Alice (A) has a direct capability to store files in a "Cloud Storage"
> system (C).  She would like to share this capability with Bob (B), but she
> is wary of Bob's fondness of storing high-resolution video, so she
> would like to add a constraint that he may only upload files that are
> no larger than 50 megabytes at a time.  Bob is excited to take
> advantage of this service because he has recently been playing with
> Dummy Bot (D), which automatically uploads some photos now and then.
> But Bob has heard mixed reviews of Dummy Bot and is worried that maybe
> Dummy Bot will malfunction.  He has decided that a 30-day window is
> a sufficient trial period for permitting Dummy Bot to upload to the
> storage system, so that he can determine whether to renew at some future
> date.
>
> The initial condition looks like this:
>
> ```
>     .-.       .-.       .-.
>    ( A )---->( B )---->( D )
>     '-'       '-'       '-'
>       \
>        \
>         \
>          \    .-.
>           '->( C )
>               '-'
>```
>
> (A)lice has a capability to the (C)loud storage system through which
> she can upload files.
> (A)lice also has a capability to send a message to (B)ob, and (B)ob
> has a capability to send a message to (D)ummy Bot.

## Cloud Storage Scenario 1: HTTP URL `invocationTarget`

This scenario illustrates one way of realizing the Cloud Storage Delegation use case.

In this scenario, the zcap `invocationTarget` is the HTTPS URL of the Cloud Storage.
This is closer to the examples in the latest zcap-spec, whose `invocationTarget` values are HTTP URLs, and it is the simpler of the two scenarios here, so it is presented first.

It is, however, **not** consistent with the [original lds-ocap scenario][lds-ocap] that inspired zcaps, in which every party, including the Cloud Storage, is identified by a DID.
Identifying the Cloud Storage by the URL of a host has consequences that this scenario cannot avoid:
* the Cloud Storage is bound to whichever host serves that URL, and moving hosts invalidates the root capability and every delegation rooted in it
* the URL must exist and be decided before the root capability can be written at all, so no part of the chain can be delegated before that decision is made

[Cloud Storage Scenario 2](#cloud-storage-scenario-2-did-invocationtarget) shows the same use case with a DID `invocationTarget`, as in the original, and shows what that buys.

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor A as Alice (did:key:alice)
    actor B as Bob (did:key:bob)
    participant D as Dummy Bot (did:key:dummy)
    participant C as Cloud Storage (https://example.com/storage)

    Note over C: Out-of-band setup<br/>root zcap urn:zcap:root:...%2Fstorage<br/>invocationTarget https://example.com/storage<br/>controller did:key:alice

    C->>A: capabilityDelegation urn:uuid:3f1a5c02...<br/>parentCapability = root zcap<br/>controller did:key:alice<br/>proof by storage key-20240828
    Note over A: Alice holds a direct capability<br/>to upload files

    A->>B: capabilityDelegation urn:uuid:6c9d4b18...<br/>parentCapability = Alice's zcap<br/>controller did:key:bob<br/>allowedAction UploadFile<br/>caveat RestrictUploadSize limit 52428800<br/>proof by did:key:alice
    Note over B: Bob may upload, but only<br/>files up to 50 MB

    B->>D: capabilityDelegation urn:uuid:9a2e7f60...<br/>parentCapability = Bob's zcap<br/>controller did:key:dummy<br/>allowedAction UploadFile<br/>expires 2026-01-31 (30-day trial)<br/>proof by did:key:bob
    Note over D: Dummy Bot may upload<br/>for 30 days, still under<br/>Bob's 50 MB caveat

    D->>C: POST invocation urn:uuid:c47b0d3e... to invocationTarget<br/>file + proof (capabilityInvocation)<br/>capabilityAction UploadFile<br/>capability = Dummy Bot's zcap

    C->>C: Verify invocation proof (did:key:dummy)
    C->>C: Verify delegation chain up to root zcap
    C->>C: Check allowedAction, expires, and caveats<br/>(file at most 50 MB)

    alt chain and caveats satisfied
        C-->>D: 201 Created (file stored)
    else expired, oversized, or unauthorized action
        C-->>D: 403 Forbidden
    end
```

### Cloud Storage Setup

The Cloud Storage system needs to be set up in order to provision capabilities that satisfy the use case.

The Cloud Storage system must choose an identifier that identifies the storage system itself.
Here, we'll use `https://example.com/storage` as the storage system identifier.

The Cloud Storage system must support an action that enables uploading a file.
This action must have a unique identifier.
In this example, we'll use `https://example.com/storage/method/UploadFile`.
This action must support a caveat that limits the size of files uploaded using the action.
In this example, we'll use `https://example.com/storage/caveat/RestrictUploadSize`.

Let's assume Alice's actor is identified by `did:key:alice`.
The Cloud Storage system is configured out-of-band to authorize Alice's identifier as a controller.

### Cloud Storage Root Capability

The Cloud Storage will verify capability invocations whose `capabilityChain` is rooted in the cloud storage's root capability `urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage`.
Because the Cloud Storage `https://example.com/storage` has been configured out-of-band to consider Alice's identifier as an authorized controller, the cloud storage's verifier will dereference this root capability identifier to the root capability object
```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
	"invocationTarget": "https://example.com/storage",
	"controller": "did:key:alice"
}	
```

#### Note: Root Capability with DID `invocationTarget`

In the [original lds-ocap scenario][lds-ocap], the Cloud Storage is identified by a DID `did:example:3f1a5c02-f9f4-4c1e-b76c-d821a4b32741`.
[Cloud Storage Scenario 2](#cloud-storage-scenario-2-did-invocationtarget) shows how the root capability and the rest of the chain look in that case.

### Cloud Storage Identifier Document

The Cloud Storage identifier `https://example.com/storage` resolves
to a [Controlled Identifier Document][] where
* the `id` is the same HTTPS URL that is the `invocationTarget`
	* when the `id` is an HTTPS URL, the Cloud Storage is bound to the host that serves that URL.
	  See [Cloud Storage Scenario 2](#cloud-storage-scenario-2-did-invocationtarget) for the variation where the `id` is a DID and the Cloud Storage is independent of any storage location host.
* the `capabilityDelegation` property authorizes verification methods that may create capability delegations (e.g. to Alice)

```json
{
	"@context": "https://www.w3.org/ns/cid/v1",
	"name": "Cloud Storage",
	"id": "https://example.com/storage",
	"capabilityDelegation": [
		{
			"id": "https://example.com/storage#key-20240828",
			"type": "JsonWebKey",
			"controller": "https://example.com/storage",
			"publicKeyJwk": {
				"kid": "key-20240828",
				"kty": "EC",
				"crv": "P-256",
				"alg": "ES256",
				"x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
				"y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
			}
		}
	],
	"capabilityInvocation": []
}
```

Questions
* Does this need a `capabilityInvocation` verification relationship? Eventually Dummy Bot invokes signing with its key + a capabilityChain delegating authority to it. Is it additionally required that the 

### Alice's Capability

The use case says:

> Alice (A) has a direct capability to store files in a "Cloud Storage"
> system (C).

Alice's capability to store files in the Cloud Storage is represented as a capability delegation where
* `parentCapability` is the URN of the root zcap of the cloud storage invocation target
* `proof` contains a proof of `capabilityDelegation` proven by an authorized verification method from the Cloud Storage identifier document.
* `proof.capabilityChain` is the capability ancestors array.
  Because this delegation's parent is the root zcap, the array has exactly one entry: the root zcap identified by ID (never embedded).

```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:uuid:3f1a5c02-9b34-4a7e-8f21-6d0c7b5e4a11",
	"parentCapability": "urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
	"controller": "did:key:alice",
	"expires": "2027-01-01T00:00:00Z",
	"proof": [
		{
			"type": "DataIntegrityProof",
			"cryptosuite": "eddsa-jcs-2022",
			"created": "2026-01-01T00:00:00Z",
			"verificationMethod": "https://example.com/storage#key-20240828",
			"proofPurpose": "capabilityDelegation",
			"capabilityChain": [
				"urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage"
			],
			"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
		}
	]
}
```

### Alice Delegates to Bob

Alice represents this delegation to Bob as a capability delegation where
* `parentCapability` is the URN of Alice's capability that is being delegated here
* `controller` is a URI controlled by Bob
* `allowedAction` includes the URI of the `UploadFile` method supported by Cloud Storage
* `caveat` includes a caveat supported by the Cloud Storage that limits each UploadFile invocation to 52428800 bytes (50 MB)
* `proof` includes a proof of `capabilityDelegation` proven by the verificationMethod for `did:key:alice`
* `proof.capabilityChain` is the capability ancestors array whose first entry is the root zcap ID and whose last entry is the fully embedded parent capability (Alice's capability)

```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:uuid:6c9d4b18-2e57-4c3a-9a86-1f0e2d7c8b34",
	"parentCapability": "urn:uuid:3f1a5c02-9b34-4a7e-8f21-6d0c7b5e4a11",
	"controller": "did:key:bob",
	"expires": "2027-01-01T00:00:00Z",
	"allowedAction": [
		"https://example.com/storage/method/UploadFile"
	],
	"caveat": [
		{
			"id": "#caveat/RestrictUploadSize-50M",
			"type": "https://example.com/storage/caveat/RestrictUploadSize",
			"limit": 52428800
		}
	],
	"proof": [
		{
			"type": "DataIntegrityProof",
			"cryptosuite": "eddsa-jcs-2022",
			"created": "2026-01-01T00:00:00Z",
			"verificationMethod": "did:key:alice#alice",
			"proofPurpose": "capabilityDelegation",
			"capabilityChain": [
				"urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
				{
					"@context": "https://w3id.org/zcap/v1",
					"id": "urn:uuid:3f1a5c02-9b34-4a7e-8f21-6d0c7b5e4a11",
					"parentCapability": "urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
					"controller": "did:key:alice",
					"expires": "2027-01-01T00:00:00Z",
					"proof": [
						{
							"type": "DataIntegrityProof",
							"cryptosuite": "eddsa-jcs-2022",
							"created": "2026-01-01T00:00:00Z",
							"verificationMethod": "https://example.com/storage#key-20240828",
							"proofPurpose": "capabilityDelegation",
							"capabilityChain": [
								"urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage"
							],
							"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
						}
					]
				}
			],
			"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
		}
	]
}
```

### Bob Delegates to Dummy Bot

From the use case:
> But Bob has heard mixed reviews of Dummy Bot and is worried that maybe
> Dummy Bot will malfunction. He has decided that a 30-day window is
> a sufficient trial period for permitting Dummy Bot to upload to the
> storage system, so that he can determine whether to renew at some future
> date.

Bob represents his capability delegation to the Dummy Bot as a capability delegation where:
* `parentCapability` is the URN of Bob's capability that is being delegated here
* `controller` is the URI of the delegee (Dummy Bot's DID)
* `allowedAction` includes the URI of the `UploadFile` method supported by Cloud Storage and invoked by Dummy Bot
* `expires` is explicitly 30 days after the proof `created` date, reflecting Bob's 30-day trial period
* `proof.capabilityChain` is the capability ancestors array. It has three entries:
  the root zcap ID, then Alice's capability referenced by ID only, then Bob's capability (the parent) fully embedded.
  Every ancestor other than the parent is referenced by ID so the delegated zcap stays as small as possible.

```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:uuid:9a2e7f60-4d18-4b52-8c37-5e6a1b0f2d49",
	"parentCapability": "urn:uuid:6c9d4b18-2e57-4c3a-9a86-1f0e2d7c8b34",
	"controller": "did:key:dummy",
	"expires": "2026-01-31T00:00:00Z",
	"allowedAction": [
		"https://example.com/storage/method/UploadFile"
	],
	"proof": [
		{
			"type": "DataIntegrityProof",
			"cryptosuite": "eddsa-jcs-2022",
			"created": "2026-01-01T00:00:00Z",
			"verificationMethod": "did:key:bob#bob",
			"proofPurpose": "capabilityDelegation",
			"capabilityChain": [
				"urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
				"urn:uuid:3f1a5c02-9b34-4a7e-8f21-6d0c7b5e4a11",
				{
					"@context": "https://w3id.org/zcap/v1",
					"id": "urn:uuid:6c9d4b18-2e57-4c3a-9a86-1f0e2d7c8b34",
					"parentCapability": "urn:uuid:3f1a5c02-9b34-4a7e-8f21-6d0c7b5e4a11",
					"controller": "did:key:bob",
					"expires": "2027-01-01T00:00:00Z",
					"allowedAction": [
						"https://example.com/storage/method/UploadFile"
					],
					"caveat": [
						{
							"id": "#caveat/RestrictUploadSize-50M",
							"type": "https://example.com/storage/caveat/RestrictUploadSize",
							"limit": 52428800
						}
					],
					"proof": [
						{
							"type": "DataIntegrityProof",
							"cryptosuite": "eddsa-jcs-2022",
							"created": "2026-01-01T00:00:00Z",
							"verificationMethod": "did:key:alice#alice",
							"proofPurpose": "capabilityDelegation",
							"capabilityChain": [
								"urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
								{
									"@context": "https://w3id.org/zcap/v1",
									"id": "urn:uuid:3f1a5c02-9b34-4a7e-8f21-6d0c7b5e4a11",
									"parentCapability": "urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
									"controller": "did:key:alice",
									"expires": "2027-01-01T00:00:00Z",
									"proof": [
										{
											"type": "DataIntegrityProof",
											"cryptosuite": "eddsa-jcs-2022",
											"created": "2026-01-01T00:00:00Z",
											"verificationMethod": "https://example.com/storage#key-20240828",
											"proofPurpose": "capabilityDelegation",
											"capabilityChain": [
												"urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage"
											],
											"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
										}
									]
								}
							],
							"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
						}
					]
				}
			],
			"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
		}
	]
}
```

### Dummy Bot Invokes UploadFile

Dummy Bot is ready to invoke UploadFile on Cloud Storage.

#### Invoking with a JSON Capability Invocation

Here, Dummy Bot will create a JSON Capability Invocation.
In this solution, Dummy Bot creates a JSON Capability Invocation where
* `id` is a unique identifier for this invocation
* `file` is the data in the file.
  Dummy Bot has accessed the documentation for `UploadFile`
  and learned this property is supported by the Cloud Storage service.
* `proof` is a `capabilityInvocation` proof generated by the [`eddsa-jcs-2022` cryptosuite](https://www.w3.org/TR/vc-di-eddsa/#eddsa-jcs-2022).
* `proof.invocationTarget` identifies the resource being invoked
* `proof.capabilityAction` is the identifier of the `UploadFile` method Dummy Bot's capability authorizes in `allowedActions`
* `proof.capability` MUST be the full delegated zcap that is being invoked,
  including that zcap's own `proof.capabilityChain`, so the verifier can verify the whole chain up to the root zcap without dereferencing anything over the network

```json
{
	"id": "urn:uuid:c47b0d3e-8f21-4a95-b6d0-2e5c9f1a7b38",
	"file": "nEOSQ7jbzBNg0Glup/FfeGDDzvLDvgEL36wcNpmbvKDgPy6+...",
	"proof": {
		"type": "DataIntegrityProof",
		"cryptosuite": "eddsa-jcs-2022",
		"created": "2026-01-01T00:00:00Z",
		"verificationMethod": "did:key:dummy#dummy",
		"proofPurpose": "capabilityInvocation",
		"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx",
		"invocationTarget": "https://example.com/storage",
		"capabilityAction": "https://example.com/storage/method/UploadFile",
		"capability": {
			"@context": "https://w3id.org/zcap/v1",
			"id": "urn:uuid:9a2e7f60-4d18-4b52-8c37-5e6a1b0f2d49",
			"parentCapability": "urn:uuid:6c9d4b18-2e57-4c3a-9a86-1f0e2d7c8b34",
			"controller": "did:key:dummy",
			"expires": "2026-01-31T00:00:00Z",
			"allowedAction": [
				"https://example.com/storage/method/UploadFile"
			],
			"proof": [
				{
					"type": "DataIntegrityProof",
					"cryptosuite": "eddsa-jcs-2022",
					"created": "2026-01-01T00:00:00Z",
					"verificationMethod": "did:key:bob#bob",
					"proofPurpose": "capabilityDelegation",
					"capabilityChain": [
						"urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
						"urn:uuid:3f1a5c02-9b34-4a7e-8f21-6d0c7b5e4a11",
						{
							"@context": "https://w3id.org/zcap/v1",
							"id": "urn:uuid:6c9d4b18-2e57-4c3a-9a86-1f0e2d7c8b34",
							"parentCapability": "urn:uuid:3f1a5c02-9b34-4a7e-8f21-6d0c7b5e4a11",
							"controller": "did:key:bob",
							"expires": "2027-01-01T00:00:00Z",
							"allowedAction": [
								"https://example.com/storage/method/UploadFile"
							],
							"caveat": [
								{
									"id": "#caveat/RestrictUploadSize-50M",
									"type": "https://example.com/storage/caveat/RestrictUploadSize",
									"limit": 52428800
								}
							],
							"proof": [
								{
									"type": "DataIntegrityProof",
									"cryptosuite": "eddsa-jcs-2022",
									"created": "2026-01-01T00:00:00Z",
									"verificationMethod": "did:key:alice#alice",
									"proofPurpose": "capabilityDelegation",
									"capabilityChain": [
										"urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
										{
											"@context": "https://w3id.org/zcap/v1",
											"id": "urn:uuid:3f1a5c02-9b34-4a7e-8f21-6d0c7b5e4a11",
											"parentCapability": "urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
											"controller": "did:key:alice",
											"expires": "2027-01-01T00:00:00Z",
											"proof": [
												{
													"type": "DataIntegrityProof",
													"cryptosuite": "eddsa-jcs-2022",
													"created": "2026-01-01T00:00:00Z",
													"verificationMethod": "https://example.com/storage#key-20240828",
													"proofPurpose": "capabilityDelegation",
													"capabilityChain": [
														"urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage"
													],
													"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
												}
											]
										}
									],
									"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
								}
							]
						}
					],
					"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
				}
			]
		}
	}
}
```

#### Delivering the Invocation

Because the `invocationTarget` is itself an HTTPS URL, delivery needs no discovery step:
Dummy Bot POSTs the invocation to `https://example.com/storage`, the `invocationTarget` named in its own `proof`.

That directness is the advantage of this scenario.
It is also the same property that binds the Cloud Storage to this host, discussed in the introduction above.
[Cloud Storage Scenario 2](#cloud-storage-scenario-2-did-invocationtarget) shows what delivery looks like when the `invocationTarget` is a DID and the URL is not known in advance.

## Cloud Storage Scenario 2: DID `invocationTarget`

This scenario illustrates another way of realizing the Cloud Storage Delegation use case.

In this scenario, the zcap `invocationTarget` is a DID that identifies the Cloud Storage itself.
This is the most faithful to the [original lds-ocap scenario][lds-ocap] that inspired zcaps, where every party, including the Cloud Storage, is identified by a DID.
It is presented after [Cloud Storage Scenario 1](#cloud-storage-scenario-1-http-url-invocationtarget) because it is the more involved of the two, not because it is the less representative of the use case.

Because the Cloud Storage is identified by a DID and not by the URL of any particular host,
nothing in this scenario needs to know where the Cloud Storage will be served until an invocation is actually attempted.
This scenario shows that: the Cloud Storage creates its DID offline, delegates to Alice offline, Alice delegates to Bob offline, and Bob delegates to Dummy Bot offline.
The whole chain, up to and including the invocation Dummy Bot creates, exists without a network, a server, or any decision about where invocations will be received.

The scenario then shows two ways that invocation can reach the Cloud Storage:
1. [Delivering the invocation over an unspecified channel](#delivering-the-invocation-over-an-unspecified-channel), which needs nothing published at all, but leaves the delivery mechanism out of scope
2. [Delivering the invocation over HTTP](#delivering-the-invocation-over-http), which makes delivery explicit and interoperable, and is the reason to publish a `CapabilityInvocationService`

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor A as Alice (did:key:alice)
    actor B as Bob (did:key:bob)
    participant D as Dummy Bot (did:key:dummy)
    participant C as Cloud Storage (did:example:0b36c784...)

    Note over A,C: Everything below happens offline.<br/>No verifiable data registry, no server, no URL.

    C->>C: Generate key-20240828 and derive the DID<br/>did:example:0b36c784...<br/>Build the initial identifier document offline:<br/>capabilityDelegation key-20240828, no service
    Note over C: Root zcap urn:zcap:root:did%3Aexample%3A0b36c784...<br/>invocationTarget did:example:0b36c784...<br/>controller did:key:alice<br/>The root zcap is derived from the DID, so it exists offline too.

    C->>A: capabilityDelegation urn:uuid:0b36c784-...<br/>parentCapability = root zcap<br/>controller did:key:alice<br/>proof.capabilityChain [root zcap]<br/>proof by storage key-20240828
    Note over A: Alice holds a direct capability<br/>to upload files

    A->>B: capabilityDelegation urn:uuid:f7412b9a-...<br/>parentCapability = Alice's zcap<br/>controller did:key:bob<br/>allowedAction UploadFile<br/>caveat RestrictUploadSize limit 52428800<br/>proof.capabilityChain [root zcap, Alice's zcap]<br/>proof by did:key:alice
    Note over B: Bob may upload, but only<br/>files up to 50 MB

    B->>D: capabilityDelegation urn:uuid:d2c83c43-...<br/>parentCapability = Bob's zcap<br/>controller did:key:dummy<br/>allowedAction UploadFile<br/>expires 2026-01-31 (30-day trial)<br/>proof.capabilityChain [root zcap, Alice's zcap id, Bob's zcap]<br/>proof by did:key:bob
    Note over D: Dummy Bot may upload<br/>for 30 days, still under<br/>Bob's 50 MB caveat

    D->>D: Create invocation urn:uuid:b1ce3837-...<br/>file + proof (capabilityInvocation)<br/>proof.invocationTarget did:example:0b36c784...<br/>capabilityAction UploadFile<br/>capability = Dummy Bot's zcap

    D-)C: Deliver the invocation over some channel<br/>(out of scope: see the two delivery sections below)

    C->>C: Verify invocation proof (did:key:dummy)
    C->>C: Verify proof.capabilityChain up to root zcap
    C->>C: Check allowedAction, expires, and caveats<br/>(file at most 50 MB)

    alt chain and caveats satisfied
        C--)D: File stored
    else expired, oversized, or unauthorized action
        C--)D: Refused
    end
```

### Cloud Storage Setup, Offline

The Cloud Storage system needs to be set up in order to provision capabilities that satisfy the use case.
All of this setup happens offline.
There is no verifiable data registry involved yet, no server running, and no decision yet about the URL at which invocations will be received.

The Cloud Storage system must choose an identifier that identifies the storage system itself.
Here, we'll use the DID `did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741`, as in the original lds-ocap scenario.
Because this identifier is a DID and not the URL of a storage host, the Cloud Storage is independent of any storage location host.
The Cloud Storage generates its key and derives this DID itself, offline.
This scenario assumes a DID method whose controller can create the DID and its initial identifier document locally and publish it later.

The Cloud Storage system must support an action that enables uploading a file.
This action must have a unique identifier.
In this example, we'll use the DID URL `did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#actions/UploadFile`.
This action must support a caveat that limits the size of files uploaded using the action.
In this example, we'll use `did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#caveat/RestrictUploadSize`.
Identifying the action and the caveat relative to the Cloud Storage DID keeps them host-independent too.

Let's assume Alice's actor is identified by `did:key:alice`.
The Cloud Storage system is configured out-of-band to authorize Alice's identifier as a controller.

### Cloud Storage Root Capability

The Cloud Storage will verify capability invocations whose `capabilityChain` is rooted in the cloud storage's root capability `urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741`.
This root capability identifier is the `urn:zcap:root:` URN whose suffix is the percent-encoded `invocationTarget`, here the Cloud Storage DID.
Because the URN is derived from the DID, the root capability exists as soon as the DID does, offline, with no registry lookup and no server.
Because the Cloud Storage `did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741` has been configured out-of-band to consider Alice's identifier as an authorized controller, the cloud storage's verifier will dereference this root capability identifier to the root capability object
```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741",
	"invocationTarget": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741",
	"controller": "did:key:alice"
}
```

### Cloud Storage Initial Identifier Document

The Cloud Storage builds its initial DID Document or [Controlled Identifier Document][] offline, where
* the `id` is the Cloud Storage DID
* the `capabilityDelegation` property authorizes verification methods that may create capability delegations (e.g. to Alice)
* there is no `service` property yet

```json
{
	"@context": "https://www.w3.org/ns/cid/v1",
	"name": "Cloud Storage",
	"id": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741",
	"capabilityDelegation": [
		{
			"id": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#key-20240828",
			"type": "JsonWebKey",
			"controller": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741",
			"publicKeyJwk": {
				"kid": "key-20240828",
				"kty": "EC",
				"crv": "P-256",
				"alg": "ES256",
				"x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
				"y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
			}
		}
	]
}
```

There is deliberately no `CapabilityInvocationService` in this document.
The Cloud Storage does not yet know, and does not need to know, at which URL it will receive invocations.
Nothing that follows in this section depends on that URL:
the root capability's `invocationTarget` is the DID, and every delegation identifies its parent by URN.

The document is not published anywhere yet, and in this scenario it may never need to be:
[Delivering the Invocation over an Unspecified Channel](#delivering-the-invocation-over-an-unspecified-channel) works with the document held only by the Cloud Storage itself.
[Delivering the Invocation over HTTP](#delivering-the-invocation-over-http) is where the document is published to a verifiable data registry, and where a `service` property is added to it.

### Alice's Capability

The use case says:

> Alice (A) has a direct capability to store files in a "Cloud Storage"
> system (C).

Alice's capability to store files in the Cloud Storage is represented as a capability delegation where
* `parentCapability` is the URN of the root zcap of the cloud storage invocation target
* `proof` contains a proof of `capabilityDelegation` proven by an authorized verification method from the Cloud Storage identifier document
* `proof.capabilityChain` is the capability ancestors array.
  Because this delegation's parent is the root zcap, the array has exactly one entry: the root zcap identified by ID (never embedded).

```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:uuid:0b36c784-4941-4b61-94de-cf5c539041f1",
	"parentCapability": "urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741",
	"controller": "did:key:alice",
	"expires": "2027-01-01T00:00:00Z",
	"proof": [
		{
			"type": "DataIntegrityProof",
			"cryptosuite": "eddsa-jcs-2022",
			"created": "2026-01-01T00:00:00Z",
			"verificationMethod": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#key-20240828",
			"proofPurpose": "capabilityDelegation",
			"capabilityChain": [
				"urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741"
			],
			"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
		}
	]
}
```

### Alice Delegates to Bob

Alice represents this delegation to Bob as a capability delegation where
* `parentCapability` is the URN of Alice's capability that is being delegated here
* `controller` is a URI controlled by Bob
* `allowedAction` includes the URI of the `UploadFile` method supported by Cloud Storage
* `caveat` includes a caveat supported by the Cloud Storage that limits each UploadFile invocation to 52428800 bytes (50 MB)
* `proof` includes a proof of `capabilityDelegation` proven by the verificationMethod for `did:key:alice`
* `proof.capabilityChain` is the capability ancestors array whose first entry is the root zcap ID and whose last entry is the fully embedded parent capability (Alice's capability)

```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:uuid:f7412b9a-854b-47ab-806b-3ac736cc7cda",
	"parentCapability": "urn:uuid:0b36c784-4941-4b61-94de-cf5c539041f1",
	"controller": "did:key:bob",
	"expires": "2027-01-01T00:00:00Z",
	"allowedAction": [
		"did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#actions/UploadFile"
	],
	"caveat": [
		{
			"id": "#caveat/RestrictUploadSize-50M",
			"type": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#caveat/RestrictUploadSize",
			"limit": 52428800
		}
	],
	"proof": [
		{
			"type": "DataIntegrityProof",
			"cryptosuite": "eddsa-jcs-2022",
			"created": "2026-01-01T00:00:00Z",
			"verificationMethod": "did:key:alice#alice",
			"proofPurpose": "capabilityDelegation",
			"capabilityChain": [
				"urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741",
				{
					"@context": "https://w3id.org/zcap/v1",
					"id": "urn:uuid:0b36c784-4941-4b61-94de-cf5c539041f1",
					"parentCapability": "urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741",
					"controller": "did:key:alice",
					"expires": "2027-01-01T00:00:00Z",
					"proof": [
						{
							"type": "DataIntegrityProof",
							"cryptosuite": "eddsa-jcs-2022",
							"created": "2026-01-01T00:00:00Z",
							"verificationMethod": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#key-20240828",
							"proofPurpose": "capabilityDelegation",
							"capabilityChain": [
								"urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741"
							],
							"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
						}
					]
				}
			],
			"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
		}
	]
}
```

### Bob Delegates to Dummy Bot

From the use case:
> But Bob has heard mixed reviews of Dummy Bot and is worried that maybe
> Dummy Bot will malfunction. He has decided that a 30-day window is
> a sufficient trial period for permitting Dummy Bot to upload to the
> storage system, so that he can determine whether to renew at some future
> date.

This delegation, like the ones before it, is created offline.
Bob represents his capability delegation to the Dummy Bot as a capability delegation where:
* `parentCapability` is the URN of Bob's capability that is being delegated here
* `controller` is the URI of the delegee (Dummy Bot's DID)
* `allowedAction` includes the URI of the `UploadFile` method supported by Cloud Storage and invoked by Dummy Bot
* `expires` is explicitly 30 days after the proof `created` date, reflecting Bob's 30-day trial period
* `proof.capabilityChain` is the capability ancestors array. It has three entries:
  the root zcap ID, then Alice's capability referenced by ID only, then Bob's capability (the parent) fully embedded.
  Every ancestor other than the parent is referenced by ID so the delegated zcap stays as small as possible.

```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:uuid:d2c83c43-878a-4c01-984f-b2f57932ce5f",
	"parentCapability": "urn:uuid:f7412b9a-854b-47ab-806b-3ac736cc7cda",
	"controller": "did:key:dummy",
	"expires": "2026-01-31T00:00:00Z",
	"allowedAction": [
		"did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#actions/UploadFile"
	],
	"proof": [
		{
			"type": "DataIntegrityProof",
			"cryptosuite": "eddsa-jcs-2022",
			"created": "2026-01-01T00:00:00Z",
			"verificationMethod": "did:key:bob#bob",
			"proofPurpose": "capabilityDelegation",
			"capabilityChain": [
				"urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741",
				"urn:uuid:0b36c784-4941-4b61-94de-cf5c539041f1",
				{
					"@context": "https://w3id.org/zcap/v1",
					"id": "urn:uuid:f7412b9a-854b-47ab-806b-3ac736cc7cda",
					"parentCapability": "urn:uuid:0b36c784-4941-4b61-94de-cf5c539041f1",
					"controller": "did:key:bob",
					"expires": "2027-01-01T00:00:00Z",
					"allowedAction": [
						"did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#actions/UploadFile"
					],
					"caveat": [
						{
							"id": "#caveat/RestrictUploadSize-50M",
							"type": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#caveat/RestrictUploadSize",
							"limit": 52428800
						}
					],
					"proof": [
						{
							"type": "DataIntegrityProof",
							"cryptosuite": "eddsa-jcs-2022",
							"created": "2026-01-01T00:00:00Z",
							"verificationMethod": "did:key:alice#alice",
							"proofPurpose": "capabilityDelegation",
							"capabilityChain": [
								"urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741",
								{
									"@context": "https://w3id.org/zcap/v1",
									"id": "urn:uuid:0b36c784-4941-4b61-94de-cf5c539041f1",
									"parentCapability": "urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741",
									"controller": "did:key:alice",
									"expires": "2027-01-01T00:00:00Z",
									"proof": [
										{
											"type": "DataIntegrityProof",
											"cryptosuite": "eddsa-jcs-2022",
											"created": "2026-01-01T00:00:00Z",
											"verificationMethod": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#key-20240828",
											"proofPurpose": "capabilityDelegation",
											"capabilityChain": [
												"urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741"
											],
											"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
										}
									]
								}
							],
							"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
						}
					]
				}
			],
			"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
		}
	]
}
```

### Dummy Bot Invokes UploadFile

Dummy Bot is ready to invoke UploadFile on Cloud Storage.

#### Invoking with a JSON Capability Invocation

Here, Dummy Bot will create a JSON Capability Invocation.
In this solution, Dummy Bot creates a JSON Capability Invocation where
* `id` is a unique identifier for this invocation
* `file` is the data in the file.
  Dummy Bot has accessed the documentation for `UploadFile`
  and learned this property is supported by the Cloud Storage service.
* `proof` is a `capabilityInvocation` proof generated by the [`eddsa-jcs-2022` cryptosuite](https://www.w3.org/TR/vc-di-eddsa/#eddsa-jcs-2022).
* `proof.invocationTarget` identifies the resource being invoked, here the Cloud Storage DID
* `proof.capabilityAction` is the identifier of the `UploadFile` method Dummy Bot's capability authorizes in `allowedAction`
* `proof.capability` MUST be the full delegated zcap that is being invoked,
  including that zcap's own `proof.capabilityChain`, so the verifier can verify the whole chain up to the root zcap without dereferencing anything over the network

```json
{
	"id": "urn:uuid:b1ce3837-1f76-4e34-a6ff-eab8278315c5",
	"file": "nEOSQ7jbzBNg0Glup/FfeGDDzvLDvgEL36wcNpmbvKDgPy6+...",
	"proof": {
		"type": "DataIntegrityProof",
		"cryptosuite": "eddsa-jcs-2022",
		"created": "2026-01-01T00:00:00Z",
		"verificationMethod": "did:key:dummy#dummy",
		"proofPurpose": "capabilityInvocation",
		"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx",
		"invocationTarget": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741",
		"capabilityAction": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#actions/UploadFile",
		"capability": {
			"@context": "https://w3id.org/zcap/v1",
			"id": "urn:uuid:d2c83c43-878a-4c01-984f-b2f57932ce5f",
			"parentCapability": "urn:uuid:f7412b9a-854b-47ab-806b-3ac736cc7cda",
			"controller": "did:key:dummy",
			"expires": "2026-01-31T00:00:00Z",
			"allowedAction": [
				"did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#actions/UploadFile"
			],
			"proof": [
				{
					"type": "DataIntegrityProof",
					"cryptosuite": "eddsa-jcs-2022",
					"created": "2026-01-01T00:00:00Z",
					"verificationMethod": "did:key:bob#bob",
					"proofPurpose": "capabilityDelegation",
					"capabilityChain": [
						"urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741",
						"urn:uuid:0b36c784-4941-4b61-94de-cf5c539041f1",
						{
							"@context": "https://w3id.org/zcap/v1",
							"id": "urn:uuid:f7412b9a-854b-47ab-806b-3ac736cc7cda",
							"parentCapability": "urn:uuid:0b36c784-4941-4b61-94de-cf5c539041f1",
							"controller": "did:key:bob",
							"expires": "2027-01-01T00:00:00Z",
							"allowedAction": [
								"did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#actions/UploadFile"
							],
							"caveat": [
								{
									"id": "#caveat/RestrictUploadSize-50M",
									"type": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#caveat/RestrictUploadSize",
									"limit": 52428800
								}
							],
							"proof": [
								{
									"type": "DataIntegrityProof",
									"cryptosuite": "eddsa-jcs-2022",
									"created": "2026-01-01T00:00:00Z",
									"verificationMethod": "did:key:alice#alice",
									"proofPurpose": "capabilityDelegation",
									"capabilityChain": [
										"urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741",
										{
											"@context": "https://w3id.org/zcap/v1",
											"id": "urn:uuid:0b36c784-4941-4b61-94de-cf5c539041f1",
											"parentCapability": "urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741",
											"controller": "did:key:alice",
											"expires": "2027-01-01T00:00:00Z",
											"proof": [
												{
													"type": "DataIntegrityProof",
													"cryptosuite": "eddsa-jcs-2022",
													"created": "2026-01-01T00:00:00Z",
													"verificationMethod": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#key-20240828",
													"proofPurpose": "capabilityDelegation",
													"capabilityChain": [
														"urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741"
													],
													"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
												}
											]
										}
									],
									"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
								}
							]
						}
					],
					"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
				}
			]
		}
	}
}
```

Note what this invocation does not contain: no URL, no host name, and nothing that had to be looked up.
`proof.invocationTarget` is the Cloud Storage DID, and `proof.capability` carries the whole chain up to the root capability.
Dummy Bot can create it offline, exactly as every delegation above it was created offline.

### Delivering the Invocation over an Unspecified Channel

A capability invocation is a document, not a request.
Once Dummy Bot has created the invocation above, delivering it to the Cloud Storage is a separate problem, and zcap-spec does not require any particular way of solving it.

Any channel that can carry the JSON document to the party controlling `did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741` will do:
Dummy Bot might hand it over on removable media, send it in a message over a local mesh network, publish it to a queue the Cloud Storage reads, or pass it through an operator who is in contact with both.

Whatever the channel, the Cloud Storage verifies exactly the same thing:
* the `capabilityInvocation` proof was made by `did:key:dummy`
* `proof.capability` is a delegated zcap whose `proof.capabilityChain` reaches `urn:zcap:root:did%3Aexample%3A0b36c784-f9f4-4c1e-b76c-d821a4b32741`
* the `capabilityAction`, `expires`, and caveats are satisfied

None of those checks consult a URL.
In this mode the Cloud Storage DID never needs a `CapabilityInvocationService`, and the identifier document never has to be published at all: the Cloud Storage can hold its own document, and every party that needed to verify a delegation proof got what it needed out-of-band.

The cost is that "some channel" is exactly as vague as it sounds.
Two implementations that both conform to zcap-spec may still be unable to talk to each other, because nothing tells an invoker how to reach the target it is authorized against.
That is the gap the next section closes.

### Delivering the Invocation over HTTP

To make delivery explicit, the Cloud Storage publishes its identifier document and advertises where invocations may be delivered.
This is the first step in the scenario that requires a network, and it happens long after the delegations were created.

```mermaid
sequenceDiagram
    autonumber
    participant D as Dummy Bot (did:key:dummy)
    participant C as Cloud Storage (did:example:0b36c784...)
    participant R as Verifiable Data Registry<br/>for did:example:0b36c784...
    participant S as Server (storage.example.org)

    Note over D,C: Dummy Bot already holds its zcap and<br/>has created invocation urn:uuid:b1ce3837-...<br/>entirely offline.

    C->>S: Serve the CapabilityInvocationService<br/>at https://storage.example.org/invocations
    C->>R: DID Create did:example:0b36c784...<br/>publish the identifier document, now including<br/>service CapabilityInvocationService<br/>serviceEndpoint https://storage.example.org/invocations
    Note over C,S: The URL is chosen here, and only here.<br/>No existing capability or invocation changes.

    D->>R: Resolve did:example:0b36c784...
    R-->>D: DID document whose CapabilityInvocationService<br/>serviceEndpoint is https://storage.example.org/invocations
    D->>S: POST invocation urn:uuid:b1ce3837-...<br/>unchanged from the offline invocation above

    S->>R: Resolve did:example:0b36c784...<br/>for its capabilityDelegation verification methods
    S->>S: Verify invocation proof (did:key:dummy)
    S->>S: Verify proof.capabilityChain up to root zcap
    S->>S: Check allowedAction, expires, and caveats<br/>(file at most 50 MB)

    alt chain and caveats satisfied
        S-->>D: 201 Created (file stored)
    else expired, oversized, or unauthorized action
        S-->>D: 403 Forbidden
    end
```

The published identifier document adds a `service` property to the offline document from [Cloud Storage Initial Identifier Document](#cloud-storage-initial-identifier-document):

```json
{
	"@context": "https://www.w3.org/ns/cid/v1",
	"name": "Cloud Storage",
	"id": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741",
	"capabilityDelegation": [
		{
			"id": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#key-20240828",
			"type": "JsonWebKey",
			"controller": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741",
			"publicKeyJwk": {
				"kid": "key-20240828",
				"kty": "EC",
				"crv": "P-256",
				"alg": "ES256",
				"x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
				"y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
			}
		}
	],
	"service": [
		{
			"id": "did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741#invocations",
			"type": "CapabilityInvocationService",
			"serviceEndpoint": "https://storage.example.org/invocations"
		}
	]
}
```

The `CapabilityInvocationService` type says what the endpoint is for: receiving capability invocations whose `invocationTarget` is this DID.
A type like `Storage` would describe the storage product rather than the invocation endpoint, and would leave an invoker guessing which of several services accepts invocations.

Dummy Bot now delivers the invocation by resolving `did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741` and POSTing it to the `serviceEndpoint` of that service, `https://storage.example.org/invocations`.
The invocation document itself is byte-for-byte the one Dummy Bot created offline.
The `invocationTarget` in the proof remains the DID, not the service endpoint URL, so the invocation stays bound to the Cloud Storage itself rather than to whichever host currently serves it.

Nothing created earlier had to wait for this decision, or be re-issued after it:
* the root capability's `invocationTarget` is the DID, not a server URL
* every delegation's `parentCapability` identifies its parent by URN
* every delegation proof's `capabilityChain` names only the root capability URN and delegation URNs

For the same reason the URL can be changed later by a DID Update without re-issuing anything.

In [Cloud Storage Scenario 1](#cloud-storage-scenario-1-http-url-invocationtarget), where the `invocationTarget` is an HTTPS URL, this ordering is not available: the URL has to exist and be decided before the root capability can be written at all, so none of the delegation above could have happened offline first.

<div class="issue">

Open questions for this scenario:
* Should zcap-spec say anything about invocation delivery over non-HTTP channels, or is leaving it unspecified the right scope?
* Can invocation HTTP requests for `invocationTarget` URI A be delivered to a service endpoint URL B, as done here?
* `CapabilityInvocationService` is not currently a registered service type. Should zcap-spec define and register it, so invokers can discover where to deliver invocations for a DID `invocationTarget` interoperably?
* Note the name collision risk between the `CapabilityInvocationService` service type and the `capabilityInvocation` verification relationship. They are unrelated: one says where to send invocations, the other says which keys may make them.
* Can `invocationTarget` be a DID like this?
* Can `invocationTarget` be a DID URL like `did:example:0b36c784-f9f4-4c1e-b76c-d821a4b32741/foo/bar`?
* Does the Cloud Storage identifier document need a `capabilityInvocation` verification relationship?
* Can a verifier verify a delegation that was created before the Cloud Storage DID was published, if it obtains the identifier document out-of-band?
  Self-certifying DID methods make this straightforward; methods that require registry lookup may not.
* Does zcap-spec require an `invocationTarget` to be resolvable at delegation time, or only at invocation time? This scenario assumes the latter.
* If the `CapabilityInvocationService` endpoint later changes by DID Update, should the old server redirect invocations, refuse them, or is resolving the DID at invocation time the only supported discovery?

</div>

[Controlled Identifier Document]: https://www.w3.org/TR/cid-1.0/
[lds-ocap]: https://github.com/WebOfTrustInfo/rwot5-boston/blob/master/draft-documents/lds-ocap/lds-ocap.md
