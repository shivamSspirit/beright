/**
 * Dependency Injection Infrastructure
 */

export { Container, ServiceKeys, type ServiceKey } from './Container';
export {
  initializeServices,
  getServices,
  services,
  resetServices,
  getPredictionService,
  getMarketService,
  getArbitrageService,
  getTelegramFormatter,
  getJsonFormatter,
  type Services,
} from './ServiceFactory';
