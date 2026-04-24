#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';

import { buildSnapshotEnvelope, calculateV3UnifiedScore, V3Identity, V3Prediction } from '../v3';

interface InputForecasterRecord {
  forecasterId: string;
  identity?: V3Identity;
  importedPredictions?: Array<Omit<V3Prediction, 'forecasterId' | 'source'>>;
  nativePredictions?: Array<Omit<V3Prediction, 'forecasterId' | 'source'>>;
}

interface CliInputFile {
  scoreEpoch?: string;
  forecasters: InputForecasterRecord[];
}

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parsePrediction(
  forecasterId: string,
  source: 'imported' | 'native',
  prediction: Omit<V3Prediction, 'forecasterId' | 'source'>,
): V3Prediction {
  return {
    ...prediction,
    forecasterId,
    source,
    predictedAt: new Date(prediction.predictedAt),
    resolvedAt: prediction.resolvedAt ? new Date(prediction.resolvedAt) : undefined,
    marketOpenTime: prediction.marketOpenTime ? new Date(prediction.marketOpenTime) : undefined,
    marketCloseTime: prediction.marketCloseTime ? new Date(prediction.marketCloseTime) : undefined,
  };
}

async function main() {
  const inputPath = getArg('--input');
  const outputDir = getArg('--output-dir') ?? path.join(process.cwd(), 'data', 'v3');

  if (!inputPath) {
    console.error('Usage: tsx src/cli/calculate-v3-snapshots.ts --input <file> [--output-dir <dir>]');
    process.exit(1);
  }

  const raw = await fs.readFile(path.resolve(inputPath), 'utf8');
  const parsed: CliInputFile = JSON.parse(raw);
  const scoreEpoch = parsed.scoreEpoch ?? new Date().toISOString();

  const envelopes = parsed.forecasters.map((record) => {
    const importedPredictions = (record.importedPredictions ?? []).map((prediction) =>
      parsePrediction(record.forecasterId, 'imported', prediction),
    );
    const nativePredictions = (record.nativePredictions ?? []).map((prediction) =>
      parsePrediction(record.forecasterId, 'native', prediction),
    );

    const snapshot = calculateV3UnifiedScore({
      forecasterId: record.forecasterId,
      identity: record.identity,
      importedPredictions,
      nativePredictions,
      scoreEpoch,
    });

    return buildSnapshotEnvelope(snapshot);
  });

  await fs.mkdir(outputDir, { recursive: true });

  const snapshotsPath = path.join(outputDir, 'score-snapshots.json');
  const summariesPath = path.join(outputDir, 'calibration-summaries.json');

  await fs.writeFile(
    snapshotsPath,
    JSON.stringify(
      envelopes.map((envelope) => ({
        snapshotHash: envelope.snapshotHash,
        snapshot: {
          ...envelope.snapshot,
          calculatedAt: envelope.snapshot.calculatedAt.toISOString(),
        },
      })),
      null,
      2,
    ),
  );

  await fs.writeFile(
    summariesPath,
    JSON.stringify(envelopes.map((envelope) => envelope.calibrationSummary), null, 2),
  );

  console.log(`Wrote ${envelopes.length} V3 score snapshots to ${snapshotsPath}`);
  console.log(`Wrote ${envelopes.length} calibration summaries to ${summariesPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
