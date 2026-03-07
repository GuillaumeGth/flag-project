import { useMemo } from 'react';
import { UndiscoveredMessageMapMeta, Coordinates } from '@/types';
import { calculateDistance } from '@/services/location';
import { getMessageLocation } from '@/utils/mapUtils';

export const CLUSTER_RADIUS_M = 50;

export interface MessageCluster {
  id: string; // representative message id (= first message)
  messages: UndiscoveredMessageMapMeta[];
  location: Coordinates;
  senderAvatarUrl: string;
  senderId: string;
  isPublic: boolean;
}

export function useClusteredMarkers(messages: UndiscoveredMessageMapMeta[]): MessageCluster[] {
  return useMemo(() => {
    const clusters: MessageCluster[] = [];

    const bySender = new Map<string, UndiscoveredMessageMapMeta[]>();
    for (const msg of messages) {
      const senderId = msg.sender?.id;
      if (!senderId || !msg.sender?.avatar_url) continue;
      if (!bySender.has(senderId)) bySender.set(senderId, []);
      bySender.get(senderId)!.push(msg);
    }

    for (const senderMessages of bySender.values()) {
      const remaining = [...senderMessages];

      while (remaining.length > 0) {
        const seed = remaining.shift()!;
        const seedLocation = getMessageLocation(seed);
        if (!seedLocation) continue;

        const clusterMessages = [seed];
        const toKeep: UndiscoveredMessageMapMeta[] = [];

        for (const msg of remaining) {
          const loc = getMessageLocation(msg);
          if (loc && calculateDistance(seedLocation, loc) <= CLUSTER_RADIUS_M) {
            clusterMessages.push(msg);
          } else {
            toKeep.push(msg);
          }
        }
        remaining.splice(0, remaining.length, ...toKeep);

        clusters.push({
          id: seed.id,
          messages: clusterMessages,
          location: seedLocation,
          senderId: seed.sender!.id,
          senderAvatarUrl: seed.sender!.avatar_url ?? '',
          isPublic: clusterMessages.some(m => m.is_public),
        });
      }
    }

    return clusters;
  }, [messages]);
}
