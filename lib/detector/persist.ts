import type { PrismaClient } from "@/lib/generated/prisma/client";

import { BASELINE_MONTHS } from "./core";
import {
  DEFAULT_CORPUS,
  DEFAULT_LEVELS,
  generateCorpus,
  recommendLevel,
  sweep,
  type CorpusOptions,
  type SweepResult,
} from "./evaluate";

/**
 * Re-measures the detector and records the result, replacing the previous
 * evaluation wholesale — a sweep is one experiment, and half of an old one
 * beside half of a new one would mean nothing.
 *
 * Takes its database client rather than reaching for the app's, so the
 * command line and the seed can run it without the app's server-only
 * machinery.
 */
export async function runEvaluation(
  prisma: PrismaClient,
  options: { corpus?: CorpusOptions; levels?: number[] } = {},
): Promise<SweepResult[]> {
  const corpusOptions = options.corpus ?? DEFAULT_CORPUS;
  const results = sweep(generateCorpus(corpusOptions), options.levels ?? DEFAULT_LEVELS);
  const best = recommendLevel(results);

  await prisma.detectorSweep.deleteMany({});
  for (const r of results) {
    await prisma.detectorSweep.create({
      data: {
        alertLevelK: r.k,
        truePositives: r.truePositives,
        falsePositives: r.falsePositives,
        falseNegatives: r.falseNegatives,
        trueNegatives: r.trueNegatives,
        recommended: r.k === best.k,
        records: r.records,
        scored: r.scored,
        seeded: r.outbreaks,
        baselineMonths: BASELINE_MONTHS,
        corpusSeed: corpusOptions.seed,
        bands: {
          create: r.byMagnitude.map((b) => ({
            fromMagnitude: b.from,
            toMagnitude: b.to,
            outbreaks: b.outbreaks,
            caught: b.caught,
          })),
        },
      },
    });
  }

  return results;
}
