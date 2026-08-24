import { NextRequest } from 'next/server';
import { GET, POST } from './route';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function testTradeIsPreparedNotExecuted(): Promise<void> {
  const request = new NextRequest('http://localhost/api/v2/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: '/trade TEST-MARKET YES 25',
      sessionId: 'copilot-safety-test',
    }),
  });
  const response = await POST(request);
  const payload = await response.json();

  assert(response.status === 200, `Agent route returned ${response.status}.`);
  assert(payload.data.executionPolicy === 'prepare_only', 'Copilot must use prepare-only execution.');
  assert(payload.data.structuredData?.kind === 'execution_review', 'Trade must become an execution review.');
  assert(payload.data.structuredData?.executable === false, 'Prepared actions must not be executable server-side.');
  assert(payload.data.structuredData?.requiresWalletSignature === true, 'Prepared actions must require a wallet signature.');
  assert(payload.data.suggestedActions?.[0] === '/quote TEST-MARKET YES 25', 'Trade review must route through a live quote.');
}

async function testCapabilityContractAdvertisesSafetyBoundary(): Promise<void> {
  const request = new NextRequest('http://localhost/api/v2/agent');
  const response = await GET(request);
  const payload = await response.json();

  assert(response.status === 200, `Agent info returned ${response.status}.`);
  assert(payload.data.executionPolicy.mode === 'prepare_only', 'Agent info must publish prepare-only mode.');
  assert(payload.data.executionPolicy.serverCanSign === false, 'The server must never claim signing authority.');
  assert(payload.data.executionPolicy.walletConfirmationRequired === true, 'Wallet confirmation must be explicit.');
}

async function testWalletCommandsCannotCreateServerCustody(): Promise<void> {
  const request = new NextRequest('http://localhost/api/v2/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: '/wallet',
      sessionId: 'copilot-wallet-safety-test',
    }),
  });
  const response = await POST(request);
  const payload = await response.json();

  assert(response.status === 200, `Wallet safety request returned ${response.status}.`);
  assert(payload.data.structuredData?.kind === 'execution_review', 'Wallet management must stay in a review flow.');
  assert(payload.data.structuredData?.executable === false, 'Copilot must not create server custody.');
}

async function main(): Promise<void> {
  await testTradeIsPreparedNotExecuted();
  console.log('✓ trade commands are prepared, not executed');
  await testCapabilityContractAdvertisesSafetyBoundary();
  console.log('✓ capability contract publishes the wallet safety boundary');
  await testWalletCommandsCannotCreateServerCustody();
  console.log('✓ wallet commands cannot create server custody');
}

void main();
