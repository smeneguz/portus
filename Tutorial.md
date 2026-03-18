# Portus Tutorial

This guide explains how to deploy Portus, configure the frontend and use every page of the web app with the correct wallet and field values.

## 1. What you need

You need four things before opening the app:

- IOTA CLI installed locally
- Node.js 24+ recommended
- the browser wallet extension connected to IOTA testnet
- testnet funds on the wallets you want to use in the demo

For a simple demo, two wallets are enough:

- `Wallet A`: carrier, initial controller, initial shipper holder
- `Wallet B`: bank / consignee / recipient controller

If you want a cleaner separation, use four wallets:

- carrier wallet
- shipper wallet
- bank wallet
- consignee wallet

## 2. Build, test and deploy

### Build and test Move contracts

```bash
cd contracts
iota move build
iota move test
```

### Deploy the package

```bash
cd scripts
chmod +x deploy.sh
./deploy.sh
```

At the end of the deploy, the script prints these values:

- `PACKAGE_ID`
- `BL_REGISTRY_ID`
- `CARRIER_REGISTRY_ID`
- `INTEROP_REGISTRY_ID`

You must copy them into `frontend/.env`.

## 3. Configure the frontend

Create or update `frontend/.env` like this:

```env
VITE_NETWORK=testnet
VITE_PACKAGE_ID=0x...
VITE_BL_REGISTRY_ID=0x...
VITE_CARRIER_REGISTRY_ID=0x...
VITE_INTEROP_REGISTRY_ID=0x...
VITE_RPC_URL=https://api.testnet.iota.cafe:443
```

Field meaning:

- `VITE_PACKAGE_ID`: the published Move package
- `VITE_BL_REGISTRY_ID`: the shared eBL registry created at deploy time
- `VITE_CARRIER_REGISTRY_ID`: the shared carrier registry created at deploy time
- `VITE_INTEROP_REGISTRY_ID`: the shared interop registry created at deploy time
- `VITE_RPC_URL`: the RPC endpoint used by the frontend

If `VITE_INTEROP_REGISTRY_ID` is missing, the `Interop Layer` page cannot work.

## 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and connect the wallet.

## 5. Recommended demo order

The cleanest end-to-end demo is:

1. register the carrier
2. issue the eBL
3. create the endorsement chain
4. transfer the eBL to the next holder
5. surrender the eBL
6. accomplish cargo release
7. register the interop control token
8. initiate interop transfer
9. accept interop transfer
10. inspect everything in `History` and `Anti-Fraud`

## 6. Carrier Desk

### Register Carrier

Use the wallet that should act as the carrier.

Fields:

- `Carrier name`: human-readable company name
- `SCAC code`: short carrier code used as profile identifier in the app
- `Country`: two-letter country code

When you click `Register Carrier`, Portus sends one transaction that:

- registers the carrier profile in `carrier_registry`
- mints the on-chain `CarrierCap` through `ebl::register_carrier`

After success, the UI auto-detects the `CarrierCap ID` and stores it in the form.

### Issue eBL

Use the same carrier wallet that owns the `CarrierCap`.

Important field meaning:

- `Shipper address`: the IOTA address of the party that should become the initial holder of the eBL
- `Consignee address`: the IOTA address of the final receiving party
- `Notify party`: optional address for notifications
- `BL number`: human-readable bill number
- `Vessel`, `Voyage`, `Port of loading`, `Port of discharge`, `Commodity`, `Containers`, `Weight`, `Packages`: shipment metadata stored in the eBL object
- `Content hash`: SHA-256 hash of the document content

You can type the hash manually or generate it from a file upload.

Practical note: if you want `Wallet A` to issue and also hold the eBL initially, put `Wallet A` in `Shipper address`.

## 7. Transfer Hub

This page handles title transfer inside Portus.

### Create Endorsement Chain

Run this once for every eBL before the first endorsement.

Fields:

- `eBL object ID`: the object ID created by `Issue eBL`
- `Initial holder address`: the address that currently holds the eBL

In a normal flow, this should match the `shipper` you used during issuance.

### Endorse and Transfer

Use the wallet that is currently the holder of the eBL.

Fields:

- `Chain ID`: the endorsement chain object created in the previous step
- `eBL ID`: the eBL object ID
- `Recipient address`: next holder address
- `Endorsement type`: `Blank`, `To Order` or `Straight`
- `Note`: optional business note

If the connected wallet is not the current holder, the transaction should fail.

## 8. Port Release

This page has two separate actions and they must be signed by different roles.

### Surrender eBL

Use the wallet that is the current holder of the eBL.

Field:

- `eBL ID`: the target electronic bill of lading object

Portus checks the object before opening the wallet flow. If the connected wallet is not `current_holder`, surrender is blocked in the UI.

### Accomplish eBL

Use the carrier wallet, not the consignee wallet.

`Accomplish` is only valid after the eBL status is `Surrendered`.

So the normal sequence is:

1. holder signs `Surrender`
2. carrier signs `Accomplish`

## 9. Anti-Fraud

This page is the verification view.

Fields:

- `Object ID`: the eBL object ID you want to inspect

What it does:

- resolves the live eBL object from IOTA
- shows the current status and key metadata
- lets you upload a file and compare its SHA-256 hash with the on-chain `content_hash`

Use this page to prove that the file you have matches the notarized content of the eBL.

## 10. Interop Layer

This page is separate from the eBL endorsement flow. It models cross-platform control handover through a shared `TradeDocumentControl` object.

### What this layer represents

`Transfer Hub` changes the holder of the Portus eBL.

`Interop Layer` changes the controller of a separate interop control token, together with identity and transfer metadata. That is why the two flows are related conceptually but not identical in the code.

## 11. Interop: register document control token

Use the wallet that currently controls the document on the source platform.

Fields:

- `Envelope/document hash`: SHA-256 of the eBL envelope or the document package you want to anchor
- `Document type`: free text, default is `EBL_ENVELOPE`
- `Source platform ID`: logical source platform label plus numeric ID
- `Controller DID`: DID representing the current controller
- `Controller party code`: interoperable party identifier for the current controller
- `Verifiable Credential JSON or JWT`: VC payload whose hash will be bound on-chain

Identity verification modes:

- if you paste a signed VC JWT, the app verifies it with `IOTA Identity WASM` before hashing and submitting it
- if you paste a plain VC JSON object, the app validates its structure and hashes it deterministically as fallback
- in both cases, the on-chain contract stores only the identity evidence hash

### How to fill the identity fields

If you are using the demo defaults, the app can generate them for you.

- `Controller DID`: usually `did:iota:testnet:platform-X:<wallet-address-without-0x>`
- `Controller party code`: usually `PLAT-X-<last-6-address-chars>`

You can press `Generate signed VC` to create a real signed VC JWT through `IOTA Identity`. That is the fastest path for the demo.

## 12. Interop: initiate transfer

Use the current controller wallet, which is usually the same wallet that registered the control token.

Fields:

- `Document control object ID`: the `TradeDocumentControl` object created during registration
- `Recipient controller address`: the IOTA address of the next controller, usually `Wallet B`
- `Recipient DID`: DID of the next controller
- `Recipient party code`: party identifier of the next controller
- `Recipient platform ID`: logical destination platform label plus numeric ID
- `Transfer proof hash`: hash of the transfer receipt, envelope delta or another proof package for the handover
- `Transfer nonce`: unique nonce for this transfer attempt
- `Expiry window`: how long the pending transfer remains valid
- `Recipient Verifiable Presentation JSON or JWT`: VP payload expected from the recipient
- `Cancellation / rejection reason`: text stored on-chain if the controller later cancels the pending transfer

### Very important: transfer proof hash is not the original document hash

The `Transfer proof hash` should represent evidence of the handover itself, not the original eBL document hash used at registration.

Good examples:

- hash of a transfer receipt
- hash of an envelope update
- hash of a platform-to-platform proof bundle

For a quick demo you can also use any unique placeholder hash, but conceptually it is a handover proof, not the base document fingerprint.

You can press `Generate signed VP` to create a real signed VP JWT through `IOTA Identity`. In the initiate flow, the app may also replace the recipient DID with a generated `did:jwk` so the VP can be verified cryptographically later.

## 13. Interop: accept transfer

Use the recipient controller wallet, usually `Wallet B`.

Fields:

- `Recipient DID`: must match the pending DID stored on-chain
- `Recipient party code`: must match the pending party code stored on-chain
- `Recipient VP JSON or JWT`: must hash to the same expected identity hash stored during `Initiate Transfer`

The contract checks:

- signer wallet equals `pending_controller`
- DID equals `pending_controller_did`
- party code equals `pending_party_code`
- provided VP hash equals `pending_identity_hash`

If all values match, control moves to the new controller and the pending fields are reset.

Important practical note:

- if you want to use `Generate signed VP` in the accept step, the pending recipient DID should already be the `did:jwk` generated during the initiate step
- if the pending DID is a custom string that was typed manually, you should paste your own VP evidence instead of generating a new sample at accept time

## 14. Interop: cancel transfer

Use the current controller wallet.

If the receiving platform fails validation or does not respond, you can cancel the pending transfer and persist a rejection reason on-chain.

This is useful for auditability because the object keeps the last rejection reason even after the pending transfer is cleared.

## 15. Interop: lookup control state

Use this section to inspect the live control token.

Important fields:

- `Controller`: current active controller wallet
- `Current DID`: current active DID
- `Source platform`: original source platform with explicit numeric ID
- `Current party code`: current active interoperable identifier
- `Pending controller`: next wallet expected to accept the transfer
- `Pending platform`: next platform with explicit numeric ID
- `Pending DID`: next DID expected to accept the transfer
- `Pending party code`: next party code expected to accept the transfer
- `Transfer nonce`: nonce for the current pending handover
- `Pending expiry`: transfer deadline
- `Document hash`: anchored envelope hash
- `Last transfer proof hash`: proof hash from the latest initiated transfer
- `Last rejection reason`: last stored rejection message, if any

After a successful `Accept Transfer`, the pending fields go back to their empty state. That is expected behavior.

## 16. History

The `History` page merges local app actions and on-chain events into one row per digest where possible.

Use it to track:

- the action that was executed
- the area of the app where it happened
- the most relevant reference ID
- the human-readable details of the operation
- the transaction digest for explorer lookup

Long IDs are truncated visually, but you can click the reference ID to copy it.

## 17. Common mistakes

### `CarrierCap not minted yet`

You are either:

- using a wallet that did not register as carrier
- or the registration transaction did not complete successfully

Register the carrier first with the same wallet you plan to use for issuance.

### Dry run fails on `surrender`

This usually means the connected wallet is not the `current_holder` of the eBL.

Switch to the holder wallet, or inspect the object in `Anti-Fraud` / `eBL Viewer` first.

### Dry run fails on `accomplish`

This usually means:

- the wallet is not the carrier wallet
- or the eBL is not yet in `Surrendered` status

### Interop accept fails

Check all four values:

- connected wallet address
- pending DID
- pending party code
- VP JSON hash

All of them must match the pending metadata stored during initiation.

## 18. Suggested two-wallet demo

If you only want the fastest demo path, do this:

1. connect `Wallet A`
2. register carrier with `Wallet A`
3. issue eBL with `shipper = Wallet A` and `consignee = Wallet B`
4. create endorsement chain with initial holder `Wallet A`
5. endorse transfer from `Wallet A` to `Wallet B`
6. switch to `Wallet B` and surrender the eBL
7. switch back to `Wallet A` and accomplish release
8. in `Interop Layer`, register control token with `Wallet A`
9. initiate transfer from `Wallet A` to `Wallet B`
10. switch to `Wallet B` and accept the interop transfer
11. open `History` and `Anti-Fraud` to show the audit trail

That flow is enough to demonstrate native eBL lifecycle, notarization, title transfer and cross-platform control handover in one session.
