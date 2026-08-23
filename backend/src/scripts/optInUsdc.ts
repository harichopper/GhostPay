/**
 * optInUsdc.ts — opt signer wallet into USDC ASA 10458941 on testnet
 */
import algosdk from 'algosdk';
import { env } from '../config/env.js';

const USDC_TESTNET_ASA = 10458941n;

async function run() {
  if (!env.signerMnemonic) throw new Error('ALGORAND_SENDER_MNEMONIC not set');
  const acc = algosdk.mnemonicToSecretKey(env.signerMnemonic);
  const algod = new algosdk.Algodv2(env.algodToken, env.algodServer, env.algodPort);

  // Check if already opted in
  const info = await algod.accountInformation(acc.addr.toString()).do() as {
    assets?: Array<{ 'asset-id'?: bigint | number }>;
  };
  const alreadyIn = (info.assets ?? []).some(a => Number(a['asset-id']) === 10458941);
  if (alreadyIn) {
    console.log('Already opted into USDC ASA 10458941 ✓');
    const bal = info as { assets?: Array<{ 'asset-id'?: bigint | number; amount?: bigint | number }> };
    const usdcAsset = (bal.assets ?? []).find(a => Number(a['asset-id']) === 10458941);
    const usdcBalance = usdcAsset ? Number(usdcAsset.amount ?? 0) : 0;
    console.log('USDC balance:  ', usdcBalance, 'atomic =', (usdcBalance / 1_000_000).toFixed(6), 'USDC');
    if (usdcBalance < 100_000) {
      console.log('');
      console.log('⚠️  Need USDC? Fund this wallet at the Circle testnet faucet:');
      console.log('    https://faucet.circle.com/');
      console.log('    → Select "Algorand Testnet", paste address, click "Send 20 USDC"');
      console.log('    Address:', acc.addr.toString());
    } else {
      console.log('✓ Wallet has sufficient USDC for the demo.');
    }
    return;
  }

  const sp = await algod.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: acc.addr.toString(),
    receiver: acc.addr.toString(),
    amount: 0n,
    assetIndex: USDC_TESTNET_ASA,
    suggestedParams: sp
  });

  const signed = txn.signTxn(acc.sk);
  const sent = await algod.sendRawTransaction(signed).do();
  const conf = await algosdk.waitForConfirmation(algod, sent.txid, 3);
  console.log('✅ USDC opt-in confirmed');
  console.log('TxId:', sent.txid);
  console.log('Confirmed round:', Number(conf.confirmedRound));
  console.log('');
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('Next step: fund this wallet with testnet USDC');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');
  console.log('  Wallet address:', acc.addr.toString());
  console.log('  Asset ID:       10458941 (USDC testnet)');
  console.log('  Amount needed:  ≥ 0.10 USDC (100000 atomic)');
  console.log('');
  console.log('  Option 1 — Circle Testnet Faucet (recommended):');
  console.log('    https://faucet.circle.com/');
  console.log('    1. Select "Algorand Testnet" from the network dropdown');
  console.log('    2. Paste your wallet address above');
  console.log('    3. Click "Send 20 USDC"');
  console.log('');
  console.log('  Option 2 — Lora Faucet (ALGO only, then swap):');
  console.log('    https://lora.algokit.io/testnet/fund');
  console.log('');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
