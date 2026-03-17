/**
 * NSGA-II Multi-Objective Routing
 *
 * Optimizes order routing across multiple objectives simultaneously:
 * - User surplus (higher is better)
 * - Gas costs (lower is better)
 * - Slippage (lower is better)
 * - Execution risk (lower is better)
 *
 * Uses Pareto optimization to find non-dominated solutions.
 *
 * Based on arXiv:2510.21647 on batch auction routing for DeFi.
 *
 * @author BeRight Protocol
 */

import { Platform } from '../dataFabric/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Routing objectives (all should be maximized)
 * We negate costs so higher = better for all
 */
export interface RoutingObjectives {
  userSurplus: number;      // Price improvement over baseline
  negGas: number;           // -gasEstimate (lower gas = higher negGas)
  negSlippage: number;      // -slippage (lower slippage = higher negSlippage)
  negRisk: number;          // -executionRisk (lower risk = higher negRisk)
}

/**
 * Venue quote for routing
 */
export interface VenueQuote {
  platform: Platform;
  price: number;
  liquidity: number;
  fees: number;
  gasEstimate: number;
  estimatedSlippage: number;
  executionRisk: number;    // 0-1
}

/**
 * Route candidate (individual in NSGA-II)
 */
export interface RouteCandidate {
  venues: { platform: Platform; allocation: number }[];
  objectives: RoutingObjectives;
  crowdingDistance: number;
  rank: number;
}

/**
 * NSGA-II configuration
 */
export interface NSGA2Config {
  populationSize: number;
  generations: number;
  crossoverRate: number;
  mutationRate: number;
  minAllocation: number;    // Minimum allocation per venue
  maxVenueCount: number;    // Maximum venues in a route
}

export const DEFAULT_NSGA2_CONFIG: NSGA2Config = {
  populationSize: 50,
  generations: 20,
  crossoverRate: 0.9,
  mutationRate: 0.1,
  minAllocation: 0.05,
  maxVenueCount: 4,
};

// =============================================================================
// NSGA-II ROUTER
// =============================================================================

export class NSGA2Router {
  private config: NSGA2Config;
  private venues: VenueQuote[] = [];
  private orderSize: number = 0;

  constructor(config: Partial<NSGA2Config> = {}) {
    this.config = { ...DEFAULT_NSGA2_CONFIG, ...config };
  }

  /**
   * Optimize routing for an order
   *
   * @returns Pareto-optimal front of routing solutions
   */
  async optimize(
    orderSize: number,
    availableVenues: VenueQuote[]
  ): Promise<RouteCandidate[]> {
    this.orderSize = orderSize;
    this.venues = availableVenues;

    if (availableVenues.length === 0) {
      return [];
    }

    if (availableVenues.length === 1) {
      // Only one venue - no optimization needed
      return [{
        venues: [{ platform: availableVenues[0].platform, allocation: 1 }],
        objectives: this.evaluateObjectives([{ platform: availableVenues[0].platform, allocation: 1 }]),
        crowdingDistance: 0,
        rank: 0,
      }];
    }

    // Initialize population
    let population = this.initializePopulation();

    // Evolution loop
    for (let gen = 0; gen < this.config.generations; gen++) {
      // Evaluate objectives
      for (const candidate of population) {
        candidate.objectives = this.evaluateObjectives(candidate.venues);
      }

      // Non-dominated sorting
      const fronts = this.fastNonDominatedSort(population);

      // Assign crowding distance
      for (const front of fronts) {
        this.assignCrowdingDistance(front);
      }

      // Selection, crossover, mutation
      const offspring = this.evolve(population);

      // Combine parent and offspring
      const combined = [...population, ...offspring];

      // Evaluate offspring
      for (const candidate of offspring) {
        candidate.objectives = this.evaluateObjectives(candidate.venues);
      }

      // Select next generation
      population = this.selectNextGeneration(combined);
    }

    // Final sorting
    const finalFronts = this.fastNonDominatedSort(population);

    // Return first front (Pareto-optimal)
    return finalFronts[0] || [];
  }

  /**
   * Select best solution from Pareto front based on preference
   */
  selectBest(
    front: RouteCandidate[],
    preference: 'balanced' | 'low_cost' | 'low_risk' | 'max_surplus' = 'balanced'
  ): RouteCandidate | null {
    if (front.length === 0) return null;
    if (front.length === 1) return front[0];

    switch (preference) {
      case 'max_surplus':
        return front.reduce((best, c) =>
          c.objectives.userSurplus > best.objectives.userSurplus ? c : best
        );

      case 'low_cost':
        return front.reduce((best, c) =>
          c.objectives.negGas > best.objectives.negGas ? c : best
        );

      case 'low_risk':
        return front.reduce((best, c) =>
          c.objectives.negRisk > best.objectives.negRisk ? c : best
        );

      case 'balanced':
      default:
        // Select by crowding distance (diversity)
        return front.reduce((best, c) =>
          c.crowdingDistance > best.crowdingDistance ? c : best
        );
    }
  }

  // ===========================================================================
  // EVALUATION
  // ===========================================================================

  private evaluateObjectives(
    allocations: { platform: Platform; allocation: number }[]
  ): RoutingObjectives {
    let totalCost = 0;
    let totalSlippage = 0;
    let totalGas = 0;
    let weightedRisk = 0;
    let totalWeight = 0;

    // Baseline price (worst venue)
    const worstPrice = Math.max(...this.venues.map(v => v.price));

    for (const alloc of allocations) {
      if (alloc.allocation <= 0) continue;

      const venue = this.venues.find(v => v.platform === alloc.platform);
      if (!venue) continue;

      const allocSize = this.orderSize * alloc.allocation;

      totalCost += venue.price * allocSize;
      totalSlippage += venue.estimatedSlippage * alloc.allocation;
      totalGas += venue.gasEstimate;
      weightedRisk += venue.executionRisk * alloc.allocation;
      totalWeight += alloc.allocation;
    }

    // User surplus = baseline - actual (positive = good)
    const userSurplus = worstPrice * this.orderSize - totalCost;

    return {
      userSurplus,
      negGas: -totalGas,
      negSlippage: -totalSlippage,
      negRisk: -weightedRisk,
    };
  }

  // ===========================================================================
  // GENETIC OPERATIONS
  // ===========================================================================

  private initializePopulation(): RouteCandidate[] {
    const population: RouteCandidate[] = [];
    const venueCount = this.venues.length;

    for (let i = 0; i < this.config.populationSize; i++) {
      // Random allocation
      const allocations: { platform: Platform; allocation: number }[] = [];

      // Randomly select venues
      const numVenues = Math.min(
        Math.floor(Math.random() * this.config.maxVenueCount) + 1,
        venueCount
      );

      const selectedIndices = new Set<number>();
      while (selectedIndices.size < numVenues) {
        selectedIndices.add(Math.floor(Math.random() * venueCount));
      }

      // Random allocations
      let remaining = 1;
      const indices = Array.from(selectedIndices);

      for (let j = 0; j < indices.length - 1; j++) {
        const alloc = Math.random() * remaining * 0.8 + this.config.minAllocation;
        allocations.push({
          platform: this.venues[indices[j]].platform,
          allocation: Math.min(alloc, remaining),
        });
        remaining -= alloc;
      }

      // Last venue gets remainder
      if (remaining > 0 && indices.length > 0) {
        allocations.push({
          platform: this.venues[indices[indices.length - 1]].platform,
          allocation: remaining,
        });
      }

      // Normalize
      this.normalizeAllocations(allocations);

      population.push({
        venues: allocations,
        objectives: { userSurplus: 0, negGas: 0, negSlippage: 0, negRisk: 0 },
        crowdingDistance: 0,
        rank: 0,
      });
    }

    return population;
  }

  private evolve(population: RouteCandidate[]): RouteCandidate[] {
    const offspring: RouteCandidate[] = [];

    while (offspring.length < population.length) {
      // Tournament selection
      const parent1 = this.tournamentSelect(population);
      const parent2 = this.tournamentSelect(population);

      // Crossover
      let child: RouteCandidate;
      if (Math.random() < this.config.crossoverRate) {
        child = this.crossover(parent1, parent2);
      } else {
        child = this.clone(parent1);
      }

      // Mutation
      if (Math.random() < this.config.mutationRate) {
        this.mutate(child);
      }

      offspring.push(child);
    }

    return offspring;
  }

  private tournamentSelect(population: RouteCandidate[]): RouteCandidate {
    const idx1 = Math.floor(Math.random() * population.length);
    const idx2 = Math.floor(Math.random() * population.length);

    const c1 = population[idx1];
    const c2 = population[idx2];

    // Prefer lower rank, then higher crowding distance
    if (c1.rank < c2.rank) return c1;
    if (c2.rank < c1.rank) return c2;
    if (c1.crowdingDistance > c2.crowdingDistance) return c1;
    return c2;
  }

  private crossover(parent1: RouteCandidate, parent2: RouteCandidate): RouteCandidate {
    // Uniform crossover on allocations
    const allVenues = new Set([
      ...parent1.venues.map(v => v.platform),
      ...parent2.venues.map(v => v.platform),
    ]);

    const childVenues: { platform: Platform; allocation: number }[] = [];

    for (const platform of allVenues) {
      const alloc1 = parent1.venues.find(v => v.platform === platform)?.allocation || 0;
      const alloc2 = parent2.venues.find(v => v.platform === platform)?.allocation || 0;

      // Random blend
      const allocation = Math.random() * alloc1 + (1 - Math.random()) * alloc2;

      if (allocation >= this.config.minAllocation) {
        childVenues.push({ platform, allocation });
      }
    }

    this.normalizeAllocations(childVenues);

    return {
      venues: childVenues,
      objectives: { userSurplus: 0, negGas: 0, negSlippage: 0, negRisk: 0 },
      crowdingDistance: 0,
      rank: 0,
    };
  }

  private mutate(candidate: RouteCandidate): void {
    // Randomly adjust one allocation
    if (candidate.venues.length === 0) return;

    const idx = Math.floor(Math.random() * candidate.venues.length);
    const mutation = (Math.random() - 0.5) * 0.2;

    candidate.venues[idx].allocation += mutation;
    candidate.venues[idx].allocation = Math.max(0, candidate.venues[idx].allocation);

    // Filter out zero allocations
    candidate.venues = candidate.venues.filter(v => v.allocation >= this.config.minAllocation);

    this.normalizeAllocations(candidate.venues);

    // Possibly add a new venue
    if (Math.random() < 0.2 && candidate.venues.length < this.config.maxVenueCount) {
      const unusedVenues = this.venues.filter(
        v => !candidate.venues.some(cv => cv.platform === v.platform)
      );

      if (unusedVenues.length > 0) {
        const newVenue = unusedVenues[Math.floor(Math.random() * unusedVenues.length)];
        candidate.venues.push({
          platform: newVenue.platform,
          allocation: this.config.minAllocation,
        });
        this.normalizeAllocations(candidate.venues);
      }
    }
  }

  private clone(candidate: RouteCandidate): RouteCandidate {
    return {
      venues: candidate.venues.map(v => ({ ...v })),
      objectives: { ...candidate.objectives },
      crowdingDistance: 0,
      rank: 0,
    };
  }

  private normalizeAllocations(allocations: { platform: Platform; allocation: number }[]): void {
    const total = allocations.reduce((sum, a) => sum + a.allocation, 0);
    if (total > 0) {
      for (const alloc of allocations) {
        alloc.allocation /= total;
      }
    }
  }

  // ===========================================================================
  // NON-DOMINATED SORTING
  // ===========================================================================

  private fastNonDominatedSort(population: RouteCandidate[]): RouteCandidate[][] {
    const fronts: RouteCandidate[][] = [[]];
    const dominationCount = new Map<RouteCandidate, number>();
    const dominatedBy = new Map<RouteCandidate, RouteCandidate[]>();

    for (const p of population) {
      dominationCount.set(p, 0);
      dominatedBy.set(p, []);

      for (const q of population) {
        if (this.dominates(p, q)) {
          dominatedBy.get(p)!.push(q);
        } else if (this.dominates(q, p)) {
          dominationCount.set(p, dominationCount.get(p)! + 1);
        }
      }

      if (dominationCount.get(p) === 0) {
        p.rank = 0;
        fronts[0].push(p);
      }
    }

    let i = 0;
    while (fronts[i].length > 0) {
      const nextFront: RouteCandidate[] = [];

      for (const p of fronts[i]) {
        for (const q of dominatedBy.get(p)!) {
          dominationCount.set(q, dominationCount.get(q)! - 1);
          if (dominationCount.get(q) === 0) {
            q.rank = i + 1;
            nextFront.push(q);
          }
        }
      }

      i++;
      fronts.push(nextFront);
    }

    return fronts.filter(f => f.length > 0);
  }

  private dominates(a: RouteCandidate, b: RouteCandidate): boolean {
    const objA = a.objectives;
    const objB = b.objectives;

    // All objectives should be maximized (we negated costs)
    const better = [
      objA.userSurplus >= objB.userSurplus,
      objA.negGas >= objB.negGas,
      objA.negSlippage >= objB.negSlippage,
      objA.negRisk >= objB.negRisk,
    ];

    const strictlyBetter = [
      objA.userSurplus > objB.userSurplus,
      objA.negGas > objB.negGas,
      objA.negSlippage > objB.negSlippage,
      objA.negRisk > objB.negRisk,
    ];

    return better.every(b => b) && strictlyBetter.some(b => b);
  }

  private assignCrowdingDistance(front: RouteCandidate[]): void {
    if (front.length === 0) return;

    // Initialize
    for (const c of front) {
      c.crowdingDistance = 0;
    }

    const objectives: (keyof RoutingObjectives)[] = [
      'userSurplus',
      'negGas',
      'negSlippage',
      'negRisk',
    ];

    for (const obj of objectives) {
      // Sort by objective
      front.sort((a, b) => a.objectives[obj] - b.objectives[obj]);

      // Boundary points get infinite distance
      front[0].crowdingDistance = Infinity;
      front[front.length - 1].crowdingDistance = Infinity;

      // Calculate range
      const range = front[front.length - 1].objectives[obj] - front[0].objectives[obj];

      if (range === 0) continue;

      // Calculate crowding distance
      for (let i = 1; i < front.length - 1; i++) {
        front[i].crowdingDistance += (
          front[i + 1].objectives[obj] - front[i - 1].objectives[obj]
        ) / range;
      }
    }
  }

  private selectNextGeneration(combined: RouteCandidate[]): RouteCandidate[] {
    // Non-dominated sorting
    const fronts = this.fastNonDominatedSort(combined);

    // Assign crowding distance
    for (const front of fronts) {
      this.assignCrowdingDistance(front);
    }

    // Select best individuals
    const nextGen: RouteCandidate[] = [];

    for (const front of fronts) {
      if (nextGen.length + front.length <= this.config.populationSize) {
        nextGen.push(...front);
      } else {
        // Sort by crowding distance and take remaining
        front.sort((a, b) => b.crowdingDistance - a.crowdingDistance);
        const remaining = this.config.populationSize - nextGen.length;
        nextGen.push(...front.slice(0, remaining));
        break;
      }
    }

    return nextGen;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let router: NSGA2Router | null = null;

export function getNSGA2Router(config?: Partial<NSGA2Config>): NSGA2Router {
  if (!router) {
    router = new NSGA2Router(config);
  }
  return router;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  NSGA2Router,
  getNSGA2Router,
  DEFAULT_NSGA2_CONFIG,
};
