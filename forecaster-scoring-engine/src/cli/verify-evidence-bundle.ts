import { readFile } from 'node:fs/promises';
import { replayEvidenceBundleV1, type EvidenceBundleV1 } from '../reputation';

async function main(): Promise<void> {
  const path = process.argv.find((argument) => !argument.startsWith('-') && argument !== process.argv[0] && argument !== process.argv[1]);
  const jsonOutput = process.argv.includes('--json');
  if (!path) throw new Error('Usage: verify:passport <evidence-bundle.json> [--json]');
  const bundle = JSON.parse(await readFile(path, 'utf8')) as EvidenceBundleV1;
  const result = replayEvidenceBundleV1(bundle);
  if (jsonOutput) process.stdout.write(`${JSON.stringify(result)}\n`);
  else process.stdout.write(result.valid ? `PASS evidence and published passport reproduce exactly\n` : `FAIL ${result.errors.join(', ')}\n`);
  if (!result.valid) process.exitCode = 1;
}

main().catch((error: unknown) => { process.stderr.write(`${JSON.stringify({ valid: false, error: error instanceof Error ? error.message : 'Verification failed' })}\n`); process.exitCode = 1; });
