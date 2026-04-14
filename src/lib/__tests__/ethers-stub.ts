// Stub for `ethers` during vitest runs. The real dependency is optional
// and loaded dynamically in src/lib/prove/chain.ts; tests always mock
// @/lib/prove/chain, so these exports are never actually invoked.
export class JsonRpcProvider {}
export class Wallet {}
export class Contract {}
export default { JsonRpcProvider, Wallet, Contract };
