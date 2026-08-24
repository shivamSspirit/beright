declare module '@jup-ag/lend/earn' {
  import type BN from 'bn.js';
  import type { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';

  interface BaseParams {
    asset: PublicKey;
    signer: PublicKey;
    connection: Connection;
    market?: 'main' | 'ethena';
  }

  interface AmountParams extends BaseParams {
    amount: BN;
  }

  interface ShareParams extends BaseParams {
    shares: BN;
  }

  export function getDepositIxs(params: AmountParams): Promise<{ ixs: TransactionInstruction[] }>;
  export function getWithdrawIxs(params: AmountParams): Promise<{ ixs: TransactionInstruction[] }>;
  export function getRedeemIxs(params: ShareParams): Promise<{ ixs: TransactionInstruction[] }>;

  export function getUserLendingPositionByAsset(params: {
    user: PublicKey;
    asset: PublicKey;
    connection: Connection;
    market: 'main' | 'ethena';
  }): Promise<{
    lendingTokenShares: BN;
    underlyingAssets: BN;
    underlyingBalance: BN;
  }>;

  export function getLendingTokenDetails(params: {
    lendingToken: PublicKey;
    connection: Connection;
    market: 'main' | 'ethena';
  }): Promise<{
    address: PublicKey;
    asset: PublicKey;
    decimals: number;
    totalAssets: BN;
    totalSupply: BN;
    convertToShares: BN;
    convertToAssets: BN;
    rewardsRate: BN;
    supplyRate: BN;
  }>;
}
