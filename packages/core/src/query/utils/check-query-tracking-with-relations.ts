import type { Entity } from '../../entity/types';
import { hasRelationPair } from '../../relation/relation';
import type { World } from '../../world';
import type { EventType, QueryInstance } from '../types';
import { checkQueryTracking } from './check-query-tracking';

/**
 * Check if an entity matches a tracking query with relation filters.
 * Combines checkQueryTracking (trait bitmasks + tracking state) with relation checks.
 */
export function checkQueryTrackingWithRelations(
    world: World,
    query: QueryInstance,
    entity: Entity,
    eventType: EventType,
    eventGenerationId: number,
    eventBitflag: number
): boolean {
    if (!checkQueryTracking(world, query, entity, eventType, eventGenerationId, eventBitflag)) {
        return false;
    }

    const filters = query.relationFilters!;
    for (let i = 0, len = filters.length; i < len; i++) {
        if (!hasRelationPair(world, entity, filters[i])) return false;
    }

    return true;
}
