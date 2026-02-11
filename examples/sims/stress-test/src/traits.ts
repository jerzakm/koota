import { type Trait, trait } from 'koota';

export const Position = trait({ x: 0, y: 0, z: 0 });
export const Velocity = trait({ x: 0, y: 0, z: 0 });
export const Acceleration = trait({ x: 0, y: 0, z: 0 });
export const Health = trait({ current: 100, max: 100 });
export const Damage = trait({ value: 0 });
export const Mass = trait({ value: 1 });
export const Radius = trait({ value: 1 });
export const Color = trait({ r: 255, g: 255, b: 255 });
export const Lifetime = trait({ remaining: 0 });
export const Score = trait({ value: 0 });

export const IsPlayer = trait();
export const IsEnemy = trait();
export const IsProjectile = trait();
export const IsActive = trait();
export const IsDead = trait();
export const IsStatic = trait();
export const NeedsUpdate = trait();
export const MarkedForRemoval = trait();

// 40 dummy tag traits for wide-archetype and multi-query benchmarks.
export const DummyTraits: Trait[] = [];
for (let i = 0; i < 40; i++) {
	DummyTraits.push(trait());
}
