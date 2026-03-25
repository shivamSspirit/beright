# ADR-002: Async Job Architecture for Long-Running Operations

## Status
Proposed

## Context
The gateway API uses synchronous HTTP request/response for operations that take 30+ seconds (research, deep analysis, LLM reasoning). This causes:
- HTTP timeouts (Next.js dev proxy ~30s limit)
- Poor UX (users see spinner with no feedback)
- Resource blocking (connections held open)
- Scalability limits (can't handle concurrent long operations)

## Decision
Implement async job architecture for operations exceeding 5 seconds.

## Architecture

### Flow: Async with Polling

```
┌─────────┐  POST /api/gateway     ┌─────────┐
│  User   │───────────────────────▶│ Gateway │
│         │◀─── 200 OK (job_id) ───│         │
└────┬────┘                        └────┬────┘
     │                                  │
     │  GET /api/jobs/{id}              │ Background
     │◀────── status: "running" ────────│ Processing
     │                                  │
     │  GET /api/jobs/{id}              │
     │◀────── status: "running" ────────│
     │         progress: 60%            │
     │                                  │
     │  GET /api/jobs/{id}              │
     │◀────── status: "complete" ───────│
     │         result: {...}            │
└─────────┘                        └─────────┘
```

### Implementation

#### 1. Job Queue (In-Memory for MVP, Redis for Production)

```typescript
// lib/jobs/jobQueue.ts
interface Job {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number;           // 0-100
  progressMessage?: string;   // "Fetching market data..."
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;            // Auto-cleanup after 10 minutes
}

const jobs = new Map<string, Job>();

export function createJob(): Job {
  const job: Job = {
    id: crypto.randomUUID(),
    status: 'queued',
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
  jobs.set(job.id, job);
  return job;
}

export function updateJob(id: string, updates: Partial<Job>): void {
  const job = jobs.get(id);
  if (job) {
    Object.assign(job, updates, { updatedAt: new Date() });
  }
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
```

#### 2. Gateway: Detect Long Operations

```typescript
// app/api/gateway/route.ts
const LONG_RUNNING_PATTERNS = [
  /^analyze/i,
  /^research/i,
  /^intelligence/i,
  /^deep\s+dive/i,
  /probability.*estimate/i,
];

function isLongRunningRequest(message: string): boolean {
  return LONG_RUNNING_PATTERNS.some(p => p.test(message));
}

export async function POST(request: NextRequest) {
  const { message, userId, sessionId } = await request.json();

  if (isLongRunningRequest(message)) {
    // Return immediately with job ID
    const job = createJob();

    // Process in background (not awaited)
    processLongRunningJob(job.id, message, userId, sessionId);

    return NextResponse.json({
      success: true,
      async: true,
      jobId: job.id,
      pollUrl: `/api/jobs/${job.id}`,
      message: 'Processing your request...',
    });
  }

  // Short requests: handle synchronously (existing flow)
  const response = await secureTelegramHandler(pseudoMessage);
  return NextResponse.json({ success: true, ...response });
}
```

#### 3. Job Status Endpoint

```typescript
// app/api/jobs/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const job = getJob(params.id);

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    progressMessage: job.progressMessage,
    result: job.status === 'complete' ? job.result : undefined,
    error: job.status === 'failed' ? job.error : undefined,
  });
}
```

#### 4. Progress Updates During Processing

```typescript
// lib/jobs/processJob.ts
async function processLongRunningJob(
  jobId: string,
  message: string,
  userId: string,
  sessionId: string
) {
  try {
    updateJob(jobId, { status: 'running', progress: 0 });

    // Progress callback for handlers
    const onProgress = (pct: number, msg: string) => {
      updateJob(jobId, { progress: pct, progressMessage: msg });
    };

    onProgress(10, 'Starting analysis...');

    // Build pseudo message and call handler
    const pseudoMessage = buildPseudoMessage(message, userId, sessionId);

    onProgress(20, 'Gathering market data...');
    const response = await secureTelegramHandler(pseudoMessage, { onProgress });

    onProgress(100, 'Complete');
    updateJob(jobId, {
      status: 'complete',
      progress: 100,
      result: response,
    });

  } catch (error) {
    updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

### Frontend Integration

```typescript
// Terminal component
async function sendMessage(message: string) {
  const res = await fetch('/api/gateway', {
    method: 'POST',
    body: JSON.stringify({ message, userId, sessionId }),
  });
  const data = await res.json();

  if (data.async) {
    // Show immediate feedback
    addMessage('bot', 'Processing your request...');

    // Poll for result
    const result = await pollForResult(data.jobId);
    updateLastMessage('bot', result.text);
  } else {
    // Sync response
    addMessage('bot', data.text);
  }
}

async function pollForResult(jobId: string, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`/api/jobs/${jobId}`);
    const job = await res.json();

    if (job.status === 'complete') return job.result;
    if (job.status === 'failed') throw new Error(job.error);

    // Update progress in UI
    updateProgress(job.progress, job.progressMessage);

    // Wait before next poll (exponential backoff)
    await sleep(Math.min(1000 * Math.pow(1.5, i), 5000));
  }
  throw new Error('Job timed out');
}
```

## Alternative: Server-Sent Events (SSE)

For real-time progress without polling:

```typescript
// app/api/gateway/stream/route.ts
export async function POST(request: NextRequest) {
  const { message, userId } = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'start', message: 'Processing...' });

      // Handler with progress callback
      const response = await secureTelegramHandler(message, {
        onProgress: (pct, msg) => send({ type: 'progress', pct, msg }),
      });

      send({ type: 'complete', result: response });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## Migration Path

### Phase 1: Quick Fix (1 day)
- Detect long-running patterns
- Return job ID immediately
- Simple in-memory job queue
- Basic polling

### Phase 2: Progress Updates (2-3 days)
- Add progress callbacks to handlers
- Update job progress during execution
- Frontend progress bar

### Phase 3: Production Ready (1 week)
- Redis-backed job queue
- Job expiration/cleanup
- Rate limiting per user
- Analytics on job durations

## Consequences

### Positive
- No more HTTP timeouts
- Better UX with progress feedback
- Scalable to any operation duration
- Works with serverless (Vercel, Railway)

### Negative
- More complex frontend logic
- Need to handle job cleanup
- Additional API endpoint to maintain

## Decision
Implement Phase 1 immediately to fix the timeout issues, then iterate.
