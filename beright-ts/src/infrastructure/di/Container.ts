/**
 * Dependency Injection Container
 *
 * Simple service locator pattern for managing dependencies.
 * No external library required.
 */

type Factory<T> = () => T;

/**
 * Simple DI Container
 */
export class Container {
  private static instance: Container | null = null;
  private services: Map<string, unknown> = new Map();
  private factories: Map<string, Factory<unknown>> = new Map();
  private singletons: Set<string> = new Set();

  private constructor() {}

  /**
   * Get singleton instance of container
   */
  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Reset container (useful for testing)
   */
  static reset(): void {
    Container.instance = null;
  }

  /**
   * Register a factory function for a service
   */
  register<T>(key: string, factory: Factory<T>, singleton = true): void {
    this.factories.set(key, factory as Factory<unknown>);
    if (singleton) {
      this.singletons.add(key);
    } else {
      this.singletons.delete(key);
    }
    // Clear cached instance if re-registering
    this.services.delete(key);
  }

  /**
   * Register a pre-built instance
   */
  registerInstance<T>(key: string, instance: T): void {
    this.services.set(key, instance);
    this.singletons.add(key);
  }

  /**
   * Resolve a service by key
   */
  resolve<T>(key: string): T {
    // Check if already instantiated
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }

    // Check if factory exists
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Service not registered: ${key}`);
    }

    // Create instance
    const instance = factory() as T;

    // Cache if singleton
    if (this.singletons.has(key)) {
      this.services.set(key, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   */
  has(key: string): boolean {
    return this.services.has(key) || this.factories.has(key);
  }

  /**
   * Get all registered service keys
   */
  keys(): string[] {
    const factoryKeys = Array.from(this.factories.keys());
    const instanceKeys = Array.from(this.services.keys());
    return [...new Set([...factoryKeys, ...instanceKeys])];
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
  }
}

/**
 * Service keys for type-safe resolution
 */
export const ServiceKeys = {
  // Repositories
  PredictionRepository: 'prediction.repository',
  UserRepository: 'user.repository',

  // Market Providers
  KalshiProvider: 'provider.kalshi',
  PolymarketProvider: 'provider.polymarket',
  DFlowProvider: 'provider.dflow',
  MarketAggregator: 'provider.aggregator',

  // Services
  PredictionService: 'service.prediction',
  MarketService: 'service.market',
  ArbitrageService: 'service.arbitrage',

  // Formatters
  TelegramFormatter: 'formatter.telegram',
  JsonFormatter: 'formatter.json',
} as const;

export type ServiceKey = (typeof ServiceKeys)[keyof typeof ServiceKeys];

export default Container;
