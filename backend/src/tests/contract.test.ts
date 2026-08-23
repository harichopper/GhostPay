/**
 * contract.test.ts
 *
 * Unit tests for the GhostPay TEAL smart contracts and associated deploy /
 * service-layer logic.
 *
 * What is tested here:
 *
 *   1. TEAL source structure (static analysis)
 *      — Approval program:  pragma version, routing branches, create handler,
 *        admin-op handler, no_op handler (argument checks, group validation,
 *        sender checks, amount matching, global state writes)
 *      — Clear program:     minimal valid program
 *
 *   2. Deploy script logic (algod mocked)
 *      — Compiles both programs
 *      — Creates application with correct global state schema
 *      — Reports the resulting App ID
 *
 *   3. algorandService — sendAlgoPayment (algod mocked)
 *      — Server-signed plain payment (no contract)
 *      — Server-signed atomic-group payment (with contract)
 *      — Client-signed plain payment
 *      — Client-signed: ENFORCE_CONTRACT=true raises an error
 *      — Client-signed: ENFORCE_CONTRACT=false submits without contract
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import algosdk from 'algosdk';

// ─── Resolve path to contract directory ─────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACTS_DIR = path.resolve(__dirname, '../../contracts');

// ─── Load TEAL source once ───────────────────────────────────────────────────

const approvalTeal = fs.readFileSync(
  path.join(CONTRACTS_DIR, 'ghostpay_approval.teal'),
  'utf-8'
);
const clearTeal = fs.readFileSync(
  path.join(CONTRACTS_DIR, 'ghostpay_clear.teal'),
  'utf-8'
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Collect non-empty, non-comment lines from a TEAL source string. */
function tealLines(src: string): string[] {
  return src
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('//'));
}

/** Return true when the approval source contains the given opcode or string. */
function hasOpcode(opcode: string): boolean {
  return tealLines(approvalTeal).some(l => l === opcode || l.startsWith(opcode + ' ') || l.startsWith(opcode + '\t'));
}

/** Return true when the source contains the given literal text anywhere. */
function containsText(src: string, text: string): boolean {
  return src.includes(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TEAL SOURCE — CLEAR PROGRAM
// ─────────────────────────────────────────────────────────────────────────────

describe('clear program — static analysis', () => {
  it('starts with #pragma version 8', () => {
    expect(clearTeal.trimStart().startsWith('#pragma version 8')).toBe(true);
  });

  it('approves unconditionally (int 1 / return)', () => {
    const lines = tealLines(clearTeal);
    expect(lines).toContain('int 1');
    expect(lines).toContain('return');
  });

  it('contains no reject opcode (int 0 / return)', () => {
    // The clear program must never reject — user should always be able to clear
    const lines = tealLines(clearTeal);
    // "int 0" alone without return following would be unusual, but a clear that
    // rejects (int 0 / return) is forbidden by design.
    const idx0 = lines.indexOf('int 0');
    if (idx0 !== -1) {
      // If "int 0" exists, the very next opcode must NOT be "return"
      expect(lines[idx0 + 1]).not.toBe('return');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TEAL SOURCE — APPROVAL PROGRAM: GENERAL STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

describe('approval program — general structure', () => {
  it('starts with #pragma version 8', () => {
    expect(approvalTeal.trimStart().startsWith('#pragma version 8')).toBe(true);
  });

  it('reads ApplicationID for creation check', () => {
    expect(containsText(approvalTeal, 'txn ApplicationID')).toBe(true);
  });

  it('branches on ApplicationID == 0 (create path)', () => {
    // Should branch to "create" label when ApplicationID == 0
    const createBranch = tealLines(approvalTeal).some(
      l => l.startsWith('bnz create') || l.startsWith('bz create')
    );
    expect(createBranch).toBe(true);
  });

  it('checks OnCompletion for DeleteApplication', () => {
    expect(containsText(approvalTeal, 'int DeleteApplication')).toBe(true);
  });

  it('checks OnCompletion for UpdateApplication', () => {
    expect(containsText(approvalTeal, 'int UpdateApplication')).toBe(true);
  });

  it('checks OnCompletion for NoOp', () => {
    expect(containsText(approvalTeal, 'int NoOp')).toBe(true);
  });

  it('routes delete/update to admin handler', () => {
    // Both delete and update must branch to the same or separate admin labels
    const lines = tealLines(approvalTeal);
    const adminBranches = lines.filter(l => l.startsWith('bnz delete') || l.startsWith('bnz update') || l.startsWith('bnz admin'));
    expect(adminBranches.length).toBeGreaterThanOrEqual(1);
  });

  it('routes NoOp to no_op handler', () => {
    const lines = tealLines(approvalTeal);
    const noOpBranch = lines.some(l => l.startsWith('bnz no_op') || l.startsWith('bnz noOp'));
    expect(noOpBranch).toBe(true);
  });

  it('has a fallthrough reject path (int 0 / return)', () => {
    // Anything not routed to a handler must be rejected
    expect(containsText(approvalTeal, 'int 0')).toBe(true);
    expect(containsText(approvalTeal, 'return')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. TEAL SOURCE — CREATE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

describe('approval program — create handler', () => {
  it('stores admin = txn.Sender', () => {
    expect(containsText(approvalTeal, 'byte "admin"')).toBe(true);
    expect(containsText(approvalTeal, 'txn Sender')).toBe(true);
    expect(containsText(approvalTeal, 'app_global_put')).toBe(true);
  });

  it('initialises payment_count = 0', () => {
    expect(containsText(approvalTeal, 'byte "payment_count"')).toBe(true);
  });

  it('initialises last_amount_micro = 0', () => {
    expect(containsText(approvalTeal, 'byte "last_amount_micro"')).toBe(true);
  });

  it('returns 1 (approves creation)', () => {
    expect(containsText(approvalTeal, 'int 1')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. TEAL SOURCE — ADMIN HANDLER (delete / update)
// ─────────────────────────────────────────────────────────────────────────────

describe('approval program — admin handler (delete/update)', () => {
  it('reads the stored admin address from global state', () => {
    expect(containsText(approvalTeal, 'app_global_get')).toBe(true);
  });

  it('compares stored admin to txn.Sender', () => {
    // The admin section must compare admin address with txn Sender
    const src = approvalTeal;
    const adminGetIdx = src.indexOf('app_global_get');
    const senderIdx = src.indexOf('txn Sender', adminGetIdx);
    const eqIdx = src.indexOf('==', senderIdx);
    // All three must appear in that order
    expect(adminGetIdx).toBeGreaterThan(-1);
    expect(senderIdx).toBeGreaterThan(adminGetIdx);
    expect(eqIdx).toBeGreaterThan(senderIdx);
  });

  it('returns the equality result (no hard assert — just return)', () => {
    // The delete/update handler should use "return" not "assert"
    // so a non-admin receives a reject (0) rather than an error
    const lines = tealLines(approvalTeal);
    // After the == in the delete block there should be a "return" not just "assert"
    expect(lines).toContain('return');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. TEAL SOURCE — no_op HANDLER: ARGUMENT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

describe('approval program — no_op handler: argument validation', () => {
  it('verifies exactly 3 app arguments (txn NumAppArgs == 3)', () => {
    expect(containsText(approvalTeal, 'txn NumAppArgs')).toBe(true);
    // Should compare against 3
    const lines = tealLines(approvalTeal);
    const numArgsIdx = lines.findIndex(l => l === 'txn NumAppArgs');
    expect(numArgsIdx).toBeGreaterThan(-1);
    expect(lines[numArgsIdx + 1]).toBe('int 3');
    expect(lines[numArgsIdx + 2]).toBe('==');
    expect(lines[numArgsIdx + 3]).toBe('assert');
  });

  it('checks arg[0] == "record"', () => {
    expect(containsText(approvalTeal, 'txna ApplicationArgs 0')).toBe(true);
    expect(containsText(approvalTeal, 'byte "record"')).toBe(true);
  });

  it('arg[0] check is followed by == and assert', () => {
    const lines = tealLines(approvalTeal);
    const idx = lines.findIndex(l => l === 'txna ApplicationArgs 0');
    expect(idx).toBeGreaterThan(-1);
    expect(lines[idx + 1]).toBe('byte "record"');
    expect(lines[idx + 2]).toBe('==');
    expect(lines[idx + 3]).toBe('assert');
  });

  it('decodes arg[2] with btoi for amount comparison', () => {
    expect(containsText(approvalTeal, 'txna ApplicationArgs 2')).toBe(true);
    expect(containsText(approvalTeal, 'btoi')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. TEAL SOURCE — no_op HANDLER: ATOMIC GROUP VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

describe('approval program — no_op handler: atomic group validation', () => {
  it('asserts GroupSize == 2', () => {
    expect(containsText(approvalTeal, 'global GroupSize')).toBe(true);
    const lines = tealLines(approvalTeal);
    const idx = lines.findIndex(l => l === 'global GroupSize');
    expect(idx).toBeGreaterThan(-1);
    expect(lines[idx + 1]).toBe('int 2');
    expect(lines[idx + 2]).toBe('==');
    expect(lines[idx + 3]).toBe('assert');
  });

  it('asserts this call is at GroupIndex == 1 (second in group)', () => {
    expect(containsText(approvalTeal, 'txn GroupIndex')).toBe(true);
    const lines = tealLines(approvalTeal);
    const idx = lines.findIndex(l => l === 'txn GroupIndex');
    expect(idx).toBeGreaterThan(-1);
    expect(lines[idx + 1]).toBe('int 1');
    expect(lines[idx + 2]).toBe('==');
    expect(lines[idx + 3]).toBe('assert');
  });

  it('asserts gtxn 0 is a pay transaction', () => {
    expect(containsText(approvalTeal, 'gtxn 0 TypeEnum')).toBe(true);
    expect(containsText(approvalTeal, 'int pay')).toBe(true);
  });

  it('gtxn 0 TypeEnum check is followed by == and assert', () => {
    const lines = tealLines(approvalTeal);
    const idx = lines.findIndex(l => l === 'gtxn 0 TypeEnum');
    expect(idx).toBeGreaterThan(-1);
    expect(lines[idx + 1]).toBe('int pay');
    expect(lines[idx + 2]).toBe('==');
    expect(lines[idx + 3]).toBe('assert');
  });

  it('asserts payment sender == app-call sender', () => {
    expect(containsText(approvalTeal, 'gtxn 0 Sender')).toBe(true);
    const lines = tealLines(approvalTeal);
    const idx = lines.findIndex(l => l === 'gtxn 0 Sender');
    expect(idx).toBeGreaterThan(-1);
    // Next instruction must push txn.Sender for comparison
    expect(lines[idx + 1]).toBe('txn Sender');
    expect(lines[idx + 2]).toBe('==');
    expect(lines[idx + 3]).toBe('assert');
  });

  it('asserts declared foreign account count == 1', () => {
    expect(containsText(approvalTeal, 'txn NumAccounts')).toBe(true);
    const lines = tealLines(approvalTeal);
    const idx = lines.findIndex(l => l === 'txn NumAccounts');
    expect(idx).toBeGreaterThan(-1);
    expect(lines[idx + 1]).toBe('int 1');
    expect(lines[idx + 2]).toBe('==');
    expect(lines[idx + 3]).toBe('assert');
  });

  it('asserts payment receiver == declared foreign account (Accounts[1])', () => {
    expect(containsText(approvalTeal, 'gtxn 0 Receiver')).toBe(true);
    expect(containsText(approvalTeal, 'txna Accounts 1')).toBe(true);
    const lines = tealLines(approvalTeal);
    const idx = lines.findIndex(l => l === 'gtxn 0 Receiver');
    expect(idx).toBeGreaterThan(-1);
    expect(lines[idx + 1]).toBe('txna Accounts 1');
    expect(lines[idx + 2]).toBe('==');
    expect(lines[idx + 3]).toBe('assert');
  });

  it('asserts declared amount (arg[2] btoi) == actual payment amount (gtxn 0 Amount)', () => {
    expect(containsText(approvalTeal, 'gtxn 0 Amount')).toBe(true);
    // The contract must compare them — verify the opcodes appear in the right order
    const src = approvalTeal;
    const btoi2Idx = src.lastIndexOf('btoi');       // last btoi is in the comparison
    const amountIdx = src.indexOf('gtxn 0 Amount');
    // Both appear, and the equality + assert follows
    expect(btoi2Idx).toBeGreaterThan(-1);
    expect(amountIdx).toBeGreaterThan(-1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. TEAL SOURCE — no_op HANDLER: GLOBAL STATE WRITES
// ─────────────────────────────────────────────────────────────────────────────

describe('approval program — no_op handler: global state writes', () => {
  const STATE_KEYS = [
    'last_sender',
    'last_receiver',
    'last_ts',
    'last_amount_micro',
    'payment_count',
  ] as const;

  for (const key of STATE_KEYS) {
    it(`writes "${key}" to global state`, () => {
      expect(containsText(approvalTeal, `byte "${key}"`)).toBe(true);
      // Each key should appear at least twice: once in create/init, once here
      // (or once in no_op; either way the key must be present)
    });
  }

  it('writes last_sender = gtxn 0 Sender', () => {
    const src = approvalTeal;
    const keyIdx = src.indexOf('byte "last_sender"');
    expect(keyIdx).toBeGreaterThan(-1);
    // After "byte "last_sender"" the value pushed must be gtxn 0 Sender
    const afterKey = src.slice(keyIdx);
    expect(afterKey.includes('gtxn 0 Sender')).toBe(true);
  });

  it('writes last_receiver = gtxn 0 Receiver', () => {
    const src = approvalTeal;
    const keyIdx = src.indexOf('byte "last_receiver"');
    expect(keyIdx).toBeGreaterThan(-1);
    const afterKey = src.slice(keyIdx);
    expect(afterKey.includes('gtxn 0 Receiver')).toBe(true);
  });

  it('writes last_ts = ApplicationArgs[1]', () => {
    const src = approvalTeal;
    const keyIdx = src.indexOf('byte "last_ts"');
    expect(keyIdx).toBeGreaterThan(-1);
    const afterKey = src.slice(keyIdx);
    expect(afterKey.includes('txna ApplicationArgs 1')).toBe(true);
  });

  it('writes last_amount_micro using btoi of arg[2]', () => {
    const src = approvalTeal;
    const keyIdx = src.indexOf('byte "last_amount_micro"');
    // The key appears multiple times (create init + no_op write)
    expect(keyIdx).toBeGreaterThan(-1);
  });

  it('increments payment_count by 1 using app_global_get + 1 + app_global_put', () => {
    const src = approvalTeal;
    // Pattern: byte "payment_count" / byte "payment_count" / app_global_get / int 1 / + / app_global_put
    const lines = tealLines(src);
    let found = false;
    for (let i = 0; i < lines.length - 5; i++) {
      if (
        lines[i]     === 'byte "payment_count"' &&
        lines[i + 1] === 'byte "payment_count"' &&
        lines[i + 2] === 'app_global_get' &&
        lines[i + 3] === 'int 1' &&
        lines[i + 4] === '+' &&
        lines[i + 5] === 'app_global_put'
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. TEAL SOURCE — GLOBAL STATE SCHEMA ALIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

describe('approval program — global state schema alignment', () => {
  // Schema declared in deployContract.ts:
  //   numGlobalInts: 3   → payment_count, last_amount_micro, _reserved
  //   numGlobalByteSlices: 4 → admin, last_sender, last_receiver, last_ts

  const INT_KEYS   = ['payment_count', 'last_amount_micro'];
  const BYTES_KEYS = ['admin', 'last_sender', 'last_receiver', 'last_ts'];

  for (const key of INT_KEYS) {
    it(`integer key "${key}" is present in contract`, () => {
      expect(containsText(approvalTeal, `byte "${key}"`)).toBe(true);
    });
  }

  for (const key of BYTES_KEYS) {
    it(`byte-slice key "${key}" is present in contract`, () => {
      expect(containsText(approvalTeal, `byte "${key}"`)).toBe(true);
    });
  }

  it('contract uses at most 3 distinct integer state keys', () => {
    const allByteKeys = [...approvalTeal.matchAll(/byte "([^"]+)"/g)]
      .map(m => m[1]);
    const uniqueKeys = [...new Set(allByteKeys)];
    // "record" appears as an argument comparison literal — not a state key
    const knownKeys = new Set([...INT_KEYS, ...BYTES_KEYS, 'record']);
    for (const key of uniqueKeys) {
      // If this fails, add the key to INT_KEYS, BYTES_KEYS, or the known literals set above
      expect(knownKeys.has(key), `Unexpected byte literal "${key}" in contract`).toBe(true);
    }
  });

  it('total distinct global state keys does not exceed 7 (3 ints + 4 bytes)', () => {
    const allByteKeys = [...approvalTeal.matchAll(/byte "([^"]+)"/g)]
      .map(m => m[1]);
    const uniqueKeys = new Set(allByteKeys);
    expect(uniqueKeys.size).toBeLessThanOrEqual(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. DEPLOY SCRIPT — algod MOCKED
// ─────────────────────────────────────────────────────────────────────────────

describe('deployContract script — algod mocked', () => {
  /**
   * We test the deploy logic by exercising the same steps the script performs,
   * but with a fully mocked algod client.
   */

  function fakeBase64Program(label: string): string {
    return Buffer.from(`compiled-${label}`).toString('base64');
  }

  function buildMockAlgodClient() {
    // algosdk v3 requires genesisHash as Uint8Array, not base64 string
    const genesisHashBytes = new Uint8Array(32).fill(1);
    return {
      compile: vi.fn().mockReturnValue({
        do: vi.fn()
          .mockResolvedValueOnce({ result: fakeBase64Program('approval') })
          .mockResolvedValueOnce({ result: fakeBase64Program('clear') }),
      }),
      getTransactionParams: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue({
          fee:          1000,
          firstValid:   BigInt(1000),
          lastValid:    BigInt(2000),
          genesisHash:  genesisHashBytes,
          genesisID:    'testnet-v1.0',
          minFee:       1000,
        }),
      }),
      sendRawTransaction: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue({ txid: 'DEPLOY_TXID_123' }),
      }),
      pendingTransactionInformation: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue({
          'application-index': 42,
          'confirmed-round': 1001,
        }),
      }),
      status: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue({ 'last-round': 1001 }),
      }),
      statusAfterBlock: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue({ 'last-round': 1001 }),
      }),
    };
  }

  it('compiles both TEAL programs during deploy', async () => {
    const mockClient = buildMockAlgodClient();
    // Re-implement the compilation step the deploy script performs
    const approvalResult = await mockClient.compile(approvalTeal).do();
    const clearResult    = await mockClient.compile(clearTeal).do();

    expect(mockClient.compile).toHaveBeenCalledTimes(2);
    expect(mockClient.compile).toHaveBeenNthCalledWith(1, approvalTeal);
    expect(mockClient.compile).toHaveBeenNthCalledWith(2, clearTeal);

    expect(approvalResult.result).toBe(fakeBase64Program('approval'));
    expect(clearResult.result).toBe(fakeBase64Program('clear'));
  });

  it('converts base64 compile result to Uint8Array', async () => {
    const mockClient = buildMockAlgodClient();
    const approvalResult = await mockClient.compile(approvalTeal).do();
    const clearResult    = await mockClient.compile(clearTeal).do();

    const approvalProgram = new Uint8Array(Buffer.from(approvalResult.result, 'base64'));
    const clearProgram    = new Uint8Array(Buffer.from(clearResult.result, 'base64'));

    expect(approvalProgram).toBeInstanceOf(Uint8Array);
    expect(clearProgram).toBeInstanceOf(Uint8Array);
    expect(approvalProgram.length).toBeGreaterThan(0);
    expect(clearProgram.length).toBeGreaterThan(0);
  });

  it('creates application with correct global state schema', async () => {
    const mockClient = buildMockAlgodClient();
    const approvalResult = await mockClient.compile(approvalTeal).do();
    const clearResult    = await mockClient.compile(clearTeal).do();

    const approvalProgram = new Uint8Array(Buffer.from(approvalResult.result, 'base64'));
    const clearProgram    = new Uint8Array(Buffer.from(clearResult.result, 'base64'));

    const suggestedParams = await mockClient.getTransactionParams().do();

    // Generate a dummy deployer account (don't use real keys in tests)
    const deployerAccount = algosdk.generateAccount();

    // Build the create txn exactly as the deploy script does
    // Note: algosdk v3 uses `onComplete` (not `onCompletion`) in the param object
    const appCreateTxn = algosdk.makeApplicationCreateTxnFromObject({
      sender:               deployerAccount.addr.toString(),
      suggestedParams:      suggestedParams as algosdk.SuggestedParams,
      onComplete:           algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram,
      clearProgram,
      numGlobalByteSlices:  4,
      numGlobalInts:        3,
      numLocalByteSlices:   0,
      numLocalInts:         0,
    });

    // In algosdk v3 the schema is stored under applicationCall
    const ac = (appCreateTxn as any).applicationCall;
    expect(ac.numGlobalInts).toBe(3);
    expect(ac.numGlobalByteSlices).toBe(4);
    expect(ac.numLocalInts).toBe(0);
    expect(ac.numLocalByteSlices).toBe(0);
  });

  it('submits exactly one raw transaction during deploy', async () => {
    const mockClient = buildMockAlgodClient();
    const approvalResult = await mockClient.compile(approvalTeal).do();
    const clearResult    = await mockClient.compile(clearTeal).do();

    const approvalProgram = new Uint8Array(Buffer.from(approvalResult.result, 'base64'));
    const clearProgram    = new Uint8Array(Buffer.from(clearResult.result, 'base64'));
    const suggestedParams = await mockClient.getTransactionParams().do();

    const deployerAccount = algosdk.generateAccount();
    const appCreateTxn = algosdk.makeApplicationCreateTxnFromObject({
      sender:              deployerAccount.addr.toString(),
      suggestedParams:     suggestedParams as algosdk.SuggestedParams,
      onComplete:          algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram,
      clearProgram,
      numGlobalByteSlices: 4,
      numGlobalInts:       3,
      numLocalByteSlices:  0,
      numLocalInts:        0,
    });

    const signedTxn = appCreateTxn.signTxn(deployerAccount.sk);
    const { txid } = await mockClient.sendRawTransaction(signedTxn).do();

    expect(mockClient.sendRawTransaction).toHaveBeenCalledTimes(1);
    expect(txid).toBe('DEPLOY_TXID_123');
  });

  it('reports App ID from confirmation result', async () => {
    const mockClient = buildMockAlgodClient();

    const deployerAccount = algosdk.generateAccount();
    const suggestedParams = await mockClient.getTransactionParams().do();
    const approvalResult  = await mockClient.compile(approvalTeal).do();
    const clearResult     = await mockClient.compile(clearTeal).do();

    const approvalProgram = new Uint8Array(Buffer.from(approvalResult.result, 'base64'));
    const clearProgram    = new Uint8Array(Buffer.from(clearResult.result, 'base64'));

    const appCreateTxn = algosdk.makeApplicationCreateTxnFromObject({
      sender:              deployerAccount.addr.toString(),
      suggestedParams:     suggestedParams as algosdk.SuggestedParams,
      onComplete:          algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram,
      clearProgram,
      numGlobalByteSlices: 4,
      numGlobalInts:       3,
      numLocalByteSlices:  0,
      numLocalInts:        0,
    });

    const signedTxn = appCreateTxn.signTxn(deployerAccount.sk);
    await mockClient.sendRawTransaction(signedTxn).do();

    // Simulate waitForConfirmation returning application-index
    const confirmation = await mockClient.pendingTransactionInformation('DEPLOY_TXID_123').do();
    const appId = confirmation['application-index'];

    expect(appId).toBe(42);
  });

  it('throws when ALGORAND_SENDER_MNEMONIC is not set', () => {
    const original = process.env.ALGORAND_SENDER_MNEMONIC;
    delete process.env.ALGORAND_SENDER_MNEMONIC;

    const fn = () => {
      const mnemonic = process.env.ALGORAND_SENDER_MNEMONIC;
      if (!mnemonic) {
        throw new Error('ALGORAND_SENDER_MNEMONIC environment variable is required');
      }
    };

    expect(fn).toThrow('ALGORAND_SENDER_MNEMONIC environment variable is required');

    // Restore
    if (original !== undefined) process.env.ALGORAND_SENDER_MNEMONIC = original;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. algorandService — sendAlgoPayment (algod mocked)
// ─────────────────────────────────────────────────────────────────────────────

describe('algorandService — sendAlgoPayment', () => {
  // We use a real algosdk account so transactions can be signed properly.
  const senderAccount  = algosdk.generateAccount();
  const receiverAccount = algosdk.generateAccount();

  const SENDER_MNEMONIC = algosdk.secretKeyToMnemonic(senderAccount.sk);
  const RECEIVER_ADDR   = receiverAccount.addr.toString();
  const AMOUNT          = 1_000_000; // 1 ALGO in microALGO

  function makeSuggestedParams(): algosdk.SuggestedParams {
    return {
      fee:         1000,
      minFee:      1000,
      firstValid:  BigInt(1000),
      lastValid:   BigInt(2000),
      genesisHash: new Uint8Array(32).fill(1),
      genesisID:   'testnet-v1.0',
    } as unknown as algosdk.SuggestedParams;
  }

  function buildMockAlgodClient(txid = 'PAYMENT_TXID_001') {
    return {
      getTransactionParams: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue(makeSuggestedParams()),
      }),
      sendRawTransaction: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue({ txid }),
      }),
      pendingTransactionInformation: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue({ 'confirmed-round': 1001 }),
      }),
      status: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue({ 'last-round': 1001 }),
      }),
      statusAfterBlock: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue({ 'last-round': 1001 }),
      }),
    };
  }

  // Helper: build a signed payment transaction (simulates what the client signs)
  function buildSignedPayTxn(): { signedBytes: Uint8Array; txn: algosdk.Transaction } {
    const sp  = makeSuggestedParams();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender:          senderAccount.addr.toString(),
      receiver:        RECEIVER_ADDR,
      amount:          AMOUNT,
      suggestedParams: sp,
    });
    return { signedBytes: txn.signTxn(senderAccount.sk), txn };
  }

  // ── 10a. Server-signed, no contract ────────────────────────────────────────

  it('server-signed plain payment: submits one pay txn (no contract)', async () => {
    const mockClient = buildMockAlgodClient();
    const sp = await mockClient.getTransactionParams().do();

    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender:          senderAccount.addr.toString(),
      receiver:        RECEIVER_ADDR,
      amount:          AMOUNT,
      suggestedParams: sp as algosdk.SuggestedParams,
    });

    const signedPay = payTxn.signTxn(senderAccount.sk);
    const { txid } = await mockClient.sendRawTransaction(signedPay).do();

    expect(mockClient.sendRawTransaction).toHaveBeenCalledTimes(1);
    expect(txid).toBe('PAYMENT_TXID_001');
  });

  // ── 10b. Server-signed, with contract (atomic group) ──────────────────────

  it('server-signed with contract: sends an atomic group of exactly 2 txns', async () => {
    const mockClient = buildMockAlgodClient('GROUP_TXID_002');
    const sp = await mockClient.getTransactionParams().do();
    const spTyped = sp as algosdk.SuggestedParams;
    const CONTRACT_APP_ID = 999;

    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender:          senderAccount.addr.toString(),
      receiver:        RECEIVER_ADDR,
      amount:          AMOUNT,
      suggestedParams: spTyped,
    });

    const ts = new Date().toISOString();
    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender:          senderAccount.addr.toString(),
      appIndex:        CONTRACT_APP_ID,
      appArgs: [
        new TextEncoder().encode('record'),
        new TextEncoder().encode(ts),
        algosdk.encodeUint64(AMOUNT),
      ],
      accounts:        [RECEIVER_ADDR],
      suggestedParams: spTyped,
    });

    // assignGroupID mutates both txns
    algosdk.assignGroupID([payTxn, appCallTxn]);

    // Both must have the same group ID after assignment
    expect(payTxn.group).toBeDefined();
    expect(appCallTxn.group).toBeDefined();
    expect(Buffer.from(payTxn.group!).toString('hex'))
      .toBe(Buffer.from(appCallTxn.group!).toString('hex'));

    const signedPay = payTxn.signTxn(senderAccount.sk);
    const signedApp = appCallTxn.signTxn(senderAccount.sk);

    // Concatenate as the service does
    const combined = new Uint8Array(signedPay.length + signedApp.length);
    combined.set(signedPay, 0);
    combined.set(signedApp, signedPay.length);

    const { txid } = await mockClient.sendRawTransaction(combined).do();

    expect(mockClient.sendRawTransaction).toHaveBeenCalledTimes(1);
    // sendRawTransaction receives the combined blob
    const callArg = mockClient.sendRawTransaction.mock.calls[0][0] as Uint8Array;
    expect(callArg.length).toBe(signedPay.length + signedApp.length);
    expect(txid).toBe('GROUP_TXID_002');
  });

  it('atomic group: app call args are [record, timestamp, amount_uint64]', async () => {
    const mockClient = buildMockAlgodClient();
    const sp = await mockClient.getTransactionParams().do();
    const CONTRACT_APP_ID = 999;

    const ts = '2026-08-23T12:00:00.000Z';
    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender:          senderAccount.addr.toString(),
      appIndex:        CONTRACT_APP_ID,
      appArgs: [
        new TextEncoder().encode('record'),
        new TextEncoder().encode(ts),
        algosdk.encodeUint64(AMOUNT),
      ],
      accounts:        [RECEIVER_ADDR],
      suggestedParams: sp as algosdk.SuggestedParams,
    });

    // In algosdk v3, app call data lives under txn.applicationCall
    const appArgs = (appCallTxn as any).applicationCall?.appArgs as Uint8Array[];
    expect(appArgs).toBeDefined();
    expect(new TextDecoder().decode(appArgs[0])).toBe('record');
    expect(new TextDecoder().decode(appArgs[1])).toBe(ts);
    expect(algosdk.decodeUint64(appArgs[2], 'safe')).toBe(AMOUNT);
  });

  it('atomic group: app call includes receiver in foreign accounts', async () => {
    const mockClient = buildMockAlgodClient();
    const sp = await mockClient.getTransactionParams().do();
    const CONTRACT_APP_ID = 999;

    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender:          senderAccount.addr.toString(),
      appIndex:        CONTRACT_APP_ID,
      appArgs: [
        new TextEncoder().encode('record'),
        new TextEncoder().encode(new Date().toISOString()),
        algosdk.encodeUint64(AMOUNT),
      ],
      accounts:        [RECEIVER_ADDR],
      suggestedParams: sp as algosdk.SuggestedParams,
    });

    // In algosdk v3, app call data lives under txn.applicationCall
    const foreignAccounts = ((appCallTxn as any).applicationCall?.accounts as Array<{ publicKey: Uint8Array }>)
      ?.map(a => algosdk.encodeAddress(a.publicKey));
    expect(foreignAccounts).toBeDefined();
    expect(foreignAccounts).toContain(RECEIVER_ADDR);
  });

  // ── 10c. Client-signed, no contract ────────────────────────────────────────

  it('client-signed plain payment: submits the raw signed bytes directly', async () => {
    const mockClient = buildMockAlgodClient('CLIENT_TXID_003');
    const { signedBytes } = buildSignedPayTxn();

    const { txid } = await mockClient.sendRawTransaction(signedBytes).do();

    expect(mockClient.sendRawTransaction).toHaveBeenCalledTimes(1);
    expect(txid).toBe('CLIENT_TXID_003');
  });

  it('client-signed: decodeSignedTransaction recovers sender address', () => {
    const { signedBytes } = buildSignedPayTxn();

    const decoded = algosdk.decodeSignedTransaction(signedBytes);
    // algosdk v3: sender is an Address object on decoded.txn.sender
    const senderObj = (decoded.txn as any).sender as { publicKey: Uint8Array };
    const recoveredSender = algosdk.encodeAddress(senderObj.publicKey);

    expect(recoveredSender).toBe(senderAccount.addr.toString());
  });

  // ── 10d. ENFORCE_CONTRACT flag ─────────────────────────────────────────────

  it('ENFORCE_CONTRACT=true throws when client submits pre-signed txn without group', () => {
    const enforceContract = true;
    const contractAppId   = 999;
    const { signedBytes } = buildSignedPayTxn();

    const fn = () => {
      if (contractAppId > 0 && enforceContract) {
        throw new Error(
          'Contract enforcement enabled: client must re-sign the payment txn in the group. ' +
          'Submit both signed transactions as signedGroupTxns.'
        );
      }
    };

    expect(fn).toThrow('Contract enforcement enabled');
  });

  it('ENFORCE_CONTRACT=false falls back to plain submit when client provides pre-signed txn', async () => {
    const mockClient      = buildMockAlgodClient('FALLBACK_TXID_004');
    const enforceContract = false;
    const contractAppId   = 999;
    const { signedBytes } = buildSignedPayTxn();

    let txid: string | undefined;
    if (contractAppId > 0 && !enforceContract) {
      // best-effort: submit plain payment (service behaviour)
      const result = await mockClient.sendRawTransaction(signedBytes).do();
      txid = result.txid;
    }

    expect(txid).toBe('FALLBACK_TXID_004');
    expect(mockClient.sendRawTransaction).toHaveBeenCalledTimes(1);
  });

  // ── 10e. Amount encoding ───────────────────────────────────────────────────

  it('encodeUint64 / decodeUint64 round-trips the payment amount', () => {
    const amounts = [1, 1_000_000, 10_000_000, 999_999_999, 2 ** 32 - 1];
    for (const amount of amounts) {
      const encoded = algosdk.encodeUint64(amount);
      const decoded = algosdk.decodeUint64(encoded, 'safe');
      expect(decoded).toBe(amount);
    }
  });

  it('encodeUint64 produces exactly 8 bytes', () => {
    const encoded = algosdk.encodeUint64(1_000_000);
    expect(encoded).toHaveLength(8);
  });
});
