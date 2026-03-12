import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
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
import { UndiscoveredMessageMapMeta, OwnFlagMapMeta, Coordinates, MainTabParamList, RootStackParamList } from '@/types';
import { colors, shadows, radius, spacing, typography } from '@/theme-redesign';
import Toast from '@/components/Toast';
import SelectedMessageCard from '@/components/map/SelectedMessageCard';
import OwnFlagCard from '@/components/map/OwnFlagCard';
import MessageMarker from '@/components/map/MessageMarker';
import MapModePill, { MapMode } from '@/components/map/MapModePill';
import ClusterPickerModal from '@/components/map/ClusterPickerModal';
import ScreenLoader from '@/components/ScreenLoader';
import { useMapMessages } from '@/hooks/useMapMessages';
import { useMapMarkers } from '@/hooks/useMapMarkers';
import { useMyFlags } from '@/hooks/useMyFlags';
import { useClusteredMarkers, MessageCluster } from '@/hooks/useClusteredMarkers';
import { getMessageLocation, colorForUserId, initialsForName } from '@/utils/mapUtils';
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

// 1° latitude ≈ 111 000m → at LAT_DELTA=0.009 this gives 50m (the base cluster radius)
const LAT_DEG_TO_METERS = 111_000;
const CLUSTER_RATIO = 0.06; // fraction of visible height used as cluster radius
const MIN_CLUSTER_RADIUS = 20;
const MAX_CLUSTER_RADIUS = 15_000;

const GRADIENT_START = { x: 0, y: 0 } as const;
const FAB_GRADIENT_END = { x: 1, y: 1 } as const;
const PERMISSION_GRADIENT_END = { x: 1, y: 0 } as const;

// Golden gradient for admin-placed message markers
const ADMIN_GOLD_GRADIENT = ['#FFF9C4', '#FFD700', '#F5A623', '#FFD700'] as const;
// Golden gradient for the admin placement FAB
const ADMIN_FAB_GRADIENT_ACTIVE = ['#F5A623', '#FFD700', '#FFF0A0'] as const;
const ADMIN_FAB_GRADIENT_IDLE = ['#3D2B00', '#7A5700', '#4A3500'] as const;


export default function MapScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { current: userLocation, loading: locationLoading, refreshLocation, requestPermission, permission } = useLocation();
  const mapRef = useRef<MapView>(null);

  // --- Zoom-aware clustering ---
  const [latDelta, setLatDelta] = useState(LAT_DELTA);
  const clusterRadius = useMemo(
    () => Math.max(MIN_CLUSTER_RADIUS, Math.min(MAX_CLUSTER_RADIUS, latDelta * LAT_DEG_TO_METERS * CLUSTER_RATIO)),
    [latDelta],
  );

  // --- Explore mode ---
  const { messages, loading, loadMessages } = useMapMessages();
  const { avatarImages, avatarRefs, captureAvatar, canReadMessage, formatDistance } = useMapMarkers(userLocation, messages);


  const otherMessages = useMemo(
    () => messages.filter(msg => msg.sender?.id !== user?.id),
    [messages, user?.id],
  );
  const clusters = useClusteredMarkers(otherMessages, clusterRadius, false);

  // --- Mine mode ---
  const { flags: myFlags, loadFlags } = useMyFlags();
  const [mapMode, setMapMode] = useState<MapMode>('explore');

  // Convert own flags to the UndiscoveredMessageMapMeta shape so we can reuse useClusteredMarkers
  const myFlagsAsMapMeta = useMemo<UndiscoveredMessageMapMeta[]>(
    () => myFlags.map(flag => ({
      id: flag.id,
      location: flag.location,
      created_at: flag.created_at,
      is_public: flag.is_public,
      // For private flags, show the recipient's identity (id + name) so the marker
      // displays their initials/color. For public flags, show the sender's own identity.
      is_admin_placed: flag.is_admin_placed,
      sender: {
        id: (!flag.is_public && flag.recipient?.id) ? flag.recipient.id : user?.id ?? '',
        display_name: (!flag.is_public && flag.recipient?.display_name)
          ? flag.recipient.display_name
          : user?.display_name,
        avatar_url: (!flag.is_public && flag.recipient?.avatar_url)
          ? flag.recipient.avatar_url
          : user?.avatar_url,
        is_admin: flag.is_admin_placed, // drives golden border in capture container
      },
    })),
    [myFlags, user],
  );
  const ownClusters = useClusteredMarkers(myFlagsAsMapMeta, clusterRadius, true);

  const ownFlagLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const flag of myFlags) {
      map[flag.id] = flag.recipient?.display_name ?? (flag.is_public ? 'Public' : 'Flaag');
    }
    return map;
  }, [myFlags]);

  // Map flagId -> is_read to compute per-cluster open/closed state
  const ownFlagReadMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const flag of myFlags) {
      map[flag.id] = flag.is_read;
    }
    return map;
  }, [myFlags]);

  // --- Selection state ---
  const [selectedMessage, setSelectedMessage] = useState<UndiscoveredMessageMapMeta | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<MessageCluster | null>(null);
  const [selectedOwnFlag, setSelectedOwnFlag] = useState<OwnFlagMapMeta | null>(null);

  // --- Centering / focus state ---
  const [centerLocation, setCenterLocation] = useState<Coordinates | null>(null);
  const [centeredMessageId, setCenteredMessageId] = useState<string | null>(null);
  const [centeredOwnFlagId, setCenteredOwnFlagId] = useState<string | null>(null);
  const [focusLocation, setFocusLocation] = useState<unknown>(null);
  const [focusMarkerCoords, setFocusMarkerCoords] = useState<Coordinates | null>(null);

  // --- Tracking mode: map follows user position until they manually move the map ---
  const [isTracking, setIsTracking] = useState(true);
  const isProgrammaticMove = useRef(false);
  const programmaticMoveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const triggerProgrammaticMove = useCallback((fn: () => void) => {
    isProgrammaticMove.current = true;
    clearTimeout(programmaticMoveTimer.current);
    fn();
    programmaticMoveTimer.current = setTimeout(() => {
      isProgrammaticMove.current = false;
    }, 1500);
  }, []);

  // --- Admin placement mode (map-picker UX: pin fixed at center, map moves underneath) ---
  const [isAdminPlacementMode, setIsAdminPlacementMode] = useState(false);
  // Tracks the geographic center of the visible map region (updated by onRegionChangeComplete)
  const [mapCenterCoords, setMapCenterCoords] = useState<Coordinates | null>(null);

  // --- Toast & route ---
  const [toastData, setToastData] = useState<{ visible: boolean; message: string; type: 'success' | 'warning' | 'error' }>({ visible: false, message: '', type: 'success' });
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }> | null>(null);
  const [routeTargetId, setRouteTargetId] = useState<string | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // --- Animations ---
  const [cardSlideAnim] = useState(new Animated.Value(200));
  const [cardOpacityAnim] = useState(new Animated.Value(0));
  const [ownFlagSlideAnim] = useState(new Animated.Value(200));
  const [ownFlagOpacityAnim] = useState(new Animated.Value(0));

  // Radar ping animation for tracking button
  const pingAnim1 = useRef(new Animated.Value(0)).current;
  const pingAnim2 = useRef(new Animated.Value(0)).current;

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

  // Navigation params handler
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = navigation.getState()?.routes?.find((r: { name: string }) => r.name === 'Map')?.params ?? route?.params;
      log('MapScreen', 'focus params:', JSON.stringify(params));

      if (params?.toast) {
        setToastData({ visible: true, message: params.toast.message, type: params.toast.type });
        navigation.setParams({ toast: undefined });
      }

      if (params?.refresh) {
        navigation.setParams({ refresh: undefined });
        if (user) loadMessages();
      }

      // Switch to mine mode if requested
      if (params?.mine) {
        setMapMode('mine');
        setSelectedMessage(null);
        setRouteCoordinates(null);
        loadFlags();
        navigation.setParams({ mine: undefined });

        // If a specific own flag is targeted, center on it after loading
        if (params?.messageId) {
          setCenteredOwnFlagId(params.messageId);
          setCenteredMessageId(null);
          setFocusLocation(null);
          navigation.setParams({ messageId: undefined });
        }
      } else if (params?.messageId) {
        setCenteredMessageId(params.messageId);
        setCenteredOwnFlagId(null);
        setFocusLocation(null);
        navigation.setParams({ messageId: undefined });
      } else if (params?.focusLocation) {
        setFocusLocation(params.focusLocation);
        setCenteredMessageId(null);
        setCenteredOwnFlagId(null);
        navigation.setParams({ focusLocation: undefined });
      } else if (!params?.mine) {
        setCenterLocation(null);
        setCenteredMessageId(null);
        setCenteredOwnFlagId(null);
        setFocusLocation(null);
        setFocusMarkerCoords(null);
        setSelectedMessage(null);
        setSelectedOwnFlag(null);
      }
    });

    return unsubscribe;
  }, [navigation, route]);

  useEffect(() => {
    const params = route?.params;
    if (params?.focusLocation) {
      setFocusLocation(params.focusLocation);
      setCenteredMessageId(null);
    } else if (params?.messageId && !params?.mine) {
      setCenteredMessageId(params.messageId);
      setFocusLocation(null);
    }
  }, [route?.params]);

  // Center on user location — only when tracking is active
  useEffect(() => {
    if (isTracking && userLocation && mapRef.current && !centeredMessageId && !centeredOwnFlagId && !focusLocation) {
      triggerProgrammaticMove(() => {
        mapRef.current?.animateToRegion({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: LAT_DELTA,
          longitudeDelta: LNG_DELTA,
        }, 500);
      });
    }
  }, [isTracking, userLocation, centeredMessageId, centeredOwnFlagId, focusLocation, triggerProgrammaticMove]);

  // Animate explore card
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

  // Animate own flag card
  useEffect(() => {
    if (selectedOwnFlag) {
      Animated.parallel([
        Animated.spring(ownFlagSlideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
        Animated.timing(ownFlagOpacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      ownFlagSlideAnim.setValue(200);
      ownFlagOpacityAnim.setValue(0);
    }
  }, [selectedOwnFlag]);

  // Radar ping animation — two rings staggered, loop while tracking
  useEffect(() => {
    if (!isTracking) {
      pingAnim1.setValue(0);
      pingAnim2.setValue(0);
      return;
    }
    const ring1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pingAnim1, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(pingAnim1, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const ring2 = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(pingAnim2, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(pingAnim2, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    ring1.start();
    ring2.start();
    return () => {
      ring1.stop();
      ring2.stop();
    };
  }, [isTracking, pingAnim1, pingAnim2]);

  // Center on explore message
  useEffect(() => {
    if (!centeredMessageId || !mapRef.current || messages.length === 0) return;
    const targetMessage = messages.find((m) => m.id === centeredMessageId);
    if (!targetMessage) return;
    const location = getMessageLocation(targetMessage);
    if (!location) return;
    setCenterLocation(location);
    setSelectedMessage(targetMessage);
    triggerProgrammaticMove(() => {
      mapRef.current?.animateToRegion({ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
    });
  }, [centeredMessageId, messages, userLocation, triggerProgrammaticMove]);

  // Center on own flag
  useEffect(() => {
    if (!centeredOwnFlagId || !mapRef.current || myFlags.length === 0) return;
    const targetFlag = myFlags.find((f) => f.id === centeredOwnFlagId);
    if (!targetFlag) return;
    const location = getMessageLocation(targetFlag as unknown as UndiscoveredMessageMapMeta);
    if (!location) return;
    setSelectedOwnFlag(targetFlag);
    setCenteredOwnFlagId(null);
    triggerProgrammaticMove(() => {
      mapRef.current?.animateToRegion({ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
    });
  }, [centeredOwnFlagId, myFlags, triggerProgrammaticMove]);

  useEffect(() => {
    if (!focusLocation || !mapRef.current) return;
    const coords = getMessageLocation({ location: focusLocation } as UndiscoveredMessageMapMeta);
    if (!coords) return;
    setFocusMarkerCoords(coords);
    triggerProgrammaticMove(() => {
      mapRef.current?.animateToRegion({ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    });
  }, [focusLocation, userLocation, triggerProgrammaticMove]);

  useEffect(() => {
    if (!routeCoordinates || !mapRef.current) return;
    const timeout = setTimeout(() => {
      triggerProgrammaticMove(() => {
        mapRef.current?.fitToCoordinates(routeCoordinates, {
          edgePadding: { top: 120, right: 60, bottom: 280, left: 60 },
          animated: true,
        });
      });
    }, 100);
    return () => clearTimeout(timeout);
  }, [routeCoordinates, triggerProgrammaticMove]);

  const handleModeSwitch = useCallback((mode: MapMode) => {
    setMapMode(mode);
    setSelectedMessage(null);
    setSelectedOwnFlag(null);
    setRouteCoordinates(null);
    setRouteTargetId(null);
    if (mode === 'mine') {
      loadFlags();
    }
  }, [loadFlags]);

  const centerOnUser = useCallback(() => {
    if (userLocation && mapRef.current) {
      triggerProgrammaticMove(() => {
        mapRef.current?.animateToRegion({ latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: LAT_DELTA, longitudeDelta: LNG_DELTA }, 300);
      });
      setIsTracking(true);
    }
  }, [userLocation, triggerProgrammaticMove]);

  const hideToast = useCallback(() => setToastData((prev) => ({ ...prev, visible: false })), []);

  const clearRoute = useCallback(() => {
    setRouteCoordinates(null);
    setRouteTargetId(null);
  }, []);

  const navigateToCreate = useCallback(() => navigation.navigate('CreateMessage'), [navigation]);

  const toggleAdminPlacement = useCallback(() => {
    setIsAdminPlacementMode((prev) => !prev);
    setSelectedMessage(null);
    setSelectedOwnFlag(null);
  }, []);

  // Keep mapCenterCoords seeded with userLocation so admin send works without dragging
  useEffect(() => {
    if (userLocation) {
      setMapCenterCoords((prev) => prev ?? userLocation);
    }
  }, [userLocation]);

  // Main FAB in admin mode: navigate to CreateMessage with current map center
  const handleAdminSend = useCallback(() => {
    const coords = mapCenterCoords ?? userLocation;
    if (!coords) return;
    setIsAdminPlacementMode(false);
    navigation.navigate('CreateMessage', { adminLocation: coords });
  }, [mapCenterCoords, userLocation, navigation]);

  const handleRead = useCallback(() => {
    if (selectedMessage) navigation.navigate('ReadMessage', { messageId: selectedMessage.id });
  }, [selectedMessage, navigation]);

  const handleCloseCard = useCallback(() => {
    setSelectedMessage(null);
    setRouteCoordinates(null);
  }, []);

  const handleCloseOwnFlagCard = useCallback(() => {
    setSelectedOwnFlag(null);
  }, []);

  const handleViewOwnFlagConversation = useCallback(() => {
    if (!selectedOwnFlag?.recipient_id) return;
    const flagId = selectedOwnFlag.id;
    const recipientId = selectedOwnFlag.recipient_id;
    const recipientName = selectedOwnFlag.recipient?.display_name ?? '';
    setSelectedOwnFlag(null);
    navigation.navigate('Conversation', {
      otherUserId: recipientId,
      otherUserName: recipientName,
      scrollToMessageId: flagId,
    });
  }, [selectedOwnFlag, navigation]);

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
    if (mapMode === 'mine') {
      const ownFlag = myFlags.find(f => f.id === message.id);
      if (ownFlag) setSelectedOwnFlag(ownFlag);
    } else {
      setSelectedMessage(message);
    }
  }, [mapMode, myFlags]);

  const handleClusterPress = useCallback((cluster: MessageCluster) => {
    setSelectedCluster(cluster);
  }, []);

  if (locationLoading || !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ScreenLoader message={permission !== 'granted' ? 'Autorisation de localisation requise...' : 'Localisation en cours...'} />
        {permission !== 'granted' && (
          <TouchableOpacity style={styles.permissionButtonContainer} onPress={requestPermission} activeOpacity={0.9}>
            <LinearGradient
              colors={colors.gradients.button}
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

      {/* Pill mode toggle */}
      <MapModePill
        mode={mapMode}
        onChange={handleModeSwitch}
        style={{ top: insets.top + 12 }}
      />



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
        onRegionChangeComplete={(region) => {
          setLatDelta(region.latitudeDelta);
          setMapCenterCoords({ latitude: region.latitude, longitude: region.longitude });
          if (!isProgrammaticMove.current) {
            setIsTracking(false);
          }
        }}
      >
        {/* Explore mode markers */}
        {mapMode === 'explore' && clusters.map((cluster) => {
          const captureKey = `${cluster.id}:${cluster.messages.length}`;
          const capturedImage = avatarImages[captureKey];
          if (!capturedImage) return null;
          return (
            <MessageMarker
              key={captureKey}
              markerId={cluster.id}
              location={cluster.location}
              avatarUri={capturedImage}
              isTarget={cluster.messages.some(m => m.id === routeTargetId)}
              hasActiveRoute={!!routeCoordinates}
              onPress={() =>
                cluster.messages.length > 1
                  ? handleClusterPress(cluster)
                  : handleMarkerPress(cluster.messages[0])
              }
            />
          );
        })}

        {/* Mine mode markers */}
        {mapMode === 'mine' && ownClusters.map((cluster) => {
          const captureKey = `${cluster.id}:${cluster.messages.length}`;
          const capturedImage = avatarImages[captureKey];
          if (!capturedImage) return null;
          return (
            <MessageMarker
              key={captureKey}
              markerId={cluster.id}
              location={cluster.location}
              avatarUri={capturedImage}
              isTarget={false}
              hasActiveRoute={false}
              onPress={() =>
                cluster.messages.length > 1
                  ? handleClusterPress(cluster)
                  : handleMarkerPress(cluster.messages[0])
              }
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

      {/* Capture container AFTER MapView so it sits above the SurfaceView on Android */}
      <View style={styles.captureContainer} pointerEvents="none">
        {(mapMode === 'explore' ? clusters : ownClusters).map((cluster) => {
          const captureKey = `${cluster.id}:${cluster.messages.length}`;
          if (avatarImages[captureKey]) return null;
          const count = cluster.messages.length;
          // In mine mode: violet for public, blue if any private message is unread, green if all read
          const isClusterOpened = mapMode === 'mine' && !cluster.isPublic
            ? cluster.messages.every(m => ownFlagReadMap[m.id])
            : false;
          const avatarBorderStyle: StyleProp<ViewStyle> = mapMode === 'mine'
            ? (cluster.isPublic ? styles.captureAvatarPublic : (isClusterOpened ? styles.captureAvatarOwnOpened : styles.captureAvatarOwnClosed))
            : (cluster.isPublic ? styles.captureAvatarPublic : undefined);

          // Admin-placed markers: golden border — driven by is_admin_placed from DB in both modes
          const isAdminCluster = cluster.isAdminPlaced;

          // Inner avatar shared between all border styles
          const avatarContent = cluster.senderAvatarUrl ? (
            <Image
              source={{ uri: cluster.senderAvatarUrl }}
              style={styles.captureAvatarImage}
              fadeDuration={0}
              onLoad={() => {
                requestAnimationFrame(() => requestAnimationFrame(() => captureAvatar(captureKey)));
              }}
            />
          ) : (
            <View style={[styles.captureAvatarBg, { backgroundColor: colorForUserId(cluster.senderId) }]}>
              <Text style={styles.captureAvatarInitials}>{initialsForName(cluster.senderDisplayName)}</Text>
            </View>
          );

          return (
            <View
              key={captureKey}
              ref={(ref) => { avatarRefs.current[captureKey] = ref; }}
              collapsable={false}
              style={styles.captureAvatarWrapper}
              onLayout={cluster.senderAvatarUrl ? undefined : () => {
                requestAnimationFrame(() => requestAnimationFrame(() => captureAvatar(captureKey)));
              }}
            >
              {isAdminCluster ? (
                <LinearGradient
                  colors={ADMIN_GOLD_GRADIENT}
                  start={GRADIENT_START}
                  end={FAB_GRADIENT_END}
                  style={styles.captureAvatarAdminBorder}
                >
                  <View style={styles.captureAvatarGradientInner}>
                    {avatarContent}
                  </View>
                </LinearGradient>
              ) : cluster.isPublic ? (
                <LinearGradient
                  colors={['#6D28D9', '#3B82F6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.captureAvatarGradientBorder}
                >
                  <View style={styles.captureAvatarGradientInner}>
                    {avatarContent}
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.captureAvatar, avatarBorderStyle]}>
                  {avatarContent}
                </View>
              )}

              {/* Admin star badge */}
              {isAdminCluster && count === 1 && (
                <View style={styles.adminStarBadge}>
                  <Text style={styles.adminStarText}>★</Text>
                </View>
              )}
              {count > 1 && (
                mapMode === 'mine' ? (
                  cluster.isPublic ? (
                    <LinearGradient
                      colors={['#6D28D9', '#3B82F6']}
                      start={GRADIENT_START}
                      end={FAB_GRADIENT_END}
                      style={styles.clusterBadge}
                    >
                      <Text style={styles.clusterBadgeText}>{count}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.clusterBadgeSolid, { backgroundColor: isClusterOpened ? '#22C55E' : '#3B82F6' }]}>
                      <Text style={styles.clusterBadgeText}>{count}</Text>
                    </View>
                  )
                ) : (
                  <LinearGradient
                    colors={colors.gradients.button}
                    start={GRADIENT_START}
                    end={FAB_GRADIENT_END}
                    style={styles.clusterBadge}
                  >
                    <Text style={styles.clusterBadgeText}>{count}</Text>
                  </LinearGradient>
                )
              )}
            </View>
          );
        })}
      </View>

      {routeCoordinates && (
        <View style={[styles.floatingButtonsContainer, { top: insets.top + 16 }]}>
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
        </View>
      )}

      {/* Fixed center pin — visible in admin placement mode (map moves, pin stays) */}
      {isAdminPlacementMode && (
        <View style={styles.adminCenterPinContainer} pointerEvents="none">
          <View style={styles.adminCenterPinInner}>
            <LinearGradient
              colors={ADMIN_GOLD_GRADIENT}
              start={GRADIENT_START}
              end={FAB_GRADIENT_END}
              style={styles.adminCenterPin}
            >
              <Text style={styles.adminCenterPinText}>★</Text>
            </LinearGradient>
            <View style={styles.adminCenterPinTail} />
          </View>
        </View>
      )}

      <View style={[styles.bottomRightContainer, { bottom: 24 + insets.bottom }]}>
        <View style={[styles.createFABGlowContainer, isAdminPlacementMode && styles.createFABGlowAdmin]}>
          <TouchableOpacity
            style={styles.createFABContainer}
            onPress={isAdminPlacementMode ? handleAdminSend : navigateToCreate}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isAdminPlacementMode ? ADMIN_FAB_GRADIENT_ACTIVE : colors.gradients.button}
              start={GRADIENT_START}
              end={FAB_GRADIENT_END}
              style={[styles.createFAB, isAdminPlacementMode && styles.createFABAdmin]}
            >
              <View style={styles.createFABInner}>
                <FontAwesome name="paper-plane" size={32} color={isAdminPlacementMode ? '#5A3A00' : '#FFFFFF'} style={styles.fabIcon} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {isTracking ? (
          <View style={styles.trackingButtonWrapper}>
            <Animated.View style={[
              styles.trackingPing,
              {
                transform: [{ scale: pingAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                opacity: pingAnim1.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.3, 0] }),
              },
            ]} />
            <Animated.View style={[
              styles.trackingPing,
              {
                transform: [{ scale: pingAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                opacity: pingAnim2.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.3, 0] }),
              },
            ]} />
            <TouchableOpacity
              onPress={centerOnUser}
              activeOpacity={0.9}
              style={[styles.floatingButton, styles.floatingButtonTracking]}
            >
              <Ionicons name="locate" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={centerOnUser}
            activeOpacity={0.9}
            style={styles.floatingButton}
          >
            <Ionicons name="locate" size={22} color={colors.primary.cyan} />
          </TouchableOpacity>
        )}
      </View>

      {/* Admin placement FAB (bottom-left, admin only) */}
      {user?.is_admin && (
        <View style={[styles.adminFABContainer, { bottom: 24 + insets.bottom }]}>
          <View style={isAdminPlacementMode ? styles.adminFABGlowActive : styles.adminFABGlow}>
            <TouchableOpacity
              style={styles.adminFABTouchable}
              onPress={toggleAdminPlacement}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isAdminPlacementMode ? ADMIN_FAB_GRADIENT_ACTIVE : ADMIN_FAB_GRADIENT_IDLE}
                start={GRADIENT_START}
                end={FAB_GRADIENT_END}
                style={styles.adminFAB}
              >
                <Text style={[styles.adminFABIcon, isAdminPlacementMode && styles.adminFABIconActive]}>
                  {isAdminPlacementMode ? '✕' : '★'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Explore: selected message card */}
      {selectedMessage && mapMode === 'explore' && (
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

      {/* Mine: selected own flag card */}
      {selectedOwnFlag && mapMode === 'mine' && (
        <OwnFlagCard
          flag={selectedOwnFlag}
          cardSlideAnim={ownFlagSlideAnim}
          cardOpacityAnim={ownFlagOpacityAnim}
          bottomOffset={24 + insets.bottom}
          onClose={handleCloseOwnFlagCard}
          onViewConversation={selectedOwnFlag.recipient_id ? handleViewOwnFlagConversation : undefined}
        />
      )}

      <ClusterPickerModal
        cluster={selectedCluster}
        onSelect={handleMarkerPress}
        onClose={() => setSelectedCluster(null)}
        labelMap={mapMode === 'mine' ? ownFlagLabelMap : undefined}
      />
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
    borderRadius: radius.full,
    ...shadows.small,
  },
  floatingButtonTracking: {
    backgroundColor: 'rgba(167, 139, 250, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(196, 181, 253, 0.7)',
    shadowColor: colors.primary.violet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  trackingButtonWrapper: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingPing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.primary.violet,
  },
  floatingButtonDanger: {
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  floatingButtonMaps: {
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
  },
  bottomRightContainer: {
    position: 'absolute',
    right: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  createFABGlowContainer: {
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
    top: -200,
    left: -200,
  },
  // Wrapper circulaire : élimine les coins transparents qui deviennent blancs
  // dans le renderer natif de la map (GMSMarker/MKAnnotationView).
  // Le badge (top:7, right:7, 26x26) reste dans le cercle (distance au centre ≈ 34px < rayon 35).
  captureAvatarWrapper: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 35,
    overflow: 'hidden',
  },
  captureAvatar: {
    width: 56,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  clusterBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  clusterBadgeSolid: {
    position: 'absolute',
    top: 7,
    right: 7,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: colors.primary.violet,
  },
  clusterBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  captureAvatarPublic: {
    borderWidth: 3,
    borderColor: colors.primary.violet,
  },
  captureAvatarGradientBorder: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Admin-placed message marker — golden gradient border (slightly wider for visibility)
  captureAvatarAdminBorder: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminStarBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  adminStarText: {
    fontSize: 11,
    color: '#5A3A00',
    fontWeight: '800',
    lineHeight: 13,
  },
  captureAvatarGradientInner: {
    width: 56,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  captureAvatarOwnOpened: {
    borderWidth: 3,
    borderColor: '#22C55E',
  },
  captureAvatarOwnClosed: {
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  captureAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  captureAvatarBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureAvatarInitials: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  insetSpacer: {
    backgroundColor: 'transparent',
  },
  fabIcon: {
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  // Fixed center pin — floats above the map, tip points to the exact map center
  // translateY: -(pinRadius + tailHeight) moves the tip to screen center
  adminCenterPinContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminCenterPinInner: {
    alignItems: 'center',
    transform: [{ translateY: -38 }], // (48/2 + 14) = 38 → tip aligns with screen center
  },
  adminCenterPin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#5A3A00',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 20,
  },
  adminCenterPinText: {
    fontSize: 26,
    color: '#5A3A00',
    fontWeight: '900',
  },
  adminCenterPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#5A3A00',
    marginTop: -2,
  },
  // Main FAB in admin mode — golden
  createFABGlowAdmin: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 36,
    elevation: 28,
  },
  createFABAdmin: {
    borderColor: 'rgba(255, 215, 0, 0.8)',
  },
  createFABAdminText: {
    fontSize: 36,
    color: '#5A3A00',
    fontWeight: '900',
  },
  // Admin placement FAB (bottom-left)
  adminFABContainer: {
    position: 'absolute',
    left: spacing.lg,
    alignItems: 'center',
  },
  adminFABGlow: {
    shadowColor: '#7A5700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
    borderRadius: radius.full,
  },
  adminFABGlowActive: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 20,
    borderRadius: radius.full,
  },
  adminFABTouchable: {
    borderRadius: radius.full,
  },
  adminFAB: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.6)',
  },
  adminFABIcon: {
    fontSize: 22,
    color: '#B8860B',
    fontWeight: '800',
  },
  adminFABIconActive: {
    color: '#5A3A00',
    fontSize: 20,
  },
  // Admin placement mode banner (below mode pill)
  adminPlacementBanner: {
    position: 'absolute',
    alignSelf: 'center',
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: 'rgba(255, 215, 0, 0.18)',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 10,
  },
  adminPlacementBannerText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
