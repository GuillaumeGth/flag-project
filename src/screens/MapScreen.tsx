import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUndiscoveredMessagesForMap } from '@/services/messages';
import { isWithinRadius } from '@/services/location';
import { UndiscoveredMessageMapMeta, Coordinates } from '@/types';

interface Props {
  navigation: any;
  route: any;
}

// 500m radius = ~0.009 latitudeDelta (1km visible area)
const VISIBLE_RADIUS_METERS = 500;
const LAT_DELTA = 0.009;
const LNG_DELTA = 0.009;

export default function MapScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { current: userLocation, loading: locationLoading, refreshLocation, requestPermission, permission } = useLocation();  
  const mapRef = useRef<MapView>(null);
  const [messages, setMessages] = useState<UndiscoveredMessageMapMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<UndiscoveredMessageMapMeta | null>(null);
  const [centerLocation, setCenterLocation] = useState<Coordinates | null>(null);
  const [centeredMessageId, setCenteredMessageId] = useState<string | null>(null);
  const [focusLocation, setFocusLocation] = useState<any>(null);
  const [markersReady, setMarkersReady] = useState(false);
  const [avatarImages, setAvatarImages] = useState<Record<string, string>>({});
  const avatarRefs = useRef<Record<string, View | null>>({});
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request location permission on mount
  useEffect(() => {
    if (permission !== 'granted') {
      requestPermission();
    }
  }, []);

  // Load messages whenever the map screen is focused
  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [])
  );

  // Remember which message we should center on when coming from another screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = navigation.getState()?.routes?.find((r: any) => r.name === 'Map')?.params ?? route?.params;
      console.log('DEBUG Map focus params:', JSON.stringify(params));

      if (params && params.messageId) {
        setCenteredMessageId(params.messageId);
        setFocusLocation(null);
      } else if (params && params.focusLocation) {
        setFocusLocation(params.focusLocation);
        setCenteredMessageId(null);
      } else {
        if (focusTimeoutRef.current) {
          clearTimeout(focusTimeoutRef.current);
          focusTimeoutRef.current = null;
        }
        setCenterLocation(null);
        setCenteredMessageId(null);
        setFocusLocation(null);
        setSelectedMessage(null);
      }
    });

    return unsubscribe;
  }, [navigation, route]);

  // Clear any pending timeout on unmount
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, []);

  // Center on user when location changes (unless we are focusing a specific message or location)
  useEffect(() => {
    if (userLocation && mapRef.current && !centeredMessageId && !focusLocation) {
      console.log('DEBUG: User location:', userLocation.latitude, userLocation.longitude);
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: LAT_DELTA,
        longitudeDelta: LNG_DELTA,
      }, 500);
    }
  }, [userLocation, centeredMessageId, focusLocation]);

  // When messages are loaded and we have a centeredMessageId, center the map on that message,
  // then after a delay, return to the normal mode centered on the user
  useEffect(() => {
    if (!centeredMessageId || !mapRef.current || messages.length === 0) return;

    const targetMessage = messages.find((m) => m.id === centeredMessageId);
    if (!targetMessage) return;

    const location = getMessageLocation(targetMessage);
    if (!location) return;

    setCenterLocation(location);
    setSelectedMessage(targetMessage);
    
    // Clear any previous timeout before scheduling a new one
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }

    // First, slightly zoom out around the flag
    mapRef.current.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500
    );

    // After 5 seconds, go back to normal mode centered on the user
    if (userLocation) {
      focusTimeoutRef.current = setTimeout(() => {
        if (!mapRef.current || !userLocation) return;

        setCenteredMessageId(null);
        setCenterLocation(null);
        setSelectedMessage(null);

        mapRef.current.animateToRegion(
          {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: LAT_DELTA,
            longitudeDelta: LNG_DELTA,
          },
          500
        );
      }, 5000);
    }

    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, [centeredMessageId, messages, userLocation]);

  // Handle focusLocation from conversation screen
  useEffect(() => {
    console.log('DEBUG focusLocation:', focusLocation);
    if (!focusLocation || !mapRef.current) return;

    // Use the same parsing function as for undiscovered messages
    const coords = getMessageLocation({ location: focusLocation } as any);
    console.log('DEBUG parsed coords:', coords);
    if (!coords) return;

    // Clear any previous timeout
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }

    // Animate to the focus location
    mapRef.current.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500
    );

    // After 5 seconds, go back to user location
    if (userLocation) {
      focusTimeoutRef.current = setTimeout(() => {
        if (!mapRef.current || !userLocation) return;

        setFocusLocation(null);

        mapRef.current.animateToRegion(
          {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: LAT_DELTA,
            longitudeDelta: LNG_DELTA,
          },
          500
        );
      }, 5000);
    }

    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, [focusLocation, userLocation]);

  const loadMessages = async () => {
    setLoading(true);
    setMarkersReady(false);
    const data = await fetchUndiscoveredMessagesForMap();
    console.log('DEBUG: Loaded', data.length, 'messages:', JSON.stringify(data));
    setMessages(data);
    setLoading(false);
    setTimeout(() => setMarkersReady(true), 500);
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: LAT_DELTA,
        longitudeDelta: LNG_DELTA,
      }, 300);
    }
  };

  const handleMarkerPress = useCallback((message: UndiscoveredMessageMapMeta) => {
    setSelectedMessage(message);
  }, []);

  const getInitials = useCallback((name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }, []);

  const canReadMessage = useCallback((messageLocation: Coordinates | null): boolean => {
    if (!userLocation || !messageLocation) return false;
    return isWithinRadius(userLocation, messageLocation, 30);
  }, [userLocation]);

  const captureAvatar = useCallback(async (messageId: string) => {
    const ref = avatarRefs.current[messageId];
    if (!ref || avatarImages[messageId]) return;

    try {
      const uri = await captureRef(ref, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      setAvatarImages(prev => ({ ...prev, [messageId]: uri }));
    } catch (e) {
      console.log('Failed to capture avatar:', e);
    }
  }, [avatarImages]);

  // Parse WKB hex string to coordinates
  const parseWKBHex = (wkbHex: string): Coordinates | null => {
    try {
      // WKB Point with SRID format:
      // 01 (little endian) + 01000020 (Point with SRID) + E6100000 (SRID 4326) + 16 bytes coords
      // or without SRID: 01 + 01000000 (Point) + 16 bytes coords
      if (wkbHex.length < 42) return null; // Minimum for point without SRID

      const isLittleEndian = wkbHex.substring(0, 2) === '01';
      const typeHex = wkbHex.substring(2, 10);

      let coordStart = 10;
      // Check if SRID is present (0x20 flag in type)
      if (typeHex === '01000020' || typeHex === '20000001') {
        coordStart = 18; // Skip SRID (4 bytes = 8 hex chars)
      }

      // Parse longitude (8 bytes = 16 hex chars)
      const lngHex = wkbHex.substring(coordStart, coordStart + 16);
      // Parse latitude (8 bytes = 16 hex chars)
      const latHex = wkbHex.substring(coordStart + 16, coordStart + 32);

      const hexToDouble = (hex: string, littleEndian: boolean): number => {
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
          bytes.push(parseInt(hex.substring(i, i + 2), 16));
        }
        if (littleEndian) bytes.reverse();
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        bytes.forEach((b, i) => view.setUint8(i, b));
        return view.getFloat64(0, false);
      };

      const lng = hexToDouble(lngHex, isLittleEndian);
      const lat = hexToDouble(latHex, isLittleEndian);

      if (!isNaN(lng) && !isNaN(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { longitude: lng, latitude: lat };
      }
    } catch (e) {
      console.error('WKB parse error:', e);
    }
    return null;
  };

  const getMessageLocation = (message: UndiscoveredMessageMapMeta): Coordinates | null => {
    if (!message.location) return null;

    // Handle GeoJSON format from PostGIS (Supabase returns geography as GeoJSON)
    // Format: { type: "Point", coordinates: [longitude, latitude] }
    if (typeof message.location === 'object') {
      const loc = message.location as any;

      // GeoJSON Point format
      if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
        const lng = loc.coordinates[0];
        const lat = loc.coordinates[1];
        if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
          return { longitude: lng, latitude: lat };
        }
      }

      // Direct coordinates format { latitude, longitude }
      if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number' &&
          !isNaN(loc.latitude) && !isNaN(loc.longitude)) {
        return { longitude: loc.longitude, latitude: loc.latitude };
      }
    }

    if (typeof message.location === 'string') {
      // Handle WKB hex format (PostGIS internal format)
      // Starts with 01 (little endian) or 00 (big endian)
      if (/^[0-9A-Fa-f]+$/.test(message.location) && message.location.length >= 42) {
        const coords = parseWKBHex(message.location);
        if (coords) return coords;
      }

      // Handle WKT POINT string format (fallback)
      const match = message.location.match(/POINT\(([^ ]+) ([^)]+)\)/);
      if (match) {
        const lng = parseFloat(match[1]);
        const lat = parseFloat(match[2]);
        if (!isNaN(lng) && !isNaN(lat)) {
          return { longitude: lng, latitude: lat };
        }
      }
    }

    return null;
  };

  if (locationLoading || !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.loadingText}>
          {permission !== 'granted'
            ? 'Autorisation de localisation requise...'
            : 'Localisation en cours...'}
        </Text>
        {permission !== 'granted' && (
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Autoriser la localisation</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status bar spacer */}
      <View style={{ height: insets.top, backgroundColor: '#f5f5f5' }} />
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={
          userLocation
            ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: LAT_DELTA,
                longitudeDelta: LNG_DELTA,
              }
            : undefined
        }
        showsUserLocation
        showsMyLocationButton={false}
        minZoomLevel={16}
        maxZoomLevel={18}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}
      >
        {messages.map((message) => {
          const location = getMessageLocation(message);
          if (!location) return null;
          const sender = message.sender;
          const capturedImage = avatarImages[message.id];

          // Avatar with captured image
          if (sender?.avatar_url) {
            if (!capturedImage) return null; // Wait for capture
            return (
              <Marker
                key={message.id}
                coordinate={location}
                image={{ uri: capturedImage }}
                onPress={() => handleMarkerPress(message)}
              />
            );
          }

          // Initials marker (use children)
          return (
            <Marker
              key={message.id}
              coordinate={location}
              onPress={() => handleMarkerPress(message)}
              image={require('../assets/red-circle.png')}

            >
              <View style={styles.initialsMarker}>
                <Text style={styles.initialsText}>
                  {getInitials(sender?.display_name)}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Center on user button */}
      <TouchableOpacity style={[styles.centerButton, { top: insets.top + 16 }]} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#4A90D9" />
      </TouchableOpacity>

      {/* Refresh button */}
      <TouchableOpacity
        style={[styles.refreshButton, { top: insets.top + 76 }]}
        onPress={() => {
          refreshLocation();
          loadMessages();
        }}
      >
        <Ionicons name="refresh" size={24} color="#4A90D9" />
      </TouchableOpacity>

      {/* Create message button */}
      <TouchableOpacity
        style={[styles.createButton, { bottom: 24 }]}
        onPress={() => navigation.navigate('CreateMessage')}
      >
        <Ionicons name="paper-plane" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Selected message card */}
      {selectedMessage && (
        <View style={[styles.messageCard, { bottom: 24 }]}>
          <View style={styles.messageCardHeader}>
            <View style={styles.messageCardTitle}>
              {selectedMessage.sender?.avatar_url ? (
                <Image source={{ uri: selectedMessage.sender.avatar_url }} style={styles.cardAvatar} />
              ) : (
                <View style={styles.cardAvatarPlaceholder}>
                  <Text style={styles.cardAvatarInitials}>
                    {getInitials(selectedMessage.sender?.display_name)}
                  </Text>
                </View>
              )}
              <Text style={styles.senderName}>
                {selectedMessage.sender?.display_name || 'Inconnu'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedMessage(null)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {canReadMessage(getMessageLocation(selectedMessage)) ? (
            <TouchableOpacity
              style={styles.readButton}
              onPress={() => navigation.navigate('ReadMessage', { messageId: selectedMessage.id })}
            >
              <Text style={styles.readButtonText}>Découvrir le message</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.distanceText}>
              Rapprochez-vous pour découvrir ce message
            </Text>
          )}
        </View>
      )}

      {/* Hidden container for capturing circular avatars */}
      <View style={styles.captureContainer} pointerEvents="none">
        {messages.map((message) => {
          const sender = message.sender;
          if (!sender?.avatar_url || avatarImages[message.id]) return null;

          return (
            <View
              key={message.id}
              ref={(ref) => { avatarRefs.current[message.id] = ref; }}
              collapsable={false}
              style={styles.captureAvatar}
            >
              <Image
                source={{ uri: sender.avatar_url }}
                style={styles.captureAvatarImage}
                onLoad={() => {
                  setTimeout(() => captureAvatar(message.id), 100);
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  permissionButton: {
    marginTop: 24,
    backgroundColor: '#4A90D9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  refreshButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  createButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#4A90D9',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  messageCard: {
    position: 'absolute',
    left: 16,
    right: 92,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  messageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  messageCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  cardAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardAvatarInitials: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  readButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  readButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  distanceText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    width: 60,
    height: 70,
  },
  customMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerReadable: {
    backgroundColor: '#4A90D9',
  },
  markerUnreadable: {
    backgroundColor: '#999',
  },
  markerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 50,
  },
  markerInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',            
    
    
  },
  markerPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -4,
  },
  pointerReadable: {
    borderTopColor: '#4A90D9',
  },
  pointerUnreadable: {
    borderTopColor: '#999',
  },
  avatarMarkerContainer: {
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 27,
  },
  avatarMarkerClip: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  avatarMarkerImage: {
    width: 50,
    height: 50,
  },
  initialsMarker: {
    width: 42,
    height: 42,
    
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    
    
  },
  initialsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  captureContainer: {
    position: 'absolute',
    top: 50,
    left: 50,
    zIndex: 9999,
    opacity: 0.01,
  },
  captureAvatar: {
    width: 56,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  captureAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
});
