import type { Entity } from '../entity/types';
import { getEntityId } from '../entity/utils/pack-entity';

// Hybrid BitSet + dense array for query entity storage.
// BitSet provides O(1) bit-test for has() (the hottest path).
// Dense array stores packed entities for zero-cost iteration output.
// Keyed by entity ID (20-bit), stores packed entity (32-bit) in dense.

const INITIAL_CAPACITY = 1024;

export class QueryEntitySet {
	// BitSet layer — keyed by entity ID for O(1) has/add/remove
	private bottom: Uint32Array;
	private capacity: number;

	// Dense layer — packed entities for iteration output
	private _dense: Entity[] = [];
	// Sparse layer — maps entity ID → dense index (for swap-remove)
	private _sparse: number[] = [];
	private _cursor: number = 0;

	constructor(capacity: number = INITIAL_CAPACITY) {
		this.capacity = capacity;
		const words = (capacity + 31) >>> 5;
		this.bottom = new Uint32Array(words);
	}

	has(entity: Entity): boolean {
		const eid = getEntityId(entity);
		if (eid >= this.capacity) return false;
		if ((this.bottom[eid >>> 5] & (1 << (eid & 31))) === 0) return false;
		return this._dense[this._sparse[eid]] === entity;
	}

	add(entity: Entity): void {
		const eid = getEntityId(entity);

		if (eid >= this.capacity) {
			this.grow(eid + 1);
		}

		const wordIdx = eid >>> 5;
		const bit = 1 << (eid & 31);

		if (this.bottom[wordIdx] & bit) {
			// Bit set — check if it's the same packed entity (exact match = already present)
			const existingIdx = this._sparse[eid];
			if (this._dense[existingIdx] === entity) return;
			// Stale entry (recycled entity ID) — overwrite in-place
			this._dense[existingIdx] = entity;
			return;
		}

		this.bottom[wordIdx] |= bit;
		this._sparse[eid] = this._cursor;
		this._dense[this._cursor++] = entity;
	}

	remove(entity: Entity): void {
		const eid = getEntityId(entity);
		if (eid >= this.capacity) return;

		const wordIdx = eid >>> 5;
		const bit = 1 << (eid & 31);

		if (!(this.bottom[wordIdx] & bit)) return;
		if (this._dense[this._sparse[eid]] !== entity) return;

		this.bottom[wordIdx] &= ~bit;

		const index = this._sparse[eid];
		this._cursor--;

		if (index !== this._cursor) {
			const swapped = this._dense[this._cursor];
			this._dense[index] = swapped;
			this._sparse[getEntityId(swapped)] = index;
		}
	}

	clear(): void {
		// Clear only the words that have bits set (faster than fill(0) for sparse usage)
		for (let i = 0; i < this._cursor; i++) {
			const eid = getEntityId(this._dense[i]);
			this.bottom[eid >>> 5] = 0;
		}
		this._cursor = 0;
	}

	// Returns a fresh copy of packed entities — matches SparseSet.dense behavior
	get dense(): Entity[] {
		return this._dense.slice(0, this._cursor);
	}

	get size(): number {
		return this._cursor;
	}

	private grow(minCapacity: number): void {
		let newCapacity = this.capacity;
		while (newCapacity < minCapacity) {
			newCapacity *= 2;
		}

		const newWords = (newCapacity + 31) >>> 5;
		const newBottom = new Uint32Array(newWords);
		newBottom.set(this.bottom);

		this.bottom = newBottom;
		this.capacity = newCapacity;
	}
}
