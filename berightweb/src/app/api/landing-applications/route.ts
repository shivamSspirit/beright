import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_VENUES = new Set(['Polymarket', 'Kalshi', 'Manifold', 'Drift', 'Limitless', 'Other']);
const VALID_ROLES = new Set(['forecaster', 'lp', 'watching']);
const ROLE_VALUES = ['forecaster', 'lp', 'watching'] as const;

type LandingRole = (typeof ROLE_VALUES)[number];

interface LandingApplicationRequest {
  name?: unknown;
  handle?: unknown;
  email?: unknown;
  venues?: unknown;
  resolvedPredictions?: unknown;
  role?: unknown;
  edge?: unknown;
}

interface LandingApplicationRow {
  id: string;
  name: string | null;
  handle: string | null;
  venues: string[] | null;
  role: string | null;
  created_at: string;
}

interface PublicWaitlistStatsPayload {
  total?: unknown;
  recentWeek?: unknown;
  roles?: unknown;
  recent?: unknown;
}

interface PublicWaitlistRolesPayload {
  forecaster?: unknown;
  lp?: unknown;
  watching?: unknown;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseKey =
    serviceRoleKey ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return {
    client: createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
    canUpsert: Boolean(serviceRoleKey),
  };
}

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isUniqueConstraintError(error: { code?: string; message?: string }): boolean {
  return error.code === '23505' || Boolean(error.message?.toLowerCase().includes('duplicate key'));
}

function createApplicationPayload(input: {
  email: string;
  name: string;
  handle: string;
  venues: string[];
  resolvedPredictions: number;
  role: string;
  edge: string;
  userAgent: string | null;
}) {
  return {
    email: input.email,
    name: input.name,
    handle: input.handle || null,
    venues: input.venues,
    resolved_predictions: input.resolvedPredictions,
    role: input.role,
    source: 'landing_apply_form',
    status: 'new',
    metadata: {
      edge: input.edge || null,
      userAgent: input.userAgent,
    },
    updated_at: new Date().toISOString(),
  };
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeEmail(value: unknown): string {
  return cleanText(value, 254).toLowerCase();
}

function normalizeVenues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((venue): venue is string => typeof venue === 'string' && VALID_VENUES.has(venue))
    .slice(0, VALID_VENUES.size);
}

function normalizeResolvedPredictions(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(2000, Math.max(0, Math.round(value)));
}

function normalizeRole(value: unknown): string {
  return typeof value === 'string' && VALID_ROLES.has(value) ? value : 'forecaster';
}

function getDisplayName(row: LandingApplicationRow): string {
  const handle = cleanText(row.handle, 80);
  if (handle) return handle;

  const name = cleanText(row.name, 120);
  if (!name) return 'Waitlist applicant';

  return name.split(/\s+/).slice(0, 2).join(' ');
}

function getInitials(displayName: string): string {
  const cleaned = displayName.replace(/^@/, '').trim();
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');

  return initials || 'BR';
}

function isLandingRole(value: string | null): value is LandingRole {
  return value !== null && ROLE_VALUES.includes(value as LandingRole);
}

function toSafeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLandingApplicationRow(value: unknown): LandingApplicationRow | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string' ? value.id : '';
  const createdAt = typeof value.created_at === 'string' ? value.created_at : '';
  if (!id || !createdAt) return null;

  const venues = Array.isArray(value.venues)
    ? value.venues.filter((venue): venue is string => typeof venue === 'string')
    : null;

  return {
    id,
    name: typeof value.name === 'string' ? value.name : null,
    handle: typeof value.handle === 'string' ? value.handle : null,
    venues,
    role: typeof value.role === 'string' ? value.role : null,
    created_at: createdAt,
  };
}

function createPublicSignup(row: LandingApplicationRow) {
  const displayName = getDisplayName(row);

  return {
    id: row.id,
    displayName,
    initials: getInitials(displayName),
    role: isLandingRole(row.role) ? row.role : 'forecaster',
    venues: Array.isArray(row.venues) ? row.venues.slice(0, 3) : [],
    createdAt: row.created_at,
  };
}

function createPublicStatsResponse(input: {
  total: number;
  recentWeek: number;
  roles: {
    forecaster: number;
    lp: number;
    watching: number;
  };
  rows: LandingApplicationRow[];
}) {
  return {
    success: true,
    data: {
      total: input.total,
      recentWeek: input.recentWeek,
      roles: input.roles,
      recent: input.rows.map(createPublicSignup),
    },
  };
}

async function readPublicStatsWithServiceRole(
  supabase: SupabaseClient
) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalResult,
    recentWeekResult,
    forecasterResult,
    lpResult,
    watchingResult,
    recentResult,
  ] = await Promise.all([
    supabase.from('landing_applications').select('*', { count: 'exact', head: true }),
    supabase
      .from('landing_applications')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),
    supabase
      .from('landing_applications')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'forecaster'),
    supabase
      .from('landing_applications')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'lp'),
    supabase
      .from('landing_applications')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'watching'),
    supabase
      .from('landing_applications')
      .select('id, name, handle, venues, role, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const readError =
    totalResult.error ||
    recentWeekResult.error ||
    forecasterResult.error ||
    lpResult.error ||
    watchingResult.error ||
    recentResult.error;

  if (readError) {
    throw readError;
  }

  return createPublicStatsResponse({
    total: totalResult.count || 0,
    recentWeek: recentWeekResult.count || 0,
    roles: {
      forecaster: forecasterResult.count || 0,
      lp: lpResult.count || 0,
      watching: watchingResult.count || 0,
    },
    rows: (recentResult.data || []) as LandingApplicationRow[],
  });
}

async function readPublicStatsWithRpc(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('get_public_landing_waitlist_stats');

  if (error) {
    throw error;
  }

  const payload = isRecord(data) ? (data as PublicWaitlistStatsPayload) : {};
  const roles = isRecord(payload.roles) ? (payload.roles as PublicWaitlistRolesPayload) : {};
  const rows = Array.isArray(payload.recent)
    ? payload.recent
        .map(normalizeLandingApplicationRow)
        .filter((row): row is LandingApplicationRow => row !== null)
    : [];

  return createPublicStatsResponse({
    total: toSafeCount(payload.total),
    recentWeek: toSafeCount(payload.recentWeek),
    roles: {
      forecaster: toSafeCount(roles.forecaster),
      lp: toSafeCount(roles.lp),
      watching: toSafeCount(roles.watching),
    },
    rows,
  });
}

export async function GET() {
  try {
    const serviceClient = getSupabaseServiceClient();

    if (serviceClient) {
      const response = await readPublicStatsWithServiceRole(serviceClient);
      return NextResponse.json(response);
    }

    const supabaseConfig = getSupabaseClient();

    if (!supabaseConfig) {
      return NextResponse.json(
        { success: false, error: 'Application storage is not configured' },
        { status: 503 }
      );
    }

    const response = await readPublicStatsWithRpc(supabaseConfig.client);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Landing Applications] Read error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load applications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LandingApplicationRequest;
    const name = cleanText(body.name, 120);
    const handle = cleanText(body.handle, 80);
    const email = normalizeEmail(body.email);
    const venues = normalizeVenues(body.venues);
    const resolvedPredictions = normalizeResolvedPredictions(body.resolvedPredictions);
    const role = normalizeRole(body.role);
    const edge = cleanText(body.edge, 240);

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Valid email address required' },
        { status: 400 }
      );
    }

    const supabaseConfig = getSupabaseClient();

    if (!supabaseConfig) {
      return NextResponse.json(
        { success: false, error: 'Application storage is not configured' },
        { status: 503 }
      );
    }

    const { client: supabase, canUpsert } = supabaseConfig;
    const application = createApplicationPayload({
      email,
      name,
      handle,
      venues,
      resolvedPredictions,
      role,
      edge,
      userAgent: request.headers.get('user-agent'),
    });

    if (!canUpsert) {
      const { error } = await supabase.from('landing_applications').insert(application);

      if (error) {
        if (isUniqueConstraintError(error)) {
          return NextResponse.json({
            success: true,
            alreadyExists: true,
          });
        }

        console.error('[Landing Applications] Supabase error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to store application' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          publicSignup: createPublicSignup({
            id: `pending-${application.updated_at}`,
            name: application.name,
            handle: application.handle,
            venues: application.venues,
            role: application.role,
            created_at: application.updated_at,
          }),
        },
      });
    }

    const { data, error } = await supabase
      .from('landing_applications')
      .upsert(application, { onConflict: 'email' })
      .select('id, created_at')
      .single();

    if (error) {
      if (isUniqueConstraintError(error)) {
        return NextResponse.json({
          success: true,
          alreadyExists: true,
        });
      }

      console.error('[Landing Applications] Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to store application' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        createdAt: data.created_at,
        publicSignup: createPublicSignup({
          id: data.id,
          name: application.name,
          handle: application.handle,
          venues: application.venues,
          role: application.role,
          created_at: data.created_at,
        }),
      },
    });
  } catch (error) {
    console.error('[Landing Applications] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
