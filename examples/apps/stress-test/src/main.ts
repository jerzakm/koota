import type { BenchResult } from "@sim/stress-test";
import {
  benchMixedWorkload,
  benchMultiQueryPopulation,
  benchNotQueryChurn,
  benchQueryIteration,
  benchSpawnDestroy,
  benchTraitChurn,
  benchWideArchetype,
} from "@sim/stress-test";

const ITERATIONS = 50;

type Suite = { name: string; run: () => BenchResult };

const suites: Suite[] = [
  { name: "spawn & destroy", run: () => benchSpawnDestroy(ITERATIONS) },
  { name: "trait churn", run: () => benchTraitChurn(ITERATIONS) },
  { name: "updateEach", run: () => benchQueryIteration(ITERATIONS) },
  {
    name: "multi-query population",
    run: () => benchMultiQueryPopulation(ITERATIONS),
  },
  { name: "wide archetype", run: () => benchWideArchetype(ITERATIONS) },
  { name: "not-query churn", run: () => benchNotQueryChurn(ITERATIONS) },
  { name: "mixed workload", run: () => benchMixedWorkload(ITERATIONS) },
];

function fmtMs(v: number): string {
  if (v < 0.001) return `${(v * 1000).toFixed(2)} µs`;
  if (v < 1) return `${(v * 1000).toFixed(1)} µs`;
  return `${v.toFixed(3)} ms`;
}

function buildSummaryText(results: BenchResult[]): string {
  const W = 90;
  const nameWidth = Math.max(30, ...results.map((r) => r.name.length + 2));
  const lines: string[] = [];

  lines.push("=".repeat(W));
  lines.push("  SUMMARY");
  lines.push("=".repeat(W));

  const header =
    "  " +
    "Benchmark".padEnd(nameWidth) +
    "Mean".padStart(12) +
    "Median".padStart(12) +
    "P99".padStart(12) +
    "P99.9".padStart(12) +
    "StdDev".padStart(12);
  lines.push(header);
  lines.push("  " + "-".repeat(header.length - 2));

  for (const r of results) {
    lines.push(
      "  " +
        r.name.padEnd(nameWidth) +
        fmtMs(r.mean).padStart(12) +
        fmtMs(r.median).padStart(12) +
        fmtMs(r.p99).padStart(12) +
        fmtMs(r.p999).padStart(12) +
        fmtMs(r.stddev).padStart(12),
    );
  }

  lines.push("=".repeat(W));
  return lines.join("\n");
}

function createUI(): {
  setStatus: (text: string) => void;
  addResult: (r: BenchResult) => void;
  setDone: (results: BenchResult[]) => void;
} {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = `
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body { background: #0d1117; color: #c9d1d9; font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace; font-size: 14px; padding: 24px; }
		h1 { color: #58a6ff; font-size: 20px; margin-bottom: 4px; }
		.subtitle { color: #8b949e; font-size: 13px; margin-bottom: 20px; }
		#status { color: #f0883e; margin-bottom: 16px; font-size: 13px; }
		table { border-collapse: collapse; width: 100%; max-width: 1100px; }
		th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #30363d; color: #8b949e; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
		th.num { text-align: right; }
		td { padding: 8px 12px; border-bottom: 1px solid #21262d; }
		td.num { text-align: right; font-variant-numeric: tabular-nums; }
		td.name { color: #58a6ff; font-weight: 500; }
		tr:hover td { background: #161b22; }
		.actions { margin-top: 16px; display: flex; gap: 8px; }
		.actions button { padding: 8px 20px; border: none; border-radius: 6px; font-family: inherit; font-size: 14px; cursor: pointer; }
		#run-btn { background: #238636; color: #fff; }
		#run-btn:hover { background: #2ea043; }
		#run-btn:disabled { background: #21262d; color: #484f58; cursor: not-allowed; }
		#copy-btn { background: #30363d; color: #c9d1d9; display: none; }
		#copy-btn:hover { background: #484f58; }
		#summary-block { margin-top: 16px; display: none; }
		#summary-block pre { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; overflow-x: auto; white-space: pre; font-size: 13px; color: #e6edf3; }
	`;
  document.head.appendChild(style);

  const h1 = document.createElement("h1");
  h1.textContent = "Koota ECS Stress Test";
  app.appendChild(h1);

  const sub = document.createElement("div");
  sub.className = "subtitle";
  sub.textContent = `${ITERATIONS} iterations per benchmark`;
  app.appendChild(sub);

  const status = document.createElement("div");
  status.id = "status";
  app.appendChild(status);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const cols = [
    "Benchmark",
    "Mean",
    "Median",
    "Min",
    "Max",
    "P99",
    "P99.9",
    "StdDev",
    "ops/s",
  ];
  for (const col of cols) {
    const th = document.createElement("th");
    th.textContent = col;
    if (col !== "Benchmark") th.className = "num";
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  app.appendChild(table);

  const actions = document.createElement("div");
  actions.className = "actions";

  const btn = document.createElement("button");
  btn.id = "run-btn";
  btn.textContent = "Run Again";
  btn.disabled = true;
  btn.onclick = () => {
    tbody.innerHTML = "";
    summaryBlock.style.display = "none";
    copyBtn.style.display = "none";
    runAll();
  };
  actions.appendChild(btn);

  const copyBtn = document.createElement("button");
  copyBtn.id = "copy-btn";
  copyBtn.textContent = "Copy Summary";
  actions.appendChild(copyBtn);

  app.appendChild(actions);

  const summaryBlock = document.createElement("div");
  summaryBlock.id = "summary-block";
  const summaryPre = document.createElement("pre");
  summaryBlock.appendChild(summaryPre);
  app.appendChild(summaryBlock);

  return {
    setStatus(text: string) {
      status.textContent = text;
    },
    addResult(r: BenchResult) {
      const tr = document.createElement("tr");
      const vals = [
        { text: r.name, cls: "name" },
        { text: fmtMs(r.mean), cls: "num" },
        { text: fmtMs(r.median), cls: "num" },
        { text: fmtMs(r.min), cls: "num" },
        { text: fmtMs(r.max), cls: "num" },
        { text: fmtMs(r.p99), cls: "num" },
        { text: fmtMs(r.p999), cls: "num" },
        { text: fmtMs(r.stddev), cls: "num" },
        { text: (1000 / r.mean).toFixed(1), cls: "num" },
      ];
      for (const v of vals) {
        const td = document.createElement("td");
        td.textContent = v.text;
        td.className = v.cls;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    },
    setDone(results: BenchResult[]) {
      status.textContent = "Done.";
      btn.disabled = false;

      const text = buildSummaryText(results);
      summaryPre.textContent = text;
      summaryBlock.style.display = "block";
      copyBtn.style.display = "inline-block";
      copyBtn.textContent = "Copy Summary";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => {
            copyBtn.textContent = "Copy Summary";
          }, 1500);
        });
      };
    },
  };
}

const ui = createUI();

function runAll() {
  const btn = document.getElementById("run-btn") as HTMLButtonElement;
  btn.disabled = true;

  let idx = 0;
  const results: BenchResult[] = [];

  function next() {
    if (idx >= suites.length) {
      ui.setDone(results);
      return;
    }

    const suite = suites[idx];
    ui.setStatus(`Running ${idx + 1}/${suites.length}: ${suite.name}...`);

    setTimeout(() => {
      const result = suite.run();
      ui.addResult(result);
      results.push(result);
      idx++;
      next();
    }, 50);
  }

  next();
}

runAll();
