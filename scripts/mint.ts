import {
  broadcastTransaction,
  makeContractCall,
  uintCV,
  standardPrincipalCV,
  getAddressFromPrivateKey,
} from "@stacks/transactions";
import { STACKS_MAINNET, STACKS_TESTNET, createNetwork } from "@stacks/network";
import { config } from "dotenv";
config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.DEPLOYER_KEY || "";
const STACKS_NETWORK = (process.env.STACKS_NETWORK || "mainnet") as
  | "mainnet"
  | "testnet";
const STACKS_API_URL = process.env.STACKS_API_URL;

const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || "SP25H46Z9YCAB1TW93YG42WM0SREG9SC5EZB977TJ";
const CONTRACT_NAME = "adryx-token";

if (!PRIVATE_KEY) throw new Error("Set PRIVATE_KEY or DEPLOYER_KEY in .env");

const SENDER_ADDRESS = getAddressFromPrivateKey(PRIVATE_KEY, STACKS_NETWORK);

// Mint recipient — defaults to the deployer/sender, override via env
const MINT_RECIPIENT = process.env.MINT_RECIPIENT || SENDER_ADDRESS;

// Amount to mint in micro-ADAD (6 decimals). Default: 1,000,000 ADAD
const MINT_AMOUNT = BigInt(process.env.MINT_AMOUNT || "1000000000000");

function buildNetwork() {
  const base = STACKS_NETWORK === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;
  return createNetwork({
    network: base,
    client: { baseUrl: STACKS_API_URL || base.client.baseUrl },
  });
}

async function main() {
  const network = buildNetwork();

  console.log(`Minting ${MINT_AMOUNT} micro-ADAD to ${MINT_RECIPIENT}...`);
  console.log(`Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
  console.log(`Sender:   ${SENDER_ADDRESS}`);

  const tx = await makeContractCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: "mint",
    functionArgs: [uintCV(MINT_AMOUNT), standardPrincipalCV(MINT_RECIPIENT)],
    senderKey: PRIVATE_KEY,
    network,
    fee: 10000,
  });

  const result = await broadcastTransaction({ transaction: tx, network });

  if ("error" in result) {
    console.error("❌ Mint failed:", result.error, result.reason);
    process.exit(1);
  }

  console.log(`✅ Mint broadcast: ${result.txid}`);
  console.log(
    `🔗 https://explorer.hiro.so/txid/${result.txid}?chain=${STACKS_NETWORK}`,
  );
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
