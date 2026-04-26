# Adryx Token (ADAD)

A SIP-010 compliant fungible token for the [Adryx](https://adryx.io) decentralized advertising network.

## Token Details

| Property   | Value              |
| ---------- | ------------------ |
| Name       | Adryx Token        |
| Symbol     | ADAD               |
| Decimals   | 6                  |
| Max Supply | 1,000,000,000 ADAD |
| Standard   | SIP-010.           |

## What it's used for

- Advertisers pay for ad campaigns in ADAD
- Publishers earn ADAD as rewards for serving ads
- Users earn ADAD for engaging with ads

## Project Structure

```
contracts/
  sip-010-trait.clar    # Local trait definition (simnet/testing only)
  adryx-token.clar      # SIP-010 token contract
deployments/
  mainnet-plan.yaml     # Mainnet deployment plan
tests/
  adryx-token.test.ts   # Vitest test suite
Clarinet.toml           # Clarinet project config
```

## Prerequisites

- [Clarinet](https://github.com/hirosystems/clarinet) v2+
- Node.js 18+ and pnpm

## Setup

```bash
pnpm install
```

## Run Tests

```bash
pnpm test
```

## Deploy with Clarinet

### Local devnet

```bash
clarinet integrate
```

### Mainnet

Before deploying to mainnet, swap the `impl-trait` line in `contracts/adryx-token.clar` to reference the canonical on-chain trait instead of the local file:

```clarity
;; Replace this:
(impl-trait .sip-010-trait.sip-010-trait)

;; With this:
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
```

Then deploy using the included mainnet plan:

```bash
clarinet deployments apply --mainnet --deployment-plan-path deployments/mainnet-plan.yaml
```

You'll need a funded STX wallet configured in `settings/Mainnet.toml`. The `sip-010-trait` contract is NOT redeployed — only `adryx-token` is published.

### Testnet

```bash
clarinet deployments generate --testnet
clarinet deployments apply --testnet
```

## Key Functions

### Mint (owner only)

```clarity
(contract-call? .adryx-token mint u1000000 'SP...)
```

### Transfer

```clarity
(contract-call? .adryx-token transfer u500000 tx-sender 'SP... none)
```

### Burn

```clarity
(contract-call? .adryx-token burn u100000)
```

### Check balance

```clarity
(contract-call? .adryx-token get-balance 'SP...)
```

### Transfer ownership

```clarity
(contract-call? .adryx-token set-contract-owner 'SP...)
```

## Error Codes

| Code | Constant                 | Meaning                           |
| ---- | ------------------------ | --------------------------------- |
| u100 | ERR-NOT-AUTHORIZED       | Caller is not the contract owner  |
| u101 | ERR-INVALID-AMOUNT       | Amount must be > 0                |
| u102 | ERR-INSUFFICIENT-BALANCE | Not enough tokens to burn         |
| u103 | ERR-MAX-SUPPLY-EXCEEDED  | Mint would exceed 1B cap          |
| u104 | ERR-INVALID-RECIPIENT    | Sender and recipient are the same |
