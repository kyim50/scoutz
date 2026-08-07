import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Easing, Dimensions } from 'react-native';
import { SkeletonBox } from '../components/Skeleton';
import { createStackNavigator, CardStyleInterpolators, TransitionSpecs } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import type { StackCardInterpolationProps } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

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
import ActivityScreen from '../screens/ActivityScreen';
import ItemReviewsScreen from '../screens/ItemReviewsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_BAR_BASE_HEIGHT = 56;

const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Stack transition: horizontal slide (iOS-style) ────────────────────────────
const slideInterpolator = ({ current, next, layouts }: StackCardInterpolationProps) => {
  const width = layouts.screen.width;
  // Incoming screen slides in from the right
  const translateX = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
    extrapolate: 'clamp',
  });
  // Outgoing screen slides out to the left (parallax — moves 30% of width)
  const outgoingTranslateX = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -width * 0.3],
        extrapolate: 'clamp',
      })
    : 0;

  return {
    cardStyle: { transform: [{ translateX }] },
    containerStyle: { transform: [{ translateX: outgoingTranslateX }] },
  };
};

const snappyTransitionSpec = {
  open: {
    animation: 'timing' as const,
    config: { duration: 320, easing: Easing.out(Easing.poly(5)) },
  },
  close: {
    animation: 'timing' as const,
    config: { duration: 250, easing: Easing.in(Easing.poly(4)) },
  },
};

// ── Tab slide wrapper ─────────────────────────────────────────────────────────
// Slides in from the right when navigating to a higher-index tab, left otherwise.
/**
 * The tab that was focused last, shared across the tab screens so each one can
 * work out which way it is being entered from. With only two tabs the direction
 * was implied by the index; a middle tab can be reached from either side.
 */
const lastTabIndex = { current: 0 };

const SlideTabScreen = ({ children, index }: { children: React.ReactNode; index: number }) => {
  const isFocused = useIsFocused();
  const translateX = useRef(new Animated.Value(isFocused ? 0 : SCREEN_WIDTH)).current;
  const lastFocused = useRef(isFocused);

  useEffect(() => {
    if (isFocused === lastFocused.current) return;
    lastFocused.current = isFocused;

    if (isFocused) {
      // Snap to off-screen position matching the direction, then slide in
      const direction = index >= lastTabIndex.current ? 1 : -1;
      lastTabIndex.current = index;
      translateX.setValue(direction * SCREEN_WIDTH * 0.25);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.poly(4)),
        useNativeDriver: true,
      }).start();
    } else {
      translateX.setValue(0);
    }
  }, [isFocused]);

  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
};

// ── Tab button ───────────────────────────────────────────────────────────────
/**
 * Press feedback only. 0.75 was a quarter of the control's size — enough to
 * read as the tab collapsing rather than as a button acknowledging a touch —
 * and the release spring bounced, which on something pressed dozens of times a
 * day is motion nobody asked to watch twice.
 */
const AnimatedTabButton = ({ children, onPress, onLongPress, style, accessibilityState }: any) => {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (toValue: number, duration: number) =>
    Animated.timing(scale, {
      toValue,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  return (
    <TouchableOpacity
      onPress={(e) => {
        // Silent when the tab is already open: nothing changed to confirm.
        if (!accessibilityState?.selected) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      onLongPress={onLongPress}
      onPressIn={() => to(0.94, 90)}
      onPressOut={() => to(1, 140)}
      activeOpacity={1}
      style={style}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

// ── Tab item ─────────────────────────────────────────────────────────────────
/**
 * Icon over a label.
 *
 * The bar previously said "active" four times at once — colour, a filled
 * glyph, a 1.2x scale and an underline — while saying nothing at all about
 * what each tab was. Three abstract glyphs is a guess for anyone who has not
 * already learned them, and none of the four signals helped with that. Two of
 * them are gone and the space goes to a label instead.
 *
 * The scale also left the active glyph 29pt against its neighbours' 24, so the
 * row never sat evenly, and the underline animated `width`, which cannot run on
 * the native thread — the one animation in the app pinned to the JS thread, on
 * the screen already busy drawing a map.
 */
const TabItem = ({
  name,
  label,
  focused,
  color,
}: {
  name: any;
  label: string;
  focused: boolean;
  color: string;
}) => (
  <View style={{ alignItems: 'center', gap: 3, width: 76 }}>
    <Ionicons name={name} size={23} color={color} />
    <Text
      numberOfLines={1}
      style={{
        fontSize: 11,
        lineHeight: 14,
        fontWeight: focused ? '700' : '500',
        letterSpacing: 0.1,
        color,
      }}
    >
      {label}
    </Text>
  </View>
);

// ── Tab screens ───────────────────────────────────────────────────────────────
const MapTabScreen = (props: any) => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + Math.max(insets.bottom, 8);
  return (
    <SlideTabScreen index={0}>
      <MapScreen {...props} navBarHeight={tabBarHeight} />
    </SlideTabScreen>
  );
};

const ActivityTabScreen = (props: any) => (
  <SlideTabScreen index={1}>
    <ActivityScreen {...props} />
  </SlideTabScreen>
);

const ProfileTabScreen = (props: any) => (
  <SlideTabScreen index={2}>
    <ProfileScreen {...props} />
  </SlideTabScreen>
);

// ── Main tab navigator ────────────────────────────────────────────────────────
const MainTabs = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: TAB_BAR_BASE_HEIGHT + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 7,
          backgroundColor: colors.surface,
          // The map runs to the bar's edge, so without this the two meet with
          // nothing between them.
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mediumGray,
        tabBarButton: (props) => <AnimatedTabButton {...props} />,
        tabBarIcon: ({ focused, color }) => {
          // `reader` is a document, which is not what Activity holds. A clock
          // matches what the screen is: your history, most recent first.
          const tabs: Record<string, [string, string, string]> = {
            Map: ['map', 'map-outline', 'Map'],
            Activity: ['time', 'time-outline', 'Activity'],
            Profile: ['person', 'person-outline', 'Account'],
          };
          const [on, off, label] = tabs[route.name] ?? ['ellipse', 'ellipse-outline', route.name];
          return (
            <TabItem name={focused ? on : off} label={label} focused={focused} color={color} />
          );
        },
      })}
    >
      <Tab.Screen name="Map" component={MapTabScreen} />
      <Tab.Screen name="Activity" component={ActivityTabScreen} />
      <Tab.Screen name="Profile" component={ProfileTabScreen} />
    </Tab.Navigator>
  );
};

// ── Root stack navigator ──────────────────────────────────────────────────────
const AppNavigator = () => {
  const {
    isAuthenticated,
    loading,
    isPasswordRecovery,
    authLinkError,
    clearAuthLinkError,
  } = useAuth();
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  // An expired or already-used link would otherwise do nothing at all, leaving
  // the user staring at the login screen wondering if the email worked.
  useEffect(() => {
    if (!authLinkError) return;
    showAlert('That link has expired', authLinkError, [
      { text: 'OK', onPress: clearAuthLinkError },
    ]);
  }, [authLinkError, showAlert, clearAuthLinkError]);

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
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 80, gap: 16 }}>
        <SkeletonBox width="50%" height={28} radius={8} />
        <SkeletonBox width="100%" height={56} radius={12} />
        <SkeletonBox width="100%" height={56} radius={12} />
        <SkeletonBox width="70%" height={14} radius={6} style={{ alignSelf: 'center', marginTop: 8 }} />
      </View>
    );
  }

  const modalOptions = {
    cardStyle: { backgroundColor: 'transparent' },
    cardOverlayEnabled: true,
    cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS,
    transitionSpec: {
      open: { ...TransitionSpecs.TransitionIOSSpec },
      close: { ...TransitionSpecs.TransitionIOSSpec },
    },
  };

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        cardStyleInterpolator: slideInterpolator,
        transitionSpec: snappyTransitionSpec,
      }}
    >
      {isPasswordRecovery ? (
        // Takes precedence over both stacks: a recovery link creates a real
        // session, so without this the user would be dropped into the app with
        // their password still unset.
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      ) : !isAuthenticated ? (
        <>
          {!hasOnboarded && (
            <Stack.Screen name="Onboarding">
              {(props: any) => (
                <OnboardingScreen {...props} onComplete={handleOnboardingComplete} />
              )}
            </Stack.Screen>
          )}
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="SelectType" component={SelectTypeScreen} />
          <Stack.Screen name="PlacePin" component={PlacePinScreen} />
          <Stack.Screen name="CreatePin" component={CreatePinScreen}
            options={{ presentation: 'modal', ...modalOptions }} />
          <Stack.Screen name="CreateEvent" component={CreateEventScreen}
            options={{ presentation: 'modal', ...modalOptions }} />
          <Stack.Screen name="CreateReport" component={CreateReportScreen}
            options={{ presentation: 'modal', ...modalOptions }} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="UserPins" component={UserPinsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="UserReports" component={UserReportsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="UserEvents" component={UserEventsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="SavedItems" component={SavedItemsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="CreateReview" component={CreateReviewScreen}
            options={{ presentation: 'modal', ...modalOptions }} />
          <Stack.Screen name="ItemReviews" component={ItemReviewsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="Groups" component={GroupsScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
          <Stack.Screen name="GroupDetail" component={GroupDetailScreen}
            options={{ cardStyle: { backgroundColor: colors.surface } }} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
