/**
 * Agents API Route
 * GET /api/agents - Get all agent configurations
 * GET /api/agents?id=poster - Get specific agent config
 *
 * This exposes the centralized agent config to Web/Telegram/any gateway.
 * Single source of truth - change config/agentConfig.ts → syncs everywhere.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware, ApiContext } from '../../../lib/apiMiddleware';
import {
  getAllAgentConfigs,
  getAgentSettings,
  listEnabledAgents,
  isAgentEnabled,
} from '../../../config/agentConfig';
import { AGENTS, getAgentConfig } from '../../../config/agents';

export const GET = withMiddleware(
  async (request: NextRequest, context: ApiContext) => {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');

    // If specific agent requested
    if (agentId) {
      const operational = getAgentSettings(agentId);
      const definition = getAgentConfig(agentId);

      if (!operational && !definition) {
        return NextResponse.json({
          success: false,
          error: `Agent '${agentId}' not found`,
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        agent: {
          id: agentId,
          // Operational settings (rate limits, schedules, etc.)
          operational,
          // Definition (model, capabilities, system prompt)
          definition: definition ? {
            name: definition.name,
            model: definition.model,
            description: definition.description,
            capabilities: definition.capabilities,
            tools: definition.tools,
            maxTokens: definition.maxTokens,
            temperature: definition.temperature,
          } : null,
        },
      });
    }

    // Return all agents
    const operationalConfigs = getAllAgentConfigs();
    const enabledAgents = listEnabledAgents();

    const agents = Object.keys(operationalConfigs).map(id => {
      const operational = operationalConfigs[id];
      const definition = AGENTS[id];

      if (!operational) {
        return null;
      }

      return {
        id,
        name: operational.name,
        description: operational.description,
        enabled: operational.enabled,
        // Summary info
        rateLimit: operational.rateLimit,
        schedule: operational.schedule,
        behavior: operational.behavior,
        // Definition summary
        model: definition?.model || null,
        capabilities: definition?.capabilities || [],
      };
    }).filter(Boolean);

    return NextResponse.json({
      success: true,
      count: agents.length,
      enabledCount: enabledAgents.length,
      agents,
    });
  },
  {
    rateLimit: 'default',
    cache: { maxAge: 60, staleWhileRevalidate: 120 },
  }
);
