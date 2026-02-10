export function ensureEntityMaskSize(masks: Uint32Array[], generationId: number, eid: number): void {
    const arr = masks[generationId];
    if (eid < arr.length) return;
    let newLen = arr.length;
    while (newLen <= eid) newLen *= 2;
    const grown = new Uint32Array(newLen);
    grown.set(arr);
    masks[generationId] = grown;
}
