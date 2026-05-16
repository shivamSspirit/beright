/**
 * Middleware Module
 *
 * Centralized exports for all middleware.
 */

// Authentication
export {
  type AuthSource,
  type UserTier,
  type AuthContext,
  type AuthOptions,
  extractAuthContext,
  withAuth,
  requireAuth,
  requireAdmin,
  requireService,
  registerApiKey,
  revokeApiKey,
  addAdminWallet,
  removeAdminWallet,
  clearRateLimit,
  getRateLimitInfo,
} from './auth';

// Security Logging
export {
  type SecurityEventType,
  type SecuritySeverity,
  type SecurityEvent,
  logSecurityEvent,
  logTransactionAudit,
  updateTransactionAudit,
  logCriticalSecurityEvent,
  getRecentSecurityEvents,
  getSecurityStats,
} from './securityLogger';
