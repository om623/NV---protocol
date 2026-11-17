import assert from 'node:assert/strict';
import type { AgentAction } from '../src/lib/intelligence';
import { applyNVActionCorrection, parseNVTurn } from '../src/lib/nvAgentCore';

const pendingBridge: AgentAction = {
  type: 'bridge',
  executeInChat: true,
  navigateTo: 'bridge',
  params: { amount: 5, fromNetwork: 'arc-mainnet' },
};

const pendingSwap: AgentAction = {
  type: 'swap',
  executeInChat: true,
  navigateTo: 'swap',
  params: { sourceToken: 'ETH', destinationToken: 'USDC', network: 'base' },
};

assert.equal(parseNVTurn('Como fazer bridge USDC?').intent, 'chat');
assert.equal(parseNVTurn('How do I bridge USDC?').intent, 'chat');
assert.equal(parseNVTurn('What is a bridge?').intent, 'chat');
assert.equal(parseNVTurn('Explain Bitcoin').intent, 'chat');

const bridgeRequest = parseNVTurn('Bridge 5 USDC from Arc Mainnet to Base');
assert.equal(bridgeRequest.intent, 'bridge');
assert.equal(bridgeRequest.params.amount, 5);
assert.equal(bridgeRequest.params.fromNetwork, 'arc-mainnet');
assert.equal(bridgeRequest.params.toNetwork, 'base');

const swapRequest = parseNVTurn('Swap ETH to USDC');
assert.equal(swapRequest.intent, 'swap');
assert.equal(swapRequest.params.sourceToken, 'ETH');
assert.equal(swapRequest.params.destinationToken, 'USDC');

assert.equal(parseNVTurn('What is Base?', pendingBridge).intent, 'chat');
assert.equal(parseNVTurn('Explain Bitcoin', pendingSwap).intent, 'chat');

const destinationReply = applyNVActionCorrection(pendingBridge, 'Base');
assert.equal(destinationReply.action?.type, 'bridge');
assert.equal(destinationReply.action?.params?.fromNetwork, 'arc-mainnet');
assert.equal(destinationReply.action?.params?.toNetwork, 'base');

const amountReply = applyNVActionCorrection(pendingSwap, '0.01');
assert.equal(amountReply.action?.type, 'swap');
assert.equal(amountReply.action?.params?.amount, 0.01);

assert.equal(applyNVActionCorrection(pendingBridge, 'cancel').cancelled, true);
assert.equal(applyNVActionCorrection(pendingBridge, 'confirm').confirmed, true);

console.log('NV Agent general-intelligence routing: all assertions passed');
