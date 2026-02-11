import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

interface PermissionItem {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: 'undetermined' | 'granted' | 'denied';
}

interface PermissionsScreenProps {
  onComplete: () => void;
}

export default function PermissionsScreen({ onComplete }: PermissionsScreenProps) {
  const [permissions, setPermissions] = useState<PermissionItem[]>([
    {
      key: 'location',
      label: 'Localisation',
      description: 'Pour afficher les messages autour de vous',
      icon: 'location-outline',
      status: 'undetermined',
    },
    {
      key: 'locationBackground',
      label: 'Localisation en arrière-plan',
      description: 'Pour vous notifier quand vous êtes proche d\'un message',
      icon: 'navigate-outline',
      status: 'undetermined',
    },
    {
      key: 'camera',
      label: 'Caméra',
      description: 'Pour prendre des photos à joindre aux messages',
      icon: 'camera-outline',
      status: 'undetermined',
    },
    {
      key: 'microphone',
      label: 'Microphone',
      description: 'Pour enregistrer des messages audio',
      icon: 'mic-outline',
      status: 'undetermined',
    },
    {
      key: 'notifications',
      label: 'Notifications',
      description: 'Pour être alerté des nouveaux messages',
      icon: 'notifications-outline',
      status: 'undetermined',
    },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    checkExistingPermissions();
  }, []);

  const checkExistingPermissions = async () => {
    const [locationFg, locationBg, camera, microphone, notifications] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Camera.getCameraPermissionsAsync(),
      Audio.getPermissionsAsync(),
      Notifications.getPermissionsAsync(),
    ]);

    setPermissions((prev) =>
      prev.map((p) => {
        switch (p.key) {
          case 'location':
            return { ...p, status: locationFg.status as PermissionItem['status'] };
          case 'locationBackground':
            return { ...p, status: locationBg.status as PermissionItem['status'] };
          case 'camera':
            return { ...p, status: camera.status as PermissionItem['status'] };
          case 'microphone':
            return { ...p, status: microphone.status as PermissionItem['status'] };
          case 'notifications':
            return { ...p, status: notifications.status as PermissionItem['status'] };
          default:
            return p;
        }
      })
    );
  };

  const requestPermission = async (key: string) => {
    setRequesting(true);
    let status: string = 'denied';

    try {
      switch (key) {
        case 'location': {
          const result = await Location.requestForegroundPermissionsAsync();
          status = result.status;
          break;
        }
        case 'locationBackground': {
          const result = await Location.requestBackgroundPermissionsAsync();
          status = result.status;
          break;
        }
        case 'camera': {
          const result = await Camera.requestCameraPermissionsAsync();
          status = result.status;
          break;
        }
        case 'microphone': {
          const result = await Audio.requestPermissionsAsync();
          status = result.status;
          break;
        }
        case 'notifications': {
          const result = await Notifications.requestPermissionsAsync();
          status = result.status;
          if (status === 'granted' && Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('messages', {
              name: 'Messages',
              importance: Notifications.AndroidImportance.HIGH,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#4A90D9',
            });
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Error requesting ${key} permission:`, error);
    }

    setPermissions((prev) =>
      prev.map((p) =>
        p.key === key ? { ...p, status: status as PermissionItem['status'] } : p
      )
    );

    setRequesting(false);

    // Move to next permission or complete
    if (currentIndex < permissions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const skipPermission = () => {
    if (currentIndex < permissions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const current = permissions[currentIndex];
  const isAlreadyGranted = current.status === 'granted';

  // Auto-skip already granted permissions
  useEffect(() => {
    if (isAlreadyGranted) {
      if (currentIndex < permissions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onComplete();
      }
    }
  }, [currentIndex, isAlreadyGranted]);

  if (isAlreadyGranted) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.progress}>
        {permissions.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i === currentIndex && styles.progressDotActive,
              i < currentIndex && styles.progressDotDone,
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name={current.icon} size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>{current.label}</Text>
        <Text style={styles.description}>{current.description}</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => requestPermission(current.key)}
          disabled={requesting}
        >
          <Text style={styles.buttonText}>Autoriser</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={skipPermission}
          disabled={requesting}
        >
          <Text style={styles.skipButtonText}>Plus tard</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        {currentIndex + 1} / {permissions.length}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceLight,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  progressDotDone: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  footer: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
  },
});
