/**
 * Circuit Breaker for BeRight Protocol
 * Prevents cascading failures by stopping requests to failing services
 */

import { CircuitOpenError } from './errors';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  /** Normal operation, requests flow through */
  CLOSED = 'CLOSED',
  /** Failing, all requests rejected immediately */
  OPEN = 'OPEN',
  /** Testing if service has recovered */
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  /** Name for logging and identification */
  name: string;
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time to wait before attempting recovery (ms) */
  resetTimeoutMs: number;
  /** Number of successful calls in half-open to close circuit */
  successThreshold: number;
  /** Time window for counting failures (ms) */
  failureWindowMs: number;
  /** Optional callback when state changes */
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
}

/**
 * Default circuit breaker options
 */
export const DEFAULT_CIRCUIT_OPTIONS: Omit<CircuitBreakerOptions, 'name'> = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  successThreshold: 2,
  failureWindowMs: 60_000,
};

/**
 * Circuit breaker preset configurations
 */
export const CIRCUIT_PRESETS = {
  /** Sensitive services that should fail fast */
  SENSITIVE: {
    failureThreshold: 3,
    resetTimeoutMs: 30_000,
    successThreshold: 3,
    failureWindowMs: 30_000,
  },
  /** Resilient services that can tolerate more failures */
  RESILIENT: {
    failureThreshold: 10,
    resetTimeoutMs: 120_000,
    successThreshold: 1,
    failureWindowMs: 120_000,
  },
} as const;

/**
 * Failure record for tracking
 */
interface FailureRecord {
  timestamp: number;
  error: Error;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: FailureRecord[] = [];
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = { ...DEFAULT_CIRCUIT_OPTIONS, ...options };
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
  } {
    return {
      state: this.state,
      failureCount: this.getRecentFailureCount(),
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime || null,
    };
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transition(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitOpenError(
          this.options.name,
          this.lastFailureTime + this.options.resetTimeoutMs
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Manually trip the circuit (force open)
   */
  trip(): void {
    this.transition(CircuitState.OPEN);
    this.lastFailureTime = Date.now();
  }

  /**
   * Manually reset the circuit (force closed)
   */
  reset(): void {
    this.failures = [];
    this.successCount = 0;
    this.transition(CircuitState.CLOSED);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.reset();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Clear old failures on success
      this.pruneOldFailures();
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.lastFailureTime = Date.now();
    this.failures.push({
      timestamp: this.lastFailureTime,
      error,
    });
    this.pruneOldFailures();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open reopens the circuit
      this.transition(CircuitState.OPEN);
      this.successCount = 0;
    } else if (this.state === CircuitState.CLOSED) {
      if (this.getRecentFailureCount() >= this.options.failureThreshold) {
        this.transition(CircuitState.OPEN);
      }
    }
  }

  /**
   * Check if we should attempt to reset from OPEN state
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs;
  }

  /**
   * Get count of failures within the window
   */
  private getRecentFailureCount(): number {
    const cutoff = Date.now() - this.options.failureWindowMs;
    return this.failures.filter(f => f.timestamp > cutoff).length;
  }

  /**
   * Remove old failures outside the window
   */
  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.options.failureWindowMs;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  /**
   * Transition to a new state
   */
  private transition(newState: CircuitState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.options.onStateChange?.(this.options.name, oldState, newState);
    }
  }
}

/**
 * Circuit breaker registry for managing multiple circuits
 */
class CircuitBreakerRegistry {
  private circuits: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  get(name: string, options?: Partial<Omit<CircuitBreakerOptions, 'name'>>): CircuitBreaker {
    let circuit = this.circuits.get(name);
    if (!circuit) {
      circuit = new CircuitBreaker({
        name,
        ...DEFAULT_CIRCUIT_OPTIONS,
        ...options,
      });
      this.circuits.set(name, circuit);
    }
    return circuit;
  }

  /**
   * Get all circuit states
   */
  getAllStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    for (const [name, circuit] of this.circuits) {
      stats[name] = circuit.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }
}

/**
 * Global circuit breaker registry
 */
export const circuitBreakers = new CircuitBreakerRegistry();

/**
 * Decorator for adding circuit breaker to methods
 */
export function WithCircuitBreaker(
  name: string,
  options?: Partial<Omit<CircuitBreakerOptions, 'name'>>
) {
  const circuit = circuitBreakers.get(name, options);

  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return circuit.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
