import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUnreadMessages } from '@/services/messages';
import { isWithinRadius } from '@/services/location';
import { MessageWithSender, Coordinates } from '@/types';

interface Props {
  navigation: any;
}

export default function MapScreen({ navigation }: Props) {
  const { current: userLocation, loading: locationLoading, refreshLocation } = useLocation();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<MessageWithSender | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    const data = await fetchUnreadMessages();
    setMessages(data);
    setLoading(false);
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const handleMarkerPress = (message: MessageWithSender) => {
    setSelectedMessage(message);
  };

  const canReadMessage = (messageLocation: Coordinates): boolean => {
    if (!userLocation) return false;
    return isWithinRadius(userLocation, messageLocation, 30);
  };

  const openMessage = () => {
    if (selectedMessage) {
      navigation.navigate('ReadMessage', { message: selectedMessage });
    }
  };

  const getMessageLocation = (message: MessageWithSender): Coordinates => {
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

  if (locationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.loadingText}>Localisation en cours...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={
          userLocation
            ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            : undefined
        }
        showsUserLocation
        showsMyLocationButton={false}
      >
        {messages.map((message) => {
          const location = getMessageLocation(message);
          const isReadable = canReadMessage(location);

          return (
            <React.Fragment key={message.id}>
              <Circle
                center={location}
                radius={30}
                fillColor={isReadable ? 'rgba(74, 144, 217, 0.2)' : 'rgba(150, 150, 150, 0.2)'}
                strokeColor={isReadable ? '#4A90D9' : '#999'}
                strokeWidth={2}
              />
              <Marker
                coordinate={location}
                onPress={() => handleMarkerPress(message)}
                pinColor={isReadable ? '#4A90D9' : '#999'}
              />
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Center on user button */}
      <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#4A90D9" />
      </TouchableOpacity>

      {/* Refresh button */}
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={() => {
          refreshLocation();
          loadMessages();
        }}
      >
        <Ionicons name="refresh" size={24} color="#4A90D9" />
      </TouchableOpacity>

      {/* Create message button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateMessage')}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Selected message card */}
      {selectedMessage && (
        <View style={styles.messageCard}>
          <View style={styles.messageCardHeader}>
            <Text style={styles.senderName}>
              {selectedMessage.sender?.display_name || 'Utilisateur'}
            </Text>
            <TouchableOpacity onPress={() => setSelectedMessage(null)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {canReadMessage(getMessageLocation(selectedMessage)) ? (
            <TouchableOpacity style={styles.readButton} onPress={openMessage}>
              <Text style={styles.readButtonText}>Lire le message</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.distanceText}>
              Rapprochez-vous pour lire ce message
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
  },
  centerButton: {
    position: 'absolute',
    top: 60,
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
    top: 120,
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
    bottom: 32,
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
    bottom: 32,
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
