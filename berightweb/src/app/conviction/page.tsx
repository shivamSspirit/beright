'use client';

/**
 * Conviction Markets Page
 *
 * Browse conviction markets where crypto projects stake on their milestones.
 * Projects stake SOL to back their claims, creating on-chain accountability.
 */

import { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { ConvictionStakeModal } from '@/components/ConvictionStakeModal';
import PageHeader from '@/components/PageHeader';

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

// ============================================================================
// COMPONENTS
// ============================================================================

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
  const { user, walletAddress } = useUser();

  const [projects, setProjects] = useState<ConvictionProject[]>([]);
  const [markets, setMarkets] = useState<ConvictionMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStakeModal, setShowStakeModal] = useState(false);

  useEffect(() => {
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
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <PageHeader title="Conviction Markets" />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/30 rounded-2xl p-8 mb-8">
          <h1 className="text-3xl font-bold mb-3">Put Your Money Where Your Mouth Is</h1>
          <p className="text-gray-300 mb-6 max-w-2xl">
            Conviction markets let crypto projects stake real SOL on their milestones.
            If they deliver, they keep their stake. If not, it goes to the community.
            On-chain accountability.
          </p>
          <button
            onClick={() => setShowStakeModal(true)}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
          >
            Create Conviction Market
          </button>
        </div>

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
