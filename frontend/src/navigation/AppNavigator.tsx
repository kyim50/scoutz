import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Animated, TouchableOpacity } from 'react-native';
import { createStackNavigator, CardStyleInterpolators, TransitionSpecs } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import OnboardingScreen from '../screens/OnboardingScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SelectTypeScreen from '../screens/SelectTypeScreen';
import PlacePinScreen from '../screens/PlacePinScreen';
import CreatePinScreen from '../screens/CreatePinScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import CreateReportScreen from '../screens/CreateReportScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import UserPinsScreen from '../screens/UserPinsScreen';
import UserEventsScreen from '../screens/UserEventsScreen';
import UserReportsScreen from '../screens/UserReportsScreen';
import SavedItemsScreen from '../screens/SavedItemsScreen';
import CreateReviewScreen from '../screens/CreateReviewScreen';
import ItemReviewsScreen from '../screens/ItemReviewsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_BAR_BASE_HEIGHT = 52;

const AnimatedTabButton = ({ children, onPress, onLongPress, style }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

const MapTabScreen = (props: any) => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + Math.max(insets.bottom, 8);
  return <MapScreen {...props} navBarHeight={tabBarHeight} />;
};

const ProfileTabScreen = (props: any) => <ProfileScreen {...props} />;

const MainTabs = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginTop: -2 },
        tabBarStyle: {
          height: TAB_BAR_BASE_HEIGHT + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mediumGray,
        tabBarButton: (props) => <AnimatedTabButton {...props} />,
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = route.name === 'Map'
            ? focused ? 'map' : 'map-outline'
            : focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map" component={MapTabScreen} />
      <Tab.Screen name="Profile" component={ProfileTabScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const value = await AsyncStorage.getItem('hasOnboarded');
      setHasOnboarded(value === 'true');
    } catch {
      setHasOnboarded(false);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem('hasOnboarded', 'true');
      setHasOnboarded(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  if (loading || hasOnboarded === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: {
          open: { ...TransitionSpecs.TransitionIOSSpec },
          close: { ...TransitionSpecs.TransitionIOSSpec },
        },
      }}
    >
      {!isAuthenticated ? (
        <>
          {!hasOnboarded && (
            <Stack.Screen name="Onboarding">
              {(props: any) => (
                <OnboardingScreen {...props} onComplete={handleOnboardingComplete} />
              )}
            </Stack.Screen>
          )}
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="SelectType" component={SelectTypeScreen} />
          <Stack.Screen name="PlacePin" component={PlacePinScreen} />
          <Stack.Screen
            name="CreatePin"
            component={CreatePinScreen}
            options={{ presentation: 'modal', cardStyle: { backgroundColor: 'transparent' }, cardOverlayEnabled: true }}
          />
          <Stack.Screen
            name="CreateEvent"
            component={CreateEventScreen}
            options={{ presentation: 'modal', cardStyle: { backgroundColor: 'transparent' }, cardOverlayEnabled: true }}
          />
          <Stack.Screen
            name="CreateReport"
            component={CreateReportScreen}
            options={{ presentation: 'modal', cardStyle: { backgroundColor: 'transparent' }, cardOverlayEnabled: true }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen
            name="UserPins"
            component={UserPinsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen
            name="UserReports"
            component={UserReportsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen
            name="UserEvents"
            component={UserEventsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen
            name="SavedItems"
            component={SavedItemsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen
            name="CreateReview"
            component={CreateReviewScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="ItemReviews" component={ItemReviewsScreen} />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen
            name="Groups"
            component={GroupsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
          <Stack.Screen
            name="GroupDetail"
            component={GroupDetailScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
