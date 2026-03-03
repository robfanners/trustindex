// src/lib/prove/chain.ts
//
// Optional chain anchoring for Prove features.
// If CHAIN_RPC_URL is not configured, all operations are no-ops returning "skipped".

import { createHash } from "crypto";

/** Whether chain anchoring is enabled (env vars present) */
export function isChainEnabled(): boolean {
  return !!(
    process.env.CHAIN_RPC_URL &&
    process.env.HAPP_REGISTRY_ADDRESS &&
    process.env.CHAIN_RELAYER_PRIVATE_KEY
  );
}

/**
 * Deterministic hash of a payload object.
 * Uses SHA-256 with sorted keys for determinism.
 * Returns 0x-prefixed hex string.
 */
export function hashPayload(data: Record<string, unknown>): string {
  const json = JSON.stringify(data, Object.keys(data).sort());
  return "0x" + createHash("sha256").update(json).digest("hex");
}

/**
 * Generate a short verification ID for external lookups.
 * Format: VER-XXXXXXXX (8 hex chars from hash).
 */
export function generateVerificationId(data: Record<string, unknown>): string {
  const hash = hashPayload(data);
  return "VER-" + hash.slice(2, 10).toUpperCase();
}

/**
 * Anchor an event hash on-chain via the HAPP Registry contract.
 * Returns tx hash and status. If chain is not enabled, returns "skipped".
 * Server-only function — never call from client components.
 */
export async function anchorOnChain(
  eventHash: string
): Promise<{ txHash: string | null; status: "anchored" | "failed" | "skipped" }> {
  if (!isChainEnabled()) {
    return { txHash: null, status: "skipped" };
  }

  try {
    // Dynamic import ethers only when chain is enabled.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethers = (await import("ethers" as any)) as any;
    const provider = new ethers.JsonRpcProvider(process.env.CHAIN_RPC_URL);
    const signer = new ethers.Wallet(
      process.env.CHAIN_RELAYER_PRIVATE_KEY!,
      provider
    );

    // Minimal ABI — only the function we need
    const abi = [
      "function registerEvent(bytes32 eventHash, uint8 verificationType, bytes32 verificationRef) external",
    ];
    const registry = new ethers.Contract(
      process.env.HAPP_REGISTRY_ADDRESS!,
      abi,
      signer
    );

    const tx = await registry.registerEvent(
      eventHash,
      0, // UNVERIFIED verification type
      ethers.ZeroHash // no verification reference
    );
    const receipt = await tx.wait();
    return { txHash: receipt.hash, status: "anchored" };
  } catch (error) {
    console.error("[prove/chain] Anchor failed:", error);
    return { txHash: null, status: "failed" };
  }
}
