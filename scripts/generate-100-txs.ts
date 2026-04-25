import {
  broadcastTransaction,
  makeContractCall,
  standardPrincipalCV,
  uintCV,
  getAddressFromPrivateKey,
} from "@stacks/transactions";
import { STACKS_MAINNET, STACKS_TESTNET, createNetwork } from "@stacks/network";
import { config } from "dotenv";

config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.DEPLOYER_KEY || "";
const STACKS_NETWORK = "mainnet";
const STACKS_API_URL = process.env.STACKS_API_URL || "https://api.hiro.so";
const CONTRACT_ADDRESS = "SP25H46Z9YCAB1TW93YG42WM0SREG9SC5EZB977TJ";
const CONTRACT_NAME = "adryxtoken";
const RECIPIENT_ADDRESS =
  process.env.RECIPIENT_ADDRESS || "SP1EQNTKNRGME36P9EEXZCFFNCYBA50VN51676JB";
const TX_COUNT = Number.parseInt(process.env.TX_COUNT || "50", 10);
const FEE = Number.parseInt(process.env.FEE || "6000", 10);
const DELAY_MS = Number.parseInt(process.env.DELAY_MS || "5000", 10);
const PAUSE_ON_RATE_LIMIT_MS = Number.parseInt(
  process.env.PAUSE_ON_RATE_LIMIT_MS || "30000",
  10,
);
const AMOUNT_PER_TX = Number.parseInt(
  process.env.AMOUNT_PER_TX || "1000000",
  10,
);

if (!PRIVATE_KEY) throw new Error("Set PRIVATE_KEY or DEPLOYER_KEY in .env");

function buildNetwork() {
  const base = STACKS_NETWORK === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;
  return createNetwork({ network: base, client: { baseUrl: STACKS_API_URL } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimit(err: any) {
  return JSON.stringify(err || "")
    .toLowerCase()
    .includes("rate");
}

const MAX_MEMPOOL = 24; // Stacks node rejects if you have >= 25 pending txs

/**
 * Wait until the mempool count for this address drops below MAX_MEMPOOL.
 */
async function waitForMempoolSpace(address: string): Promise<void> {
  while (true) {
    const res = await fetch(
      `${STACKS_API_URL}/extended/v1/address/${address}/mempool?limit=1&unanchored=true`,
    );
    if (!res.ok) {
      await sleep(5000);
      continue;
    }
    const data = (await res.json()) as { total: number };
    if (data.total < MAX_MEMPOOL) return;
    console.log(
      `   ⏳ Mempool has ${data.total} pending txs (limit ${MAX_MEMPOOL}), waiting 15s...`,
    );
    await sleep(15_000);
  }
}
async function fetchPossibleNextNonce(address: string): Promise<number> {
  const url = `${STACKS_API_URL}/extended/v1/address/${address}/nonces`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Nonce fetch failed: ${res.status} ${url}`);
  const data = (await res.json()) as { possible_next_nonce: number };
  console.log(`   API nonce response: ${JSON.stringify(data)}`);
  return data.possible_next_nonce;
}

async function sendTx(index: number, nonce: number) {
  const network = buildNetwork();
  const amount = BigInt(AMOUNT_PER_TX) + BigInt(index);

  console.log(
    `\n[${index}/${TX_COUNT}] nonce=${nonce} — minting ${amount} to ${RECIPIENT_ADDRESS}...`,
  );

  try {
    const tx = await makeContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "mint",
      functionArgs: [uintCV(amount), standardPrincipalCV(RECIPIENT_ADDRESS)],
      senderKey: PRIVATE_KEY,
      network,
      fee: FEE,
      nonce,
    });

    const result = await broadcastTransaction({ transaction: tx, network });

    if ("error" in result) {
      const reason = (result as any).reason ?? "";
      console.error(`❌ Tx ${index} rejected: ${result.error} ${reason}`);
      return {
        ok: false,
        txid: null,
        error: `${result.error} ${reason}`.trim(),
      };
    }

    console.log(`✅ Tx ${index}: ${result.txid}`);
    console.log(
      `   🔗 https://explorer.hiro.so/txid/${result.txid}?chain=mainnet`,
    );
    return { ok: true, txid: result.txid, error: null };
  } catch (err: any) {
    console.error(`❌ Tx ${index} threw:`, err?.message ?? err);
    return { ok: false, txid: null, error: err?.message ?? String(err) };
  }
}

async function main() {
  const senderAddress = getAddressFromPrivateKey(PRIVATE_KEY, STACKS_MAINNET);
  console.log(`Sender  : ${senderAddress}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
  console.log(`Network : ${STACKS_NETWORK}`);

  let nonce = await fetchPossibleNextNonce(senderAddress);
  console.log(`Starting nonce (possible_next): ${nonce}`);
  console.log(`Sending ${TX_COUNT} mint txs...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 1; i <= TX_COUNT; i++) {
    // Wait if mempool is full before sending
    await waitForMempoolSpace(senderAddress);

    const res = await sendTx(i, nonce);

    if (res.ok) {
      success++;
      nonce++;
    } else {
      failed++;
      if (isRateLimit(res.error)) {
        console.log(`⏸ Rate limit — pausing ${PAUSE_ON_RATE_LIMIT_MS}ms...`);
        await sleep(PAUSE_ON_RATE_LIMIT_MS);
      } else {
        // Re-fetch after failure
        nonce = await fetchPossibleNextNonce(senderAddress);
        console.log(`   Refreshed nonce: ${nonce}`);
      }
    }

    if (DELAY_MS > 0 && i < TX_COUNT) await sleep(DELAY_MS);
  }

  console.log(`\nDone. ✅ ${success} succeeded  ❌ ${failed} failed`);
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
