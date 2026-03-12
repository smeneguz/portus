<p align="center">
  <img src="frontend/public/logo.svg" width="120" alt="Portus logo" />
</p>

<h1 align="center">Portus</h1>
<p align="center"><em>"Bills of Lading, finally digital."</em></p>

<p align="center">
  Electronic Bill of Lading protocol on <strong>IOTA Move</strong>.<br/>
  Carrier issues, shipper endorses, bank endorses, consignee surrenders at port.<br/>
  Includes an interoperability control layer for cross-platform trade document settlement.
</p>

---

## Problem

The paper Bill of Lading passes through 20-30 hands per shipment, arrives after the goods, and costs the maritime industry ~$4 billion/year in fraud. UNCITRAL MLETR is adopted; the legal framework is ready. The infrastructure is not.

## Solution

**Portus** makes the BoL a **Move object on IOTA**. Ownership transfers on-chain with sub-second finality. The content hash is notarised at creation -- any alteration is instantly detectable. A forged BoL cannot match the on-chain hash; a stolen BoL cannot transfer without the owner's key.

## Architecture

```
+--------------------------------------------------+
|              IOTA Move Contracts                  |
+----------+----------+------------+----------------+----------------+
|  ebl     | endorse  | notarize   | carrier_reg    | interop_ctrl   |
|          | ment     |            |                |                |
+----------+----------+------------+----------------+----------------+
|           React + @iota/dapp-kit                  |
+--------------------------------------------------+
```

**5 Move modules** -- `ebl` (lifecycle), `endorsement` (chain of title), `notarization` (hash anchoring), `carrier_registry` (identity), `interop_control` (decentralized control tracking / settlement).

**6 frontend pages** -- Carrier Dashboard, eBL Viewer, Transfer/Endorse, Surrender/Accomplish, Verify/Anti-Fraud, Interop Layer.

## Deployed (testnet)

| Object | ID |
|--------|----|
| Package | from `scripts/deploy.sh` output |
| BLRegistry | from `scripts/deploy.sh` output |
| CarrierRegistry | from `scripts/deploy.sh` output |
| InteropRegistry | from `scripts/deploy.sh` output |

## Prerequisites

- IOTA CLI v1.2+ (`cargo install iota`)
- Node.js v20+
- An IOTA-compatible browser wallet (e.g. IOTA Wallet extension)

## Quick start

1. **Build and test contracts**

```bash
cd contracts
iota move build
iota move test
```

2. **Deploy contracts** (optional, already deployed on testnet)

```bash
cd scripts
chmod +x deploy.sh
./deploy.sh
```

3. **Start the frontend**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and connect your IOTA wallet.

4. **Run E2E tests** (requires funded testnet keypairs)

```bash
cd scripts
npm install
export CARRIER_PRIVKEY="iotaprivkey1qq..."
export SHIPPER_PRIVKEY="iotaprivkey1qq..."
export BANK_PRIVKEY="iotaprivkey1qq..."
export CONSIGNEE_PRIVKEY="iotaprivkey1qq..."
npx tsx e2e-test.ts
```

## Smart contracts

| Module | Description | Key functions |
|--------|-------------|---------------|
| `ebl` | eBL lifecycle | `register_carrier`, `issue_ebl`, `update_status`, `surrender`, `accomplish` |
| `endorsement` | Chain of title transfers | `create_chain`, `endorse_and_transfer` |
| `notarization` | Document hash anchoring | `notarize`, `verify`, `batch_notarize` |
| `carrier_registry` | Carrier identity | `register`, `increment_bls` |
| `interop_control` | Universal control-settlement layer for trade docs | `register_document`, `initiate_transfer`, `accept_transfer`, `cancel_transfer` |

## Testing

**Move unit tests** -- 18 tests, 18 passed

Covers: registry init, carrier registration, eBL issuance, status updates, endorsement chain (shipper to bank to consignee), surrender + accomplish, anti-fraud hash verification, batch notarization, interoperability control-token registration, initiate/accept transfer handshake, unauthorized status update rejection, unauthorized surrender rejection, unauthorized endorsement rejection.

**E2E integration tests** -- 11 tests, 11 passed (0.0221 IOTA gas)

```
PASS  Register Carrier
PASS  Issue eBL
PASS  Notarise Document
PASS  Create Endorsement Chain
PASS  Endorsement shipper to bank
PASS  Endorsement bank to consignee
PASS  Status Update (arrived)
PASS  Surrender
PASS  Accomplish
PASS  Anti-Fraud Check
PASS  Unauthorised Transfer (correctly rejected)
```

## Project structure

```
portus/
  contracts/
    Move.toml
    sources/
      ebl.move
      endorsement.move
      notarization.move
      carrier_registry.move
      interop_control.move
    tests/
      ebl_tests.move
      endorsement_tests.move
      notarization_tests.move
      carrier_registry_tests.move
      interop_control_tests.move
  frontend/
    public/
      favicon.svg
      logo.svg
    src/
      main.tsx
      App.tsx
      config/
      hooks/
      components/
      pages/
    index.html
    package.json
    tsconfig.json
    vite.config.ts
    vercel.json
    .env.example
  scripts/
    deploy.sh
    e2e-test.ts
    seed-demo.ts
    package.json
  README.md
  .gitignore
```

## Tech stack

- **Blockchain**: IOTA Move (testnet)
- **Smart contracts**: Move 2024.beta
- **Frontend**: React 19, Vite 7, TypeScript, Tailwind CSS v4
- **Wallet**: @iota/dapp-kit
- **Testing**: `iota move test` (unit), `tsx` E2E scripts (integration)

## Licence

Apache-2.0
