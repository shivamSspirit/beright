'use client';

/**
 * Conviction Markets Page
 *
 * Browse conviction markets where crypto projects stake on their milestones.
 * Projects stake SOL to back their claims, creating on-chain accountability.
 *
 * On-chain program: E6Gp6fzaPM6y1k3wLYBFno1oMZjZvNbaFszVGzvXaZX9 (devnet)
 */

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUnifiedUser';
import { useMode } from '@/context/ModeContext';
import { ConvictionStakeModal } from '@/components/ConvictionStakeModal';
import { useConvictionEscrow } from '@/hooks/useConvictionEscrow';
import PageHeader from '@/components/PageHeader';

// ============================================================================
// CONSTANTS
// ============================================================================

const PROGRAM_ID = 'E6Gp6fzaPM6y1k3wLYBFno1oMZjZvNbaFszVGzvXaZX9';

// ============================================================================
// TYPES
// ============================================================================

interface ConvictionProject {
  id: string;
  slug: string;
  name: string;
  category: string;
  convictionScore: number;
  totalStaked: number;
  marketsCreated: number;
  successRate: number;
  verified: boolean;
}

interface ConvictionMarket {
  id: string;
  projectId: string;
  question: string;
  milestoneType: string;
  stakeAmount: number;
  stakePosition: 'yes' | 'no';
  yesPrice: number;
  noPrice: number;
  status: string;
  resolutionDate: string;
  project?: ConvictionProject;
}

interface OnChainMarket {
  marketPda: string;
  vaultPda: string;
  projectWallet: string;
  resolver: string;
  stakeAmountSol: number;
  stakePosition: 'yes' | 'no';
  resolutionDate: number;
  resolutionDateISO: string;
  status: 'pending_stake' | 'active' | 'resolved' | 'claimed';
  outcome: 'none' | 'yes' | 'no' | 'invalid';
  createdAt: number;
  vaultBalanceSol: number;
}

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchProjects(): Promise<ConvictionProject[]> {
  try {
    const res = await fetch('/api/v2/conviction/projects?leaderboard=true&limit=10');
    const json = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
}

async function fetchMarkets(): Promise<ConvictionMarket[]> {
  try {
    const res = await fetch('/api/v2/conviction/markets?active=true&limit=20');
    const json = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
}

async function fetchOnChainMarket(projectWallet: string): Promise<OnChainMarket | null> {
  try {
    const res = await fetch(`/api/v2/conviction/escrow?projectWallet=${projectWallet}`);
    const json = await res.json();
    if (!json.success) return null;

    const { market, pdas, vaultBalanceSol } = json.data;
    return {
      marketPda: pdas?.marketPda || '',
      vaultPda: pdas?.vaultPda || '',
      projectWallet: market.projectWallet,
      resolver: market.resolver,
      stakeAmountSol: market.stakeAmount,
      stakePosition: market.stakePosition,
      resolutionDate: market.resolutionDate,
      resolutionDateISO: market.resolutionDateISO,
      status: market.status,
      outcome: market.outcome,
      createdAt: market.createdAt,
      vaultBalanceSol: vaultBalanceSol || 0,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

function OnChainMarketCard({
  market,
  network,
}: {
  market: OnChainMarket;
  network: 'devnet' | 'mainnet-beta';
}) {
  const resolutionDate = new Date(market.resolutionDateISO);
  const daysUntilResolution = Math.ceil(
    (resolutionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isPastResolution = daysUntilResolution <= 0;

  const statusColors = {
    pending_stake: 'bg-amber-500/20 text-amber-400',
    active: 'bg-emerald-500/20 text-emerald-400',
    resolved: 'bg-blue-500/20 text-blue-400',
    claimed: 'bg-gray-500/20 text-gray-400',
  };

  const explorerUrl = `https://orbmarkets.io/address/${market.marketPda}?cluster=${network}`;

  return (
    <div className="bg-[#161b22] border border-emerald-500/30 rounded-xl p-5 hover:border-emerald-500/50 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-emerald-400 text-xs font-mono px-2 py-0.5 bg-emerald-500/10 rounded">
              ON-CHAIN
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[market.status]}`}>
              {market.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <p className="text-white font-medium">
            {market.stakePosition === 'yes' ? 'Project backs' : 'Project hedges'} milestone
          </p>
          <p className="text-gray-500 text-sm mt-1 font-mono truncate">
            {market.projectWallet.slice(0, 8)}...{market.projectWallet.slice(-6)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#0d1117] rounded-lg p-3">
          <p className="text-gray-500 text-xs mb-1">Staked</p>
          <p className="text-white text-xl font-bold">{market.vaultBalanceSol.toFixed(2)} SOL</p>
        </div>
        <div className="bg-[#0d1117] rounded-lg p-3">
          <p className="text-gray-500 text-xs mb-1">Position</p>
          <p className={`text-xl font-bold ${market.stakePosition === 'yes' ? 'text-emerald-400' : 'text-red-400'}`}>
            {market.stakePosition.toUpperCase()}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>
          <p className="text-gray-500">Resolution</p>
          <p className="text-white">
            {resolutionDate.toLocaleDateString()}
            {!isPastResolution && (
              <span className="text-gray-500 ml-1">({daysUntilResolution}d)</span>
            )}
          </p>
        </div>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1"
        >
          View on Explorer
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {market.status === 'resolved' && (
        <div className="mt-4 pt-4 border-t border-[#30363d]">
          <p className="text-gray-400 text-sm">
            Outcome:{' '}
            <span className={market.outcome === 'yes' ? 'text-emerald-400' : market.outcome === 'no' ? 'text-red-400' : 'text-gray-400'}>
              {market.outcome.toUpperCase()}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ConvictionProject }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 hover:border-emerald-500/50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
            {project.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-white font-medium flex items-center gap-2">
              {project.name}
              {project.verified && (
                <span className="text-emerald-400 text-xs">Verified</span>
              )}
            </h3>
            <p className="text-gray-500 text-sm capitalize">{project.category}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-400">
            {project.convictionScore}
          </p>
          <p className="text-gray-500 text-xs">Conviction Score</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-[#0d1117] rounded-lg p-2 text-center">
          <p className="text-white font-medium">{project.totalStaked} SOL</p>
          <p className="text-gray-500 text-xs">Staked</p>
        </div>
        <div className="bg-[#0d1117] rounded-lg p-2 text-center">
          <p className="text-white font-medium">{project.marketsCreated}</p>
          <p className="text-gray-500 text-xs">Markets</p>
        </div>
        <div className="bg-[#0d1117] rounded-lg p-2 text-center">
          <p className="text-white font-medium">{project.successRate}%</p>
          <p className="text-gray-500 text-xs">Success</p>
        </div>
      </div>
    </div>
  );
}

function MarketCard({ market }: { market: ConvictionMarket }) {
  const resolutionDate = new Date(market.resolutionDate);
  const daysUntilResolution = Math.ceil(
    (resolutionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 hover:border-emerald-500/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-white font-medium leading-tight">{market.question}</p>
          <p className="text-gray-500 text-sm mt-1">
            {market.project?.name || 'Unknown Project'}
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            market.status === 'active'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {market.status}
        </span>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex gap-4">
          <div>
            <p className="text-emerald-400 font-bold text-lg">
              {Math.round(market.yesPrice * 100)}%
            </p>
            <p className="text-gray-500 text-xs">YES</p>
          </div>
          <div>
            <p className="text-red-400 font-bold text-lg">
              {Math.round(market.noPrice * 100)}%
            </p>
            <p className="text-gray-500 text-xs">NO</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-white font-medium">{market.stakeAmount} SOL</p>
          <p className="text-gray-500 text-xs">
            {daysUntilResolution > 0
              ? `${daysUntilResolution}d until resolution`
              : 'Resolution pending'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function ConvictionPage() {
  // User authentication (works in both demo and production mode)
  const { user, walletAddress, isAuthenticated, isLoading, login } = useUser();
  const ready = !isLoading;
  const authenticated = isAuthenticated;
  const { network, isDemo } = useMode();

  // On-chain escrow hook for connected wallet
  const {
    escrowState,
    hasMarket: hasOnChainMarket,
    loading: escrowLoading,
    connected,
    ownerPubkey,
  } = useConvictionEscrow();

  const [projects, setProjects] = useState<ConvictionProject[]>([]);
  const [markets, setMarkets] = useState<ConvictionMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStakeModal, setShowStakeModal] = useState(false);

  // Load data when authenticated
  useEffect(() => {
    if (!ready || !authenticated) return;

    async function loadData() {
      setLoading(true);
      const [projectsData, marketsData] = await Promise.all([
        fetchProjects(),
        fetchMarkets(),
      ]);
      setProjects(projectsData);
      setMarkets(marketsData);
      setLoading(false);
    }
    loadData();
  }, [ready, authenticated]);

  // ─────────────────────────────────────────────────────────────────────────────
  // LOADING STATE - Privy initializing
  // ─────────────────────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONNECT WALLET PROMPT
  // ─────────────────────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-6 px-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Conviction Markets</h1>
          <p className="text-gray-400 max-w-md">
            Connect your wallet to browse conviction markets and stake on project milestones.
          </p>
        </div>
        <button
          onClick={login}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  // Convert escrow state to OnChainMarket format for display
  const onChainMarket: OnChainMarket | null = escrowState
    ? {
        marketPda: escrowState.marketPda,
        vaultPda: escrowState.vaultPda,
        projectWallet: escrowState.projectWallet,
        resolver: escrowState.resolver,
        stakeAmountSol: escrowState.stakeAmountSol,
        stakePosition: escrowState.stakePosition,
        resolutionDate: escrowState.resolutionDate,
        resolutionDateISO: escrowState.resolutionDateISO,
        status: escrowState.status,
        outcome: escrowState.outcome,
        createdAt: escrowState.createdAt,
        vaultBalanceSol: escrowState.vaultBalanceSol,
      }
    : null;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <PageHeader title="Conviction Markets" />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Network Banner */}
        {isDemo && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 mb-6 flex items-center gap-2">
            <span className="text-amber-400 text-sm font-medium">Devnet Mode</span>
            <span className="text-gray-400 text-sm">
              Program: <code className="font-mono text-xs">{PROGRAM_ID}</code>
            </span>
          </div>
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-2xl p-8 mb-8">
          <h1 className="text-3xl font-bold mb-3">Put Your Money Where Your Mouth Is</h1>
          <p className="text-gray-300 mb-6 max-w-2xl">
            Conviction markets let crypto projects stake real SOL on their milestones.
            If they deliver, they keep their stake. If not, it goes to the community.
            On-chain accountability.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowStakeModal(true)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
            >
              Create Conviction Market
            </button>
            {connected && hasOnChainMarket && (
              <span className="text-emerald-400 text-sm">
                You have an active market
              </span>
            )}
          </div>
        </div>

        {/* Your On-Chain Market */}
        {connected && !escrowLoading && hasOnChainMarket && onChainMarket && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              Your On-Chain Market
              <span className="text-emerald-400 text-xs font-mono px-2 py-0.5 bg-emerald-500/10 rounded">
                LIVE
              </span>
            </h2>
            <OnChainMarketCard market={onChainMarket} network={network} />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Active Markets */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                Active Markets
                <span className="text-gray-500 text-sm font-normal">
                  ({markets.length})
                </span>
              </h2>

              {markets.length === 0 ? (
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center">
                  <p className="text-gray-400 mb-4">No active markets yet</p>
                  <button
                    onClick={() => setShowStakeModal(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
                  >
                    Be the first to create one
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {markets.map((market) => (
                    <MarketCard key={market.id} market={market} />
                  ))}
                </div>
              )}
            </div>

            {/* Leaderboard */}
            <div>
              <h2 className="text-xl font-bold mb-4">Top Projects</h2>

              {projects.length === 0 ? (
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 text-center">
                  <p className="text-gray-400">No projects yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.map((project, index) => (
                    <div key={project.id} className="flex items-start gap-3">
                      <span className="text-gray-500 font-medium w-6">
                        #{index + 1}
                      </span>
                      <div className="flex-1">
                        <ProjectCard project={project} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Stake Modal */}
      <ConvictionStakeModal
        isOpen={showStakeModal}
        onClose={() => setShowStakeModal(false)}
        projectName="Your Project"
        milestoneQuestion="Will you achieve your milestone?"
      />
    </div>
  );
}
