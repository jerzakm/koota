import {
	benchMixedWorkload,
	benchMultiQueryPopulation,
	benchNotQueryChurn,
	benchQueryIteration,
	benchSpawnDestroy,
	benchTraitChurn,
	benchWideArchetype,
} from './benchmarks';
import { type BenchResult, printResult, printSummary } from './harness';

const ITERATIONS = 100;

console.log(`\nKoota ECS Stress Test — ${ITERATIONS} iterations per benchmark\n`);
console.log(`${'═'.repeat(90)}`);

const results: BenchResult[] = [];

const suites = [
	() => benchSpawnDestroy(ITERATIONS),
	() => benchTraitChurn(ITERATIONS),
	() => benchQueryIteration(ITERATIONS),
	() => benchMultiQueryPopulation(ITERATIONS),
	() => benchWideArchetype(ITERATIONS),
	() => benchNotQueryChurn(ITERATIONS),
	() => benchMixedWorkload(ITERATIONS),
];

for (const suite of suites) {
	const result = suite();
	printResult(result);
	results.push(result);
}

printSummary(results);
