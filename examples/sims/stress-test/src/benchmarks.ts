import { createWorld, Not, type Entity, type World } from 'koota';
import { bench, type BenchResult } from './harness';
import {
	Acceleration,
	Color,
	Damage,
	DummyTraits,
	Health,
	IsActive,
	IsDead,
	IsEnemy,
	IsPlayer,
	IsProjectile,
	IsStatic,
	Lifetime,
	MarkedForRemoval,
	Mass,
	NeedsUpdate,
	Position,
	Radius,
	Score,
	Velocity,
} from './traits';

// ─── 1. Spawn & Destroy ─────────────────────────────────────────────────────
// Exercises: BitSet add/remove, TraitData[] lookup, Query[] iteration,
//            Uint32Array entityMask growth, per-trait BitSet maintenance
const SPAWN_COUNT = 50_000;

export function benchSpawnDestroy(iterations: number): BenchResult {
	return bench(
		`spawn & destroy ${SPAWN_COUNT} entities`,
		() => {
			const world = createWorld();
			const entities: Entity[] = new Array(SPAWN_COUNT);

			for (let i = 0; i < SPAWN_COUNT; i++) {
				entities[i] = world.spawn(Position, Velocity, Health, Mass, Color);
			}

			for (let i = 0; i < SPAWN_COUNT; i++) {
				entities[i].destroy();
			}

			world.destroy();
		},
		iterations
	);
}

// ─── 2. Trait Add/Remove Churn ───────────────────────────────────────────────
// Exercises: TraitData[] lookup, BitSet membership, Query[] iteration,
//            reusable queryEvent object, spread elimination in addTrait
const CHURN_ENTITIES = 10_000;
const CHURN_CYCLES = 5;

export function benchTraitChurn(iterations: number): BenchResult {
	const world = createWorld();
	const entities: Entity[] = new Array(CHURN_ENTITIES);
	for (let i = 0; i < CHURN_ENTITIES; i++) {
		entities[i] = world.spawn(Position, Velocity);
	}

	world.query(Position, Velocity, Health);
	world.query(Position, Velocity, IsActive);
	world.query(Health, Damage);

	const result = bench(
		`trait add/remove churn (${CHURN_ENTITIES} ents x ${CHURN_CYCLES} cycles)`,
		() => {
			for (let c = 0; c < CHURN_CYCLES; c++) {
				for (let i = 0; i < CHURN_ENTITIES; i++) {
					entities[i].add(Health({ current: 50, max: 100 }), IsActive);
				}
				for (let i = 0; i < CHURN_ENTITIES; i++) {
					entities[i].remove(Health, IsActive);
				}
			}
		},
		iterations
	);

	world.destroy();
	return result;
}

// ─── 3. Query Iteration (updateEach) ─────────────────────────────────────────
// Exercises: Pre-allocated entity array in runQuery, BitSet forEach,
//            cached dense/sparse lookup, query-result pre-allocated temps
const ITER_ENTITIES = 100_000;

export function benchQueryIteration(iterations: number): BenchResult {
	const world = createWorld();
	for (let i = 0; i < ITER_ENTITIES; i++) {
		world.spawn(Position({ x: i, y: 0, z: 0 }), Velocity({ x: 1, y: 0.5, z: 0 }));
	}

	const result = bench(
		`updateEach Position+Velocity (${ITER_ENTITIES} ents)`,
		() => {
			world.query(Position, Velocity).updateEach(([pos, vel]) => {
				pos.x += vel.x;
				pos.y += vel.y;
				pos.z += vel.z;
			});
		},
		iterations
	);

	world.destroy();
	return result;
}

// ─── 4. Multi-Query Population ───────────────────────────────────────────────
// Exercises: bitSetAndMany fast path, TraitData[] lookup, Query[] push,
//            per-trait BitSet intersection
const POP_ENTITIES = 50_000;
const POP_QUERIES = 20;

export function benchMultiQueryPopulation(iterations: number): BenchResult {
	return bench(
		`create ${POP_QUERIES} queries over ${POP_ENTITIES} entities`,
		() => {
			const world = createWorld();

			for (let i = 0; i < POP_ENTITIES; i++) {
				const traits = [Position, Velocity];
				if (i % 2 === 0) traits.push(Health as any);
				if (i % 3 === 0) traits.push(Mass as any);
				if (i % 5 === 0) traits.push(Color as any);
				if (i % 7 === 0) traits.push(IsActive as any);
				if (i % 11 === 0) traits.push(Damage as any);
				world.spawn(...traits);
			}

			world.query(Position, Velocity);
			world.query(Position, Health);
			world.query(Velocity, Mass);
			world.query(Position, Velocity, Health);
			world.query(Position, Velocity, Mass);
			world.query(Position, Velocity, Color);
			world.query(Health, Mass);
			world.query(Health, Damage);
			world.query(Position, IsActive);
			world.query(Velocity, IsActive);
			world.query(Position, Velocity, Health, Mass);
			world.query(Position, Velocity, Health, Color);
			world.query(Position, Velocity, Mass, Color);
			world.query(Position, Health, Mass);
			world.query(Velocity, Health, Mass);
			world.query(Position, Velocity, IsActive);
			world.query(Health, IsActive);
			world.query(Position, Color, IsActive);
			world.query(Position, Velocity, Damage);
			world.query(Health, Damage, IsActive);

			world.destroy();
		},
		iterations
	);
}

// ─── 5. Wide Archetype (30+ traits) ─────────────────────────────────────────
// Exercises: Multi-generation Uint32Array entityMasks, BitSet per-trait AND,
//            TraitData[] with high trait IDs
const WIDE_ENTITIES = 5_000;
const WIDE_TRAIT_COUNT = 30;

export function benchWideArchetype(iterations: number): BenchResult {
	const wideDummies = DummyTraits.slice(0, WIDE_TRAIT_COUNT);

	return bench(
		`wide archetype (${WIDE_ENTITIES} ents x ${WIDE_TRAIT_COUNT} traits)`,
		() => {
			const world = createWorld();

			for (let i = 0; i < WIDE_ENTITIES; i++) {
				const entity = world.spawn(Position, Velocity, Health);
				entity.add(...wideDummies);
			}

			world.query(Position, Velocity, wideDummies[0], wideDummies[15], wideDummies[29]);
			world.query(Position, wideDummies[5], wideDummies[10], wideDummies[20]);
			world.query(Health, wideDummies[0], wideDummies[29]);

			world.destroy();
		},
		iterations
	);
}

// ─── 6. Not-Query with Entity Churn ─────────────────────────────────────────
// Exercises: notQueries as Query[], indexed for loop in createEntity,
//            BitSet add/remove on query.entities
const NOT_ENTITIES = 20_000;

export function benchNotQueryChurn(iterations: number): BenchResult {
	const world = createWorld();

	world.query(Position, Not(IsDead));
	world.query(Velocity, Not(IsStatic));
	world.query(Health, Not(MarkedForRemoval));
	world.query(Position, Velocity, Not(IsProjectile));

	const result = bench(
		`Not-query churn (${NOT_ENTITIES} spawn+destroy)`,
		() => {
			const entities: Entity[] = new Array(NOT_ENTITIES);

			for (let i = 0; i < NOT_ENTITIES; i++) {
				entities[i] = world.spawn(Position, Velocity, Health);
			}

			for (let i = 0; i < NOT_ENTITIES; i += 2) {
				entities[i].add(IsDead);
			}

			for (let i = 0; i < NOT_ENTITIES; i++) {
				entities[i].destroy();
			}
		},
		iterations
	);

	world.destroy();
	return result;
}

// ─── 7. Mixed Workload (realistic game tick) ─────────────────────────────────
// Exercises: All optimizations combined — spawn, add traits, query, mutate,
//            remove traits, destroy in a single simulated tick.
const MIX_EXISTING = 50_000;
const MIX_SPAWN_PER_TICK = 500;
const MIX_DESTROY_PER_TICK = 500;

export function benchMixedWorkload(iterations: number): BenchResult {
	const world = createWorld();
	const alive: Entity[] = new Array(MIX_EXISTING + MIX_SPAWN_PER_TICK * iterations);
	let aliveHead = 0;
	let aliveTail = 0;

	for (let i = 0; i < MIX_EXISTING; i++) {
		const e = world.spawn(Position, Velocity);
		if (i % 3 === 0) e.add(Health);
		if (i % 5 === 0) e.add(IsEnemy);
		if (i % 7 === 0) e.add(IsActive);
		alive[aliveTail++] = e;
	}

	world.query(Position, Velocity);
	world.query(Position, Velocity, Health);
	world.query(Position, Not(IsDead));
	world.query(IsEnemy, IsActive);

	let tickSeed = 0;

	const result = bench(
		`mixed workload (${MIX_EXISTING} base, +${MIX_SPAWN_PER_TICK}/-${MIX_DESTROY_PER_TICK} per tick)`,
		() => {
			tickSeed++;

			for (let i = 0; i < MIX_SPAWN_PER_TICK; i++) {
				const e = world.spawn(
					Position({ x: tickSeed + i, y: 0, z: 0 }),
					Velocity({ x: 1, y: -1, z: 0 })
				);
				if (i % 2 === 0) e.add(Health, IsEnemy, IsActive);
				alive[aliveTail++] = e;
			}

			world.query(Position, Velocity).updateEach(([pos, vel]) => {
				pos.x += vel.x;
				pos.y += vel.y;
			});

			const enemies = world.query(IsEnemy, IsActive);
			let marked = 0;
			for (const entity of enemies) {
				if (marked++ < 100) {
					entity.add(IsDead);
					entity.remove(IsActive);
				}
			}

			// O(1) ring-buffer style destroy from head.
			const toDestroy = Math.min(MIX_DESTROY_PER_TICK, aliveTail - aliveHead);
			for (let i = 0; i < toDestroy; i++) {
				const e = alive[aliveHead++];
				if (world.has(e)) e.destroy();
			}
		},
		iterations
	);

	world.destroy();
	return result;
}
