/**
 * BeRight Conviction - Milestone Templates
 *
 * Pre-defined templates for common milestone types that projects
 * can use when creating conviction markets.
 */

import { MilestoneType, ResolutionSource } from './types';

// ============================================================================
// MILESTONE TEMPLATE DEFINITION
// ============================================================================

export interface MilestoneTemplate {
  type: MilestoneType;
  name: string;
  description: string;
  questionTemplate: string;
  resolutionCriteria: string;
  resolutionSource: ResolutionSource;
  suggestedStake: number;         // SOL
  minStake: number;               // SOL
  placeholders: string[];         // Variables in question template
  examples: string[];
}

// ============================================================================
// MILESTONE TEMPLATES
// ============================================================================

export const MILESTONE_TEMPLATES: Record<MilestoneType, MilestoneTemplate> = {
  mainnet_launch: {
    type: 'mainnet_launch',
    name: 'Mainnet Launch',
    description: 'Project launches their mainnet/production version',
    questionTemplate: 'Will {project} launch mainnet by {date}?',
    resolutionCriteria: 'Mainnet must be publicly accessible and officially announced by the team',
    resolutionSource: 'manual',
    suggestedStake: 100,
    minStake: 10,
    placeholders: ['project', 'date'],
    examples: [
      'Will Jupiter launch perpetuals mainnet by Q2 2026?',
      'Will Tensor launch v2 mainnet by March 2026?',
    ],
  },

  user_milestone: {
    type: 'user_milestone',
    name: 'User Milestone',
    description: 'Project reaches a specific number of users',
    questionTemplate: 'Will {project} reach {target} users by {date}?',
    resolutionCriteria: 'User count verified via public dashboard, API, or official announcement',
    resolutionSource: 'api',
    suggestedStake: 50,
    minStake: 5,
    placeholders: ['project', 'target', 'date'],
    examples: [
      'Will Phantom reach 10M monthly active users by Q3 2026?',
      'Will Magic Eden reach 1M daily active users by June 2026?',
    ],
  },

  tvl_milestone: {
    type: 'tvl_milestone',
    name: 'TVL Milestone',
    description: 'Project reaches a specific Total Value Locked',
    questionTemplate: 'Will {project} reach ${target} TVL by {date}?',
    resolutionCriteria: 'TVL measured via DefiLlama on resolution date',
    resolutionSource: 'api',
    suggestedStake: 100,
    minStake: 10,
    placeholders: ['project', 'target', 'date'],
    examples: [
      'Will Marinade reach $500M TVL by Q2 2026?',
      'Will Kamino reach $1B TVL by December 2026?',
    ],
  },

  token_launch: {
    type: 'token_launch',
    name: 'Token Launch',
    description: 'Project launches their native token',
    questionTemplate: 'Will {project} launch their token by {date}?',
    resolutionCriteria: 'Token must be trading on a major DEX or CEX',
    resolutionSource: 'on_chain',
    suggestedStake: 200,
    minStake: 20,
    placeholders: ['project', 'date'],
    examples: [
      'Will Phantom launch $PHANTOM token by Q4 2026?',
      'Will Tensor launch governance token by June 2026?',
    ],
  },

  partnership: {
    type: 'partnership',
    name: 'Partnership Announcement',
    description: 'Project announces partnership with another entity',
    questionTemplate: 'Will {project} announce a partnership with {partner} by {date}?',
    resolutionCriteria: 'Official announcement from both parties required',
    resolutionSource: 'manual',
    suggestedStake: 50,
    minStake: 5,
    placeholders: ['project', 'partner', 'date'],
    examples: [
      'Will Jupiter partner with Coinbase by Q2 2026?',
      'Will Solana Foundation announce partnership with a Fortune 500 by 2026?',
    ],
  },

  audit_completion: {
    type: 'audit_completion',
    name: 'Security Audit',
    description: 'Project completes a security audit',
    questionTemplate: 'Will {project} complete a security audit by {auditor} by {date}?',
    resolutionCriteria: 'Audit report must be publicly available',
    resolutionSource: 'manual',
    suggestedStake: 30,
    minStake: 5,
    placeholders: ['project', 'auditor', 'date'],
    examples: [
      'Will New DeFi Protocol complete OtterSec audit by March 2026?',
      'Will NFT Marketplace complete Halborn audit by Q2 2026?',
    ],
  },

  feature_release: {
    type: 'feature_release',
    name: 'Feature Release',
    description: 'Project releases a specific feature',
    questionTemplate: 'Will {project} release {feature} by {date}?',
    resolutionCriteria: 'Feature must be live and accessible to users',
    resolutionSource: 'manual',
    suggestedStake: 30,
    minStake: 5,
    placeholders: ['project', 'feature', 'date'],
    examples: [
      'Will Jupiter release limit orders by Q1 2026?',
      'Will Magic Eden release mobile app by June 2026?',
    ],
  },

  revenue_milestone: {
    type: 'revenue_milestone',
    name: 'Revenue Milestone',
    description: 'Project reaches a specific revenue target',
    questionTemplate: 'Will {project} reach ${target} in cumulative revenue by {date}?',
    resolutionCriteria: 'Revenue verified via public dashboard or official announcement',
    resolutionSource: 'api',
    suggestedStake: 100,
    minStake: 10,
    placeholders: ['project', 'target', 'date'],
    examples: [
      'Will Pump.fun reach $500M cumulative revenue by Q2 2026?',
      'Will Jupiter reach $100M in swap fees by 2026?',
    ],
  },

  funding_round: {
    type: 'funding_round',
    name: 'Funding Round',
    description: 'Project raises a funding round',
    questionTemplate: 'Will {project} raise a {round_type} by {date}?',
    resolutionCriteria: 'Funding round officially announced with amount and investors',
    resolutionSource: 'manual',
    suggestedStake: 100,
    minStake: 10,
    placeholders: ['project', 'round_type', 'date'],
    examples: [
      'Will New Protocol raise a Series A by Q3 2026?',
      'Will DeFi Startup raise $10M+ by June 2026?',
    ],
  },

  ai_visibility: {
    type: 'ai_visibility',
    name: 'AI Visibility',
    description: 'Project gets recommended by AI LLMs',
    questionTemplate: 'Will {project} be recommended by {llm} for {category} by {date}?',
    resolutionCriteria: 'BeRight queries the LLM 10 times with category-relevant questions. Majority mention = YES.',
    resolutionSource: 'ai_query',
    suggestedStake: 30,
    minStake: 5,
    placeholders: ['project', 'llm', 'category', 'date'],
    examples: [
      'Will Jupiter be recommended by ChatGPT for "best DEX on Solana" by Q2 2026?',
      'Will Tensor be mentioned by Perplexity for "NFT marketplaces" by June 2026?',
    ],
  },

  custom: {
    type: 'custom',
    name: 'Custom Milestone',
    description: 'Custom milestone defined by the project',
    questionTemplate: '{custom_question}',
    resolutionCriteria: 'Custom criteria defined by market creator',
    resolutionSource: 'manual',
    suggestedStake: 50,
    minStake: 10,
    placeholders: ['custom_question'],
    examples: [
      'Will BeRight reach #1 on Product Hunt by Q2 2026?',
      'Will Solana process 100k TPS sustained for 24 hours by 2026?',
    ],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a milestone template by type
 */
export function getMilestoneTemplate(type: MilestoneType): MilestoneTemplate {
  return MILESTONE_TEMPLATES[type];
}

/**
 * Get all milestone templates
 */
export function getAllMilestoneTemplates(): MilestoneTemplate[] {
  return Object.values(MILESTONE_TEMPLATES);
}

/**
 * Generate a question from a template and values
 */
export function generateQuestion(
  type: MilestoneType,
  values: Record<string, string>
): string {
  const template = MILESTONE_TEMPLATES[type];
  let question = template.questionTemplate;

  for (const [key, value] of Object.entries(values)) {
    question = question.replace(`{${key}}`, value);
  }

  return question;
}

/**
 * Validate that all required placeholders are provided
 */
export function validatePlaceholders(
  type: MilestoneType,
  values: Record<string, string>
): { valid: boolean; missing: string[] } {
  const template = MILESTONE_TEMPLATES[type];
  const missing: string[] = [];

  for (const placeholder of template.placeholders) {
    if (!values[placeholder] || values[placeholder].trim() === '') {
      missing.push(placeholder);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get suggested resolution date based on milestone type
 */
export function getSuggestedResolutionDate(type: MilestoneType): Date {
  const now = new Date();
  const daysToAdd = getDefaultDaysForType(type);
  return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
}

function getDefaultDaysForType(type: MilestoneType): number {
  switch (type) {
    case 'mainnet_launch':
      return 90;  // 3 months
    case 'user_milestone':
      return 60;  // 2 months
    case 'tvl_milestone':
      return 60;
    case 'token_launch':
      return 120; // 4 months
    case 'partnership':
      return 90;
    case 'audit_completion':
      return 45;  // 1.5 months
    case 'feature_release':
      return 30;  // 1 month
    case 'revenue_milestone':
      return 90;
    case 'funding_round':
      return 120;
    case 'ai_visibility':
      return 60;
    case 'custom':
      return 60;
    default:
      return 60;
  }
}

/**
 * Check if stake amount meets minimum for milestone type
 */
export function validateStakeAmount(
  type: MilestoneType,
  amount: number
): { valid: boolean; minRequired: number } {
  const template = MILESTONE_TEMPLATES[type];
  return {
    valid: amount >= template.minStake,
    minRequired: template.minStake,
  };
}

/**
 * Get milestone types by resolution source
 */
export function getMilestonesByResolutionSource(
  source: ResolutionSource
): MilestoneTemplate[] {
  return Object.values(MILESTONE_TEMPLATES).filter(
    (template) => template.resolutionSource === source
  );
}
