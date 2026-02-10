// Two-level hierarchical bitfield. Level 0 (top): 1 bit per 32-element block.
// Level 1 (bottom): 1 bit per element. ~1.06 bits overhead per element.
// Inner join via AND + tzcnt loop. Skips 1024 empty elements per top-level zero bit.

// tzcnt32: index of lowest set bit (0-31), or 32 if v === 0
export function tzcnt32(v: number): number {
	if (v === 0) return 32;
	return 31 - Math.clz32(v & -v); // isolate LSB via v & -v, then clz
}

// popcount32: number of set bits in a 32-bit integer (Hamming weight)
export function popcount32(v: number): number {
	v = v - ((v >>> 1) & 0x55555555);
	v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
	return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

const INITIAL_CAPACITY = 1024;

export class BitSet {
	bottom: Uint32Array;
	top: Uint32Array;
	count: number = 0;
	private capacity: number;

	constructor(capacity: number = INITIAL_CAPACITY) {
		this.capacity = capacity;
		const bottomWords = (capacity + 31) >>> 5;
		const topWords = (bottomWords + 31) >>> 5;
		this.bottom = new Uint32Array(bottomWords);
		this.top = new Uint32Array(topWords);
	}

	has(key: number): boolean {
		if (key >= this.capacity) return false;
		return (this.bottom[key >>> 5] & (1 << (key & 31))) !== 0;
	}

	add(key: number): boolean {
		if (key >= this.capacity) {
			this.grow(key + 1);
		}

		const wordIdx = key >>> 5;
		const bit = 1 << (key & 31);

		if (this.bottom[wordIdx] & bit) return false;

		this.bottom[wordIdx] |= bit;
		this.top[wordIdx >>> 5] |= 1 << (wordIdx & 31);
		this.count++;
		return true;
	}

	remove(key: number): boolean {
		if (key >= this.capacity) return false;

		const wordIdx = key >>> 5;
		const bit = 1 << (key & 31);

		if (!(this.bottom[wordIdx] & bit)) return false;

		this.bottom[wordIdx] &= ~bit;

		if (this.bottom[wordIdx] === 0) {
			this.top[wordIdx >>> 5] &= ~(1 << (wordIdx & 31));
		}

		this.count--;
		return true;
	}

	clear(): void {
		this.bottom.fill(0);
		this.top.fill(0);
		this.count = 0;
	}

	forEach(fn: (key: number) => void): void {
		for (let ti = 0; ti < this.top.length; ti++) {
			let topBits = this.top[ti];
			while (topBits !== 0) {
				const topBit = tzcnt32(topBits);
				topBits &= topBits - 1;

				const bottomIdx = (ti << 5) | topBit;
				let bottomBits = this.bottom[bottomIdx];
				while (bottomBits !== 0) {
					const bottomBit = tzcnt32(bottomBits);
					bottomBits &= bottomBits - 1;

					fn((bottomIdx << 5) | bottomBit);
				}
			}
		}
	}

	toArray(): number[] {
		const result: number[] = [];
		this.forEach((key) => result.push(key));
		return result;
	}

	toArrayInto(out: number[] | Uint32Array, offset: number = 0): number {
		let cursor = offset;
		this.forEach((key) => {
			out[cursor++] = key;
		});
		return cursor - offset;
	}

	private grow(minCapacity: number): void {
		let newCapacity = this.capacity;
		while (newCapacity < minCapacity) {
			newCapacity *= 2;
		}

		const newBottomWords = (newCapacity + 31) >>> 5;
		const newTopWords = (newBottomWords + 31) >>> 5;

		const newBottom = new Uint32Array(newBottomWords);
		newBottom.set(this.bottom);

		const newTop = new Uint32Array(newTopWords);
		newTop.set(this.top);

		this.bottom = newBottom;
		this.top = newTop;
		this.capacity = newCapacity;
	}
}

export function bitSetAnd(a: BitSet, b: BitSet, fn: (key: number) => void): void {
	const topLen = Math.min(a.top.length, b.top.length);

	for (let ti = 0; ti < topLen; ti++) {
		let topBits = a.top[ti] & b.top[ti];
		while (topBits !== 0) {
			const topBit = tzcnt32(topBits);
			topBits &= topBits - 1;

			const bottomIdx = (ti << 5) | topBit;
			let bottomBits = a.bottom[bottomIdx] & b.bottom[bottomIdx];
			while (bottomBits !== 0) {
				const bottomBit = tzcnt32(bottomBits);
				bottomBits &= bottomBits - 1;

				fn((bottomIdx << 5) | bottomBit);
			}
		}
	}
}

export function bitSetAndMany(sets: BitSet[], fn: (key: number) => void): void {
	if (sets.length === 0) return;
	if (sets.length === 1) {
		sets[0].forEach(fn);
		return;
	}
	if (sets.length === 2) {
		bitSetAnd(sets[0], sets[1], fn);
		return;
	}

	const topLen = Math.min(...sets.map((s) => s.top.length));

	for (let ti = 0; ti < topLen; ti++) {
		let topBits = sets[0].top[ti];
		for (let s = 1; s < sets.length; s++) {
			topBits &= sets[s].top[ti];
		}

		while (topBits !== 0) {
			const topBit = tzcnt32(topBits);
			topBits &= topBits - 1;

			const bottomIdx = (ti << 5) | topBit;
			let bottomBits = sets[0].bottom[bottomIdx];
			for (let s = 1; s < sets.length; s++) {
				bottomBits &= sets[s].bottom[bottomIdx];
			}

			while (bottomBits !== 0) {
				const bottomBit = tzcnt32(bottomBits);
				bottomBits &= bottomBits - 1;

				fn((bottomIdx << 5) | bottomBit);
			}
		}
	}
}

export function bitSetAndNot(a: BitSet, b: BitSet, fn: (key: number) => void): void {
	for (let ti = 0; ti < a.top.length; ti++) {
		let topBits = a.top[ti];
		while (topBits !== 0) {
			const topBit = tzcnt32(topBits);
			topBits &= topBits - 1;

			const bottomIdx = (ti << 5) | topBit;
			const bBottom = bottomIdx < b.bottom.length ? b.bottom[bottomIdx] : 0;
			let bottomBits = a.bottom[bottomIdx] & ~bBottom;
			while (bottomBits !== 0) {
				const bottomBit = tzcnt32(bottomBits);
				bottomBits &= bottomBits - 1;

				fn((bottomIdx << 5) | bottomBit);
			}
		}
	}
}

export function bitSetAndAny(a: BitSet, b: BitSet): boolean {
	const topLen = Math.min(a.top.length, b.top.length);

	for (let ti = 0; ti < topLen; ti++) {
		let topBits = a.top[ti] & b.top[ti];
		while (topBits !== 0) {
			const topBit = tzcnt32(topBits);
			topBits &= topBits - 1;

			const bottomIdx = (ti << 5) | topBit;
			if ((a.bottom[bottomIdx] & b.bottom[bottomIdx]) !== 0) {
				return true;
			}
		}
	}

	return false;
}

export function bitSetIsSubset(a: BitSet, b: BitSet): boolean {
	for (let ti = 0; ti < a.top.length; ti++) {
		let topBits = a.top[ti];
		while (topBits !== 0) {
			const topBit = tzcnt32(topBits);
			topBits &= topBits - 1;

			const bottomIdx = (ti << 5) | topBit;
			const aWord = a.bottom[bottomIdx];
			const bWord = bottomIdx < b.bottom.length ? b.bottom[bottomIdx] : 0;

			if ((aWord & bWord) !== aWord) return false;
		}
	}

	return true;
}
