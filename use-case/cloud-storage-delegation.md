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

## Candidate Solution 1

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
The Cloud Storage system has been pre-configured to authorize Alice's actor as a controller.

### Cloud Storage Identifier Document

The Cloud Storage identifier `https://example.com/storage` resolves
to a DID Document or [Controlled Identifier Document][] where
* the `capabilityDelegation` property authorizes verification methods that may create capability delegations (e.g. to Alice)

```json
{
	"@context": "https://www.w3.org/ns/cid/v1",
	"name": "Cloud Storage",
	"id": "https://example.com/storage",
	"verificationMethod": [
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
	"capabilityDelegation": [
		"https://example.com/storage#key-20240828"
	]
}
```

### Alice's Capability

The use case says:

> Alice (A) has a direct capability to store files in a "Cloud Storage"
> system (C).

Alice's capability to store files in the Cloud Storage is represented as a capability delegation where
* `parentCapability` is the URN of the root zcap of the cloud storage invocation target
* `proof` contains a proof of `capabilityDelegation` proven by an authorized verification method from the Cloud Storage identifier document.

```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:uuid:0b36c7844941b61b-c763-4617-94de-cf5c539041f1",
	"parentCapability": "urn:zcap:root:https%3A%2F%2Fexample.com%2Fstorage",
	"controller": "did:key:alice",
	"expires": "2025-11-03T18:33:51Z",
	"proof": [
		{
			"type": "DataIntegrityProof",
			"cryptosuite": "eddsa-jcs-2022",
			"created": "2023-03-05T19:23:24Z",
			"verificationMethod": "https://example.com/storage#key-20240828",
			"proofPurpose": "capabilityDelegation",
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

```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:uuid:f7412b9a-854b-47ab-806b-3ac736cc7cda",
	"parentCapability": "urn:uuid:0b36c7844941b61b-c763-4617-94de-cf5c539041f1",
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
			"created": "2023-03-05T19:23:24Z",
			"verificationMethod": "did:key:alice#alice",
			"proofPurpose": "capabilityDelegation",
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
* `expires` is explicitly 30 days after the proof `created` date, reflecting Bob's

```json
{
	"@context": "https://w3id.org/zcap/v1",
	"id": "urn:uuid:d2c83c43-878a-4c01-984f-b2f57932ce5f",
	"parentCapability": "urn:uuid:f7412b9a-854b-47ab-806b-3ac736cc7cda",
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
* `proof.capability` identifies the root zcap

```json
{
	"id" : "urn:uuid:b1ce3837-1f76-4e34-a6ff-eab8278315c5",
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
			"id": "urn:uuid:d2c83c43-878a-4c01-984f-b2f57932ce5f",
			"parentCapability": "urn:uuid:f7412b9a-854b-47ab-806b-3ac736cc7cda",
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
					"proofValue": "zQeVbY4oey5q2M3XKaxup3tmzN4DRFTLVqpLMweBrSxMY2xHX5XTYV8nQApmEcqaqA3Q1gVHMrXFkXJeV6doDwLWx"
				}
			]
		},
	}
}
```

<!-- TODO deliver invocation to invocationTarget -->

<div class="issue">

This Candidate Solution is incomplete, and should be completed.

Show:
* Bob delegates to Dummy Bot
* Dummy Bot creates invocation of `UploadFile`
* Dummy Bot delivers invocation to `invocationTarget` at Cloud Storage

</div>

[Controlled Identifier Document]: https://www.w3.org/TR/cid-1.0/
