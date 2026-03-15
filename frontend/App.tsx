import React, { useState, useCallback, useEffect, useRef } from 'react';
import { initMapbox } from './src/lib/mapboxInit';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { usePushNotifications, scheduleContributionReminder } from './src/hooks/usePushNotifications';

import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme, LinkingOptions } from '@react-navigation/native';

// Initialise Mapbox token before any MapView mounts.
void initMapbox();
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { AreaProvider } from './src/context/AreaContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AlertProvider } from './src/context/AlertContext';
import { GroupProvider } from './src/context/GroupContext';
import SplashScreen from './src/screens/SplashScreen';

// Keep native splash visible until we're ready to show our animated one
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

const linking: LinkingOptions<any> = {
  prefixes: ['traverse://', 'https://traverseapp.com'],
  config: {
    screens: {
      Main: {
        screens: {
          Map: {
            path: '',
            parse: {
              targetPinId: (id: string) => id,
              targetEventId: (id: string) => id,
              targetReportId: (id: string) => id,
            },
            screens: {},
          },
        },
      },
    },
  },
};

function AppContent() {
  const { isDarkMode, colors } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const navigationRef = useRef<any>(null);

  // Register for push notifications and schedule a contribution reminder
  usePushNotifications((notification) => {
    // Handle push notification taps — navigate to the relevant screen
    const data = notification?.request?.content?.data ?? notification?.data ?? {};
    if (!navigationRef.current) return;
    if (data.type === 'rsvp' && data.eventId) {
      navigationRef.current.navigate('Main', {
        screen: 'Map',
        params: { targetEventId: data.eventId },
      });
    } else if (data.type === 'event_chat' && data.eventId) {
      navigationRef.current.navigate('Main', {
        screen: 'Map',
        params: { targetEventId: data.eventId },
      });
    } else if (data.type === 'review') {
      if (data.itemType === 'event' && data.itemId) {
        navigationRef.current.navigate('Main', {
          screen: 'Map',
          params: { targetEventId: data.itemId },
        });
      } else if (data.itemType === 'pin' && data.itemId) {
        navigationRef.current.navigate('Main', {
          screen: 'Map',
          params: { targetPinId: data.itemId },
        });
      }
    } else if ((data.type === 'pin_verified' || data.type === 'pin_grace_period') && data.pinId) {
      navigationRef.current.navigate('Main', {
        screen: 'Map',
        params: { targetPinId: data.pinId },
      });
    } else if (data.type === 'event_cancelled' && data.eventId) {
      navigationRef.current.navigate('Main', {
        screen: 'Map',
        params: { targetEventId: data.eventId },
      });
    } else if (data.type === 'rsvp_cancelled' && data.eventId) {
      navigationRef.current.navigate('Main', {
        screen: 'Map',
        params: { targetEventId: data.eventId },
      });
    } else if (data.type === 'report_chat' && data.reportId) {
      navigationRef.current.navigate('Main', {
        screen: 'Map',
        params: { targetReportId: data.reportId },
      });
    }
  });

  useEffect(() => {
    scheduleContributionReminder().catch(() => {});
  }, []);

  // Hide the native Expo splash right away so our animated splash takes over
  useEffect(() => {
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  const paperTheme = isDarkMode
    ? { ...MD3DarkTheme, colors: { ...MD3DarkTheme.colors, primary: colors.primary, background: colors.background, surface: colors.surface } }
    : { ...MD3LightTheme, colors: { ...MD3LightTheme.colors, primary: colors.primary, background: colors.background, surface: colors.surface } };

  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  const navTheme = isDarkMode
    ? { ...DarkTheme,  colors: { ...DarkTheme.colors,  background: colors.background, card: colors.surface } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.backgroundGray, card: colors.surface } };

  return (
    <PaperProvider theme={paperTheme}>
      <AuthProvider>
        <GroupProvider>
          <AlertProvider>
            <AreaProvider>
              <NavigationContainer theme={navTheme} linking={linking} ref={navigationRef}>
                <AppNavigator />
              </NavigationContainer>
              {!splashDone && <SplashScreen onFinish={handleSplashFinish} />}
            </AreaProvider>
          </AlertProvider>
        </GroupProvider>
      </AuthProvider>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BottomSheetModalProvider>
            <AppContent />
          </BottomSheetModalProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
