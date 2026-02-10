import { $internal } from '../common';
import { getEntitiesWithRelationTo, getRelationTargets } from '../relation/relation';
import { addTrait, cleanupRelationTarget, removeTrait } from '../trait/trait';
import type { ConfigurableTrait } from '../trait/types';
import { universe } from '../universe/universe';
import type { World } from '../world';
import type { Entity } from './types';
import { allocateEntity, releaseEntity } from './utils/entity-index';
import { getEntityId, getEntityWorldId } from './utils/pack-entity';

// Ensure entity methods are patched.
import './entity-methods-patch';

export function createEntity(world: World, ...traits: ConfigurableTrait[]): Entity {
    const ctx = world[$internal];
    const entity = allocateEntity(ctx.entityIndex);

	for (let i = 0, len = ctx.notQueries.length; i < len; i++) {
		const query = ctx.notQueries[i];
		const match = query.check(world, entity);
		if (match) query.add(entity);
		query.resetTrackingBitmasks(getEntityId(entity));
	}

    ctx.entityTraits.set(entity, new Set());
    addTrait(world, entity, ...traits);

    return entity;
}

const cachedSet = new Set<Entity>();
const cachedQueue = [] as Entity[];

export function destroyEntity(world: World, entity: Entity) {
    const ctx = world[$internal];

    // Check if entity exists.
    if (!world.has(entity)) throw new Error('Koota: The entity being destroyed does not exist.');

    // Caching the lookup in the outer scope of the loop increases performance.
    const entityQueue = cachedQueue;
    const processedEntities = cachedSet;

    // Ensure the queue is empty before starting.
    entityQueue.length = 0;
    entityQueue.push(entity);
    processedEntities.clear();

    // Destroyed entities may be the target or source of relations.
    // To avoid stale references, all these relations must be removed.
    // autoDestroy controls cascade behavior:
    // - 'source' (or 'orphan'): when target dies, destroy sources (e.g., parent dies → children die)
    // - 'target': when source dies, destroy targets (e.g., container dies → items die)
    const relationsArr = Array.from(ctx.relations);
    const relationsLen = relationsArr.length;

    while (entityQueue.length > 0) {
        const currentEntity = entityQueue.pop()!;
        if (processedEntities.has(currentEntity)) continue;

        processedEntities.add(currentEntity);

        for (let ri = 0; ri < relationsLen; ri++) {
            const relation = relationsArr[ri];
            const relationCtx = relation[$internal];

            const sources = getEntitiesWithRelationTo(world, relation, currentEntity);
            for (let si = 0; si < sources.length; si++) {
                const source = sources[si];
                if (!world.has(source)) continue;
                cleanupRelationTarget(world, relation, source, currentEntity);
                if (relationCtx.autoDestroy === 'source') entityQueue.push(source);
            }

            if (relationCtx.autoDestroy === 'target') {
                const targets = getRelationTargets(world, relation, currentEntity);
                for (let ti = 0; ti < targets.length; ti++) {
                    const target = targets[ti];
                    if (!world.has(target)) continue;
                    if (!processedEntities.has(target)) entityQueue.push(target);
                }
            }
        }

        const entityTraits = ctx.entityTraits.get(currentEntity);
        if (entityTraits) {
            const traitsArr = Array.from(entityTraits);
            for (let ti = 0; ti < traitsArr.length; ti++) {
                removeTrait(world, currentEntity, traitsArr[ti]);
            }
        }

        // Free the entity.
        releaseEntity(ctx.entityIndex, currentEntity);

        // Remove the entity from the all query.
        const allQuery = ctx.queriesHashMap.get('');
        if (allQuery) allQuery.remove(world, currentEntity);

        // Remove all entity state from world.
        ctx.entityTraits.delete(currentEntity);

        // Clear entity bitmasks.
        const eid = getEntityId(currentEntity);
        for (let i = 0; i < ctx.entityMasks.length; i++) {
            ctx.entityMasks[i][eid] = 0;
        }
    }
}

/* @inline @pure */ export function getEntityWorld(entity: Entity) {
    const worldId = getEntityWorldId(entity);
    return universe.worlds[worldId]!;
}
