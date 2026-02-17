/**
 * MapScreen - Redesigned with Neo-Cartographic theme
 *
 * Major improvements:
 * - Glass floating action buttons
 * - Gradient FAB with glow
 * - Premium message card with glass effect
 * - Better marker visuals
 * - Smooth animations
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Image,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUndiscoveredMessagesForMap, getCachedMapMessages, fetchFollowingPublicMessages } from '@/services/messages';
import { isWithinRadius, calculateDistance } from '@/services/location';
import { UndiscoveredMessageMapMeta, Coordinates } from '@/types';
import { colors, shadows, radius, spacing, typography } from '@/theme-redesign';
import Toast from '@/components/Toast';
import GlassCard from '@/components/redesign/GlassCard';
import PremiumAvatar from '@/components/redesign/PremiumAvatar';

interface Props {
  navigation: any;
  route: any;
}

// 500m radius = ~0.009 latitudeDelta (1km visible area)
const VISIBLE_RADIUS_METERS = 500;
const LAT_DELTA = 0.009;
const LNG_DELTA = 0.009;

export default function MapScreenRedesign({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { current: userLocation, loading: locationLoading, refreshLocation, requestPermission, permission } = useLocation();
  const mapRef = useRef<MapView>(null);
  const [messages, setMessages] = useState<UndiscoveredMessageMapMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<UndiscoveredMessageMapMeta | null>(null);
  const [centerLocation, setCenterLocation] = useState<Coordinates | null>(null);
  const [centeredMessageId, setCenteredMessageId] = useState<string | null>(null);
  const [focusLocation, setFocusLocation] = useState<any>(null);
  const [focusMarkerCoords, setFocusMarkerCoords] = useState<Coordinates | null>(null);
  const [markersReady, setMarkersReady] = useState(false);
  const [avatarImages, setAvatarImages] = useState<Record<string, string>>({});
  const [toastData, setToastData] = useState<{ visible: boolean; message: string; type: 'success' | 'warning' | 'error' }>({ visible: false, message: '', type: 'success' });
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }> | null>(null);
  const [routeTargetId, setRouteTargetId] = useState<string | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const avatarRefs = useRef<Record<string, View | null>>({});

  // Animation for message card
  const [cardSlideAnim] = useState(new Animated.Value(200));
  const [cardOpacityAnim] = useState(new Animated.Value(0));

  // Request location permission on mount
  useEffect(() => {
    if (permission !== 'granted') {
      requestPermission();
    }
  }, []);


  // Load messages whenever the map screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('[MapScreen] useFocusEffect fired, user =', user?.id);
      if (user) {
        loadMessages();
      }
    }, [])
  );

  // Remember which message we should center on when coming from another screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = navigation.getState()?.routes?.find((r: any) => r.name === 'Map')?.params ?? route?.params;
      console.log('DEBUG Map focus params:', JSON.stringify(params));

      if (params?.toast) {
        setToastData({ visible: true, message: params.toast.message, type: params.toast.type });
        navigation.setParams({ toast: undefined });
      }

      if (params && params.messageId) {
        setCenteredMessageId(params.messageId);
        setFocusLocation(null);
        // Clean up the param after using it
        navigation.setParams({ messageId: undefined });
      } else if (params && params.focusLocation) {
        setFocusLocation(params.focusLocation);
        setCenteredMessageId(null);
        // Clean up the param after using it
        navigation.setParams({ focusLocation: undefined });
      } else {
        setCenterLocation(null);
        setCenteredMessageId(null);
        setFocusLocation(null);
        setFocusMarkerCoords(null);
        setSelectedMessage(null);
      }
    });

    return unsubscribe;
  }, [navigation, route]);

  // Also handle route params changes directly
  useEffect(() => {
    const params = route?.params;
    console.log('DEBUG Map route.params changed:', JSON.stringify(params));
    if (params && params.focusLocation) {
      setFocusLocation(params.focusLocation);
      setCenteredMessageId(null);
    } else if (params && params.messageId) {
      setCenteredMessageId(params.messageId);
      setFocusLocation(null);
    }
  }, [route?.params]);


  // Center on user when location changes
  useEffect(() => {
    if (userLocation && mapRef.current && !centeredMessageId && !focusLocation) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: LAT_DELTA,
        longitudeDelta: LNG_DELTA,
      }, 500);
    }
  }, [userLocation, centeredMessageId, focusLocation]);

  // Animate message card entrance
  useEffect(() => {
    if (selectedMessage) {
      Animated.parallel([
        Animated.spring(cardSlideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      cardSlideAnim.setValue(200);
      cardOpacityAnim.setValue(0);
    }
  }, [selectedMessage]);

  // When messages are loaded and we have a centeredMessageId
  useEffect(() => {
    if (!centeredMessageId || !mapRef.current || messages.length === 0) return;

    const targetMessage = messages.find((m) => m.id === centeredMessageId);
    if (!targetMessage) return;

    const location = getMessageLocation(targetMessage);
    if (!location) return;

    setCenterLocation(location);
    setSelectedMessage(targetMessage);

    mapRef.current.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500
    );
  }, [centeredMessageId, messages, userLocation]);

  // Handle focusLocation from conversation screen
  useEffect(() => {
    if (!focusLocation || !mapRef.current) return;

    const coords = getMessageLocation({ location: focusLocation } as any);
    if (!coords) return;

    setFocusMarkerCoords(coords);

    mapRef.current.animateToRegion(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500
    );
  }, [focusLocation, userLocation]);

  const loadMessages = async () => {
    console.log('[MapScreen] loadMessages: START');

    if (messages.length === 0) {
      const cached = await getCachedMapMessages();
      if (cached && cached.length > 0) {
        console.log('[MapScreen] showing', cached.length, 'cached messages');
        setMessages(cached);
        setLoading(false);
        setTimeout(() => setMarkersReady(true), 500);
      }
    }

    setMarkersReady(false);
    const [data, followingData] = await Promise.all([
      fetchUndiscoveredMessagesForMap(),
      fetchFollowingPublicMessages(),
    ]);

    const mergedMap = new Map<string, UndiscoveredMessageMapMeta>();
    for (const msg of data) mergedMap.set(msg.id, msg);
    for (const msg of followingData) {
      if (!mergedMap.has(msg.id)) mergedMap.set(msg.id, msg);
    }
    const allMessages = Array.from(mergedMap.values());

    console.log('[MapScreen] loadMessages: got', data.length, 'undiscovered +', followingData.length, 'following =', allMessages.length, 'total');
    setMessages(allMessages);
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
    const location = getMessageLocation(message);
    if (location && !canReadMessage(location)) {
      fetchRoute(location, message.id);
    }
  }, [canReadMessage, fetchRoute]);

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
    return isWithinRadius(userLocation, messageLocation, 100);
  }, [userLocation]);

  const formatDistance = useCallback((messageLocation: Coordinates | null): string | null => {
    if (!userLocation || !messageLocation) return null;
    const distance = calculateDistance(userLocation, messageLocation);
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  }, [userLocation]);

  const fetchRoute = useCallback(async (destination: Coordinates, messageId: string) => {
    if (!userLocation) return;
    setIsLoadingRoute(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const url = `https://router.project-osrm.org/route/v1/walking/${userLocation.longitude},${userLocation.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lng,
        }));
        setRouteCoordinates(coords);
        setRouteTargetId(messageId);
        setSelectedMessage(null);
      } else {
        setToastData({ visible: true, message: 'Impossible de calculer l\'itinéraire', type: 'error' });
      }
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'Délai dépassé, réessaie plus tard'
        : 'Erreur de connexion pour l\'itinéraire';
      setToastData({ visible: true, message: msg, type: 'error' });
    } finally {
      clearTimeout(timeout);
      setIsLoadingRoute(false);
    }
  }, [userLocation]);

  const openInMaps = useCallback(() => {
    if (!routeCoordinates || routeCoordinates.length === 0) return;
    const dest = routeCoordinates[routeCoordinates.length - 1];
    const { latitude, longitude } = dest;
    const url = Platform.OS === 'ios'
      ? `maps://?daddr=${latitude},${longitude}&dirflg=w`
      : `google.navigation:q=${latitude},${longitude}&mode=w`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/maps?daddr=${latitude},${longitude}`);
    });
  }, [routeCoordinates]);

  // Fit map to route AFTER re-render (so minZoomLevel is already removed)
  useEffect(() => {
    if (!routeCoordinates || !mapRef.current) return;
    const timeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 120, right: 60, bottom: 280, left: 60 },
        animated: true,
      });
    }, 100);
    return () => clearTimeout(timeout);
  }, [routeCoordinates]);

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

  const parseWKBHex = (wkbHex: string): Coordinates | null => {
    try {
      if (wkbHex.length < 42) return null;

      const isLittleEndian = wkbHex.substring(0, 2) === '01';
      const typeHex = wkbHex.substring(2, 10);

      let coordStart = 10;
      if (typeHex === '01000020' || typeHex === '20000001') {
        coordStart = 18;
      }

      const lngHex = wkbHex.substring(coordStart, coordStart + 16);
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

    if (typeof message.location === 'object') {
      const loc = message.location as any;

      if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
        const lng = loc.coordinates[0];
        const lat = loc.coordinates[1];
        if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
          return { longitude: lng, latitude: lat };
        }
      }

      if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number' &&
          !isNaN(loc.latitude) && !isNaN(loc.longitude)) {
        return { longitude: loc.longitude, latitude: loc.latitude };
      }
    }

    if (typeof message.location === 'string') {
      if (/^[0-9A-Fa-f]+$/.test(message.location) && message.location.length >= 42) {
        const coords = parseWKBHex(message.location);
        if (coords) return coords;
      }

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
        <ActivityIndicator size="large" color={colors.primary.cyan} />
        <Text style={styles.loadingText}>
          {permission !== 'granted'
            ? 'Autorisation de localisation requise...'
            : 'Localisation en cours...'}
        </Text>
        {permission !== 'granted' && (
          <TouchableOpacity
            style={styles.permissionButtonContainer}
            onPress={requestPermission}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={colors.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>Autoriser la localisation</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Toast
        visible={toastData.visible}
        message={toastData.message}
        type={toastData.type}
        onHide={() => setToastData((prev) => ({ ...prev, visible: false }))}
      />

      {/* Status bar spacer */}
      <View style={{ height: insets.top, backgroundColor: 'transparent' }} />

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
        scrollEnabled
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}
      >
        {messages.map((message) => {
          const location = getMessageLocation(message);
          if (!location) return null;
          const sender = message.sender;
          const capturedImage = avatarImages[message.id];
          const isTarget = message.id === routeTargetId;
          const markerOpacity = routeCoordinates && !isTarget ? 0.35 : 1;

          if (sender?.avatar_url) {
            if (!capturedImage) return null;
            return (
              <Marker
                key={message.id}
                coordinate={location}
                image={{ uri: capturedImage }}
                onPress={() => handleMarkerPress(message)}
                opacity={markerOpacity}
              />
            );
          }

          return null;
        })}
        {routeCoordinates && (
          <>
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="rgba(255,255,255,0.9)"
              strokeWidth={10}
            />
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={colors.primary.cyan}
              strokeWidth={5}
            />
          </>
        )}
        {focusMarkerCoords && (
          <Marker
            coordinate={focusMarkerCoords}
            anchor={{ x: 0.3, y: 1 }}
            tracksViewChanges={true}
          >
            <View style={styles.focusMarker}>
              <Ionicons name="flag" size={36} color={colors.primary.cyan} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Floating Action Buttons - Glass Style */}
      <View style={[styles.floatingButtonsContainer, { top: insets.top + 16 }]}>
        <TouchableOpacity onPress={centerOnUser} activeOpacity={0.9} style={styles.floatingButton}>
          <Ionicons name="locate" size={22} color={colors.primary.cyan} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('SearchUsers')}
          activeOpacity={0.9}
          style={styles.floatingButton}
        >
          <Ionicons name="search" size={22} color={colors.primary.cyan} />
        </TouchableOpacity>

        {routeCoordinates && (
          <>
            <TouchableOpacity
              onPress={openInMaps}
              activeOpacity={0.9}
              style={[styles.floatingButton, styles.floatingButtonMaps]}
            >
              <Ionicons name="walk-outline" size={22} color={colors.primary.cyan} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setRouteCoordinates(null); setRouteTargetId(null); }}
              activeOpacity={0.9}
              style={[styles.floatingButton, styles.floatingButtonDanger]}
            >
              <Ionicons name="close" size={22} color="#FF6B6B" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Create Message FAB - Gradient Style */}
      <View
        style={[
          styles.createFABGlowContainer,
          { bottom: 24 + insets.bottom },
        ]}
      >
        <TouchableOpacity
          style={styles.createFABContainer}
          onPress={() => navigation.navigate('CreateMessage')}
          activeOpacity={0.8}
        >
          {/* Main button with intense gradient */}
          <LinearGradient
            colors={[
              '#A78BFA',
              '#8B5CF6',
              '#7C3AED',
              '#6D28D9',
              '#5B21B6',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.createFAB}
          >
            <View style={styles.createFABInner}>
              <FontAwesome name="paper-plane" size={32} color="#FFFFFF" style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Selected Message Card - Premium Glass */}
      {selectedMessage && (() => {
        const msgLocation = getMessageLocation(selectedMessage);
        const distance = formatDistance(msgLocation);
        const canRead = canReadMessage(msgLocation);
        return (
          <Animated.View
            style={[
              styles.messageCardContainer,
              { bottom: 24 + insets.bottom },
              {
                opacity: cardOpacityAnim,
                transform: [{ translateY: cardSlideAnim }],
              },
            ]}
          >
            <GlassCard withBorder withGlow glowColor="cyan" style={styles.messageCard}>
              {/* Close button */}
              <TouchableOpacity
                style={styles.cardCloseButton}
                onPress={() => { setSelectedMessage(null); setRouteCoordinates(null); }}
              >
                <Ionicons name="close" size={18} color="#ffffff" />
              </TouchableOpacity>


              {/* Sender row */}
              <View style={styles.messageCardHeader}>
                <View style={styles.messageCardHeaderLeft}>
                  <PremiumAvatar
                    uri={selectedMessage.sender?.avatar_url}
                    name={selectedMessage.sender?.display_name}
                    size="small"
                    withRing
                    ringColor="gradient"
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                    <Text style={styles.senderName}>
                      {selectedMessage.sender?.display_name || 'Inconnu'}
                    </Text>
                    <Text style={styles.senderLabel}>
                      · {new Date(selectedMessage.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Button */}
              {canRead ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate('ReadMessage', { messageId: selectedMessage.id })}
                  activeOpacity={0.8}
                  style={styles.actionButton}
                >
                  <LinearGradient
                    colors={['rgba(124, 92, 252, 0.4)', 'rgba(167, 139, 250, 0.35)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.navButton, { borderColor: 'rgba(167, 139, 250, 0.5)' }]}
                  >
                    <Ionicons name="eye" size={16} color={colors.primary.violet} />
                    <Text style={styles.navButtonText}>Découvrir le message</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    if (!isLoadingRoute && msgLocation) {
                      fetchRoute(msgLocation, selectedMessage.id);
                    }
                  }}
                  activeOpacity={0.8}
                  style={styles.actionButton}
                  disabled={isLoadingRoute}
                >
                  <LinearGradient
                    colors={['rgba(0, 229, 255, 0.18)', 'rgba(124, 92, 252, 0.35)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.navButton}
                  >
                    {isLoadingRoute ? (
                      <ActivityIndicator size="small" color={colors.primary.cyan} />
                    ) : (
                      <>
                        <Ionicons name="navigate" size={16} color={colors.primary.cyan} />
                        <Text style={styles.navButtonText}>
                          Itinéraire
                          {distance ? ` · ${distance}` : ''}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </GlassCard>
          </Animated.View>
        );
      })()}

      {/* Hidden container for capturing circular avatars */}
      <View style={styles.captureContainer} pointerEvents="none">
        {messages.map((message) => {
          const sender = message.sender;
          if (!sender?.avatar_url || avatarImages[message.id]) return null;
          const isPublic = message.is_public === true;

          return (
            <View
              key={message.id}
              ref={(ref) => { avatarRefs.current[message.id] = ref; }}
              collapsable={false}
              style={[
                styles.captureAvatar,
                isPublic && styles.captureAvatarPublic,
              ]}
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
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  permissionButtonContainer: {
    marginTop: spacing.xxl,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  permissionButton: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  permissionButtonText: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    fontWeight: '700',
  },
  floatingButtonsContainer: {
    position: 'absolute',
    right: spacing.lg,
    gap: spacing.md,
  },
  floatingButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.glass,
    borderRadius: radius.lg,
    ...shadows.small,
  },
  floatingButtonDanger: {
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  floatingButtonMaps: {
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
  },
  createFABGlowContainer: {
    position: 'absolute',
    right: spacing.lg,
    shadowColor: '#C4B5FD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 20,
  },
  createFABContainer: {
    borderRadius: radius.full,
  },
  createFAB: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  createFABInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.full,
  },
  messageCardContainer: {
    position: 'absolute',
    left: spacing.lg,
    right: 96,
  },
  messageCard: {
  },
  cardCloseButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    marginRight: 32,
  },
  cardIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconMeta: {
    flex: 1,
  },
  cardIconTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  cardIconSub: {
    fontSize: typography.sizes.xs,
    color: colors.primary.cyan,
    fontWeight: '600',
  },
  cardSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.md,
  },
  messageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  messageCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  senderLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginBottom: 1,
  },
  senderName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.text.primary,
  },
  actionButton: {
    marginTop: spacing.xs,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    overflow: 'hidden',
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  focusMarker: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  captureAvatarPublic: {
    borderWidth: 3,
    borderColor: colors.primary.violet,
  },
  captureAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
});
