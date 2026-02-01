import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';

import AuthScreen from '@/screens/AuthScreen';
import MapScreen from '@/screens/MapScreen';
import InboxScreen from '@/screens/InboxScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import CreateMessageScreen from '@/screens/CreateMessageScreen';
import ReadMessageScreen from '@/screens/ReadMessageScreen';

// Register background task
import './src/tasks/backgroundLocation';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Inbox') {
            iconName = focused ? 'mail' : 'mail-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4A90D9',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          paddingTop: 8,
          minHeight: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 4,
        },
      })}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ tabBarLabel: 'Carte' }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ tabBarLabel: 'Messages' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Or a splash screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
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
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocationProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </LocationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
