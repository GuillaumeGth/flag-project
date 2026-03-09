import { useMemo } from 'react';
import { UndiscoveredMessageMapMeta, Coordinates } from '@/types';
import { calculateDistance } from '@/services/location';
import { getMessageLocation } from '@/utils/mapUtils';

/** Default cluster radius used at the base zoom level (latDelta ≈ 0.009). */
export const CLUSTER_RADIUS_M = 50;

/**
 * A cluster represents one map marker.
 *
 * - `id`              — ID of the seed message (first processed in the cluster).
 *                       Also used as the avatar capture cache key (combined with
 *                       `messages.length` to invalidate when the count changes).
 * - `senderAvatarUrl` — Avatar of the seed message's sender; used for the marker image.
 * - `isPublic`        — true if at least one message in the cluster is public.
 */
export interface MessageCluster {
  id: string;
  messages: UndiscoveredMessageMapMeta[];
  location: Coordinates;
  senderAvatarUrl: string | null;
  senderDisplayName: string | null;
  senderId: string;
  isPublic: boolean;
  isAdminPlaced: boolean;
}

/**
 * Groups messages into spatial clusters for map rendering.
 *
 * Algorithm: greedy single-linkage clustering (O(n²)).
 * Each unassigned message becomes a seed; every subsequent message within
 * `clusterRadius` metres of that seed is merged into its cluster.
 *
 * @param messages      Messages to cluster (must have sender.id + sender.avatar_url).
 * @param clusterRadius Merge radius in metres. In MapScreen this is computed
 *                      dynamically from the map's latitudeDelta so clusters adapt
 *                      to the current zoom level:
 *                        radius = clamp(latDelta × 111 000 × 0.10, 20, 15 000)
 * @param groupBySender When true, messages are first partitioned by sender before
 *                      spatial clustering — messages from different senders are
 *                      never merged. Used for "Mes Flaags" mode so each recipient's
 *                      flags stay visually separate.
 *                      When false (Explorer mode), clustering is purely spatial and
 *                      messages from any sender can be grouped together.
 */
/**
 * Pure clustering function — testable without a React context.
 * See `useClusteredMarkers` for parameter docs.
 */
export function clusterMessages(
  messages: UndiscoveredMessageMapMeta[],
  clusterRadius: number = CLUSTER_RADIUS_M,
  groupBySender: boolean = false,
): MessageCluster[] {
  const clusters: MessageCluster[] = [];
  const valid = messages.filter(m => m.sender?.id);

  if (groupBySender) {
    const bySender = new Map<string, UndiscoveredMessageMapMeta[]>();
    for (const msg of valid) {
      const sid = msg.sender!.id;
      if (!bySender.has(sid)) bySender.set(sid, []);
      bySender.get(sid)!.push(msg);
    }
    for (const senderMessages of bySender.values()) {
      spatialCluster(senderMessages, clusterRadius, clusters);
    }
  } else {
    spatialCluster(valid, clusterRadius, clusters);
  }

  return clusters;
}

export function useClusteredMarkers(
  messages: UndiscoveredMessageMapMeta[],
  clusterRadius: number = CLUSTER_RADIUS_M,
  groupBySender: boolean = false,
): MessageCluster[] {
  return useMemo(
    () => clusterMessages(messages, clusterRadius, groupBySender),
    [messages, clusterRadius, groupBySender],
  );
}

/**
 * Core greedy spatial clustering pass. Mutates `out` by appending new clusters.
 * Processes messages in insertion order; the first message in each group becomes
 * the seed (and its id / avatar represent the whole cluster).
 */
function spatialCluster(
  messages: UndiscoveredMessageMapMeta[],
  clusterRadius: number,
  out: MessageCluster[],
): void {
  const remaining = [...messages];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const seedLocation = getMessageLocation(seed);
    if (!seedLocation) continue;

    const clusterMessages = [seed];
    const toKeep: UndiscoveredMessageMapMeta[] = [];

    for (const msg of remaining) {
      const loc = getMessageLocation(msg);
      if (loc && calculateDistance(seedLocation, loc) <= clusterRadius) {
        clusterMessages.push(msg);
      } else {
        toKeep.push(msg);
      }
    }
    remaining.splice(0, remaining.length, ...toKeep);

    out.push({
      id: seed.id,
      messages: clusterMessages,
      location: seedLocation,
      senderId: seed.sender!.id,
      senderAvatarUrl: seed.sender!.avatar_url ?? null,
      senderDisplayName: seed.sender!.display_name ?? null,
      isPublic: clusterMessages.some(m => m.is_public),
      isAdminPlaced: seed.sender?.is_admin === true,
    });
  }
}
