import type { CapitalStrategyProvider } from './types';

export function isCapitalStrategyPreparationEnabled(): boolean {
  return process.env.CAPITAL_STRATEGY_PREPARE_ENABLED === 'true';
}

export function getCapitalStrategyProviders(): CapitalStrategyProvider[] {
  const jupiterEnabled = isCapitalStrategyPreparationEnabled();

  return [
    {
      id: 'jupiter_earn',
      name: 'Jupiter Lend Earn',
      status: jupiterEnabled ? 'transaction_ready' : 'configuration_required',
      asset: 'USDC',
      custody: 'user_wallet',
      supports: ['deposit', 'withdraw', 'position'],
      reason: jupiterEnabled
        ? null
        : 'Set CAPITAL_STRATEGY_PREPARE_ENABLED=true after reviewing the configured RPC and transaction cap.',
    },
    {
      id: 'kamino_earn',
      name: 'Kamino Earn',
      status: 'partner_required',
      asset: 'USDC',
      custody: 'user_wallet',
      supports: [],
      reason: 'A specific audited vault, allocation policy, and partner configuration must be approved before transactions are exposed.',
    },
    {
      id: 'loopscale_vault',
      name: 'Loopscale Vault',
      status: 'partner_required',
      asset: 'USDC',
      custody: 'user_wallet',
      supports: [],
      reason: 'A specific vault and signed transaction validation policy must be approved before its API-built transactions are exposed.',
    },
  ];
}
