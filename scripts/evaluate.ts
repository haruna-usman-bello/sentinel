/**
 * Re-measures the detector against a freshly generated labelled corpus and
 * records the result, so the accuracy screen quotes an experiment rather
 * than a fixture.
 *
 *   npm run detector:evaluate
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { ASSUMED_PREVALENCE, projectAt, recommendLevel } from "../lib/detector/evaluate";
import { runEvaluation } from "../lib/detector/persist";
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const results = await runEvaluation(prisma);
  const best = recommendLevel(results);
  const byF1 = results.reduce((b, r) => (r.f1 > b.f1 ? r : b));

  console.log(
    `${results[0].records} records, ${results[0].scored} scored, ${results[0].outbreaks} seeded outbreaks`,
  );
  console.log(
    `Precision and alert volume projected at an assumed ${(ASSUMED_PREVALENCE * 100).toFixed(0)}% outbreak rate,`,
  );
  console.log("not read off the corpus, which is far thicker with outbreaks than reality.\n");
  console.log("    k  caught  false alarm  flags/100mo  of those real      F2");
  for (const r of results) {
    const p = projectAt(r, ASSUMED_PREVALENCE);
    const fpr = r.falsePositives / (r.falsePositives + r.trueNegatives || 1);
    const mark =
      r.k === best.k ? "  ← recommended (F2)" : r.k === byF1.k ? "  ← best F1 on corpus" : "";
    console.log(
      `${r.k.toFixed(2).padStart(5)}   ${p.recall.toFixed(3)}        ${fpr.toFixed(3)}` +
        `${p.flagsPer100.toFixed(1).padStart(13)}${p.realPer100.toFixed(1).padStart(15)}` +
        `${p.f2.toFixed(3).padStart(8)}${mark}`,
    );
  }

  console.log(`\nAt the recommended ${best.k.toFixed(2)}×, recall by size of rise:`);
  for (const band of best.byMagnitude) {
    const share = band.outbreaks ? (band.caught / band.outbreaks).toFixed(2) : "—";
    console.log(
      `  ${band.from.toFixed(1)}–${(band.to === 4.01 ? 4 : band.to).toFixed(1)}×  ${String(band.caught).padStart(3)}/${String(band.outbreaks).padEnd(3)}  ${share}`,
    );
  }

  const diseases = await prisma.disease.findMany({
    select: { name: true, alertLevelK: true },
  });
  const adrift = diseases.filter((d) => Math.abs(d.alertLevelK - best.k) > 0.001);
  if (adrift.length) {
    console.log(
      `\nSet in the system but not recommended: ${adrift
        .map((d) => `${d.name} at ${d.alertLevelK.toFixed(2)}×`)
        .join(", ")}.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
