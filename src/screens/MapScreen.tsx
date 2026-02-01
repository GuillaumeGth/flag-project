import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUndiscoveredMessagesForMap } from '@/services/messages';
import { isWithinRadius } from '@/services/location';
import { UndiscoveredMessageMapMeta, Coordinates } from '@/types';

interface Props {
  navigation: any;
}

// 500m radius = ~0.009 latitudeDelta (1km visible area)
const VISIBLE_RADIUS_METERS = 500;
const LAT_DELTA = 0.009;
const LNG_DELTA = 0.009;

export default function MapScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { current: userLocation, loading: locationLoading, refreshLocation, requestPermission, permission } = useLocation();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [messages, setMessages] = useState<UndiscoveredMessageMapMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<UndiscoveredMessageMapMeta | null>(null);

  // Request location permission on mount
  useEffect(() => {
    if (permission !== 'granted') {
      requestPermission();
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, []);

  // Center on user when location changes
  useEffect(() => {
    if (userLocation && mapRef.current) {
      console.log('Centering map on:', userLocation.latitude, userLocation.longitude);
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: LAT_DELTA,
        longitudeDelta: LNG_DELTA,
      }, 500);
    }
  }, [userLocation]);

  const loadMessages = async () => {
    setLoading(true);
    const data = await fetchUndiscoveredMessagesForMap();
    setMessages(data);
    setLoading(false);
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

  const handleMarkerPress = (message: UndiscoveredMessageMapMeta) => {
    setSelectedMessage(message);
  };

  const canReadMessage = (messageLocation: Coordinates): boolean => {
    if (!userLocation) return false;
    return isWithinRadius(userLocation, messageLocation, 30);
  };

  const getMessageLocation = (message: UndiscoveredMessageMapMeta): Coordinates => {
    // Parse PostGIS POINT format or use direct coordinates
    if (typeof message.location === 'string') {
      const match = message.location.match(/POINT\(([^ ]+) ([^)]+)\)/);
      if (match) {
        return {
          longitude: parseFloat(match[1]),
          latitude: parseFloat(match[2]),
        };
      }
    }
    return message.location as Coordinates;
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
        provider={PROVIDER_GOOGLE}
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
      >
        {messages.map((message) => {
          const location = getMessageLocation(message);
          const isReadable = canReadMessage(location);

          return (
            <Marker
              key={message.id}
              coordinate={location}
              onPress={() => handleMarkerPress(message)}
              pinColor={isReadable ? '#4A90D9' : '#999'}
            />
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
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Selected message card */}
      {selectedMessage && (
        <View style={[styles.messageCard, { bottom: 24 }]}>
          <View style={styles.messageCardHeader}>
            <View style={styles.messageCardTitle}>
              <Ionicons name="mail-unread" size={20} color="#4A90D9" style={{ marginRight: 8 }} />
              <Text style={styles.senderName}>Message non découvert</Text>
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
});
