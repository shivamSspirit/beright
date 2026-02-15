/**
 * Service Factory
 *
 * Creates and wires all application services.
 * Central point for dependency injection setup.
 */

import { Container, ServiceKeys } from './Container';

// Repositories
import { SupabasePredictionRepository } from '../../adapters/driven/persistence/supabase/SupabasePredictionRepository';
import { SupabaseUserRepository } from '../../adapters/driven/persistence/supabase/SupabaseUserRepository';

// Market Providers
import { KalshiProvider } from '../../adapters/driven/markets/KalshiProvider';
import { PolymarketProvider } from '../../adapters/driven/markets/PolymarketProvider';
import { DFlowProvider } from '../../adapters/driven/markets/DFlowProvider';
import { MarketAggregator } from '../../adapters/driven/markets/MarketAggregator';

// Services
import { PredictionService, type IPredictionService } from '../../application/services/PredictionService';
import { MarketService, type IMarketService } from '../../application/services/MarketService';
import { ArbitrageService, type IArbitrageService } from '../../application/services/ArbitrageService';

// Formatters
import { TelegramFormatter } from '../../adapters/driving/formatters/TelegramFormatter';
import { JsonFormatter } from '../../adapters/driving/formatters/JsonFormatter';

/**
 * Aggregated services interface
 */
export interface Services {
  predictionService: IPredictionService;
  marketService: IMarketService;
  arbitrageService: IArbitrageService;
  telegramFormatter: TelegramFormatter;
  jsonFormatter: JsonFormatter;
}

/**
 * Initialize all services and register with container
 */
export function initializeServices(): Services {
  const container = Container.getInstance();

  // ========== Repositories ==========
  container.register(ServiceKeys.PredictionRepository, () => {
    return new SupabasePredictionRepository();
  });

  container.register(ServiceKeys.UserRepository, () => {
    return new SupabaseUserRepository();
  });

  // ========== Market Providers ==========
  container.register(ServiceKeys.KalshiProvider, () => {
    return new KalshiProvider();
  });

  container.register(ServiceKeys.PolymarketProvider, () => {
    return new PolymarketProvider();
  });

  container.register(ServiceKeys.DFlowProvider, () => {
    return new DFlowProvider();
  });

  container.register(ServiceKeys.MarketAggregator, () => {
    const kalshi = container.resolve<KalshiProvider>(ServiceKeys.KalshiProvider);
    const polymarket = container.resolve<PolymarketProvider>(ServiceKeys.PolymarketProvider);
    const dflow = container.resolve<DFlowProvider>(ServiceKeys.DFlowProvider);

    return new MarketAggregator([kalshi, polymarket, dflow]);
  });

  // ========== Services ==========
  container.register(ServiceKeys.PredictionService, () => {
    const predictionRepo = container.resolve<SupabasePredictionRepository>(ServiceKeys.PredictionRepository);
    const userRepo = container.resolve<SupabaseUserRepository>(ServiceKeys.UserRepository);

    return new PredictionService(predictionRepo, userRepo);
  });

  container.register(ServiceKeys.MarketService, () => {
    const aggregator = container.resolve<MarketAggregator>(ServiceKeys.MarketAggregator);
    return new MarketService(aggregator);
  });

  container.register(ServiceKeys.ArbitrageService, () => {
    const aggregator = container.resolve<MarketAggregator>(ServiceKeys.MarketAggregator);
    return new ArbitrageService(aggregator);
  });

  // ========== Formatters ==========
  container.register(ServiceKeys.TelegramFormatter, () => {
    return new TelegramFormatter();
  });

  container.register(ServiceKeys.JsonFormatter, () => {
    return new JsonFormatter();
  });

  // Return resolved services
  return getServices();
}

/**
 * Get all services from container
 */
export function getServices(): Services {
  const container = Container.getInstance();

  return {
    predictionService: container.resolve<IPredictionService>(ServiceKeys.PredictionService),
    marketService: container.resolve<IMarketService>(ServiceKeys.MarketService),
    arbitrageService: container.resolve<IArbitrageService>(ServiceKeys.ArbitrageService),
    telegramFormatter: container.resolve<TelegramFormatter>(ServiceKeys.TelegramFormatter),
    jsonFormatter: container.resolve<JsonFormatter>(ServiceKeys.JsonFormatter),
  };
}

/**
 * Get individual service
 */
export function getPredictionService(): IPredictionService {
  return Container.getInstance().resolve<IPredictionService>(ServiceKeys.PredictionService);
}

export function getMarketService(): IMarketService {
  return Container.getInstance().resolve<IMarketService>(ServiceKeys.MarketService);
}

export function getArbitrageService(): IArbitrageService {
  return Container.getInstance().resolve<IArbitrageService>(ServiceKeys.ArbitrageService);
}

export function getTelegramFormatter(): TelegramFormatter {
  return Container.getInstance().resolve<TelegramFormatter>(ServiceKeys.TelegramFormatter);
}

export function getJsonFormatter(): JsonFormatter {
  return Container.getInstance().resolve<JsonFormatter>(ServiceKeys.JsonFormatter);
}

/**
 * Lazy initialization wrapper
 * Use this in entry points to ensure services are initialized once
 */
let initialized = false;
let cachedServices: Services | null = null;

export function services(): Services {
  if (!initialized) {
    cachedServices = initializeServices();
    initialized = true;
  }
  return cachedServices!;
}

/**
 * Reset services (for testing)
 */
export function resetServices(): void {
  Container.reset();
  initialized = false;
  cachedServices = null;
}

export default {
  initializeServices,
  getServices,
  services,
  resetServices,
  getPredictionService,
  getMarketService,
  getArbitrageService,
  getTelegramFormatter,
  getJsonFormatter,
};
