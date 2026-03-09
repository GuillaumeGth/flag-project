import { clusterMessages, CLUSTER_RADIUS_M } from '@/hooks/useClusteredMarkers';
import { UndiscoveredMessageMapMeta } from '@/types';

// Prevent supabase client from being initialised during tests
jest.mock('@/services/errorReporting', () => ({ reportError: jest.fn() }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function makeMsg(
  lat: number,
  lng: number,
  senderId = 'sender-1',
  avatarUrl = 'https://example.com/avatar.jpg',
): UndiscoveredMessageMapMeta {
  return {
    id: `msg-${++idCounter}`,
    location: { latitude: lat, longitude: lng },
    created_at: new Date().toISOString(),
    is_public: false,
    sender: { id: senderId, display_name: 'Test', avatar_url: avatarUrl },
  } as unknown as UndiscoveredMessageMapMeta;
}

// Paris centre
const PARIS = { lat: 48.8566, lng: 2.3522 };
// ~40 m north of PARIS (well within 50 m default radius)
const PARIS_NEAR = { lat: 48.8570, lng: 2.3522 };
// ~500 m north of PARIS (outside 50 m radius, inside 1 000 m radius)
const PARIS_FAR = { lat: 48.8611, lng: 2.3522 };
// Senlis — ~50 km north, never clusters with Paris at any reasonable radius
const SENLIS = { lat: 49.2057, lng: 2.5878 };

beforeEach(() => { idCounter = 0; });

// ---------------------------------------------------------------------------
// Empty / invalid input
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('returns [] for empty input', () => {
    expect(clusterMessages([])).toEqual([]);
  });

  it('filters out messages without sender.id', () => {
    const msg = makeMsg(PARIS.lat, PARIS.lng);
    (msg as any).sender = { id: '', avatar_url: 'https://example.com/a.jpg' };
    expect(clusterMessages([msg])).toHaveLength(0);
  });

  it('filters out messages without sender.avatar_url', () => {
    const msg = makeMsg(PARIS.lat, PARIS.lng);
    (msg as any).sender = { id: 'sender-1', avatar_url: '' };
    expect(clusterMessages([msg])).toHaveLength(0);
  });

  it('filters out messages without a valid location', () => {
    const msg = makeMsg(PARIS.lat, PARIS.lng);
    (msg as any).location = null;
    expect(clusterMessages([msg])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Single message
// ---------------------------------------------------------------------------

describe('single message', () => {
  it('produces one cluster for a single message', () => {
    const msg = makeMsg(PARIS.lat, PARIS.lng);
    const clusters = clusterMessages([msg]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].messages).toHaveLength(1);
    expect(clusters[0].id).toBe(msg.id);
  });
});

// ---------------------------------------------------------------------------
// Spatial clustering (groupBySender = false)
// ---------------------------------------------------------------------------

describe('spatial clustering — groupBySender: false (Explorer mode)', () => {
  it('merges two close messages from the SAME sender', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng);
    const b = makeMsg(PARIS_NEAR.lat, PARIS_NEAR.lng);
    const clusters = clusterMessages([a, b], CLUSTER_RADIUS_M, false);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].messages).toHaveLength(2);
  });

  it('merges two close messages from DIFFERENT senders', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng, 'sender-1');
    const b = makeMsg(PARIS_NEAR.lat, PARIS_NEAR.lng, 'sender-2');
    const clusters = clusterMessages([a, b], CLUSTER_RADIUS_M, false);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].messages).toHaveLength(2);
  });

  it('keeps far-apart messages in separate clusters', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng);
    const b = makeMsg(SENLIS.lat, SENLIS.lng);
    const clusters = clusterMessages([a, b], CLUSTER_RADIUS_M, false);
    expect(clusters).toHaveLength(2);
  });

  it('uses the seed message id as cluster id', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng);
    const b = makeMsg(PARIS_NEAR.lat, PARIS_NEAR.lng);
    const clusters = clusterMessages([a, b], CLUSTER_RADIUS_M, false);
    expect(clusters[0].id).toBe(a.id);
  });

  it('uses the seed message avatar as cluster avatar', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng, 'sender-1', 'https://example.com/avatar-a.jpg');
    const b = makeMsg(PARIS_NEAR.lat, PARIS_NEAR.lng, 'sender-2', 'https://example.com/avatar-b.jpg');
    const clusters = clusterMessages([a, b], CLUSTER_RADIUS_M, false);
    expect(clusters[0].senderAvatarUrl).toBe('https://example.com/avatar-a.jpg');
  });

  it('marks cluster as public if any message is public', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng);
    const b = makeMsg(PARIS_NEAR.lat, PARIS_NEAR.lng);
    (b as any).is_public = true;
    const clusters = clusterMessages([a, b], CLUSTER_RADIUS_M, false);
    expect(clusters[0].isPublic).toBe(true);
  });

  it('does not merge messages just outside the radius', () => {
    // PARIS_FAR is ~500 m away, default radius is 50 m
    const a = makeMsg(PARIS.lat, PARIS.lng);
    const b = makeMsg(PARIS_FAR.lat, PARIS_FAR.lng);
    const clusters = clusterMessages([a, b], CLUSTER_RADIUS_M, false);
    expect(clusters).toHaveLength(2);
  });

  it('merges messages just inside a custom radius', () => {
    // PARIS_FAR is ~500 m away — use 1 000 m radius
    const a = makeMsg(PARIS.lat, PARIS.lng);
    const b = makeMsg(PARIS_FAR.lat, PARIS_FAR.lng);
    const clusters = clusterMessages([a, b], 1_000, false);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].messages).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Zoom-aware radius
// ---------------------------------------------------------------------------

describe('zoom-aware radius', () => {
  it('keeps two ~500 m apart messages separate at small radius', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng);
    const b = makeMsg(PARIS_FAR.lat, PARIS_FAR.lng);
    expect(clusterMessages([a, b], 100)).toHaveLength(2);
  });

  it('merges two ~500 m apart messages at larger radius (zoomed out)', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng);
    const b = makeMsg(PARIS_FAR.lat, PARIS_FAR.lng);
    expect(clusterMessages([a, b], 1_000)).toHaveLength(1);
  });

  it('keeps distant cities separate even at large radius', () => {
    const paris  = makeMsg(PARIS.lat, PARIS.lng);
    const senlis = makeMsg(SENLIS.lat, SENLIS.lng);
    // 15 000 m radius — Senlis is ~50 km away
    expect(clusterMessages([paris, senlis], 15_000)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// groupBySender: true  (Mes Flaags mode)
// ---------------------------------------------------------------------------

describe('groupBySender: true (Mes Flaags mode)', () => {
  it('does NOT merge close messages from different senders', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng, 'sender-1');
    const b = makeMsg(PARIS_NEAR.lat, PARIS_NEAR.lng, 'sender-2');
    const clusters = clusterMessages([a, b], CLUSTER_RADIUS_M, true);
    expect(clusters).toHaveLength(2);
  });

  it('DOES merge close messages from the same sender', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng, 'sender-1');
    const b = makeMsg(PARIS_NEAR.lat, PARIS_NEAR.lng, 'sender-1');
    const clusters = clusterMessages([a, b], CLUSTER_RADIUS_M, true);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].messages).toHaveLength(2);
  });

  it('produces separate clusters for each sender even when overlapping', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng, 'sender-1');
    const b = makeMsg(PARIS.lat, PARIS.lng, 'sender-2'); // exact same location
    const clusters = clusterMessages([a, b], CLUSTER_RADIUS_M, true);
    expect(clusters).toHaveLength(2);
    const senderIds = clusters.map(c => c.senderId).sort();
    expect(senderIds).toEqual(['sender-1', 'sender-2']);
  });

  it('merges 3 messages from same sender when all within radius', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng, 'sender-1');
    const b = makeMsg(PARIS_NEAR.lat, PARIS_NEAR.lng, 'sender-1');
    const c = makeMsg(PARIS.lat + 0.0002, PARIS.lng, 'sender-1'); // ~22 m
    const clusters = clusterMessages([a, b, c], CLUSTER_RADIUS_M, true);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].messages).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Cluster location
// ---------------------------------------------------------------------------

describe('cluster location', () => {
  it('uses the seed message location as cluster location', () => {
    const a = makeMsg(PARIS.lat, PARIS.lng);
    const b = makeMsg(PARIS_NEAR.lat, PARIS_NEAR.lng);
    const clusters = clusterMessages([a, b]);
    expect(clusters[0].location).toEqual({ latitude: PARIS.lat, longitude: PARIS.lng });
  });
});

// ---------------------------------------------------------------------------
// isAdminPlaced — admin flag placement feature
// ---------------------------------------------------------------------------

function makeAdminMsg(
  lat: number,
  lng: number,
  senderId = 'admin-1',
): UndiscoveredMessageMapMeta {
  return {
    id: `msg-${++idCounter}`,
    location: { latitude: lat, longitude: lng },
    created_at: new Date().toISOString(),
    is_public: false,
    sender: {
      id: senderId,
      display_name: 'Admin',
      avatar_url: 'https://example.com/admin.jpg',
      is_admin: true,
    },
  } as unknown as UndiscoveredMessageMapMeta;
}

describe('isAdminPlaced', () => {
  it('is false for a regular (non-admin) sender', () => {
    const msg = makeMsg(PARIS.lat, PARIS.lng);
    const clusters = clusterMessages([msg]);
    expect(clusters[0].isAdminPlaced).toBe(false);
  });

  it('is true when the seed sender is admin', () => {
    const msg = makeAdminMsg(PARIS.lat, PARIS.lng);
    const clusters = clusterMessages([msg]);
    expect(clusters[0].isAdminPlaced).toBe(true);
  });

  it('is true when the seed is admin even if merged messages are not', () => {
    const admin = makeAdminMsg(PARIS.lat, PARIS.lng, 'admin-1');
    const regular = makeMsg(PARIS_NEAR.lat, PARIS_NEAR.lng, 'user-1');
    // admin is processed first → becomes the seed
    const clusters = clusterMessages([admin, regular], CLUSTER_RADIUS_M, false);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].isAdminPlaced).toBe(true);
  });

  it('is false when the seed is non-admin even if merged messages are admin', () => {
    const regular = makeMsg(PARIS.lat, PARIS.lng, 'user-1');
    const admin = makeAdminMsg(PARIS_NEAR.lat, PARIS_NEAR.lng, 'admin-1');
    // regular is processed first → becomes the seed
    const clusters = clusterMessages([regular, admin], CLUSTER_RADIUS_M, false);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].isAdminPlaced).toBe(false);
  });

  it('produces two clusters with distinct isAdminPlaced values for far-apart admin/non-admin messages', () => {
    const admin = makeAdminMsg(PARIS.lat, PARIS.lng, 'admin-1');
    const regular = makeMsg(SENLIS.lat, SENLIS.lng, 'user-1');
    const clusters = clusterMessages([admin, regular], CLUSTER_RADIUS_M, false);
    expect(clusters).toHaveLength(2);
    const adminCluster = clusters.find(c => c.isAdminPlaced);
    const regularCluster = clusters.find(c => !c.isAdminPlaced);
    expect(adminCluster).toBeDefined();
    expect(regularCluster).toBeDefined();
  });

  it('is false when sender has is_admin: false explicitly', () => {
    const msg = makeMsg(PARIS.lat, PARIS.lng);
    (msg as any).sender.is_admin = false;
    const clusters = clusterMessages([msg]);
    expect(clusters[0].isAdminPlaced).toBe(false);
  });

  it('is false when sender.is_admin is undefined (legacy data)', () => {
    const msg = makeMsg(PARIS.lat, PARIS.lng);
    (msg as any).sender.is_admin = undefined;
    const clusters = clusterMessages([msg]);
    expect(clusters[0].isAdminPlaced).toBe(false);
  });
});
