/**
 * Re-measures the detector against a freshly generated labelled corpus and
 * records the result, so the accuracy screen quotes an experiment rather
 * than a fixture.
 *
 *   npm run detector:evaluate
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { recommendLevel } from "../lib/detector/evaluate";
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
    `${results[0].records} records, ${results[0].scored} scored, ${results[0].outbreaks} seeded outbreaks\n`,
  );
  console.log("    k   prec  recall      F1      F2");
  for (const r of results) {
    const mark =
      r.k === best.k ? "  ← recommended (F2)" : r.k === byF1.k ? "  ← best F1" : "";
    console.log(
      `${r.k.toFixed(2).padStart(5)}  ${r.precision.toFixed(3)}  ${r.recall.toFixed(3)}  ${r.f1.toFixed(3)}  ${r.f2.toFixed(3)}${mark}`,
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
