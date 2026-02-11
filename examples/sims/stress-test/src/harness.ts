// Benchmark harness — runs a function N times, collects timings, reports percentiles.

export type BenchResult = {
	name: string;
	iterations: number;
	samples: Float64Array;
	min: number;
	max: number;
	mean: number;
	median: number;
	p99: number;
	p999: number;
	stddev: number;
};

function percentile(sorted: Float64Array, p: number): number {
	const idx = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, idx)];
}

export function bench(
	name: string,
	fn: () => void,
	iterations: number,
	warmup: number = 5
): BenchResult {
	// Warmup — let V8 JIT compile and stabilize.
	for (let i = 0; i < warmup; i++) {
		fn();
	}

	const samples = new Float64Array(iterations);

	for (let i = 0; i < iterations; i++) {
		const t0 = performance.now();
		fn();
		samples[i] = performance.now() - t0;
	}

	// Sort for percentile calculation.
	const sorted = samples.slice().sort();

	let sum = 0;
	let min = Infinity;
	let max = -Infinity;
	for (let i = 0; i < sorted.length; i++) {
		const v = sorted[i];
		sum += v;
		if (v < min) min = v;
		if (v > max) max = v;
	}

	const mean = sum / iterations;

	let variance = 0;
	for (let i = 0; i < sorted.length; i++) {
		const d = sorted[i] - mean;
		variance += d * d;
	}
	const stddev = Math.sqrt(variance / iterations);

	return {
		name,
		iterations,
		samples,
		min,
		max,
		mean,
		median: percentile(sorted, 50),
		p99: percentile(sorted, 99),
		p999: percentile(sorted, 99.9),
		stddev,
	};
}

// Pretty-print a single result.
function fmtMs(v: number): string {
	if (v < 0.001) return `${(v * 1000).toFixed(2)} us`;
	if (v < 1) return `${(v * 1000).toFixed(1)} us`;
	return `${v.toFixed(3)} ms`;
}

export function printResult(r: BenchResult): void {
	const opsPerSec = (1000 / r.mean).toFixed(0);
	console.log(`\n  ${r.name}`);
	console.log(`  ${'─'.repeat(60)}`);
	console.log(`  iterations : ${r.iterations}`);
	console.log(`  mean       : ${fmtMs(r.mean)}   (${opsPerSec} ops/s)`);
	console.log(`  median     : ${fmtMs(r.median)}`);
	console.log(`  min        : ${fmtMs(r.min)}`);
	console.log(`  max        : ${fmtMs(r.max)}`);
	console.log(`  p99        : ${fmtMs(r.p99)}`);
	console.log(`  p99.9      : ${fmtMs(r.p999)}`);
	console.log(`  stddev     : ${fmtMs(r.stddev)}`);
}

// Print a summary table of all results.
export function printSummary(results: BenchResult[]): void {
	console.log(`\n${'═'.repeat(90)}`);
	console.log('  SUMMARY');
	console.log(`${'═'.repeat(90)}`);

	const nameWidth = Math.max(30, ...results.map((r) => r.name.length + 2));

	const header =
		'  ' +
		'Benchmark'.padEnd(nameWidth) +
		'Mean'.padStart(12) +
		'Median'.padStart(12) +
		'P99'.padStart(12) +
		'P99.9'.padStart(12) +
		'StdDev'.padStart(12);
	console.log(header);
	console.log(`  ${'─'.repeat(header.length - 2)}`);

	for (const r of results) {
		const line =
			'  ' +
			r.name.padEnd(nameWidth) +
			fmtMs(r.mean).padStart(12) +
			fmtMs(r.median).padStart(12) +
			fmtMs(r.p99).padStart(12) +
			fmtMs(r.p999).padStart(12) +
			fmtMs(r.stddev).padStart(12);
		console.log(line);
	}

	console.log(`${'═'.repeat(90)}\n`);
}
