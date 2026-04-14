import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import algosdk from 'algosdk';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAlgodClient() {
  return new algosdk.Algodv2(env.algodToken, env.algodServer, env.algodPort);
}

async function updateEnvWithContract(appId: number): Promise<void> {
  const envPath = path.resolve(__dirname, '../../.env');
  let envFile = await fs.readFile(envPath, 'utf8');

  const ensureLine = (key: string, value: string) => {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    if (pattern.test(envFile)) {
      envFile = envFile.replace(pattern, `${key}=${value}`);
      return;
    }

    if (!envFile.endsWith('\n')) {
      envFile += '\n';
    }

    envFile += `${key}=${value}\n`;
  };

  ensureLine('GHOSTPAY_CONTRACT_APP_ID', String(appId));
  ensureLine('ENFORCE_CONTRACT', 'true');

  await fs.writeFile(envPath, envFile, 'utf8');
}

async function compileProgram(client: algosdk.Algodv2, sourcePath: string): Promise<Uint8Array> {
  const source = await fs.readFile(sourcePath, 'utf8');
  const compiled = await client.compile(source).do();
  return new Uint8Array(Buffer.from(compiled.result, 'base64'));
}

async function deployContract() {
  if (!env.signerMnemonic) {
    throw new Error('Set ALGORAND_SENDER_MNEMONIC in backend/.env before deploying contract');
  }

  const account = algosdk.mnemonicToSecretKey(env.signerMnemonic);
  const algod = getAlgodClient();

  const approvalPath = path.resolve(__dirname, '../../contracts/ghostpay_approval.teal');
  const clearPath = path.resolve(__dirname, '../../contracts/ghostpay_clear.teal');

  const [approvalProgram, clearProgram, suggestedParams] = await Promise.all([
    compileProgram(algod, approvalPath),
    compileProgram(algod, clearPath),
    algod.getTransactionParams().do()
  ]);

  const createTxn = algosdk.makeApplicationCreateTxnFromObject({
    sender: account.addr.toString(),
    suggestedParams,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram,
    clearProgram,
    numGlobalInts: 2,
    numGlobalByteSlices: 4,
    numLocalInts: 0,
    numLocalByteSlices: 0
  });

  const signed = createTxn.signTxn(account.sk);
  const sent = await algod.sendRawTransaction(signed).do();
  const confirmed = await algosdk.waitForConfirmation(algod, sent.txid, env.confirmationRounds);

  const appIdValue = (confirmed as { applicationIndex?: number | bigint }).applicationIndex;
  if (!appIdValue) {
    throw new Error('Deployment completed but application id was not returned');
  }

  const appId = Number(appIdValue);

  console.log('GhostPay contract deployed successfully');
  console.log(`Network: ${env.algorandNetwork}`);
  console.log(`Creator: ${account.addr.toString()}`);
  console.log(`App ID: ${appId}`);

  await updateEnvWithContract(appId);
  console.log('Updated backend/.env with:');
  console.log(`GHOSTPAY_CONTRACT_APP_ID=${appId}`);
  console.log('ENFORCE_CONTRACT=true');
}

void deployContract().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
