import type { Entity } from '../../entity/types';
import { hasRelationPair } from '../../relation/relation';
import type { World } from '../../world';
import type { QueryInstance } from '../types';
import { checkQuery } from './check-query';

/**
 * Check if an entity matches a query with relation filters.
 * Uses hybrid bitmask strategy: trait bitmasks first (fast), then relation checks.
 */
export function checkQueryWithRelations(world: World, query: QueryInstance, entity: Entity): boolean {
    if (!checkQuery(world, query, entity)) return false;

    const filters = query.relationFilters!;
    for (let i = 0, len = filters.length; i < len; i++) {
        if (!hasRelationPair(world, entity, filters[i])) return false;
    }

    return true;
}
