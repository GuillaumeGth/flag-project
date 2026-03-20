import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { colors, spacing } from '@/theme-redesign';
import { RootStackParamList, MainTabParamList } from '@/types';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { log } from '@/utils/debug';
import { LocationProvider } from '@/contexts/LocationContext';
import ScreenLoader from '@/components/ScreenLoader';
import { addNotificationResponseListener } from '@/services/notifications';
import { fetchMessageById } from '@/services/messages';
import { supabase } from '@/services/supabase';
import { checkForAppUpdate } from '@/services/appUpdater';
import { setupGlobalErrorHandler } from '@/services/errorReporting';
import { navigationRef } from '@/services/navigationRef';

// Catch unhandled JS errors and forward them to Crashlytics
setupGlobalErrorHandler();

import PermissionsScreen from '@/screens/PermissionsScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import AuthScreen from '@/screens/AuthScreen';
import MapScreen from '@/screens/MapScreen';
import InboxScreen from '@/screens/InboxScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import CreateMessageScreen from '@/screens/CreateMessageScreen';
import ReadMessageScreen from '@/screens/ReadMessageScreen';
import SelectRecipientScreen from '@/screens/SelectRecipientScreen';
import ConversationScreen from '@/screens/ConversationScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import ContactScreen from '@/screens/ContactScreen';
import PrivacyScreen from '@/screens/PrivacyScreen';
import FollowRequestsScreen from '@/screens/FollowRequestsScreen';
import UserProfileScreen from '@/screens/UserProfileScreen';
import MessageFeedScreen from '@/screens/MessageFeedScreen';
import SearchUsersScreen from '@/screens/SearchUsersScreen';

// Register background task
import './src/tasks/backgroundLocation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();


function MainTabs() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 50 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Inbox') {
            iconName = focused ? 'mail' : 'mail-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#A78BFA',
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.surface.elevated,
          borderTopWidth: 1,
          borderTopColor: colors.border.default,
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          paddingTop: spacing.xs,
        },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="Search" component={SearchUsersScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const PERMISSIONS_DONE_KEY = 'permissions_onboarding_done';
const ONBOARDING_DONE_KEY = 'onboarding_done';

function AppNavigator() {
  const { user, loading } = useAuth();
  const [permissionsDone, setPermissionsDone] = useState<boolean | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  log('AppNavigator', 'render: loading =', loading, 'user =', user?.id, 'permissionsDone =', permissionsDone, 'hasSeenOnboarding =', hasSeenOnboarding);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(PERMISSIONS_DONE_KEY),
      SecureStore.getItemAsync(ONBOARDING_DONE_KEY),
    ])
      .then(([permissions, onboarding]) => {
        setPermissionsDone(permissions === 'true');
        setHasSeenOnboarding(onboarding === 'true');
      })
      .catch(() => {
        setPermissionsDone(false);
        setHasSeenOnboarding(false);
      });
  }, []);

  if (loading || permissionsDone === null || hasSeenOnboarding === null) {
    log('AppNavigator', 'showing loader (loading)');
    return <ScreenLoader />;
  }

  const handlePermissionsComplete = async () => {
    await SecureStore.setItemAsync(PERMISSIONS_DONE_KEY, 'true');
    setPermissionsDone(true);
  };

  const handleOnboardingComplete = async () => {
    await SecureStore.setItemAsync(ONBOARDING_DONE_KEY, 'true');
    setHasSeenOnboarding(true);
  };

  if (!user) {
    log('AppNavigator', 'showing AuthScreen');
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthScreen} />
      </Stack.Navigator>
    );
  }

  const isGuigz = user.display_name === 'guigz';
  if (isGuigz && !hasSeenOnboarding) {
    log('AppNavigator', 'showing OnboardingScreen');
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (!permissionsDone) {
    log('AppNavigator', 'showing PermissionsScreen');
    return <PermissionsScreen onComplete={handlePermissionsComplete} />;
  }

  log('AppNavigator', 'showing MainTabs');
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="CreateMessage"
        component={CreateMessageScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ReadMessage"
        component={ReadMessageScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="SelectRecipient"
        component={SelectRecipientScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="Contact"
        component={ContactScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="FollowRequests"
        component={FollowRequestsScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="MessageFeed"
        component={MessageFeedScreen}
        options={{ presentation: 'card' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {

  useEffect(() => {
    checkForAppUpdate();
  }, []);

  useEffect(() => {
    const subscription = addNotificationResponseListener(async (messageId) => {
      if (!navigationRef.current?.isReady()) return;

      const message = await fetchMessageById(messageId);
      if (!message) {
        navigationRef.current.navigate('Main', { screen: 'Map', params: { refresh: Date.now() } });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Public flags and own messages (discovered / reacted) → show on map
      if (message.is_public || message.sender_id === currentUserId) {
        navigationRef.current.navigate('Main', {
          screen: 'Map',
          params: { messageId },
        });
      } else {
        // Private message where current user is recipient → open conversation
        navigationRef.current.navigate('Conversation', {
          otherUserId: message.sender.id,
          otherUserName: message.sender.display_name as string,
          otherUserAvatarUrl: message.sender.avatar_url ?? undefined,
          scrollToMessageId: messageId,
        });
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocationProvider>
          <NavigationContainer ref={navigationRef}>
            <AppNavigator />
            <StatusBar style="light" />
          </NavigationContainer>
        </LocationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
