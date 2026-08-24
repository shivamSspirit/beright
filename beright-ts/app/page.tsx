/**
 * BeRight Agent API - Root Page
 *
 * This is an API-only deployment. No UI components.
 * All UI is served from berightweb frontend.
 *
 * Available endpoints:
 * - /api/v2/* - V2 API routes
 * - /api/health - Health check
 */

import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to health check for API status
  redirect('/api/health');
}
