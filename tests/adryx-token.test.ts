import { describe, it, expect, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const CONTRACT = "adryx-token";

// Simnet accounts (injected globally by vitest-environment-clarinet)
declare const simnet: any;

describe("Adryx Token — SIP-010", () => {
  let deployer: string;
  let wallet1: string;
  let wallet2: string;

  beforeEach(() => {
    const accounts = simnet.getAccounts();
    deployer = accounts.get("deployer")!;
    wallet1 = accounts.get("wallet_1")!;
    wallet2 = accounts.get("wallet_2")!;
  });

  // ──────────────────────────────────────────────
  // Read-only metadata
  // ──────────────────────────────────────────────

  describe("metadata", () => {
    it("returns correct name", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT,
        "get-name",
        [],
        deployer,
      );
      expect(result).toBeOk(Cl.stringAscii("Adryx Token"));
    });

    it("returns correct symbol", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT,
        "get-symbol",
        [],
        deployer,
      );
      expect(result).toBeOk(Cl.stringAscii("ADAD"));
    });

    it("returns 6 decimals", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT,
        "get-decimals",
        [],
        deployer,
      );
      expect(result).toBeOk(Cl.uint(6));
    });

    it("returns token URI", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT,
        "get-token-uri",
        [],
        deployer,
      );
      expect(result).toBeOk(
        Cl.some(Cl.stringUtf8("https://adryx.io/token-metadata.json")),
      );
    });
  });

  // ──────────────────────────────────────────────
  // Minting
  // ──────────────────────────────────────────────

  describe("mint", () => {
    it("owner can mint tokens to a recipient", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "mint",
        [Cl.uint(1_000_000), Cl.principal(wallet1)],
        deployer,
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("balance reflects minted amount", () => {
      simnet.callPublicFn(
        CONTRACT,
        "mint",
        [Cl.uint(500_000), Cl.principal(wallet1)],
        deployer,
      );
      const { result } = simnet.callReadOnlyFn(
        CONTRACT,
        "get-balance",
        [Cl.principal(wallet1)],
        deployer,
      );
      expect(result).toBeOk(Cl.uint(500_000));
    });

    it("total supply increases after mint", () => {
      simnet.callPublicFn(
        CONTRACT,
        "mint",
        [Cl.uint(1_000_000), Cl.principal(wallet1)],
        deployer,
      );
      const { result } = simnet.callReadOnlyFn(
        CONTRACT,
        "get-total-supply",
        [],
        deployer,
      );
      expect(result).toBeOk(Cl.uint(1_000_000));
    });

    it("non-owner cannot mint", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "mint",
        [Cl.uint(1_000_000), Cl.principal(wallet2)],
        wallet1, // not the owner
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });

    it("mint with zero amount fails", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "mint",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer,
      );
      expect(result).toBeErr(Cl.uint(101)); // ERR-INVALID-AMOUNT
    });
  });

  // ──────────────────────────────────────────────
  // Transfer
  // ──────────────────────────────────────────────

  describe("transfer", () => {
    beforeEach(() => {
      // Give wallet1 some tokens to work with
      simnet.callPublicFn(
        CONTRACT,
        "mint",
        [Cl.uint(1_000_000), Cl.principal(wallet1)],
        deployer,
      );
    });

    it("wallet1 can transfer tokens to wallet2", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "transfer",
        [
          Cl.uint(200_000),
          Cl.principal(wallet1),
          Cl.principal(wallet2),
          Cl.none(),
        ],
        wallet1,
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("balances update correctly after transfer", () => {
      simnet.callPublicFn(
        CONTRACT,
        "transfer",
        [
          Cl.uint(300_000),
          Cl.principal(wallet1),
          Cl.principal(wallet2),
          Cl.none(),
        ],
        wallet1,
      );
      const bal1 = simnet.callReadOnlyFn(
        CONTRACT,
        "get-balance",
        [Cl.principal(wallet1)],
        deployer,
      );
      const bal2 = simnet.callReadOnlyFn(
        CONTRACT,
        "get-balance",
        [Cl.principal(wallet2)],
        deployer,
      );
      expect(bal1.result).toBeOk(Cl.uint(700_000));
      expect(bal2.result).toBeOk(Cl.uint(300_000));
    });

    it("cannot transfer more than balance", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "transfer",
        [
          Cl.uint(9_999_999),
          Cl.principal(wallet1),
          Cl.principal(wallet2),
          Cl.none(),
        ],
        wallet1,
      );
      expect(result).toBeErr(Cl.uint(1)); // Clarity ft-transfer? insufficient funds
    });

    it("cannot transfer on behalf of another sender", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "transfer",
        [
          Cl.uint(100_000),
          Cl.principal(wallet1),
          Cl.principal(wallet2),
          Cl.none(),
        ],
        wallet2, // wallet2 trying to move wallet1's tokens
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });

    it("cannot transfer zero amount", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "transfer",
        [Cl.uint(0), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
        wallet1,
      );
      expect(result).toBeErr(Cl.uint(101)); // ERR-INVALID-AMOUNT
    });

    it("cannot transfer to self", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "transfer",
        [
          Cl.uint(100_000),
          Cl.principal(wallet1),
          Cl.principal(wallet1),
          Cl.none(),
        ],
        wallet1,
      );
      expect(result).toBeErr(Cl.uint(104)); // ERR-INVALID-RECIPIENT
    });
  });

  // ──────────────────────────────────────────────
  // Burning
  // ──────────────────────────────────────────────

  describe("burn", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT,
        "mint",
        [Cl.uint(1_000_000), Cl.principal(wallet1)],
        deployer,
      );
    });

    it("wallet1 can burn their own tokens", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "burn",
        [Cl.uint(400_000)],
        wallet1,
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("total supply decreases after burn", () => {
      simnet.callPublicFn(CONTRACT, "burn", [Cl.uint(400_000)], wallet1);
      const { result } = simnet.callReadOnlyFn(
        CONTRACT,
        "get-total-supply",
        [],
        deployer,
      );
      expect(result).toBeOk(Cl.uint(600_000));
    });

    it("cannot burn more than balance", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "burn",
        [Cl.uint(9_999_999)],
        wallet1,
      );
      expect(result).toBeErr(Cl.uint(102)); // ERR-INSUFFICIENT-BALANCE
    });

    it("cannot burn zero amount", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "burn",
        [Cl.uint(0)],
        wallet1,
      );
      expect(result).toBeErr(Cl.uint(101)); // ERR-INVALID-AMOUNT
    });
  });

  // ──────────────────────────────────────────────
  // Admin / Ownership
  // ──────────────────────────────────────────────

  describe("ownership", () => {
    it("deployer is initial owner", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT,
        "get-contract-owner",
        [],
        deployer,
      );
      expect(result).toBeOk(Cl.principal(deployer));
    });

    it("owner can transfer ownership", () => {
      simnet.callPublicFn(
        CONTRACT,
        "set-contract-owner",
        [Cl.principal(wallet1)],
        deployer,
      );
      const { result } = simnet.callReadOnlyFn(
        CONTRACT,
        "get-contract-owner",
        [],
        deployer,
      );
      expect(result).toBeOk(Cl.principal(wallet1));
    });

    it("non-owner cannot transfer ownership", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "set-contract-owner",
        [Cl.principal(wallet2)],
        wallet1,
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });

    it("new owner can mint after ownership transfer", () => {
      simnet.callPublicFn(
        CONTRACT,
        "set-contract-owner",
        [Cl.principal(wallet1)],
        deployer,
      );
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "mint",
        [Cl.uint(500_000), Cl.principal(wallet2)],
        wallet1,
      );
      expect(result).toBeOk(Cl.bool(true));
    });
  });
});
