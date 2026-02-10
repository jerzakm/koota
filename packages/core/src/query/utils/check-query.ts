import { $internal } from '../../common';
import type { Entity } from '../../entity/types';
import { getEntityId } from '../../entity/utils/pack-entity';
import type { World } from '../../world';
import type { QueryInstance } from '../types';

export function checkQuery(world: World, query: QueryInstance, entity: Entity): boolean {
    const staticBitmasks = query.staticBitmasks;
    const generations = query.generations;
    const entityMasks = world[$internal].entityMasks;
    const eid = getEntityId(entity);
    const generationsLen = generations.length;

    if (query.traitInstances.all.length === 0) return false;

    // Fast path: single generation (most common case)
    if (generationsLen === 1) {
        const bitmask = staticBitmasks[0];
        const required = bitmask.required;
        const forbidden = bitmask.forbidden;
        const or = bitmask.or;
        const genMasks = entityMasks[generations[0]];
        const entityMask = genMasks ? (genMasks[eid] | 0) : 0;

        if (forbidden && (entityMask & forbidden) !== 0) return false;
        if (required && (entityMask & required) !== required) return false;
        if (or !== 0 && (entityMask & or) === 0) return false;
        return true;
    }

    for (let i = 0; i < generationsLen; i++) {
        const bitmask = staticBitmasks[i];
        if (!bitmask) continue;

        const required = bitmask.required;
        const forbidden = bitmask.forbidden;
        const or = bitmask.or;
        const genMasks = entityMasks[generations[i]];
        const entityMask = genMasks ? (genMasks[eid] | 0) : 0;

        if (!forbidden && !required && !or) return false;
        if (forbidden && (entityMask & forbidden) !== 0) return false;
        if (required && (entityMask & required) !== required) return false;
        if (or !== 0 && (entityMask & or) === 0) return false;
    }

    return true;
}
