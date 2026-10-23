/**
 * Balance report: plays many full nights headlessly with scripted policies and
 * prints survival rates, causes of failure and resource use.
 *
 *   npm run balance            (default 60 seeds)
 *   node tests/tools/balanceReport.js 200
 */
import { Simulation } from '../../src/core/Simulation.js';
import { idlePolicy, doorsOnlyPolicy, competentPolicy, runNightSync } from './policies.js';

const seeds = Number(process.argv[2] ?? 60);
const policies = {
  idle: () => idlePolicy(),
  doorsOnly: () => doorsOnlyPolicy(),
  competent: () => competentPolicy(),
  competentSlow: () => competentPolicy({ reaction: 3.5, observerCheckEvery: 40 })
};

const started = Date.now();
for (const [name, factory] of Object.entries(policies)) {
  let survived = 0;
  let powerLeft = 0;
  let powerFailures = 0;
  const causes = {};
  const deathTimes = [];
  for (let i = 0; i < seeds; i++) {
    const s = runNightSync(Simulation, `balance-${i}`, factory);
    if (s.outcome === 'SURVIVED') {
      survived++;
      powerLeft += s.powerRemaining;
    } else {
      const key = `${s.breach.entityId}@${s.breach.via}`;
      causes[key] = (causes[key] ?? 0) + 1;
      deathTimes.push(s.timeSurvived);
    }
    if (s.powerFailed) powerFailures++;
  }
  deathTimes.sort((a, b) => a - b);
  const median = deathTimes.length ? deathTimes[Math.floor(deathTimes.length / 2)] : null;
  console.log(
    `${name.padEnd(14)} survived ${String(survived).padStart(3)}/${seeds} (${((100 * survived) / seeds).toFixed(0)}%)` +
      `  avg power left ${survived ? (powerLeft / survived).toFixed(1) : '-'}%` +
      `  power failures ${powerFailures}` +
      `  earliest death ${deathTimes.length ? deathTimes[0].toFixed(0) + 's' : '-'}` +
      `  median death ${median !== null ? median.toFixed(0) + 's' : '-'}`
  );
  console.log(`${''.padEnd(14)} causes ${JSON.stringify(causes)}`);
}
console.log(`(${((Date.now() - started) / 1000).toFixed(1)}s)`);
