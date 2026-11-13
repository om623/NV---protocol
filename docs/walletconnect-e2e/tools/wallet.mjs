// Headless TEST wallet (test tooling only, lives outside the repository).
// Speaks the real WalletConnect protocol over the real Reown relay with the same Project ID, so the NV dApp side is exercised for real.
//
//   node wallet.mjs <uri> <mode>
//   mode: known-arc  -> this wallet knows Arc and Arc Testnet and approves them in the session
//         no-arc     -> this wallet does NOT know Arc (a wallet without Arc configured)
//         reject     -> rejects the pairing request
// Control: write one command per line to ./cmd.txt   (disconnect | chain <decimalId> | exit)
import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import fs from 'node:fs';

const [, , uri, mode = 'known-arc'] = process.argv;
const projectId = process.env.WC_PROJECT_ID;
if (!projectId || !uri) { console.log('usage: WC_PROJECT_ID=... node wallet.mjs <uri> <mode>'); process.exit(2); }

const log = (m) => console.log(`[wallet ${new Date().toISOString().slice(11, 23)}] ${m}`);
const account = privateKeyToAccount(generatePrivateKey());
const ARC = [5042002, 5042];
const known = new Set(mode === 'known-arc' ? [1, 8453, 11155111, ...ARC] : [1, 8453, 11155111]);
const METHODS = ['eth_sendTransaction', 'personal_sign', 'eth_sign', 'eth_signTransaction', 'eth_signTypedData', 'eth_signTypedData_v4', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'eth_accounts', 'eth_requestAccounts'];

const core = new Core({ projectId });
const wk = await WalletKit.init({ core, metadata: { name: 'NV Test Wallet', description: 'headless test wallet', url: 'https://nv-test-wallet.invalid', icons: [] } });
log(`address ${account.address} mode=${mode}`);

const activeSessions = () => Object.values(wk.getActiveSessions());

wk.on('session_proposal', async (p) => {
  const req = p.params.requiredNamespaces?.eip155?.chains ?? [];
  const opt = p.params.optionalNamespaces?.eip155?.chains ?? [];
  log(`PROPOSAL from=${p.params.proposer.metadata.url} required=${JSON.stringify(req)} optional=${opt.length} arcAsked=${opt.includes('eip155:5042002') && opt.includes('eip155:5042')} mainnetAsked=${[...req, ...opt].includes('eip155:1')} total=${new Set([...req, ...opt]).size}`);
  log(`RAW requiredNamespaces=${JSON.stringify(p.params.requiredNamespaces)} optionalKeys=${Object.keys(p.params.optionalNamespaces ?? {})} optMethods=${JSON.stringify(p.params.optionalNamespaces?.eip155?.methods)} optEvents=${JSON.stringify(p.params.optionalNamespaces?.eip155?.events)} firstOptional=${JSON.stringify((p.params.optionalNamespaces?.eip155?.chains ?? []).slice(0, 3))}`);
  if (mode === 'reject') {
    await wk.rejectSession({ id: p.id, reason: getSdkError('USER_REJECTED') });
    log('REJECTED the pairing');
    return;
  }
  const chains = [...known].map((c) => `eip155:${c}`);
  const namespaces = buildApprovedNamespaces({
    proposal: p.params,
    supportedNamespaces: { eip155: { chains, methods: METHODS, events: ['chainChanged', 'accountsChanged'], accounts: chains.map((c) => `${c}:${account.address}`) } },
  });
  await wk.approveSession({ id: p.id, namespaces });
  log(`APPROVED chains=${namespaces.eip155.chains.join(',')}`);
});

wk.on('session_request', async (e) => {
  const { topic, id, params } = e;
  const { request, chainId } = params;
  log(`REQUEST ${request.method} on ${chainId} ${JSON.stringify(request.params ?? []).slice(0, 140)}`);
  const respond = (result) => wk.respondSessionRequest({ topic, response: { id, jsonrpc: '2.0', result } });
  const fail = (code, message) => wk.respondSessionRequest({ topic, response: { id, jsonrpc: '2.0', error: { code, message } } });
  try {
    if (request.method === 'wallet_switchEthereumChain') {
      const cid = parseInt(request.params[0].chainId, 16);
      if (!known.has(cid)) { log(`  -> 4902 unknown chain ${cid}`); return await fail(4902, 'Unrecognized chain ID'); }
      await respond(null);
      await wk.emitSessionEvent({ topic, event: { name: 'chainChanged', data: cid }, chainId: `eip155:${cid}` });
      log(`  -> switched to ${cid}`);
      return;
    }
    if (request.method === 'wallet_addEthereumChain') {
      const cid = parseInt(request.params[0].chainId, 16);
      known.add(cid);
      log(`  -> user approved adding chain ${cid} (${request.params[0].chainName})`);
      return await respond(null);
    }
    log('  -> user rejected (this test wallet never signs or sends anything)');
    await fail(4001, 'User rejected the request');
  } catch (err) { log(`  !! ${err.message}`); }
});

wk.on('session_delete', () => log('SESSION_DELETED (by the dApp / NV)'));
await wk.pair({ uri });
log('PAIRED (waiting for the proposal)');

let seen = 0;
const poll = setInterval(async () => {
  let lines = [];
  try { lines = fs.readFileSync('cmd.txt', 'utf8').split('\n').filter(Boolean); } catch { return; }
  for (const line of lines.slice(seen)) {
    const [cmd, arg] = line.trim().split(/\s+/);
    log(`CMD ${line.trim()}`);
    if (cmd === 'disconnect') { for (const s of activeSessions()) await wk.disconnectSession({ topic: s.topic, reason: getSdkError('USER_DISCONNECTED') }); log('disconnected from the wallet side'); }
    if (cmd === 'chain') { const cid = Number(arg); for (const s of activeSessions()) await wk.emitSessionEvent({ topic: s.topic, event: { name: 'chainChanged', data: cid }, chainId: `eip155:${cid}` }); log(`emitted chainChanged ${cid}`); }
    if (cmd === 'exit') { clearInterval(poll); process.exit(0); }
  }
  seen = lines.length;
}, 400);
