import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import { UndiscoveredMessageMapMeta, Coordinates, MainTabParamList, RootStackParamList } from '@/types';
import { colors, shadows, radius, spacing } from '@/theme-redesign';
import Toast from '@/components/Toast';
import SelectedMessageCard from '@/components/map/SelectedMessageCard';
import MessageMarker from '@/components/map/MessageMarker';
import ScreenLoader from '@/components/ScreenLoader';
import { useMapMessages } from '@/hooks/useMapMessages';
import { useMapMarkers } from '@/hooks/useMapMarkers';
import { log } from '@/utils/debug';

type MapNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Map'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type Props = Omit<BottomTabScreenProps<MainTabParamList, 'Map'>, 'navigation'> & {
  navigation: MapNavigationProp;
};

const LAT_DELTA = 0.009;
const LNG_DELTA = 0.009;

const FAB_GRADIENT_COLORS = ['#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6'] as const;
const GRADIENT_START = { x: 0, y: 0 } as const;
const FAB_GRADIENT_END = { x: 1, y: 1 } as const;
const PERMISSION_GRADIENT_END = { x: 1, y: 0 } as const;
const MARKER_ANCHOR = { x: 0.3, y: 1 } as const;

const parseWKBHex = (wkbHex: string): Coordinates | null => {
  try {
    if (wkbHex.length < 42) return null;
    const isLittleEndian = wkbHex.substring(0, 2) === '01';
    const typeHex = wkbHex.substring(2, 10);
    let coordStart = 10;
    if (typeHex === '01000020' || typeHex === '20000001') coordStart = 18;
    const lngHex = wkbHex.substring(coordStart, coordStart + 16);
    const latHex = wkbHex.substring(coordStart + 16, coordStart + 32);
    const hexToDouble = (hex: string, littleEndian: boolean): number => {
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substring(i, i + 2), 16));
      if (littleEndian) bytes.reverse();
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      bytes.forEach((b, i) => view.setUint8(i, b));
      return view.getFloat64(0, false);
    };
    const lng = hexToDouble(lngHex, isLittleEndian);
    const lat = hexToDouble(latHex, isLittleEndian);
    if (!isNaN(lng) && !isNaN(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { longitude: lng, latitude: lat };
  } catch (e) {
    log('MapScreen', 'WKB parse error:', e);
  }
  return null;
};

const getMessageLocation = (message: UndiscoveredMessageMapMeta): Coordinates | null => {
  if (!message.location) return null;
  if (typeof message.location === 'object') {
    const loc = message.location as unknown as Record<string, unknown>;
    if (loc.type === 'Point' && Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      const [lng, lat] = loc.coordinates as number[];
      if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) return { longitude: lng, latitude: lat };
    }
    if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number' && !isNaN(loc.latitude as number) && !isNaN(loc.longitude as number)) {
      return { longitude: loc.longitude as number, latitude: loc.latitude as number };
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
      if (!isNaN(lng) && !isNaN(lat)) return { longitude: lng, latitude: lat };
    }
  }
  return null;
};

export default function MapScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { current: userLocation, loading: locationLoading, refreshLocation, requestPermission, permission } = useLocation();
  const mapRef = useRef<MapView>(null);

  const { messages, loading, loadMessages } = useMapMessages();
  const { avatarImages, avatarRefs, captureAvatar, canReadMessage, formatDistance } = useMapMarkers(userLocation, messages);

  const [selectedMessage, setSelectedMessage] = useState<UndiscoveredMessageMapMeta | null>(null);
  const [centerLocation, setCenterLocation] = useState<Coordinates | null>(null);
  const [centeredMessageId, setCenteredMessageId] = useState<string | null>(null);
  const [focusLocation, setFocusLocation] = useState<unknown>(null);
  const [focusMarkerCoords, setFocusMarkerCoords] = useState<Coordinates | null>(null);
  const [toastData, setToastData] = useState<{ visible: boolean; message: string; type: 'success' | 'warning' | 'error' }>({ visible: false, message: '', type: 'success' });
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }> | null>(null);
  const [routeTargetId, setRouteTargetId] = useState<string | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const [cardSlideAnim] = useState(new Animated.Value(200));
  const [cardOpacityAnim] = useState(new Animated.Value(0));

  const selectedMsgLocation = useMemo(
    () => (selectedMessage ? getMessageLocation(selectedMessage) : null),
    [selectedMessage],
  );

  useEffect(() => {
    if (permission !== 'granted') {
      requestPermission();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      log('MapScreen', 'useFocusEffect fired, user =', user?.id);
      if (user) {
        loadMessages();
      }
    }, [])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = navigation.getState()?.routes?.find((r: { name: string }) => r.name === 'Map')?.params ?? route?.params;
      log('MapScreen', 'focus params:', JSON.stringify(params));

      if (params?.toast) {
        setToastData({ visible: true, message: params.toast.message, type: params.toast.type });
        navigation.setParams({ toast: undefined });
      }

      if (params?.messageId) {
        setCenteredMessageId(params.messageId);
        setFocusLocation(null);
        navigation.setParams({ messageId: undefined });
      } else if (params?.focusLocation) {
        setFocusLocation(params.focusLocation);
        setCenteredMessageId(null);
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

  useEffect(() => {
    const params = route?.params;
    if (params?.focusLocation) {
      setFocusLocation(params.focusLocation);
      setCenteredMessageId(null);
    } else if (params?.messageId) {
      setCenteredMessageId(params.messageId);
      setFocusLocation(null);
    }
  }, [route?.params]);

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

  useEffect(() => {
    if (selectedMessage) {
      Animated.parallel([
        Animated.spring(cardSlideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
        Animated.timing(cardOpacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      cardSlideAnim.setValue(200);
      cardOpacityAnim.setValue(0);
    }
  }, [selectedMessage]);

  useEffect(() => {
    if (!centeredMessageId || !mapRef.current || messages.length === 0) return;
    const targetMessage = messages.find((m) => m.id === centeredMessageId);
    if (!targetMessage) return;
    const location = getMessageLocation(targetMessage);
    if (!location) return;
    setCenterLocation(location);
    setSelectedMessage(targetMessage);
    mapRef.current.animateToRegion({ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
  }, [centeredMessageId, messages, userLocation]);

  useEffect(() => {
    if (!focusLocation || !mapRef.current) return;
    const coords = getMessageLocation({ location: focusLocation } as UndiscoveredMessageMapMeta);
    if (!coords) return;
    setFocusMarkerCoords(coords);
    mapRef.current.animateToRegion({ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
  }, [focusLocation, userLocation]);

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

  const centerOnUser = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({ latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: LAT_DELTA, longitudeDelta: LNG_DELTA }, 300);
    }
  }, [userLocation]);

  const hideToast = useCallback(() => setToastData((prev) => ({ ...prev, visible: false })), []);

  const clearRoute = useCallback(() => {
    setRouteCoordinates(null);
    setRouteTargetId(null);
  }, []);

  const navigateToCreate = useCallback(() => navigation.navigate('CreateMessage'), [navigation]);

  const handleRead = useCallback(() => {
    if (selectedMessage) navigation.navigate('ReadMessage', { messageId: selectedMessage.id });
  }, [selectedMessage, navigation]);

  const handleCloseCard = useCallback(() => {
    setSelectedMessage(null);
    setRouteCoordinates(null);
  }, []);

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
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }));
        setRouteCoordinates(coords);
        setRouteTargetId(messageId);
        setSelectedMessage(null);
      } else {
        setToastData({ visible: true, message: 'Impossible de calculer l\'itinéraire', type: 'error' });
      }
    } catch (e: unknown) {
      const msg = (e as { name?: string })?.name === 'AbortError'
        ? 'Délai dépassé, réessaie plus tard'
        : 'Erreur de connexion pour l\'itinéraire';
      setToastData({ visible: true, message: msg, type: 'error' });
    } finally {
      clearTimeout(timeout);
      setIsLoadingRoute(false);
    }
  }, [userLocation]);

  const handleNavigateToMessage = useCallback(() => {
    if (selectedMessage && selectedMsgLocation) {
      fetchRoute(selectedMsgLocation, selectedMessage.id);
    }
  }, [selectedMessage, selectedMsgLocation, fetchRoute]);

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

  const handleMarkerPress = useCallback((message: UndiscoveredMessageMapMeta) => {
    setSelectedMessage(message);
    const location = getMessageLocation(message);
    if (location && !canReadMessage(location)) {
      fetchRoute(location, message.id);
    }
  }, [canReadMessage, fetchRoute]);

  if (locationLoading || !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ScreenLoader message={permission !== 'granted' ? 'Autorisation de localisation requise...' : 'Localisation en cours...'} />
        {permission !== 'granted' && (
          <TouchableOpacity style={styles.permissionButtonContainer} onPress={requestPermission} activeOpacity={0.9}>
            <LinearGradient
              colors={colors.gradients.primary}
              start={GRADIENT_START}
              end={PERMISSION_GRADIENT_END}
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
        onHide={hideToast}
      />

      <View style={[styles.insetSpacer, { height: insets.top }]} />

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: LAT_DELTA, longitudeDelta: LNG_DELTA } : undefined}
        showsUserLocation
        showsMyLocationButton={false}
        scrollEnabled
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}
      >
        {messages.filter((msg) => msg.sender?.id !== user?.id).map((message) => {
          const location = getMessageLocation(message);
          if (!location) return null;
          const capturedImage = avatarImages[message.id];
          if (!message.sender?.avatar_url || !capturedImage) return null;
          return (
            <MessageMarker
              key={message.id}
              message={message}
              location={location}
              avatarUri={capturedImage}
              isTarget={message.id === routeTargetId}
              hasActiveRoute={!!routeCoordinates}
              onPress={handleMarkerPress}
            />
          );
        })}

        {routeCoordinates && (
          <>
            <Polyline coordinates={routeCoordinates} strokeColor="rgba(255,255,255,0.9)" strokeWidth={10} />
            <Polyline coordinates={routeCoordinates} strokeColor={colors.primary.cyan} strokeWidth={5} />
          </>
        )}

      </MapView>

      <View style={[styles.floatingButtonsContainer, { top: insets.top + 16 }]}>
        <TouchableOpacity onPress={centerOnUser} activeOpacity={0.9} style={styles.floatingButton}>
          <Ionicons name="locate" size={22} color={colors.primary.cyan} />
        </TouchableOpacity>

        {routeCoordinates && (
          <>
            <TouchableOpacity onPress={openInMaps} activeOpacity={0.9} style={[styles.floatingButton, styles.floatingButtonMaps]}>
              <Ionicons name="walk-outline" size={22} color={colors.primary.cyan} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={clearRoute}
              activeOpacity={0.9}
              style={[styles.floatingButton, styles.floatingButtonDanger]}
            >
              <Ionicons name="close" size={22} color="#FF6B6B" />
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={[styles.createFABGlowContainer, { bottom: 24 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.createFABContainer}
          onPress={navigateToCreate}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={FAB_GRADIENT_COLORS}
            start={GRADIENT_START}
            end={FAB_GRADIENT_END}
            style={styles.createFAB}
          >
            <View style={styles.createFABInner}>
              <FontAwesome name="paper-plane" size={32} color="#FFFFFF" style={styles.fabIcon} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {selectedMessage && (
        <SelectedMessageCard
          message={selectedMessage}
          isReadable={canReadMessage(selectedMsgLocation)}
          isLoadingRoute={isLoadingRoute}
          distance={formatDistance(selectedMsgLocation)}
          cardSlideAnim={cardSlideAnim}
          cardOpacityAnim={cardOpacityAnim}
          bottomOffset={24 + insets.bottom}
          onRead={handleRead}
          onNavigate={handleNavigateToMessage}
          onClose={handleCloseCard}
        />
      )}

      <View style={styles.captureContainer} pointerEvents="none">
        {messages.filter((msg) => msg.sender?.id !== user?.id).map((message) => {
          const sender = message.sender;
          if (!sender?.avatar_url || avatarImages[message.id]) return null;
          const isPublic = message.is_public === true;
          return (
            <View
              key={message.id}
              ref={(ref) => { avatarRefs.current[message.id] = ref; }}
              collapsable={false}
              style={[styles.captureAvatar, isPublic && styles.captureAvatarPublic]}
            >
              <Image
                source={{ uri: sender.avatar_url }}
                style={styles.captureAvatarImage}
                onLoad={() => { setTimeout(() => captureAvatar(message.id), 100); }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
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
    fontSize: 16,
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
  createFABContainer: { borderRadius: radius.full },
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
  insetSpacer: {
    backgroundColor: 'transparent',
  },
  fabIcon: {
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
