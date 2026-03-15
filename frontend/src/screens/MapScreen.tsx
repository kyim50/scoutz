import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
  FlatList,
  Image,
  Keyboard,
  Animated,
  Easing,
  Share,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import BottomSheet, { BottomSheetFlatList, BottomSheetScrollView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing, typography, borderRadius, shadows } from '../constants/theme';
import { MAPBOX_STYLE_STANDARD, MAPBOX_TOKEN } from '../constants/map';
import { searchAPI, recommendationAPI, pinAPI, eventAPI, savedAPI, reviewAPI, reportAPI, reportChatAPI, eventChatAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { useArea } from '../context/AreaContext';
import { useGroup } from '../context/GroupContext';
import GroupPickerModal from '../components/GroupPickerModal';

const { width, height } = Dimensions.get('window');
const SHEET_PEEK_BASE = 190;
const SHEET_PEEK_DETAIL = 162;
const SHEET_HALF = height * 0.78;
const SHEET_FULL = height * 0.92;
const SHEET_REPORT_MAX = Math.min(SHEET_HALF, height * 0.60);
const SHEET_EVENT_MAX = SHEET_FULL;
const SHEET_COLLAPSE_HINT_THRESHOLD = 56;
const SHEET_INDEX = {
  COLLAPSED: 0,
  HALF: 1,
  FULL: 2,
} as const;

const CHIP_PRESETS = {
  morning: [
    { id: 'coffee', label: 'Coffee', icon: 'cafe-outline' },
    { id: 'study', label: 'Quiet Study', icon: 'book-outline' },
    { id: 'bathroom', label: 'Bathroom', icon: 'water-outline' },
    { id: 'event', label: 'Events', icon: 'calendar-outline' },
  ],
  day: [
    { id: 'food', label: 'Food', icon: 'restaurant-outline' },
    { id: 'bathroom', label: 'Bathroom', icon: 'water-outline' },
    { id: 'pharmacy', label: 'Pharmacy', icon: 'medical-outline' },
    { id: 'event', label: 'Events', icon: 'calendar-outline' },
  ],
  evening: [
    { id: 'safe_walk', label: 'Safe Walk', icon: 'walk-outline' },
    { id: 'open_late', label: 'Open Late', icon: 'time-outline' },
    { id: 'food', label: 'Food', icon: 'restaurant-outline' },
    { id: 'event', label: 'Events', icon: 'calendar-outline' },
  ],
  night: [
    { id: 'safe_walk', label: 'Safe Walk', icon: 'walk-outline' },
    { id: 'open_late', label: 'Open Late', icon: 'time-outline' },
    { id: 'event', label: 'Events', icon: 'calendar-outline' },
  ],
};

function getChipPreset(): { id: string; label: string; icon: string }[] {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return CHIP_PRESETS.morning;
  if (hour >= 11 && hour < 18) return CHIP_PRESETS.day;
  if (hour >= 18 && hour < 23) return CHIP_PRESETS.evening;
  return CHIP_PRESETS.night;
}

const PIN_ICONS: { [key: string]: string } = {
  bathroom: 'water-outline',
  food: 'restaurant-outline',
  pharmacy: 'medical-outline',
  study: 'book-outline',
  coffee: 'cafe-outline',
  parking: 'car-outline',
  safe_walk: 'walk-outline',
  open_late: 'time-outline',
  default: 'location-outline',
};

const PIN_TYPE_COLORS: { [key: string]: string } = {
  bathroom: '#3B82F6',
  food: '#F97316',
  pharmacy: '#EF4444',
  study: '#8B5CF6',
  coffee: '#92400E',
  parking: '#6B7280',
  safe_walk: '#10B981',
  open_late: '#F59E0B',
  default: '#3DDC91',
};

const EVENT_ICONS: { [key: string]: string } = {
  social: 'people-outline',
  academic: 'school-outline',
  sports: 'fitness-outline',
  club: 'flag-outline',
  party: 'beer-outline',
  music: 'musical-notes-outline',
  other: 'calendar-outline',
};

const REPORT_ICONS: { [key: string]: string } = {
  hazard: 'warning-outline',
  food_status: 'restaurant-outline',
  campus_update: 'school-outline',
  safety: 'shield-outline',
  accessibility: 'accessibility-outline',
};
const REPORT_ICON_DEFAULT = 'flag-outline';
const MAP_LONG_PRESS_HINT_KEY = 'hasSeenLongPressHint';
const PIN_MORE_MENU_WIDTH = 244;

import { isEventLive } from '../utils/eventHelpers';
import { usePinSocket } from '../hooks/usePinSocket';
import { cancelContributionReminder, scheduleContributionReminder } from '../hooks/usePushNotifications';
import AnimatedUserMarker from '../components/AnimatedUserMarker';
import PinMarker from '../components/PinMarker';
import ReportMarker from '../components/ReportMarker';
import AnimatedEventMarker from '../components/AnimatedEventMarker';
import ReportModal from '../components/ReportModal';
import ReportsListModal from '../components/ReportsListModal';
import ReportChatModal from '../components/ReportChatModal';
import EventChatModal from '../components/EventChatModal';
import ShareEventModal from '../components/ShareEventModal';

interface MapScreenProps {
  navigation: any;
  route?: any;
  navBarHeight?: number;
}

type SheetContent = 'search' | 'detail' | 'results' | 'eventDetail';
type SelectedPoi = {
  id: string;
  mapboxId: string;
  title: string;
  type: string;
  coordinates: [number, number];
  category?: string;
  address?: string;
  description?: string;
};

function getTurnIcon(instruction: string): keyof typeof Ionicons.glyphMap {
  const t = instruction.toLowerCase();
  if (t.includes('arrive') || t.includes('destination') || t.includes('you have arrived')) return 'location';
  if (t.includes('u-turn') || t.includes('uturn') || t.includes('make a u')) return 'return-up-back';
  if (t.includes('turn left') || t.includes('keep left') || t.includes('bear left') || t.includes('slight left')) return 'arrow-back';
  if (t.includes('turn right') || t.includes('keep right') || t.includes('bear right') || t.includes('slight right')) return 'arrow-forward';
  if (t.includes('merge') || t.includes('ramp') || t.includes('fork')) return 'git-merge';
  if (t.includes('roundabout') || t.includes('rotary')) return 'refresh';
  return 'arrow-up';
}

// ── Route shimmer — isolated component so its 60fps state updates never re-render MapScreen ──
const RouteShimmer = memo(({ routeCoordinates }: { routeCoordinates: number[][] | null }) => {
  const [shimmerPos, setShimmerPos] = useState(0);
  const animRef = useRef(new Animated.Value(0)).current;

  const resampledRoute = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return null;
    const N = 300;
    const cumDist = [0];
    for (let i = 1; i < routeCoordinates.length; i++) {
      const [x1, y1] = routeCoordinates[i - 1];
      const [x2, y2] = routeCoordinates[i];
      cumDist.push(cumDist[i - 1] + Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2));
    }
    const totalLen = cumDist[cumDist.length - 1];
    const result: number[][] = [];
    for (let i = 0; i < N; i++) {
      const target = (i / (N - 1)) * totalLen;
      let seg = 0;
      while (seg < cumDist.length - 2 && cumDist[seg + 1] < target) seg++;
      const segLen = cumDist[seg + 1] - cumDist[seg];
      const t = segLen > 0 ? (target - cumDist[seg]) / segLen : 0;
      const [x1, y1] = routeCoordinates[seg];
      const [x2, y2] = routeCoordinates[seg + 1];
      result.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
    }
    return result;
  }, [routeCoordinates]);

  useEffect(() => {
    if (!resampledRoute) { animRef.setValue(0); return; }
    animRef.setValue(0);
    const loop = Animated.loop(
      Animated.timing(animRef, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: false })
    );
    const id = animRef.addListener(({ value }) => setShimmerPos(value));
    loop.start();
    return () => { loop.stop(); animRef.removeListener(id); };
  }, [resampledRoute]);

  const shimmerShape = useMemo(() => {
    if (!resampledRoute || resampledRoute.length < 2) return null;
    const total = resampledRoute.length;
    const windowSize = Math.max(2, Math.floor(total * 0.15));
    const centerIdx = Math.round(shimmerPos * (total - 1));
    const startIdx = Math.max(0, centerIdx - Math.floor(windowSize / 2));
    const endIdx = Math.min(total - 1, startIdx + windowSize);
    const coords = resampledRoute.slice(startIdx, endIdx + 1);
    if (coords.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: coords },
    };
  }, [shimmerPos, resampledRoute]);

  if (!shimmerShape) return null;
  return (
    <MapboxGL.ShapeSource id="shimmerSource" shape={shimmerShape}>
      <MapboxGL.LineLayer
        id="shimmerLayer"
        style={{
          lineColor: '#FFFFFF',
          lineWidth: 7,
          lineOpacity: 0.7,
          lineCap: 'round',
          lineJoin: 'round',
          lineEmissiveStrength: 1,
        }}
      />
    </MapboxGL.ShapeSource>
  );
});

export default function MapScreen({ navigation, route, navBarHeight = 0 }: MapScreenProps) {
  const { showAlert, showToast } = useAlert();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [pins, setPins] = useState<any[]>([]);
  const [forYouPins, setForYouPins] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedPin, setSelectedPin] = useState<any>(null);
  const [selectedPoi, setSelectedPoi] = useState<SelectedPoi | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [currentSearchType, setCurrentSearchType] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<number[][] | null>(null);
  const [navigationData, setNavigationData] = useState<any>(null);
  const [currentInstruction, setCurrentInstruction] = useState('');
  const [distanceToNextTurn, setDistanceToNextTurn] = useState(0);
  const currentStepIndexRef = useRef(0);
  const [isSaved, setIsSaved] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [verifyChoice, setVerifyChoice] = useState<boolean | null>(null);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportsListModal, setShowReportsListModal] = useState(false);
  const [reportsListContext, setReportsListContext] = useState<
    { pinId: string; lat?: number; lng?: number; pinTitle?: string } | null
  >(null);
  const [pinReports, setPinReports] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [reports, setReports] = useState<any[]>([]);
  const [reportModalContext, setReportModalContext] = useState<{
    lat: number;
    lng: number;
    pinId?: string;
    pinTitle?: string;
  } | null>(null);
  const [sheetContent, setSheetContent] = useState<SheetContent>('search');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [detailSnapOverride, setDetailSnapOverride] = useState<number | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [animatingToSheetIndex, setAnimatingToSheetIndex] = useState<number | null>(null);
  const [eventHeaderHeight, setEventHeaderHeight] = useState<number>(96);
  const [isSheetRaisedPreview, setIsSheetRaisedPreview] = useState(false);
  const [feedFilter, setFeedFilter] = useState<string>('all');
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventData, setSelectedEventData] = useState<any>(null);
  const [eventDetailLoading, setEventDetailLoading] = useState(false);
  const [eventDetailSnapMax, setEventDetailSnapMax] = useState<number>(SHEET_EVENT_MAX);
  const [eventIsSaved, setEventIsSaved] = useState(false);
  const [eventAvgRating, setEventAvgRating] = useState(0);
  const [eventReviewCount, setEventReviewCount] = useState(0);
  const [eventRsvpStatus, setEventRsvpStatus] = useState<'going' | null>(null);
  const [eventRsvpLoading, setEventRsvpLoading] = useState(false);
  const [eventUnreadCounts, setEventUnreadCounts] = useState<Record<string, number>>({});
  const [showEventChat, setShowEventChat] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [showLongPressCoachmark, setShowLongPressCoachmark] = useState(false);
  const [showPinMoreMenu, setShowPinMoreMenu] = useState(false);
  const [isCreatingPoiPin, setIsCreatingPoiPin] = useState(false);
  const pinMoreTranslateY = useRef(new Animated.Value(28)).current;
  const pinMoreOpacity = useRef(new Animated.Value(0)).current;
  const moreButtonRef = useRef<any>(null);
  const [pinMoreAnchor, setPinMoreAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [pinMoreCardHeight, setPinMoreCardHeight] = useState(0);

  const [zoomLevel, setZoomLevel] = useState(14);
  const [mapBearing, setMapBearing] = useState(0);

  // ── New feature state ────────────────────────────────────
  const [weather, setWeather] = useState<{ temp: number; condition: string; ionIcon: string } | null>(null);
  const [happeningNowEvent, setHappeningNowEvent] = useState<any>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerAnim = useRef(new Animated.Value(-80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const compassAnim = useRef(new Animated.Value(0)).current;
  const pullHintArrowAnim = useRef(new Animated.Value(0)).current;
  const pullHintShimmerAnim = useRef(new Animated.Value(0)).current;
  const navArrowAnim = useRef(new Animated.Value(0)).current;
  const navCardFadeAnim = useRef(new Animated.Value(1)).current;
  const navCardSlideAnim = useRef(new Animated.Value(0)).current;
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const celebrationTranslateY = useRef(new Animated.Value(0)).current;

  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  // Track whether we have already flown to the user's first GPS fix so
  // subsequent location updates don't fight the user's manual zoom/pan.
  const cameraInitializedRef = useRef(false);
  const modeRef = useRef<'open_world' | 'campus'>('open_world');
  const bottomSheetRef = useRef<BottomSheet>(null);
  const searchInputRef = useRef<TextInput>(null);
  const recentlyConvertedPoiIdsRef = useRef<Set<string>>(new Set());
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { colors, isDarkMode, loading: themeLoading } = useTheme();
  // Freeze the light preset on first stable theme read to prevent Mapbox
  // from reloading its style mid-render when AsyncStorage resolves.
  const stableLightPreset = useRef<string | null>(null);
  if (!themeLoading && stableLightPreset.current === null) {
    stableLightPreset.current = isDarkMode ? 'night' : 'day';
  }
  const { currentArea, isInCampus, mode, setMode, setLocation } = useArea();
  const { activeGroup } = useGroup();

  const isReportDetailSheet =
    sheetContent === 'detail' &&
    typeof selectedPin?.id === 'string' &&
    selectedPin.id.startsWith('report-');
  const sheetPeek = sheetContent === 'detail' ? SHEET_PEEK_DETAIL : SHEET_PEEK_BASE;
  modeRef.current = mode;
  const isEventDetailSheet = sheetContent === 'eventDetail';
  const isPoiDetailSheet =
    sheetContent === 'detail' && !!selectedPoi && !selectedPin;
  const sheetAnimationConfigs = useBottomSheetSpringConfigs({
    damping: 110,
    stiffness: 900,
    mass: 3,
    overshootClamping: true,
  });

  const snapPoints = useMemo(
    () => (
      isReportDetailSheet
        ? [sheetPeek, SHEET_REPORT_MAX]
        : isEventDetailSheet
          ? [sheetPeek, SHEET_HALF]
          : isPoiDetailSheet
            ? [sheetPeek, SHEET_HALF]
            : [sheetPeek, SHEET_HALF, SHEET_FULL]
    ),
    [sheetPeek, sheetContent, isReportDetailSheet, isEventDetailSheet, isPoiDetailSheet]
  );

  const safeSnapToIndex = useCallback(
    (index: number) => {
      if (!bottomSheetRef.current) return;
      if (!Array.isArray(snapPoints) || snapPoints.length === 0) return;

      // Clamp requested index into the valid snapPoints range to avoid
      // invariant errors when the sheet's configuration changes (e.g. POI detail
      // only exposing a single snap point).
      const maxIndex = snapPoints.length - 1;
      const clampedIndex = Math.max(0, Math.min(index, maxIndex));

      bottomSheetRef.current.snapToIndex(clampedIndex);
    },
    [snapPoints]
  );
  const handleSheetAnimate = useCallback((...args: any[]) => {
    const rawToIndex = args[1];
    const toIndex = typeof rawToIndex === 'number' && Number.isFinite(rawToIndex) ? rawToIndex : null;
    const toPosition = typeof args[3] === 'number' ? args[3] : null;
    const collapsedSheetPosition = height - sheetPeek;
    const isClearlyAboveCollapsed =
      toPosition != null && toPosition < collapsedSheetPosition - SHEET_COLLAPSE_HINT_THRESHOLD;

    if (toIndex != null && toIndex >= 0) {
      setAnimatingToSheetIndex(toIndex);
    } else {
      setAnimatingToSheetIndex(null);
    }
    const shouldBeRaised =
      toIndex === SHEET_INDEX.COLLAPSED
        ? false
        : toIndex != null
          ? toIndex > SHEET_INDEX.COLLAPSED
          : isClearlyAboveCollapsed;
    setIsSheetRaisedPreview((prev) => (prev === shouldBeRaised ? prev : shouldBeRaised));
  }, [sheetPeek]);

  const handleSheetChange = useCallback((index: number) => {
    setSheetIndex(index);
    setAnimatingToSheetIndex(null);
    setIsSheetRaisedPreview(index > SHEET_INDEX.COLLAPSED);
  }, []);
  // Treat the sheet as "expanded" as soon as the drag/animation is heading to
  // a non-collapsed index, and only as collapsed once it has fully settled.
  const isSheetExpandedForContent =
    animatingToSheetIndex != null
      ? animatingToSheetIndex > SHEET_INDEX.COLLAPSED
      : sheetIndex > SHEET_INDEX.COLLAPSED || isSheetRaisedPreview;

  const pullHintArrowTranslateY = pullHintArrowAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -2, 0],
  });

  // Inverted nav arrow for right-turn bounce (positive X instead of negative)
  const navArrowAnimRight = navArrowAnim.interpolate({
    inputRange: [-5, 0],
    outputRange: [5, 0],
  });
  const pullHintTextOpacity = pullHintShimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 1, 0.6],
  });

  useEffect(() => {
    if (isNavigating) return;
    if (sheetContent === 'search' && !selectedPin && !selectedPoi) {
      safeSnapToIndex(SHEET_INDEX.COLLAPSED);
    }
  }, [isNavigating, sheetPeek, sheetContent, selectedPin, selectedPoi]);

  // Resample route into N evenly-spaced points so shimmer moves at consistent speed
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        map: { flex: 1 },

        // Top-right control container (recenter)
        glassControls: {
          position: 'absolute',
          right: spacing.md,
          zIndex: 1,
        },
        // Top-left campus mode control
        campusControl: {
          position: 'absolute',
          left: spacing.md,
          zIndex: 1,
        },
        glassButton: {
          width: 48,
          height: 48,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          ...shadows.lg,
        },
        recenterButton: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          ...shadows.md,
        },
        fab: {
          position: 'absolute',
          right: spacing.md,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.accent,
          justifyContent: 'center',
          alignItems: 'center',
          ...shadows.lg,
        },
        groupFab: {
          position: 'absolute',
          left: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: 9,
          borderRadius: borderRadius.round,
          maxWidth: 180,
          ...shadows.md,
        },
        groupFabLabel: {
          ...typography.caption,
          fontWeight: '600',
          fontSize: 12,
          flexShrink: 1,
        },
        celebrationBubble: {
          position: 'absolute',
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: borderRadius.round,
          backgroundColor: colors.accent,
          ...shadows.lg,
        },
        celebrationText: {
          ...typography.bodySemibold,
          color: '#fff',
          fontSize: 15,
        },
        floatingWeather: {
          position: 'absolute',
          right: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: borderRadius.sm,
          backgroundColor: isDarkMode ? 'rgba(24,24,24,0.88)' : 'rgba(255,255,255,0.92)',
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.md,
        },
        floatingWeatherText: {
          ...typography.bodySmallSemibold,
          color: colors.text,
          fontSize: 12,
        },
        mapLoadingOverlay: {
          position: 'absolute',
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: borderRadius.round,
          backgroundColor: isDarkMode ? 'rgba(24,24,24,0.88)' : 'rgba(255,255,255,0.92)',
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.sm,
        },
        mapLoadingText: {
          ...typography.caption,
          color: colors.textSecondary,
        },

        sheetBackground: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xxl,
          borderTopRightRadius: borderRadius.xxl,
        },
        sheetHandle: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xxl,
          borderTopRightRadius: borderRadius.xxl,
          paddingBottom: 0,
        },
        sheetHandleIndicator: {
          backgroundColor: colors.lightGray,
          width: 36,
          height: 4,
          borderRadius: 2,
        },
        sheetContent: {
          backgroundColor: colors.surface,
          paddingBottom: spacing.sm,
        },
        sheetContentFill: {
          flex: 1,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        sheetScrollBackground: {
          flex: 1,
          backgroundColor: colors.surface,
        },

        // Search pill (Uber style)
        searchSection: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
        },
        searchHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        searchPill: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
          gap: spacing.sm,
        },
        searchPillIcon: {
          width: 24,
          height: 24,
          justifyContent: 'center',
          alignItems: 'center',
        },
        searchInput: {
          flex: 1,
          color: colors.text,
          fontSize: 16,
          fontWeight: '500',
          lineHeight: 20,
          paddingHorizontal: 0,
          paddingVertical: 0,
          textAlignVertical: 'center',
        },
        searchBackButton: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.round,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.xs,
        },
        resultsSearchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        resultsBackButton: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        searchAddButton: {
          width: 44,
          height: 44,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },

        // Campus chip
        campusChip: {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.12)',
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
          borderRadius: borderRadius.round,
          marginTop: spacing.sm,
          marginHorizontal: spacing.md,
          gap: spacing.xs,
        },
        campusChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
        areaStatusRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'nowrap',
          marginTop: spacing.sm,
          marginHorizontal: spacing.md,
          gap: 6,
        },
        areaStatusText: {
          ...typography.caption,
          color: colors.textSecondary,
          fontWeight: '600',
          fontSize: 11,
        },
        areaStatusDot: {
          width: 3,
          height: 3,
          borderRadius: 2,
          backgroundColor: colors.borderDark,
        },

        // Quick action chips
        quickActions: {
          flexDirection: 'row',
          paddingTop: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        quickActionButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceGray,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          borderRadius: borderRadius.md,
          marginRight: spacing.sm,
          gap: spacing.xs,
        },
        quickActionText: {
          ...typography.bodySmallMedium,
          color: colors.text,
        },

        // Search results
        resultsHeader: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        },
        resultsTitle: {
          ...typography.h3,
          color: colors.text,
        },
        resultsSubtitle: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          marginTop: 2,
        },
        resultItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderLight,
        },
        resultIconContainer: {
          width: 44,
          height: 44,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.md,
        },
        resultIconContainerEvent: {
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        },
        resultInfo: { flex: 1 },
        resultTitle: { ...typography.bodySemibold, color: colors.text },
        resultSubtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
        trustBadgeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 6,
          flexWrap: 'wrap',
        },
        trustBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          borderRadius: borderRadius.round,
          borderWidth: 1,
          borderColor: colors.borderLight,
          backgroundColor: colors.surfaceGray,
          paddingHorizontal: 8,
          paddingVertical: 4,
        },
        trustBadgeText: {
          ...typography.caption,
          color: colors.textSecondary,
          fontSize: 10,
          fontWeight: '700',
        },
        emptyState: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
        emptyStateText: { ...typography.h5, color: colors.text, marginTop: spacing.md },
        emptyStateSubtext: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },

        // Nearby feed
        feedSection: {
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.lg,
        },
        feedSectionGroup: {
          marginBottom: spacing.md,
        },
        feedSectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          marginBottom: 4,
          marginTop: spacing.sm,
        },
        feedSectionLabel: {
          ...typography.caption,
          fontWeight: '700',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        feedDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginTop: spacing.sm,
          marginBottom: spacing.md,
        },
        feedTopRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        },
        feedHeading: {
          ...typography.bodySmallSemibold,
          color: colors.text,
          fontSize: 15,
          fontWeight: '700',
        },
        feedCount: {
          ...typography.caption,
          color: colors.textMuted,
          fontSize: 12,
        },
        // Filter chips
        filterRow: {
          marginBottom: spacing.md,
        },
        filterChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: borderRadius.round,
          borderWidth: 1,
          gap: 4,
        },
        filterChipActive: {
          backgroundColor: colors.interactiveBg,
          borderColor: colors.interactiveBg,
        },
        filterChipInactive: {
          backgroundColor: 'transparent',
          borderColor: colors.border,
        },
        filterChipText: {
          ...typography.caption,
          fontWeight: '600',
          fontSize: 12,
        },
        filterChipTextActive: { color: colors.interactiveText },
        filterChipTextInactive: { color: colors.textSecondary },
        feedItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          gap: spacing.md,
        },
        feedItemBorder: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderLight,
        },
        feedIconContainer: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        feedIconContainerEvent: {
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        },
        feedIconContainerReport: {
          backgroundColor: colors.warning + '20',
        },
        feedIconContainerPin: {
          backgroundColor: colors.surfaceGray,
        },
        feedInfo: { flex: 1 },
        feedTitle: { ...typography.bodySmallMedium, color: colors.text },
        feedSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
        feedMeta: { ...typography.caption, color: colors.textMuted, fontSize: 11, marginTop: 2 },
        reportDistanceRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginTop: 4,
        },
        reportDistanceText: {
          ...typography.caption,
          color: colors.warning,
          fontSize: 11,
          fontWeight: '700',
        },
        feedTimeRow: { alignItems: 'flex-end', gap: 4 },
        feedTime: { ...typography.caption, color: colors.textMuted },
        liveDot: {
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: '#EF4444',
        },
        // Skeleton loaders
        skeletonRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          gap: spacing.md,
        },
        skeletonIcon: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.border,
        },
        skeletonInfo: { flex: 1, gap: 6 },
        skeletonTitle: {
          height: 13,
          borderRadius: 6,
          backgroundColor: colors.border,
          width: '65%',
        },
        skeletonSub: {
          height: 11,
          borderRadius: 5,
          backgroundColor: colors.borderLight,
          width: '45%',
        },
        skeletonTime: {
          height: 11,
          width: 32,
          borderRadius: 5,
          backgroundColor: colors.border,
        },
        // Nearby needs prompt
        nearbyNeedsCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginHorizontal: spacing.md,
          // marginTop: spacing.sm,
          marginBottom: spacing.sm,
          backgroundColor: isDarkMode ? 'rgba(40,184,115,0.08)' : 'rgba(40,184,115,0.06)',
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(40,184,115,0.2)' : 'rgba(40,184,115,0.15)',
          borderRadius: borderRadius.lg,
          padding: spacing.sm,
        },
        nearbyNeedsIcon: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(40,184,115,0.12)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        nearbyNeedsText: { ...typography.bodySmallSemibold, color: colors.text, flex: 1 },
        nearbyNeedsSub: { ...typography.caption, color: colors.textSecondary, flex: 1 },

        // Long-press hint
        longPressHint: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.sm,
        },
        longPressHintText: {
          ...typography.caption,
          color: colors.textMuted,
          fontSize: 11,
        },
        pullUpHint: {
          paddingVertical: spacing.sm,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: borderRadius.md,
        },
        pullUpHintContent: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          zIndex: 2,
        },
        pullUpArrows: {
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -1,
        },
        pullUpArrowStacked: {
          marginTop: -8,
        },
        pullUpHintText: {
          ...typography.caption,
          color: colors.textMuted,
          fontSize: 11,
        },

        // ─── Pin detail ───────────────────────────────────────
        detailSection: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.xs,
        },
        detailHeaderTop: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        detailTitleRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.sm,
        },

        // ── Sticky top zone (header + actions, never scrolls) ──
        detailStickyTop: {
          backgroundColor: colors.surface,
        },

        // ── New header layout ──
        detailHeader2: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingHorizontal: spacing.md,
          paddingTop: 14,
          paddingBottom: 10,
          gap: 11,
        },
        detailTypeIconBadge2: {
          width: 48,
          height: 48,
          borderRadius: 13,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
          marginTop: 1,
          position: 'relative',
        },
        detailHeaderBody: {
          flex: 1,
        },
        detailTitle2: {
          fontSize: 19,
          fontWeight: '700' as const,
          color: colors.text,
          lineHeight: 24,
          letterSpacing: -0.3,
        },
        detailMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginTop: 4,
          gap: 4,
        },
        detailMetaChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
        },
        detailMetaStrong: {
          fontSize: 12,
          fontWeight: '600' as const,
          color: colors.text,
          lineHeight: 16,
        },
        detailMetaMuted: {
          fontSize: 12,
          fontWeight: '400' as const,
          color: colors.textMuted,
          lineHeight: 16,
        },
        detailMetaDot: {
          fontSize: 12,
          color: colors.textMuted,
          lineHeight: 16,
          marginHorizontal: 1,
        },

        // ── Action buttons row ──
        detailActionsRow2: {
          flexDirection: 'row',
          paddingHorizontal: spacing.md,
          paddingBottom: 10,
          gap: 7,
        },
        detailRouteButton2: {
          flex: 1.4,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accent,
          height: 42,
          borderRadius: borderRadius.md,
          gap: 6,
        },
        detailRouteButtonText2: {
          fontSize: 14,
          fontWeight: '600' as const,
          color: '#000000',
          lineHeight: 18,
        },
        detailSecondaryBtn2: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceGray,
          height: 46,
          borderRadius: borderRadius.md,
          paddingHorizontal: 10,
          gap: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        detailSecondaryBtnText2: {
          fontSize: 15,
          fontWeight: '500' as const,
          color: colors.text,
          lineHeight: 19,
        },
        detailIconBtn2: {
          width: 42,
          height: 42,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },

        // ── Flat section layout ──
        detailFlatSection: {
          paddingHorizontal: spacing.md,
          paddingTop: 14,
          paddingBottom: 2,
        },
        verifyRow: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        verifyBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 10,
          borderRadius: borderRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
        },
        verifyBtnYes: {
          backgroundColor: colors.accent + '12',
          borderColor: colors.accent + '40',
        },
        verifyBtnNo: {
          backgroundColor: colors.warning + '12',
          borderColor: colors.warning + '40',
        },
        verifyBtnSubmitting: {
          opacity: 0.6,
        },
        verifyBtnYesText: {
          ...typography.captionMedium,
          color: colors.accent,
        },
        verifyBtnNoText: {
          ...typography.captionMedium,
          color: colors.warning,
        },
        verifyDoneRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        verifyDoneText: {
          ...typography.captionMedium,
        },
        detailFlatSectionSpaced: {
          paddingTop: 18,
        },
        detailFlatDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginHorizontal: spacing.md,
        },
        detailFlatLabel: {
          fontSize: 11,
          fontWeight: '700' as const,
          color: colors.textMuted,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.7,
          lineHeight: 15,
          marginBottom: 8,
        },
        detailFlatLabelRow: {
          flexDirection: 'row',
          alignItems: 'baseline',
          marginBottom: 9,
          gap: 6,
        },
        detailFlatLabelCount: {
          fontSize: 11,
          fontWeight: '500' as const,
          color: colors.textMuted,
          lineHeight: 15,
        },
        detailFlatCountBadge: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.round,
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignSelf: 'baseline',
        },
        detailFlatCountBadgeText: {
          fontSize: 11,
          fontWeight: '600' as const,
          color: colors.textSecondary,
          lineHeight: 15,
        },
        detailFlatLabelBtn: {
          marginLeft: 'auto',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        detailFlatLabelBtnText: {
          fontSize: 11,
          fontWeight: '600' as const,
          color: colors.textSecondary,
          lineHeight: 15,
        },
        detailFlatBody: {
          fontSize: 14,
          fontWeight: '400' as const,
          color: colors.textSecondary,
          lineHeight: 21,
        },
        detailFlatEmpty: {
          fontSize: 13,
          fontWeight: '400' as const,
          color: colors.textMuted,
          fontStyle: 'italic' as const,
          lineHeight: 18,
        },
        detailFlatEmptyRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
        },

        // ── Creator row ──
        detailCreatorRow2: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingTop: 16,
          paddingBottom: 4,
          gap: 10,
        },
        detailCreatorAvatar2: {
          width: 36,
          height: 36,
          borderRadius: 18,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        },
        detailCreatorAvatarText2: {
          color: '#fff',
          fontSize: 15,
          fontWeight: '700' as const,
          lineHeight: 18,
        },
        detailCreatorName2: {
          fontSize: 14,
          fontWeight: '600' as const,
          color: colors.text,
          lineHeight: 18,
        },
        detailCreatorSub2: {
          fontSize: 12,
          fontWeight: '400' as const,
          color: colors.textMuted,
          lineHeight: 16,
          marginTop: 1,
        },

        // ── Photo empty state ──
        detailPhotoEmptyRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },

        // ── Reviews row ──
        detailReviewRow2: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 2,
        },
        detailReviewScore2: {
          fontSize: 28,
          fontWeight: '700' as const,
          color: colors.text,
          lineHeight: 32,
          letterSpacing: -0.5,
        },
        detailReviewMid2: {
          flex: 1,
          gap: 3,
        },
        detailReviewStarsRow2: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
        },
        detailReviewCountLabel2: {
          fontSize: 12,
          fontWeight: '400' as const,
          color: colors.textMuted,
          lineHeight: 16,
        },
        detailReviewViewAllBtn2: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
        },
        detailReviewViewAllText2: {
          fontSize: 13,
          fontWeight: '600' as const,
          color: colors.accent,
          lineHeight: 18,
        },

        // ── Save/Share icon buttons in the actions row ──
        detailActionIconBtn: {
          width: 42,
          height: 42,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },

        // ── Detail info rows (building, floor, access notes) ──
        detailInfoRows: {
          overflow: 'hidden',
        },
        detailInfoRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 9,
        },
        detailInfoRowDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
        },
        detailInfoRowIcon: {
          width: 26,
          height: 26,
          borderRadius: 8,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        },
        detailInfoRowText: {
          fontSize: 13,
          fontWeight: '400' as const,
          color: colors.text,
          lineHeight: 18,
          flex: 1,
        },
        detailTypeIconBadge: {
          width: 56,
          height: 56,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
          marginTop: 2,
          position: 'relative',
        },
        detailTypeIconRing: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 16,
          borderWidth: 1.5,
        },
        detailTitleBlock: {
          flex: 1,
        },
        detailTitle: {
          fontSize: 19,
          fontWeight: '700' as const,
          color: colors.text,
          letterSpacing: -0.3,
          lineHeight: 24,
        },

        // ── ABOUT text styles ──
        detailAboutText: {
          ...typography.body,
          color: colors.textSecondary,
          lineHeight: 24,
          fontSize: 15,
        },
        detailAboutEmptyRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        detailAboutEmpty: {
          ...typography.bodySmall,
          color: colors.textMuted,
          fontStyle: 'italic',
        },

        // ── Photo empty state ──
        detailPhotoEmpty: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
        },
        detailPhotoEmptyIcon: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.sm,
          justifyContent: 'center',
          alignItems: 'center',
        },
        detailPhotoEmptyText: {
          ...typography.bodySmall,
          color: colors.textMuted,
        },
        detailPhotoEmptyCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          borderWidth: 1,
          borderColor: colors.border,
          borderStyle: 'dashed',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
        },
        detailPhotoEmptyIconWrap: {
          width: 46,
          height: 46,
          borderRadius: borderRadius.md,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        },
        detailPhotoEmptyTitle: {
          ...typography.bodySmallSemibold,
          color: colors.text,
          marginBottom: 2,
        },
        detailPhotoEmptySubtext: {
          ...typography.caption,
          color: colors.textMuted,
        },

        // ── Padded section label (kept for compat) ──
        detailSectionLabelPadded: {
          ...typography.caption,
          color: colors.textMuted,
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.9,
          textTransform: 'uppercase',
          marginBottom: spacing.xs,
          marginTop: spacing.md,
          paddingHorizontal: spacing.md,
        },
        detailSubRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 6,
          gap: 6,
        },
        detailType: {
          ...typography.bodySmall,
          color: colors.textSecondary,
        },
        detailRatingDot: {
          width: 3,
          height: 3,
          borderRadius: 2,
          backgroundColor: colors.mediumGray,
        },
        detailDistance: {
          ...typography.monoSmall,
          color: colors.textSecondary,
        },
        detailDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginHorizontal: spacing.md,
          marginVertical: spacing.md,
        },

        // ── Expand divider — bottom of sticky zone, top of scroll content ──
        detailExpandDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginTop: 8,
        },

        // ── Photo placeholder (no photos state) ──
        detailPhotoPlaceholder: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderStyle: 'dashed',
        },
        detailPhotoPlaceholderIcon: {
          width: 44,
          height: 44,
          borderRadius: borderRadius.md,
          backgroundColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
        },
        detailPhotoPlaceholderText: {
          ...typography.bodySmall,
          color: colors.textMuted,
        },

        // ── Reviews card ──
        detailReviewCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        detailReviewScoreCol: {
          flex: 1,
          alignItems: 'center',
          gap: 4,
        },
        detailReviewCardDivider: {
          width: StyleSheet.hairlineWidth,
          height: 52,
          backgroundColor: colors.border,
        },
        detailReviewPreviewRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        },
        detailReviewPreviewLeft: {
          flex: 1,
        },
        detailReviewPreviewScoreLine: {
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 6,
          marginBottom: 4,
        },
        detailReviewPreviewBigScore: {
          fontSize: 30,
          fontWeight: '700',
          color: colors.text,
          lineHeight: 34,
        },
        detailReviewPreviewStars: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
        },
        detailReviewPreviewScore: {
          ...typography.bodySmall,
          color: colors.text,
          fontWeight: '700',
          marginLeft: 6,
        },
        detailReviewPreviewCount: {
          ...typography.caption,
          color: colors.textMuted,
          fontWeight: '400',
          marginTop: 2,
        },
        detailReviewViewAll: {
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: spacing.md,
        },
        detailReviewViewAllText: {
          ...typography.caption,
          color: colors.accent,
          fontWeight: '700',
          fontSize: 12,
          textAlign: 'center',
        },
        detailPrimaryActionsRow: {
          flexDirection: 'row',
          paddingHorizontal: spacing.md,
          paddingBottom: 10,
          gap: 7,
        },
        detailRouteButton: {
          flex: 1.4,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.interactiveBg,
          height: 42,
          borderRadius: borderRadius.md,
          gap: 6,
        },
        detailRouteButtonText: {
          fontSize: 14,
          fontWeight: '600' as const,
          color: colors.interactiveText,
          lineHeight: 18,
        },
        detailMoreButton: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceGray,
          height: 42,
          borderRadius: borderRadius.md,
          gap: 6,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        detailMoreButtonText: {
          fontSize: 14,
          fontWeight: '500' as const,
          color: colors.text,
          lineHeight: 18,
        },
        reportDetailCard: {
          marginHorizontal: spacing.md,
          marginTop: spacing.sm,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: spacing.md,
          gap: spacing.sm,
        },
        reportDetailRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        reportDetailLabel: {
          ...typography.caption,
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontSize: 10,
        },
        reportDetailValue: {
          ...typography.bodySmallMedium,
          color: colors.text,
        },
        reportLeadDescription: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xs,
          paddingBottom: spacing.xs,
        },
        reportLeadDescriptionText: {
          ...typography.body,
          color: colors.textSecondary,
          lineHeight: 23,
        },
        pinMoreBackdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.overlayLight,
        },
        pinMoreCard: {
          width: PIN_MORE_MENU_WIDTH,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          ...shadows.xl,
        },
        pinMoreTitleRow: {
          paddingHorizontal: spacing.md - 2,
          paddingTop: spacing.sm + 2,
          paddingBottom: spacing.xs + 2,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        pinMoreTitle: {
          ...typography.bodySmallSemibold,
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontSize: 11,
        },
        pinMoreItem: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md - 2,
          paddingVertical: 11,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
        pinMoreItemLast: {
          borderBottomWidth: 0,
        },
        pinMoreItemDanger: {
          backgroundColor: colors.error + '10',
        },
        pinMoreItemText: {
          ...typography.bodySemibold,
          color: colors.text,
          fontSize: 15,
        },
        pinMoreItemTextDanger: {
          color: colors.error,
        },
        detailActionPrimary: {
          flex: 2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.interactiveBg,
          paddingVertical: 12,
          borderRadius: borderRadius.md,
          gap: spacing.xs,
        },
        detailActionPrimaryText: {
          ...typography.button,
          color: colors.interactiveText,
        },
        detailActionSecondary: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceGray,
          paddingVertical: 12,
          borderRadius: borderRadius.md,
          gap: 4,
        },
        detailActionSecondaryText: {
          ...typography.captionMedium,
          color: colors.text,
        },
        detailReportsSection: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xs,
        },
        detailReportsHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        },
        detailReportsHeading: {
          ...typography.bodySmallSemibold,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontSize: 12,
        },
        detailReportsList: {
          gap: 6,
        },
        detailReportItem: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 9,
          paddingHorizontal: 10,
          gap: 9,
          overflow: 'hidden',
        },
        detailReportIconContainer: {
          width: 32,
          height: 32,
          borderRadius: 8,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        },
        detailReportInfo: {
          flex: 1,
        },
        detailReportContent: { ...typography.bodySmall, color: colors.text, fontWeight: '500', lineHeight: 18 },
        detailReportMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          marginTop: 4,
        },
        detailReportTypePill: {
          backgroundColor: colors.warning + '18',
          borderRadius: borderRadius.round,
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
        detailReportTypePillText: {
          fontSize: 10,
          fontWeight: '600' as const,
          color: colors.warning,
          lineHeight: 14,
        },
        detailReportType: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
        detailReportTime: { ...typography.caption, color: colors.textMuted },
        detailEmptyReportsCTA: {
          gap: spacing.xs,
          marginBottom: spacing.xs,
        },
        detailEmptyState: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
        },
        detailEmptyStateText: {
          ...typography.bodySmall,
          color: colors.textMuted,
        },
        detailFixedFooter: {
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: spacing.md,
          paddingTop: 20,
          paddingBottom: 4,
          backgroundColor: colors.surface,
        },
        detailFixedFooterAbsolute: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        },
        detailReportUnreadBadge: {
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: colors.accent,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 4,
        },
        detailReportUnreadText: {
          ...typography.caption,
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: '700',
        },
        detailReportDeleteBtn: {
          width: 28,
          height: 28,
          borderRadius: borderRadius.round,
          justifyContent: 'center',
          alignItems: 'center',
        },
        detailCreateReportButton: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          height: 42,
          borderRadius: borderRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surfaceGray,
          gap: 6,
        },
        detailCreateReportText: {
          fontSize: 13,
          fontWeight: '500' as const,
          color: colors.textSecondary,
          lineHeight: 17,
        },
        detailImagesSection: {
          paddingHorizontal: spacing.md,
          marginTop: spacing.md,
          gap: spacing.xs,
        },
        detailImagesHeader: {
          ...typography.bodySmallSemibold,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontSize: 12,
        },
        detailImagesScroll: { marginTop: spacing.xs },
        detailImageThumbWrap: {
          width: 190,
          height: 150,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceGray,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        detailImageThumb: {
          width: '100%',
          height: '100%',
          backgroundColor: colors.surfaceGray,
        },
        detailImageThumbOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        detailImageThumbOverlayText: {
          color: '#FFFFFF',
          fontSize: 20,
          fontWeight: '700',
        },
        detailDescription: {
          paddingHorizontal: spacing.md,
          marginTop: spacing.md,
        },
        detailDescriptionText: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          lineHeight: 22,
        },
        detailCloseButton: {
          width: 30,
          height: 30,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 3,
          flexShrink: 0,
        },
        detailHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        },
        detailHeaderLeft: {
          flex: 1,
          paddingRight: spacing.md,
        },
        detailHeaderActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        detailHeaderIconButton: {
          width: 32,
          height: 32,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 2,
        },

        // ── Pin badge row (type + trust) ──
        detailBadgeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          marginTop: spacing.sm,
          flexWrap: 'wrap',
        },
        detailBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
        },
        detailBadgeText: {
          ...typography.caption,
          color: colors.textSecondary,
          fontWeight: '600',
          fontSize: 11,
        },
        detailBadgeVerified: {
          backgroundColor: colors.accent + '18',
        },
        detailBadgeVerifiedText: {
          color: colors.accent,
        },

        // ── Star rating row ──
        detailStarsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          marginTop: 6,
        },
        detailStarsCount: {
          ...typography.caption,
          color: colors.textSecondary,
          marginLeft: 4,
          fontSize: 12,
        },

        // ── Quick stats strip ──
        detailStatsStrip: {
          flexDirection: 'row',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        },
        detailDistanceInfo: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: colors.accent + '18',
          borderWidth: 1,
          borderColor: colors.accent + '35',
          borderRadius: borderRadius.round,
          paddingVertical: 6,
          paddingHorizontal: 10,
        },
        detailDistanceIcon: {
          width: 18,
          height: 18,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accent + '24',
        },
        detailDistanceValue: {
          ...typography.caption,
          color: colors.accent,
          fontWeight: '700',
          fontSize: 11,
        },
        detailStatPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
        },
        detailStatPillText: {
          ...typography.caption,
          color: colors.textSecondary,
          fontWeight: '600',
          fontSize: 11,
        },

        // ── Peek sub-row (collapsed view summary line) ──
        detailPeekRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginTop: 5,
          gap: 4,
        },
        detailPeekText: {
          ...typography.caption,
          color: colors.text,
          fontWeight: '600',
          fontSize: 12,
        },
        detailPeekMuted: {
          ...typography.caption,
          color: colors.textMuted,
          fontSize: 12,
        },
        detailPeekDot: {
          ...typography.caption,
          color: colors.textMuted,
          fontSize: 12,
          marginHorizontal: 1,
        },
        detailTypePill: {
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: borderRadius.round,
        },
        detailTypePillText: {
          fontSize: 11,
          fontWeight: '600' as const,
          lineHeight: 14,
        },

        // ── Section block + label (legacy — kept for compat) ──
        detailSectionBlock: {
          paddingHorizontal: spacing.md,
          marginTop: spacing.md,
        },
        detailSectionLabelRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          marginBottom: spacing.sm,
        },
        detailSectionLabelDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
        },
        detailSectionLabel: {
          fontSize: 11,
          fontWeight: '700' as const,
          color: colors.textMuted,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.7,
          flex: 1,
          lineHeight: 15,
        },
        detailSectionLabelCount: {
          ...typography.caption,
          color: colors.textMuted,
          fontWeight: '500',
          marginLeft: 'auto',
        },
        detailSectionLabelAction: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        detailSectionLabelActionText: {
          ...typography.caption,
          color: colors.textSecondary,
          fontWeight: '600',
          fontSize: 11,
        },
        detailCard: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: spacing.md,
        },

        // ── Creator card ──
        detailCreatorRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        },
        detailCreatorAvatar: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        detailCreatorAvatarText: {
          ...typography.caption,
          color: colors.textSecondary,
          fontWeight: '700',
          fontSize: 11,
        },
        detailCreatorText: {
          ...typography.caption,
          color: colors.textSecondary,
          fontSize: 12,
          flex: 1,
        },
        detailCreatorCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        detailCreatorCardAvatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        },
        detailCreatorCardAvatarText: {
          color: '#fff',
          fontWeight: '700',
          fontSize: 18,
        },
        detailCreatorCardName: {
          ...typography.bodySmallSemibold,
          color: colors.text,
        },
        detailCreatorCardSub: {
          ...typography.caption,
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 2,
        },
        detailCreatorBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        detailCreatorBadgeText: {
          fontSize: 10,
          fontWeight: '500' as const,
          color: colors.textMuted,
          lineHeight: 14,
        },

        // ── Write review CTA (primary) ──
        detailWriteReviewBtn: {
          flex: 1.5,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height: 42,
          borderRadius: borderRadius.md,
          backgroundColor: colors.interactiveBg,
        },
        detailWriteReviewText: {
          fontSize: 14,
          fontWeight: '600' as const,
          color: colors.interactiveText,
          lineHeight: 18,
        },
        detailInlineActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: spacing.md,
          marginTop: spacing.sm,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          overflow: 'hidden',
        },
        detailInlineActionBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingVertical: 11,
        },
        detailInlineActionDivider: {
          width: StyleSheet.hairlineWidth,
          height: 20,
          backgroundColor: colors.border,
        },
        detailInlineActionText: {
          ...typography.caption,
          color: colors.textSecondary,
          fontWeight: '600',
          fontSize: 12,
        },

        // ── Top greeting bar ──
        topBar: {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          zIndex: 100,
        },
        topBarInner: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        topBarPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          backgroundColor: isDarkMode ? 'rgba(24,24,24,0.78)' : 'rgba(255,255,255,0.88)',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: borderRadius.round,
        },
        topBarLeadingIcon: {
          width: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        topBarAvatar: {
          width: 24,
          height: 24,
          borderRadius: 12,
        },
        topBarAvatarFallback: {
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.accent,
          justifyContent: 'center',
          alignItems: 'center',
        },
        topBarAvatarInitial: {
          color: '#fff',
          fontSize: 11,
          fontWeight: '700',
        },
        topBarGreeting: {
          ...typography.caption,
          color: isDarkMode ? '#FFFFFF' : colors.text,
          fontWeight: '700',
          fontSize: 13,
        },
        topBarDivider: {
          width: 1,
          height: 12,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
        },
        topBarPillDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: '#10B981',
        },
        topBarPillText: {
          ...typography.caption,
          color: isDarkMode ? '#A0A0A8' : colors.textSecondary,
          fontWeight: '600',
          fontSize: 12,
        },

        // Navigation overlay
        navigationContainer: {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          zIndex: 1000,
        },
        navigationCard: {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.xl,
          ...shadows.xl,
        },
        navCardContent: {
          padding: spacing.md,
          paddingBottom: spacing.md,
        },
        navigationHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.md,
        },
        navigationIconWrap: {
          width: 54,
          height: 54,
          borderRadius: borderRadius.md,
          backgroundColor: colors.accent,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.md,
          ...shadows.mintGlow,
        },
        navigationInfo: { flex: 1 },
        navigationInstruction: {
          fontSize: 17,
          fontWeight: '700' as const,
          color: colors.text,
          marginBottom: 6,
          lineHeight: 23,
          letterSpacing: -0.2,
        },
        navigationDistanceBadge: {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.accentTint30,
          borderRadius: borderRadius.round,
          paddingHorizontal: 9,
          paddingVertical: 3,
        },
        navigationDistance: {
          ...typography.captionBold,
          color: colors.accent,
        },
        navigationStats: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: spacing.md,
          paddingBottom: spacing.xs,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          gap: spacing.xs,
        },
        stat: { alignItems: 'center', flex: 1 },
        statValue: {
          fontSize: 18,
          fontWeight: '700' as const,
          color: colors.text,
          lineHeight: 22,
        },
        statUnit: {
          fontSize: 13,
          fontWeight: '400' as const,
          color: colors.textSecondary,
        },
        statLabel: {
          ...typography.captionMedium,
          color: colors.textSecondary,
          marginTop: 1,
        },
        navStatsDivider: {
          width: StyleSheet.hairlineWidth,
          height: 32,
          backgroundColor: colors.border,
        },
        navStopBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.error,
          paddingVertical: 10,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.md,
          gap: spacing.xs,
          marginLeft: spacing.xs,
        },
        navStopText: {
          ...typography.buttonSmall,
          color: '#FFFFFF',
        },

        // ── Event detail in sheet ──
        // ── Event detail sheet ──
        evHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
        evHeaderCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
        evHeaderThumb: { width: 86, height: 86, borderRadius: 12, overflow: 'hidden' },
        evHeaderThumbImg: { width: 86, height: 86 },
        evHeaderThumbPlaceholder: { width: 86, height: 86, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
        evHeaderInfo: { flex: 1, paddingTop: 2 },
        evHeaderTitle: { fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 23, letterSpacing: -0.3 },
        evHeaderBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
        evCategoryPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
        evCategoryPillText: { fontSize: 11, fontWeight: '700' },
        evTimeBadge: { backgroundColor: colors.surfaceGray, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
        evTimeBadgeValue: { fontSize: 12, fontWeight: '700', color: colors.text },
        evHeaderDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
        evHeaderDetailText: { ...typography.caption, color: colors.textMuted, fontSize: 12 },
        evSectionSep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight },
        evSection: { paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 4 },
        evSectionLabel: { ...typography.captionBold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
        evOrgRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        evOrgAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
        evOrgName: { ...typography.bodySmallMedium, color: colors.text, fontSize: 14 },
        evOrgSub: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
        evAttendeesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
        evAttendeeAvatar: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.surface },
        evAttendeeAvatarText: { fontSize: 9, fontWeight: '700', color: '#fff' },
        evAttendeeOverflow: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceGray, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.surface },
        evAttendeeOverflowText: { fontSize: 9, fontWeight: '700', color: colors.textSecondary },
        evAttendeeLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 12, marginLeft: 4 },
        evInfoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: spacing.md, gap: 12 },
        evInfoMain: { ...typography.bodySmallMedium, color: colors.text, fontSize: 14 },
        evInfoSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
        evInfoGrid: { flexDirection: 'row', gap: 10 },
        evInfoCard: { backgroundColor: colors.surfaceGray, borderRadius: 14, padding: 12, gap: 6 },
        evInfoCardIconBadge: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
        evInfoCardMain: { ...typography.bodySmallMedium, color: colors.text, fontSize: 13 },
        evInfoCardSub: { ...typography.caption, color: colors.textMuted, fontSize: 12 },
        evCapacitySection: { marginTop: 4 },
        evCapacityLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 12 },
        evCapacityBar: { height: 4, borderRadius: 2, backgroundColor: colors.borderLight, overflow: 'hidden' },
        evCapacityFill: { height: 4, borderRadius: 2 },
        evRecurBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', marginTop: 2 },
        evRecurBadgeText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
        evDesc: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
        evDescText: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 21 },
        evActionStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 14, paddingHorizontal: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
        evActionStripItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
        evActionStripText: { ...typography.bodySmallMedium, color: colors.text, fontSize: 13 },
        evActionStripDivider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.borderDark },
        evActionBtnGroup: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight, paddingTop: 10 },
        evActionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 5 },
        evActionBtnIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceGray, justifyContent: 'center', alignItems: 'center' },
        evActionBtnLabel: { ...typography.caption, color: colors.textSecondary, fontSize: 11, fontWeight: '500' },
        evActionBtnLarge: {
          flex: 1,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        evActionBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, position: 'relative' },
        evActionBtnLargeLabel: { ...typography.bodySmallMedium, color: colors.text, fontSize: 14 },
        evChatUnreadBadge: {
          position: 'absolute',
          top: -4,
          right: -4,
          minWidth: 18,
          paddingHorizontal: 5,
          height: 18,
          borderRadius: 9,
          backgroundColor: colors.error,
          justifyContent: 'center',
          alignItems: 'center',
        },
        evChatUnreadText: {
          ...typography.captionMedium,
          color: colors.textLight,
          fontSize: 10,
        },
        evRsvpBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.interactiveBg, marginTop: spacing.sm },
        evRsvpText: { ...typography.button, color: colors.interactiveText },
        evRsvpDisabled: { opacity: 0.4 },
        evCancelRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
        evRouteBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.accentDark },
        evRouteText: { ...typography.button, color: colors.textLight },
        evCancelBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: colors.surfaceGray },
        evCancelText: { ...typography.button, color: colors.error },
        evCloseBtn: { width: 30, height: 30, borderRadius: borderRadius.round, backgroundColor: colors.surfaceGray, justifyContent: 'center', alignItems: 'center' },
        evLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B98122', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
        evLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
        evLiveBadgeText: { fontSize: 11, fontWeight: '800', color: '#10B981' },
        // ── Weather strip ──
        weatherStrip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.xs,
          gap: spacing.xs,
        },
        weatherText: {
          ...typography.caption,
          color: colors.textSecondary,
          fontWeight: '600',
          fontSize: 12,
        },
        weatherDot: {
          width: 3,
          height: 3,
          borderRadius: 2,
          backgroundColor: colors.borderDark,
        },

        // ── Live activity pulse ──
        activityBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          marginLeft: 'auto' as any,
        },
        activityPulseDot: {
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: '#28B873',
        },
        activityText: {
          ...typography.caption,
          color: colors.textSecondary,
          fontWeight: '600',
          fontSize: 11,
        },

        // ── Vibe chip ──
        vibeChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: borderRadius.round,
          borderWidth: 1,
          borderColor: colors.borderLight,
          alignSelf: 'flex-start',
          marginHorizontal: spacing.md,
          marginTop: spacing.sm,
        },
        vibeText: {
          ...typography.caption,
          fontWeight: '700',
          fontSize: 11,
        },

        // ── Trending section ──
        trendingSection: {
          paddingTop: spacing.md,
        },
        trendingHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          marginBottom: spacing.sm,
          gap: spacing.xs,
        },
        trendingTitle: {
          ...typography.bodySmallSemibold,
          color: colors.text,
          fontSize: 13,
          fontWeight: '700',
        },
        trendingScrollContent: {
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        },
        trendingCard: {
          width: 120,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          padding: spacing.sm,
          gap: 6,
        },
        trendingCardIcon: {
          width: 32,
          height: 32,
          borderRadius: borderRadius.sm,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.surface,
        },
        trendingCardTitle: {
          ...typography.caption,
          color: colors.text,
          fontWeight: '600',
          fontSize: 12,
          lineHeight: 16,
        },
        trendingCardMeta: {
          ...typography.caption,
          color: colors.textMuted,
          fontSize: 10,
        },
        trendingEmptySection: {
          paddingTop: spacing.md,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
        },
        trendingEmptyCard: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        trendingEmptyIconWrap: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.accentTint,
          justifyContent: 'center',
          alignItems: 'center',
        },
        trendingEmptyTextWrap: {
          flex: 1,
        },
        trendingEmptyTitle: {
          ...typography.bodySmall,
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
        },
        trendingEmptySubtext: {
          ...typography.caption,
          fontSize: 12,
          color: colors.textMuted,
          marginTop: 2,
        },

        // ── Happening Now banner ──
        happeningBanner: {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          zIndex: 999,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          paddingVertical: 10,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          ...shadows.lg,
        },
        happeningBannerDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#EF4444',
        },
        happeningBannerText: {
          flex: 1,
          ...typography.bodySmallMedium,
          color: colors.text,
          fontSize: 13,
        },
        happeningBannerSub: {
          ...typography.caption,
          color: colors.textSecondary,
          fontSize: 11,
        },
        happeningBannerClose: {
          padding: 4,
        },
        coachmarkContainer: {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          zIndex: 1001,
        },
        coachmarkCard: {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          ...shadows.lg,
        },
        coachmarkTopRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.xs,
        },
        coachmarkTitle: {
          ...typography.bodySmallSemibold,
          color: colors.text,
        },
        coachmarkText: {
          ...typography.caption,
          color: colors.textSecondary,
          marginBottom: spacing.sm,
        },
        coachmarkButton: {
          alignSelf: 'flex-start',
          backgroundColor: colors.interactiveBg,
          borderRadius: borderRadius.round,
          paddingHorizontal: spacing.md,
          paddingVertical: 7,
        },
        coachmarkButtonText: {
          ...typography.captionMedium,
          color: colors.interactiveText,
        },
        imagePreviewOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.95)',
        },
        imagePreviewBackdrop: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.lg,
        },
        imagePreviewCloseButton: {
          position: 'absolute',
          right: spacing.md,
          width: 36,
          height: 36,
          borderRadius: borderRadius.round,
          backgroundColor: 'rgba(255,255,255,0.14)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        },
        imagePreviewImage: {
          width: width - spacing.lg,
          height: height * 0.72,
        },

        // ── Compass button ──
        compassButton: {
          width: 48,
          height: 48,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          ...shadows.lg,
        },

        clusterBadge: {
          minWidth: 40,
          height: 40,
          paddingHorizontal: 10,
          borderRadius: 20,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: colors.accent,
          ...shadows.sm,
        },
        clusterBadgeEvent: {
          backgroundColor: colors.accent,
          borderColor: colors.accentDark,
        },
        clusterCount: {
          color: colors.accent,
          fontSize: 13,
          fontWeight: '700',
        },
        clusterCountEvent: {
          color: colors.white,
        },
      }),
    [colors]
  );

  // ── Effects ──────────────────────────────────────────────

  useEffect(() => {
    requestLocationPermission();
    const timer = setTimeout(() => {
      safeSnapToIndex(SHEET_INDEX.COLLAPSED);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showPinMoreMenu) return;
    pinMoreTranslateY.setValue(28);
    pinMoreOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(pinMoreTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(pinMoreOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showPinMoreMenu]);

  useEffect(() => {
    if (userLocation) {
      setLocation(userLocation[1], userLocation[0]);
      loadAllNearby();
    }
  }, [userLocation, mode]);

  useFocusEffect(
    useCallback(() => {
      if (userLocation) {
        loadAllNearby();
      }
    }, [userLocation])
  );

  // Real-time pin updates via Socket.IO
  usePinSocket({
    onNewPin: useCallback((pin: any) => {
      setPins((prev) => {
        if (prev.find((p) => p.id === pin.id)) return prev;
        return [...prev, pin];
      });
    }, []),
    onPinDeleted: useCallback((pinId: string) => {
      setPins((prev) => prev.filter((p) => p.id !== pinId));
    }, []),
    enabled: !!user,
  });

  const showPinCelebration = useCallback(() => {
    setCelebrationVisible(true);
    celebrationOpacity.setValue(0);
    celebrationTranslateY.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(celebrationOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(celebrationTranslateY, { toValue: -32, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(900),
      Animated.timing(celebrationOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => setCelebrationVisible(false));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [celebrationOpacity, celebrationTranslateY]);

  // Optimistic UI: add the newly created pin immediately when navigating back from CreatePin
  useEffect(() => {
    const newPin = route?.params?.newPin;
    if (!newPin) return;
    setPins((prev) => {
      if (prev.find((p) => p.id === newPin.id)) return prev;
      return [...prev, newPin];
    });
    showPinCelebration();
    cancelContributionReminder().then(() => scheduleContributionReminder()).catch(() => {});
    const wasFirstPin = ((user as any)?.pinsCreated ?? 0) === 0;
    refreshUser().then(() => {
      if (wasFirstPin) {
        setTimeout(() => showToast('First pin! You earned the First Pin badge.', 'success'), 1600);
      }
    });
    navigation.setParams({ newPin: undefined });
  }, [route?.params?.newPin]);

  // Optimistic UI: add a newly created event immediately when navigating back from CreateEvent
  useEffect(() => {
    const newEvent = route?.params?.newEvent;
    if (!newEvent) return;
    setEvents((prev) => {
      if (prev.find((e) => e.id === newEvent.id)) return prev;
      return [...prev, newEvent];
    });
    // New events start with zero unread count until the server says otherwise
    setEventUnreadCounts((prev) => ({ ...prev, [newEvent.id]: prev[newEvent.id] ?? 0 }));
    navigation.setParams({ newEvent: undefined });
  }, [route?.params?.newEvent]);

  // Optimistic UI: add a newly created standalone report immediately when navigating back
  useEffect(() => {
    const newReport = route?.params?.newReport;
    if (!newReport) return;
    setReports((prev) => {
      if (prev.find((r) => r.id === newReport.id)) return prev;
      return [...prev, newReport];
    });
    navigation.setParams({ newReport: undefined });
  }, [route?.params?.newReport]);

  // When redirected from a 409 duplicate, open the existing pin's detail sheet
  useEffect(() => {
    const highlightId = route?.params?.highlightPinId;
    if (!highlightId) return;
    const existing = pins.find((p) => p.id === highlightId);
    if (existing) {
      setSelectedPin(existing);
    }
    navigation.setParams({ highlightPinId: undefined });
  }, [route?.params?.highlightPinId, pins]);

  useEffect(() => {
    if (!searchQuery.trim() && userLocation && !searching && !currentSearchType) {
      loadAllNearby();
      setSearchResults([]);
    }
  }, [searchQuery, userLocation, searching, currentSearchType]);

  useEffect(() => {
    if (route?.params?.targetLocation && userLocation) {
      const { targetLocation, targetName, startNavigation: shouldStartNav } = route.params;
      const tempPin = {
        id: 'temp-event',
        type: 'event',
        title: targetName || 'Event Location',
        location: { lat: targetLocation.lat, lng: targetLocation.lng },
      };
      setSelectedPoi(null);
      setSelectedPin(tempPin);
      if (shouldStartNav) {
        setTimeout(() => {
          startNavigationToTarget(targetLocation.lng, targetLocation.lat);
        }, 500);
      }
      navigation.setParams({ targetLocation: undefined, targetName: undefined, startNavigation: undefined });
    }
  }, [route?.params?.targetLocation, userLocation]);

  useEffect(() => {
    const targetEventId = route?.params?.targetEventId;
    if (!targetEventId) return;
    openEventDetail(targetEventId);
    navigation.setParams({ targetEventId: undefined });
  }, [route?.params?.targetEventId]);

  useEffect(() => {
    const targetPinId = route?.params?.targetPinId;
    if (!targetPinId) return;
    navigation.setParams({ targetPinId: undefined });
    pinAPI.getById(targetPinId).then((res) => {
      const pin = res?.data?.pin ?? res?.pin ?? res;
      if (pin?.id) setSelectedPin(pin);
    }).catch(() => {});
  }, [route?.params?.targetPinId]);

  useEffect(() => {
    const targetReportId = route?.params?.targetReportId;
    if (!targetReportId) return;
    navigation.setParams({ targetReportId: undefined });
    reportAPI.getById(targetReportId).then((res) => {
      const report = res?.data?.report ?? res?.report ?? res;
      if (report?.id) setSelectedReport(report);
    }).catch(() => {});
  }, [route?.params?.targetReportId]);

  useEffect(() => {
    const loadLongPressHintState = async () => {
      try {
        const hasSeenHint = await AsyncStorage.getItem(MAP_LONG_PRESS_HINT_KEY);
        if (!hasSeenHint) {
          setShowLongPressCoachmark(true);
        }
      } catch {
        setShowLongPressCoachmark(true);
      }
    };
    loadLongPressHintState();
  }, []);

  useEffect(() => {
    // Reset verify state whenever a different pin is opened
    setVerifyStatus('idle');
    setVerifyChoice(null);
  }, [selectedPin?.id]);

  useEffect(() => {
    if (selectedPin && selectedPin.id !== 'temp-event' && !selectedPin.id?.startsWith('report-')) {
      pinContentHeightRef.current = 0;
      loadPinMetadata();
      loadPinReports();
      setSheetContent('detail');
      safeSnapToIndex(detailSnapOverride ?? SHEET_INDEX.HALF);
      setDetailSnapOverride(null);
    } else if (selectedPin) {
      pinContentHeightRef.current = 0;
      setSheetContent('detail');
      safeSnapToIndex(detailSnapOverride ?? SHEET_INDEX.HALF);
      setDetailSnapOverride(null);
    } else if (selectedPoi) {
      pinContentHeightRef.current = 0;
      setIsSaved(false);
      setAverageRating(0);
      setReviewCount(0);
      setPinReports([]);
      setSheetContent('detail');
      // Always open POI detail at the collapsed/peek position (flush to nav bar)
      safeSnapToIndex(SHEET_INDEX.COLLAPSED);
      setDetailSnapOverride(null);
      if (selectedPoi.coordinates) {
        cameraRef.current?.setCamera({
          centerCoordinate: selectedPoi.coordinates,
          zoomLevel: Math.max(zoomLevel, 16),
          animationDuration: 600,
          animationMode: 'easeTo',
          padding: { paddingBottom: sheetPeek + 20, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
        });
      }
    } else {
      setPinReports([]);
      if (sheetContent === 'detail') {
        setSheetContent('search');
        safeSnapToIndex(SHEET_INDEX.COLLAPSED);
      }
      if (detailSnapOverride != null) setDetailSnapOverride(null);
    }
  }, [selectedPin, selectedPoi]);

  // ── Weather fetch ────────────────────────────────────────
  useEffect(() => {
    if (!userLocation) return;
    const fetchWeather = async () => {
      try {
        const [lng, lat] = userLocation;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&temperature_unit=celsius`;
        const res = await fetch(url);
        const data = await res.json();
        const code = data?.current_weather?.weathercode ?? 0;
        const temp = Math.round(data?.current_weather?.temperature ?? 0);
        let condition = 'Clear';
        let ionIcon = 'sunny-outline';
        if (code === 0) { condition = 'Clear'; ionIcon = 'sunny-outline'; }
        else if (code <= 3) { condition = 'Cloudy'; ionIcon = 'partly-sunny-outline'; }
        else if (code <= 48) { condition = 'Foggy'; ionIcon = 'cloud-outline'; }
        else if (code <= 67) { condition = 'Rainy'; ionIcon = 'rainy-outline'; }
        else if (code <= 77) { condition = 'Snowy'; ionIcon = 'snow-outline'; }
        else if (code <= 82) { condition = 'Showers'; ionIcon = 'rainy-outline'; }
        else { condition = 'Stormy'; ionIcon = 'thunderstorm-outline'; }
        setWeather({ temp, condition, ionIcon });
      } catch {
        // silently fail — weather is non-critical
      }
    };
    fetchWeather();
  }, [userLocation]);

  // ── Pulse animation (live activity dot) ──────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);


  // ── Pull-up hint animations ───────────────────────────────
  useEffect(() => {
    const arrowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pullHintArrowAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pullHintArrowAnim, {
          toValue: 2,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const shimmerLoop = Animated.loop(
      Animated.timing(pullHintShimmerAnim, {
        toValue: 1,
        duration: 2800,
        easing: Easing.inOut(Easing.linear),
        useNativeDriver: true,
      }),
      { resetBeforeIteration: true }
    );

    arrowLoop.start();
    shimmerLoop.start();
    return () => {
      arrowLoop.stop();
      shimmerLoop.stop();
      pullHintArrowAnim.setValue(0);
      pullHintShimmerAnim.setValue(0);
    };
  }, []);

  // ── Compass rotation animation ───────────────────────────
  useEffect(() => {
    Animated.timing(compassAnim, {
      toValue: -mapBearing,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [mapBearing]);

  // ── Initial camera fly-to (fires once on first GPS fix) ──
  // Subsequent GPS ticks only update the location puck and the
  // navigation logic — they must NOT move the camera, otherwise
  // the continuous watchPositionAsync calls fight the user's pinch-zoom.
  useEffect(() => {
    if (userLocation && !cameraInitializedRef.current) {
      cameraInitializedRef.current = true;
      cameraRef.current?.setCamera({
        centerCoordinate: userLocation,
        zoomLevel: 14,
        animationDuration: 1500,
        animationMode: 'flyTo',
        padding: { paddingBottom: sheetPeek, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
      });
    }
  }, [userLocation]);

  // Fly to campus when entering campus mode, recenter when leaving.
  useEffect(() => {
    if (mode === 'campus') {
      const CAMPUS_NE: [number, number] = [-76.7440, 18.0230];
      const CAMPUS_SW: [number, number] = [-76.7445, 18.0181];
      cameraRef.current?.fitBounds(CAMPUS_NE, CAMPUS_SW, [60, 40, SHEET_PEEK_BASE + 60, 40], 800);
    } else {
      handleRecenter();
    }
  }, [mode]);


  // ── Happening Now banner ──────────────────────────────────
  const [liveEventCount, setLiveEventCount] = useState(0);
  useEffect(() => {
    const liveEvents = events.filter(
      (e) => e.start_time && e.end_time && isEventLive(e.start_time, e.end_time)
    );
    const liveEvent = liveEvents[0] || null;
    setLiveEventCount(liveEvents.length);
    if (liveEvent && !selectedPin && !selectedPoi && sheetContent === 'search') {
      setHappeningNowEvent(liveEvent);
      setBannerVisible(true);
      Animated.spring(bannerAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    } else {
      Animated.timing(bannerAnim, { toValue: -80, duration: 250, useNativeDriver: true }).start(() => {
        setBannerVisible(false);
        setHappeningNowEvent(null);
      });
    }
  }, [events, selectedPin, selectedPoi, sheetContent]);

  // ── Data Loaders ─────────────────────────────────────────

  const loadPinReports = async () => {
    if (!selectedPin) return;
    const isEvent = selectedPin.type === 'event' || selectedPin.start_time;
    try {
      let fetchedReports: any[] = [];
      if (isEvent) {
        const coords = getCoordinatesFromPin(selectedPin);
        if (!coords) return;
        const response = await reportAPI.getNearby(coords[1], coords[0], 200);
        fetchedReports = response?.data?.reports || [];
      } else {
        const response = await reportAPI.getByPin(selectedPin.id);
        fetchedReports = response?.data?.reports || [];
      }
      setPinReports(fetchedReports);

      // Fetch unread counts for loaded reports
      if (fetchedReports.length > 0) {
        const ids = fetchedReports.map((r: any) => r.id).filter(Boolean);
        reportChatAPI.getUnreadCounts(ids).then(setUnreadCounts).catch(() => {});
      } else {
        setUnreadCounts({});
      }
    } catch {
      setPinReports([]);
      setUnreadCounts({});
    }
  };

  const loadPinMetadata = async () => {
    if (!selectedPin) return;
    if (!user) {
      setIsSaved(false);
      setAverageRating(0);
      setReviewCount(0);
      return;
    }
    try {
      const itemType = selectedPin.type === 'event' || selectedPin.start_time ? 'event' : 'pin';
      try {
        const savedResponse = await savedAPI.checkSaved(itemType, selectedPin.id);
        const isSavedFlag =
          savedResponse?.data?.isSaved ??
          (typeof savedResponse?.isSaved === 'boolean' ? savedResponse.isSaved : false);
        setIsSaved(isSavedFlag);
      } catch (error: any) {
        setIsSaved(false);
      }
      try {
        const reviewsResponse = await reviewAPI.getReviews(itemType, selectedPin.id);
        const rating = reviewsResponse.data?.rating ?? reviewsResponse.rating;
        setAverageRating(rating?.average ?? 0);
        setReviewCount(rating?.count ?? 0);
      } catch {
        setAverageRating(0);
        setReviewCount(0);
      }
    } catch {
      setIsSaved(false);
      setAverageRating(0);
      setReviewCount(0);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 10,
        });
        setUserLocation([location.coords.longitude, location.coords.latitude]);
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
          (newLocation) => {
            setUserLocation([newLocation.coords.longitude, newLocation.coords.latitude]);
          }
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const getAdaptiveRadius = useCallback(
    (kind: 'pins' | 'events' | 'reports' | 'search', queryText?: string) => {
      const normalizedQuery = String(queryText || '').toLowerCase();
      const hasUrgentSignal = /(now|urgent|asap|quick|nearest|closest)/.test(normalizedQuery);
      const campusBase = {
        pins: hasUrgentSignal ? 850 : 1100,
        events: 2500,
        reports: 900,
        search: hasUrgentSignal ? 1400 : 1900,
      };
      const openBase = {
        pins: hasUrgentSignal ? 1700 : 2400,
        events: 5200,
        reports: 2100,
        search: hasUrgentSignal ? 2200 : 3000,
      };

      const base = mode === 'campus' ? campusBase[kind] : openBase[kind];
      return base;
    },
    [mode]
  );

  const loadNearbyPins = async () => {
    if (!userLocation) return;
    try {
      const radius = getAdaptiveRadius('pins');
      const response = await pinAPI.getNearby(userLocation[1], userLocation[0], radius);
      if (response.success) {
        setPins(response.data.pins || []);
      }
    } catch (error) {
      console.error('Error loading pins:', error);
    }
  };

  const loadNearbyEvents = async () => {
    if (!userLocation) return;
    try {
      const radius = getAdaptiveRadius('events');
      const response = await eventAPI.getUpcoming(userLocation[1], userLocation[0], radius);
      if (response.success) {
        const nearbyEvents = response.data.events || [];
        setEvents(nearbyEvents);

        // Fetch unread counts for event chats
        if (user && nearbyEvents.length > 0) {
          const ids = nearbyEvents.map((e: any) => e.id).filter(Boolean);
          eventChatAPI
            .getUnreadCounts(ids)
            .then(setEventUnreadCounts)
            .catch(() => {});
        } else {
          setEventUnreadCounts({});
        }
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const loadNearbyReports = async () => {
    if (!userLocation) return;
    try {
      const radius = getAdaptiveRadius('reports');
      const response = await reportAPI.getNearby(userLocation[1], userLocation[0], radius);
      const loadedReports = response?.data?.reports || response?.reports || [];
      setReports(Array.isArray(loadedReports) ? loadedReports : []);
    } catch {
      setReports([]);
    }
  };

  const loadForYouPins = async () => {
    if (!userLocation) return;
    try {
      const radius = getAdaptiveRadius('pins');
      const response = await pinAPI.getForYou(userLocation[1], userLocation[0], radius);
      if (response.success) {
        setForYouPins((response.data.pins || []).filter(groupFilter));
      }
    } catch {
      // non-critical — fail silently
    }
  };

  const loadAllNearby = async () => {
    if (!userLocation) return;
    setLoadingNearby(true);
    await Promise.all([loadNearbyPins(), loadNearbyEvents(), loadNearbyReports(), loadForYouPins()]);
    setLoadingNearby(false);
  };

  const mapPoiCategoryToPinType = (category?: string) => {
    const normalized = (category || '').toLowerCase();
    if (normalized.includes('cafe') || normalized.includes('coffee')) return 'coffee';
    if (normalized.includes('restaurant') || normalized.includes('food')) return 'food';
    if (normalized.includes('pharmacy') || normalized.includes('drug')) return 'pharmacy';
    if (normalized.includes('parking')) return 'parking';
    if (normalized.includes('library') || normalized.includes('study') || normalized.includes('school')) return 'study';
    if (normalized.includes('toilet') || normalized.includes('bathroom') || normalized.includes('restroom')) return 'bathroom';
    return 'default';
  };

  const normalizePoiFromFeature = (feature: any): SelectedPoi | null => {
    if (!feature || typeof feature !== 'object') return null;
    const properties = feature.properties || {};

    const dynamicNameKey = Object.keys(properties).find((k) => {
      const key = k.toLowerCase();
      return (
        key === 'name' ||
        key.startsWith('name_') ||
        key.includes('name:') ||
        key === 'poi_name' ||
        key === 'title' ||
        key === 'text'
      );
    });
    const name =
      properties.name ||
      properties.name_en ||
      properties.name_en_US ||
      properties['name_en-US'] ||
      properties.poi_name ||
      properties.title ||
      properties.text ||
      (dynamicNameKey ? properties[dynamicNameKey] : undefined);
    if (!name || typeof name !== 'string') return null;

    const layerId = String(
      feature?.layer?.id || feature?.layerID || feature?.sourceLayerID || ''
    ).toLowerCase();
    const sourceLayer = String(
      feature?.layer?.sourceLayer || feature?.sourceLayer || feature?.sourceID || ''
    ).toLowerCase();
    const featureType = String(
      properties.feature_type || properties.class || properties.type || ''
    ).toLowerCase();
    const looksLikePoiLayer = /(poi|place|label|landmark|transit|station|airport|shop|restaurant|cafe|school|hospital)/.test(
      `${layerId} ${sourceLayer} ${featureType}`
    );
    const hasPoiSignal = Boolean(
      properties.mapbox_id ||
      properties.poi ||
      properties.poi_category ||
      properties.category ||
      properties.maki ||
      featureType.includes('poi') ||
      looksLikePoiLayer
    );
    const excludedNonPoiSignals = /(road|street|highway|motorway|rail|water|river|lake|ocean|country|state|city|neighborhood|admin|boundary|landuse)/.test(
      `${featureType} ${String(properties.class || '')} ${String(properties.kind || '')}`.toLowerCase()
    );
    const hasLikelyPlaceName = name.trim().length >= 2 && !excludedNonPoiSignals;
    if (!hasPoiSignal && !hasLikelyPlaceName) return null;

    const coordinates = feature?.geometry?.coordinates || feature?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (isNaN(lng) || isNaN(lat)) return null;

    const mapboxId =
      String(properties.mapbox_id || properties.id || `${name}-${lng.toFixed(5)}-${lat.toFixed(5)}`);
    const category = String(
      properties.class ||
      properties.kind ||
      properties.category ||
      properties.poi_category ||
      properties.type ||
      properties.maki ||
      'point_of_interest'
    );
    const address =
      properties.full_address ||
      properties.address ||
      properties.place_formatted ||
      properties.place_name ||
      '';

    return {
      id: `poi-${mapboxId}`,
      mapboxId,
      title: name,
      type: mapPoiCategoryToPinType(category),
      category,
      coordinates: [lng, lat],
      address,
      description: address ? `Mapbox place: ${address}` : undefined,
    };
  };

  const fetchPoiFromTapCoordinate = async (coordinates: [number, number]) => {
    const token = MAPBOX_TOKEN;
    if (!token) return null;
    const [lng, lat] = coordinates;
    if (isNaN(lng) || isNaN(lat)) return null;
    try {
      // Primary: Tilequery API — queries vector tiles directly, works globally including Jamaica.
      const tileUrl =
        `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${lng},${lat}.json` +
        `?radius=30&limit=10&dedupe&geometry=point&access_token=${token}`;
      const tileRes = await fetch(tileUrl);
      if (tileRes.ok) {
        const tileJson = await tileRes.json();
        const tileFeatures = Array.isArray(tileJson?.features) ? tileJson.features : [];
        const poiFeature = tileFeatures.find((f: any) => {
          const name = f?.properties?.name || f?.properties?.name_en;
          const cls = String(f?.properties?.class || '').toLowerCase();
          const type = String(f?.properties?.type || '').toLowerCase();
          const isRoad = /(service|street|road|highway|motorway|rail|water|building)/.test(`${cls} ${type}`);
          return name && !isRoad;
        });
        if (poiFeature) {
          const coords = poiFeature?.geometry?.coordinates;
          const name = poiFeature?.properties?.name || poiFeature?.properties?.name_en;
          const category = String(poiFeature?.properties?.class || poiFeature?.properties?.type || 'point_of_interest');
          const mapboxId = String(poiFeature?.properties?.id || `tile-${lng}-${lat}`);
          if (name && Array.isArray(coords) && coords.length >= 2) {
            return {
              id: `poi-${mapboxId}`,
              mapboxId,
              title: name,
              type: mapPoiCategoryToPinType(category),
              category,
              coordinates: [Number(coords[0]), Number(coords[1])] as [number, number],
              address: '',
              description: undefined,
            } as SelectedPoi;
          }
        }
      }

      // Fallback: Search Box API v1 reverse (better coverage in US/Europe).
      const v1Url =
        `https://api.mapbox.com/search/searchbox/v1/reverse` +
        `?longitude=${lng}&latitude=${lat}&types=poi&limit=1&access_token=${token}`;
      const v1Res = await fetch(v1Url);
      if (v1Res.ok) {
        const v1Json = await v1Res.json();
        const v1Feature = Array.isArray(v1Json?.features) ? v1Json.features[0] : null;
        if (v1Feature) {
          const coords = v1Feature?.geometry?.coordinates;
          const title = v1Feature?.properties?.name;
          if (title && Array.isArray(coords) && coords.length >= 2) {
            const poiCategory = Array.isArray(v1Feature?.properties?.poi_category)
              ? v1Feature.properties.poi_category[0]
              : v1Feature?.properties?.feature_type || 'point_of_interest';
            const mapboxId = String(v1Feature?.properties?.mapbox_id || `reverse-${lng}-${lat}`);
            const address = v1Feature?.properties?.full_address || v1Feature?.properties?.place_formatted || '';
            return {
              id: `poi-${mapboxId}`,
              mapboxId,
              title,
              type: mapPoiCategoryToPinType(String(poiCategory)),
              category: String(poiCategory),
              coordinates: [Number(coords[0]), Number(coords[1])] as [number, number],
              address,
              description: address ? `Mapbox place: ${address}` : undefined,
            } as SelectedPoi;
          }
        }
      }

      // Last resort: Geocoding v5.
      const geoUrl =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
        `?types=poi&limit=1&access_token=${token}`;
      const geoRes = await fetch(geoUrl);
      const geoJson = await geoRes.json();
      const feature = Array.isArray(geoJson?.features) ? geoJson.features[0] : null;
      if (feature) {
        const coords = feature?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          const title = feature?.text || feature?.place_name?.split(',')[0];
          const category = feature?.properties?.category || feature?.place_type?.[0] || 'point_of_interest';
          if (title) {
            return {
              id: `poi-${feature.id}`,
              mapboxId: String(feature.id),
              title,
              type: mapPoiCategoryToPinType(String(category)),
              category: String(category),
              coordinates: [Number(coords[0]), Number(coords[1])] as [number, number],
              address: feature?.place_name || '',
              description: undefined,
            } as SelectedPoi;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const getTapCoordinates = (e: any): [number, number] | null => {
    const fromGeometry = e?.geometry?.coordinates;
    if (Array.isArray(fromGeometry) && fromGeometry.length >= 2) {
      const lng = Number(fromGeometry[0]);
      const lat = Number(fromGeometry[1]);
      if (!isNaN(lng) && !isNaN(lat)) return [lng, lat];
    }
    const fromRoot = e?.coordinates;
    if (Array.isArray(fromRoot) && fromRoot.length >= 2) {
      const lng = Number(fromRoot[0]);
      const lat = Number(fromRoot[1]);
      if (!isNaN(lng) && !isNaN(lat)) return [lng, lat];
    }
    const featureCoords = e?.feature?.geometry?.coordinates;
    if (Array.isArray(featureCoords) && featureCoords.length >= 2) {
      const lng = Number(featureCoords[0]);
      const lat = Number(featureCoords[1]);
      if (!isNaN(lng) && !isNaN(lat)) return [lng, lat];
    }
    const firstFeatureCoords = Array.isArray(e?.features)
      ? e.features?.[0]?.geometry?.coordinates
      : null;
    if (Array.isArray(firstFeatureCoords) && firstFeatureCoords.length >= 2) {
      const lng = Number(firstFeatureCoords[0]);
      const lat = Number(firstFeatureCoords[1]);
      if (!isNaN(lng) && !isNaN(lat)) return [lng, lat];
    }
    return null;
  };

  // ── Handlers ─────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim() || !userLocation) return;
    Keyboard.dismiss();
    setSearching(true);
    try {
      const recommendationResponse = await recommendationAPI.getRecommendations({
        query: searchQuery,
        location: { lat: userLocation[1], lng: userLocation[0] },
        radius: getAdaptiveRadius('search', searchQuery),
        mode,
      });

      if (recommendationResponse.success) {
        const recommendations = recommendationResponse.data?.recommendations || [];
        const mappedResults = recommendations
          .map((rec: any) => {
            const sourceItem = rec?.item;
            if (!sourceItem || typeof sourceItem !== 'object') return null;
            return {
              ...sourceItem,
              distance_meters:
                typeof sourceItem.distance_meters === 'number'
                  ? sourceItem.distance_meters
                  : rec.distanceMeters,
              _recommendation: rec,
            };
          })
          .filter(Boolean);

        const recommendedPins = recommendations
          .filter((rec: any) => rec?.kind === 'pin' && rec?.item)
          .map((rec: any) => rec.item);
        const recommendedEvents = recommendations
          .filter((rec: any) => rec?.kind === 'event' && rec?.item)
          .map((rec: any) => rec.item);

        setPins(recommendedPins);
        setEvents(recommendedEvents);
        setSearchResults(mappedResults);
        setSheetContent('results');
      safeSnapToIndex(SHEET_INDEX.HALF);

        if (mappedResults.length > 0) {
          const coords = getCoordinatesFromPin(mappedResults[0]);
          if (coords) {
            cameraRef.current?.setCamera({
              centerCoordinate: coords,
              zoomLevel: 15,
              animationDuration: 1000,
              padding: { paddingBottom: sheetPeek, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
            });
          }
        }
        return;
      }

      throw new Error('Recommendations unavailable');
    } catch (error) {
      try {
        const response = await searchAPI.search(
          searchQuery,
          { lat: userLocation[1], lng: userLocation[0] },
          getAdaptiveRadius('search', searchQuery)
        );
        if (response.success) {
          setPins(response.data.results.pins || []);
          setEvents(response.data.results.events || []);
          const allResults = [...(response.data.results.pins || []), ...(response.data.results.events || [])];
          setSearchResults(allResults);
          setSheetContent('results');
          safeSnapToIndex(SHEET_INDEX.HALF);
          if (response.data.results.pins?.length > 0) {
            const firstPin = response.data.results.pins[0];
            const coords = getCoordinatesFromPin(firstPin);
            if (coords) {
              cameraRef.current?.setCamera({
                centerCoordinate: coords,
                zoomLevel: 15,
                animationDuration: 1000,
                padding: { paddingBottom: sheetPeek, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
              });
            }
          }
          return;
        }
      } catch {
        // Handled below with toast
      }
      console.error('Search error:', error);
      showToast('Search failed. Please try again.', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleQuickAction = async (type: string) => {
    const queryLabel = type === 'safe_walk' ? 'safe walk' : type === 'open_late' ? 'open late' : type;
    setSearchQuery(queryLabel);
    if (!userLocation) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearching(true);
    setCurrentSearchType(type);
    try {
      if (type === 'safe_walk' || type === 'open_late') {
        const response = await searchAPI.search(
          queryLabel,
          { lat: userLocation[1], lng: userLocation[0] },
          getAdaptiveRadius('search', queryLabel)
        );
        if (response.success) {
          const pinsList = response.data.results?.pins || [];
          const eventsList = response.data.results?.events || [];
          setPins(pinsList);
          setEvents(eventsList);
          setSearchResults([...pinsList, ...eventsList]);
          setSheetContent('results');
          safeSnapToIndex(SHEET_INDEX.HALF);
        }
      } else if (type === 'event') {
        const response = await eventAPI.getUpcoming(userLocation[1], userLocation[0], getAdaptiveRadius('events'));
        if (response.success) {
          const results = response.data.events || [];
          setEvents(results);
          setSearchResults(results);
          setSheetContent('results');
          safeSnapToIndex(SHEET_INDEX.HALF);
        }
      } else {
        const response = await searchAPI.searchPins({
          lat: userLocation[1],
          lng: userLocation[0],
          radius: getAdaptiveRadius('pins', queryLabel),
          type,
        });
        if (response.success) {
          const results = response.data.pins || [];
          setPins(results);
          setSearchResults(results);
          setSheetContent('results');
          safeSnapToIndex(SHEET_INDEX.HALF);
        }
      }
    } catch (error) {
      console.error('Quick action error:', error);
      showToast('Could not load those results. Try again.', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (item: any) => {
    const isEvent = item.category && item.start_time;
    if (isEvent) {
      openEventDetail(item.id, getCoordinatesFromEvent(item));
    } else {
      setDetailSnapOverride(SHEET_INDEX.COLLAPSED);
      setSelectedPoi(null);
      setSelectedPin(item);
      const coords = getCoordinatesFromPin(item);
      if (coords) {
        cameraRef.current?.setCamera({
          centerCoordinate: coords,
          zoomLevel: 16,
          animationDuration: 800,
          animationMode: 'easeTo',
          padding: { paddingBottom: SHEET_PEEK_DETAIL, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
        });
      }
    }
  };

  const handleSearchPillPress = () => {
    setIsSearchFocused(true);
    setSheetContent('search');
    safeSnapToIndex(SHEET_INDEX.FULL);
    setTimeout(() => searchInputRef.current?.focus(), 150);
  };

  const handleSearchBack = () => {
    setIsSearchFocused(false);
    Keyboard.dismiss();
    setSearchQuery('');
    setCurrentSearchType('');
    setSearchResults([]);
    setSheetContent('search');
    safeSnapToIndex(SHEET_INDEX.COLLAPSED);
    if (userLocation) {
      loadAllNearby();
    }
  };

  const handleMapPress = async (e: any) => {
    let renderedFeatures: any[] = [];
    const screenX = e?.properties?.screenPointX;
    const screenY = e?.properties?.screenPointY;
    if (screenX != null && screenY != null && mapRef.current) {
      try {
        // Explicitly query the POI/label layers in Mapbox Standard style.
        const POI_LAYERS = ['poi-label', 'transit-label', 'airport-label', 'landmark-icon'];
        const result = await mapRef.current.queryRenderedFeaturesAtPoint(
          [screenX, screenY],
          [],
          POI_LAYERS
        );
        renderedFeatures = Array.isArray(result?.features) ? result.features : [];
      } catch {
        // fall through to tilequery fallback
      }
    }

    const features = Array.isArray(e?.features) ? e.features : [];
    // Prioritise rendered features (direct tile query) over press-event features
    const allFeatures = [...renderedFeatures, ...features];
    const featureCandidates = [e?.feature, ...allFeatures, e];
    const sortedCandidates = featureCandidates
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const aProps = a?.properties || {};
        const bProps = b?.properties || {};
        const aScore =
          Number(!!aProps.mapbox_id) * 4 +
          Number(!!aProps.poi) * 3 +
          Number(!!aProps.poi_category || !!aProps.category) * 2 +
          Number(!!aProps.maki) * 1;
        const bScore =
          Number(!!bProps.mapbox_id) * 4 +
          Number(!!bProps.poi) * 3 +
          Number(!!bProps.poi_category || !!bProps.category) * 2 +
          Number(!!bProps.maki) * 1;
        return bScore - aScore;
      });
    const tappedPoi =
      sortedCandidates
        .map(normalizePoiFromFeature)
        .find((poi) => !!poi) || null;
    if (tappedPoi) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedPin(null);
      setSelectedPoi(tappedPoi);
      setIsSearchFocused(false);
      Keyboard.dismiss();
      return;
    }
    const fallbackCoords = getTapCoordinates(e);
    if (fallbackCoords) {
      const [lng, lat] = fallbackCoords;
      const fromReverse = await fetchPoiFromTapCoordinate([lng, lat]);
      if (fromReverse) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedPin(null);
        setSelectedPoi(fromReverse);
        setIsSearchFocused(false);
        Keyboard.dismiss();
        return;
      }
      if (selectedPin || selectedPoi) {
        setSelectedPin(null);
        setSelectedPoi(null);
      }
      setIsSearchFocused(false);
      Keyboard.dismiss();
      setSheetContent('search');
      safeSnapToIndex(SHEET_INDEX.COLLAPSED);
      return;
    }
    if (selectedPin || selectedPoi) {
      setSelectedPin(null);
      setSelectedPoi(null);
    }
    setIsSearchFocused(false);
    Keyboard.dismiss();
    setSheetContent('search');
    safeSnapToIndex(SHEET_INDEX.COLLAPSED);
  };

  const handleMapLongPress = (e: any) => {
    const coords = e?.geometry?.coordinates;
    if (!coords || coords.length < 2) return;
    const [lng, lat] = coords;
    AsyncStorage.setItem(MAP_LONG_PRESS_HINT_KEY, 'true').catch(() => {});
    setShowLongPressCoachmark(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPoi(null);
    navigation.navigate('SelectType', {
      prefillLocation: { lat, lng },
    });
  };

  const handleRecenter = () => {
    if (userLocation) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      cameraRef.current?.setCamera({
        centerCoordinate: userLocation,
        zoomLevel: 14,
        animationDuration: 800,
        animationMode: 'easeTo',
        padding: { paddingBottom: SHEET_PEEK_BASE, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
      });
    }
  };

  const startNavigationToTarget = async (lng: number, lat: number) => {
    if (!userLocation) return;
    try {
        const start = `${userLocation[0]},${userLocation[1]}`;
      const end = `${lng},${lat}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${start};${end}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const r = data.routes[0];
        setRouteCoordinates(r.geometry.coordinates);
        setNavigationData(r);
        currentStepIndexRef.current = 0;
        setIsNavigating(true);
        setSelectedPin(null);
        setSelectedPoi(null);
        bottomSheetRef.current?.close();
        if (r.legs[0]?.steps[0]) {
          setCurrentInstruction(r.legs[0].steps[0].maneuver.instruction);
          setDistanceToNextTurn(r.legs[0].steps[0].distance);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Fit the camera to the full route by computing the bounding box from all
        // coordinates rather than just start/end — handles curved routes.
        // Delay slightly so the sheet finishes collapsing before the camera moves.
        const coords = r.geometry.coordinates as number[][];
        const routeLngs = coords.map((c: number[]) => c[0]);
        const routeLats = coords.map((c: number[]) => c[1]);
        const routeMinLng = Math.min(...routeLngs);
        const routeMaxLng = Math.max(...routeLngs);
        const routeMinLat = Math.min(...routeLats);
        const routeMaxLat = Math.max(...routeLats);
        setTimeout(() => {
          cameraRef.current?.fitBounds(
            [routeMaxLng, routeMaxLat],
            [routeMinLng, routeMinLat],
            [80, 60, SHEET_PEEK_BASE + 70, 60],
            1200
          );
        }, 350);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      showToast('Unable to start directions right now.', 'error');
    }
  };

  const startNavigation = async () => {
    if (!userLocation) return;
    const activeDetail = selectedPin || selectedPoi;
    if (!activeDetail) return;
    const pinCoords = selectedPoi ? selectedPoi.coordinates : getCoordinatesFromPin(selectedPin);
    if (!pinCoords) return;
    await startNavigationToTarget(pinCoords[0], pinCoords[1]);
  };

  const haversineDistance = useCallback((lng1: number, lat1: number, lng2: number, lat2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  useEffect(() => {
    if (!isNavigating || !userLocation || !navigationData) return;
    const steps = navigationData.legs?.[0]?.steps;
    if (!steps || steps.length === 0) return;

    const stepIdx = currentStepIndexRef.current;
    const currentStep = steps[stepIdx];
    if (!currentStep) return;

    const turnLng = currentStep.maneuver.location[0];
    const turnLat = currentStep.maneuver.location[1];
    const dist = haversineDistance(userLocation[0], userLocation[1], turnLng, turnLat);

    setDistanceToNextTurn(Math.round(dist));

    if (dist < 20 && stepIdx + 1 < steps.length) {
      const nextIdx = stepIdx + 1;
      currentStepIndexRef.current = nextIdx;
      setCurrentInstruction(steps[nextIdx].maneuver.instruction);
      setDistanceToNextTurn(steps[nextIdx].distance);
    }
  }, [userLocation, isNavigating, navigationData, haversineDistance]);

  // Bounce the direction arrow continuously while navigating
  useEffect(() => {
    if (!isNavigating) {
      navArrowAnim.setValue(0);
      return;
    }
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(navArrowAnim, { toValue: -5, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(navArrowAnim, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(300),
      ])
    );
    bounce.start();
    return () => bounce.stop();
  }, [isNavigating, navArrowAnim]);

  // Slide + fade the card in whenever the instruction changes
  useEffect(() => {
    if (!currentInstruction) return;
    navCardFadeAnim.setValue(0);
    navCardSlideAnim.setValue(10);
    Animated.parallel([
      Animated.timing(navCardFadeAnim, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(navCardSlideAnim, { toValue: 0, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [currentInstruction, navCardFadeAnim, navCardSlideAnim]);

  const stopNavigation = () => {
    setIsNavigating(false);
    setRouteCoordinates(null);
    setNavigationData(null);
    setCurrentInstruction('');
    setDistanceToNextTurn(0);
    currentStepIndexRef.current = 0;
    safeSnapToIndex(SHEET_INDEX.COLLAPSED);
    if (userLocation) {
      cameraRef.current?.setCamera({
        centerCoordinate: userLocation,
        zoomLevel: 14,
        animationDuration: 1000,
        padding: { paddingBottom: sheetPeek, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
      });
    }
  };

  const handleToggleSave = async () => {
    if (!selectedPin) return;
    if (!user) {
      showToast('Please log in to save items', 'info');
      return;
    }
    const itemType = selectedPin.type === 'event' || selectedPin.start_time ? 'event' : 'pin';
    try {
      if (isSaved) {
        await savedAPI.unsaveItem(itemType, selectedPin.id);
        setIsSaved(false);
        showToast('Item removed from saved');
      } else {
        await savedAPI.saveItem(itemType, selectedPin.id);
        setIsSaved(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Item saved successfully!', 'success');
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        showAlert('Session Expired', 'Please log in again', [
          { text: 'Log In', onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        showToast('Failed to save item', 'error');
      }
    }
  };

  const handleDeletePin = async () => {
    if (!selectedPin || !user || selectedPin.user_id !== user.id) return;
    showAlert('Delete Pin', 'Are you sure you want to delete this pin?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await pinAPI.delete(selectedPin.id);
            setPins(pins.filter((p) => p.id !== selectedPin.id));
            setSelectedPin(null);
            showToast('Pin deleted', 'success');
          } catch {
            showToast('Failed to delete pin', 'error');
          }
        },
      },
    ]);
  };

  const handleViewReviews = () => {
    if (!selectedPin) return;
    const itemType = selectedPin.type === 'event' || selectedPin.start_time ? 'event' : 'pin';
    navigation.navigate('ItemReviews', {
      itemType,
      itemId: selectedPin.id,
      itemTitle: selectedPin.title,
      itemCategory: selectedPin.type || undefined,
    });
  };

  const handleVerifyPin = async (isAccurate: boolean) => {
    if (!selectedPin || selectedPin.id?.startsWith('report-')) return;
    if (!user) { showToast('Log in to verify pins', 'info'); return; }
    setVerifyChoice(isAccurate);
    setVerifyStatus('submitting');
    try {
      await pinAPI.verify(selectedPin.id, isAccurate);
      setVerifyStatus('done');
      showToast(isAccurate ? '+2 rep — thanks for verifying!' : 'Got it, thanks for the update', 'success');
      refreshUser();
    } catch {
      setVerifyStatus('idle');
      setVerifyChoice(null);
      showToast('Could not submit — try again', 'error');
    }
  };

  const handleWriteReview = () => {
    if (!selectedPin) return;
    if (!user) {
      showToast('Please log in to write a review', 'info');
      return;
    }
    const itemType = selectedPin.type === 'event' || selectedPin.start_time ? 'event' : 'pin';
    const itemId = selectedPin.id;
    const itemTitle = selectedPin.title;
    setSelectedPin(null);
    setTimeout(() => {
      navigation.navigate('CreateReview', { itemType, itemId, itemTitle });
    }, 300);
  };

  const handleSharePin = async () => {
    if (!selectedPin) return;
    const typeLabel = (selectedPin.type || 'pin').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    const deepLink = `https://traverseapp.com?targetPinId=${selectedPin.id}`;
    const message = [
      `📍 ${selectedPin.title}`,
      typeLabel,
      selectedPin.description ? selectedPin.description.substring(0, 100) : null,
      `View on Traverse: ${deepLink}`,
    ].filter(Boolean).join('\n');
    try {
      await Share.share({ message, title: selectedPin.title, url: deepLink });
    } catch {
      showToast('Could not open the share sheet.', 'error');
    }
  };

  const handleMorePinActions = () => {
    if (!selectedPin || selectedPin.id?.startsWith('report-')) return;
    const openWithAnchor = (anchor: { x: number; y: number; width: number; height: number }) => {
      // Reset cached size so each open can reflow to current item count/content.
      setPinMoreCardHeight(0);
      setPinMoreAnchor(anchor);
      requestAnimationFrame(() => setShowPinMoreMenu(true));
    };
    if (moreButtonRef.current?.measureInWindow) {
      moreButtonRef.current.measureInWindow((x, y, measuredWidth, measuredHeight) => {
        openWithAnchor({ x, y, width: measuredWidth, height: measuredHeight });
      });
      return;
    }
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((
        _x: number,
        _y: number,
        measuredWidth: number,
        measuredHeight: number,
        pageX: number,
        pageY: number
      ) => {
        openWithAnchor({ x: pageX, y: pageY, width: measuredWidth, height: measuredHeight });
      });
      return;
    }
    // If we cannot measure the trigger, avoid opening at a detached fallback position.
    showToast('Could not open more options right now.', 'error');
  };

  const closePinMoreMenu = (onClosed?: () => void) => {
    Animated.parallel([
      Animated.timing(pinMoreTranslateY, {
        toValue: 28,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(pinMoreOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowPinMoreMenu(false);
      onClosed?.();
    });
  };

  const handleAddReportFromPin = () => {
    if (!selectedPin) return;
    const coords = getCoordinatesFromPin(selectedPin);
    if (!coords) return;
    const pinId = selectedPin.id !== 'temp-event' ? selectedPin.id : undefined;
    const pinTitle = selectedPin.title;
    const location = { lat: coords[1], lng: coords[0] };
    closePinMoreMenu(() => {
      setSelectedPin(null);
      setTimeout(() => {
        navigation.navigate('CreateReport', { location, pinId, pinTitle });
      }, 300);
    });
  };

  const handleAddPoiToCommunity = async () => {
    if (!selectedPoi || isCreatingPoiPin) return;
    if (recentlyConvertedPoiIdsRef.current.has(selectedPoi.mapboxId)) {
      showToast('This place was already added in this session.', 'success');
      return;
    }

    try {
      setIsCreatingPoiPin(true);
      const [rawLng, rawLat] = selectedPoi.coordinates;
      const lng = Number(rawLng);
      const lat = Number(rawLat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        showToast('Could not add this place: location was invalid.', 'error');
        return;
      }
      const allowedPinTypes = [
        'bathroom',
        'food',
        'pharmacy',
        'study',
        'charging',
        'coffee',
        'parking',
        'safe_walk',
        'open_late',
        'other',
      ] as const;
      const rawType = (selectedPoi.type || '').toLowerCase();
      const normalizedType =
        allowedPinTypes.find((t) => t === rawType) ??
        // very lightweight mapping from common POI categories → our enum
        (rawType.includes('cafe') || rawType.includes('coffee')
          ? 'coffee'
          : rawType.includes('restaurant') || rawType.includes('food')
            ? 'food'
            : rawType.includes('pharmacy') || rawType.includes('drug')
              ? 'pharmacy'
              : rawType.includes('bathroom') || rawType.includes('toilet') || rawType.includes('restroom')
                ? 'bathroom'
                : 'other');
      const rawTitle = selectedPoi.title || 'Untitled Place';
      const rawDescription = selectedPoi.description || undefined;
      const title = rawTitle.length > 80 ? rawTitle.slice(0, 80) : rawTitle;
      const description =
        typeof rawDescription === 'string' && rawDescription.length > 500
          ? rawDescription.slice(0, 500)
          : rawDescription;

      const baseTags: string[] = ['source:mapbox-poi'];
      if (selectedPoi.mapboxId) {
        baseTags.push(`mapbox_id:${selectedPoi.mapboxId}`);
      }
      const tags = baseTags.map((t) => (t.length > 50 ? t.slice(0, 50) : t)).slice(0, 10);

      const payload = {
        location: { lat, lng },
        type: normalizedType,
        title,
        description,
        tags,
        ...(activeGroup ? { groupId: activeGroup.id } : {}),
      };
      const response = await pinAPI.create(payload);
      const createdPin = response?.data?.pin || response?.pin;
      if (!createdPin?.id) {
        throw new Error('Invalid created pin response');
      }

      recentlyConvertedPoiIdsRef.current.add(selectedPoi.mapboxId);
      await loadNearbyPins();
      setSelectedPoi(null);
      setSelectedPin(createdPin);
      showToast('Added to community map', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        showAlert('Log in to add places', 'You need an account to add places to the community map.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => navigation.navigate('Login') },
        ]);
      } else if (error?.response?.data?.error?.code === 'DUPLICATE_PIN') {
        showToast('A similar place already exists nearby.', 'info');
      } else if (error?.response?.data?.error?.code === 'VALIDATION_ERROR') {
        showToast('Could not add this place: it looks like the details from the map provider were invalid.', 'error');
      } else {
        showToast('Could not add this place right now.', 'error');
      }
    } finally {
      setIsCreatingPoiPin(false);
    }
  };

  const eventContentHeightRef = useRef(0);
  const pinContentHeightRef = useRef(0);

  const openEventDetail = async (eventId: string, coords?: [number, number] | null) => {
    setSelectedPoi(null);
    setSelectedPin(null);
    setSelectedEventId(eventId);
    setSelectedEventData(null);
    eventContentHeightRef.current = 0;
    setEventDetailSnapMax(SHEET_EVENT_MAX);
    setSheetContent('eventDetail');
    safeSnapToIndex(SHEET_INDEX.COLLAPSED);
    if (coords) {
      cameraRef.current?.setCamera({
        centerCoordinate: coords,
        zoomLevel: 15,
        animationDuration: 800,
        padding: { paddingBottom: sheetPeek, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
      });
    }
    setEventDetailLoading(true);
    try {
      const [evRes, savedRes, reviewRes] = await Promise.all([
        eventAPI.getById(eventId),
        savedAPI
          .checkSaved('event', eventId)
          .catch(() => ({ data: { isSaved: false } })),
        reviewAPI.getReviews('event', eventId).catch(() => ({ data: { rating: { average: 0, count: 0 } } })),
      ]);
      setSelectedEventData(evRes.data?.event || evRes.event);
      const isSavedFlag =
        savedRes?.data?.isSaved ??
        (typeof savedRes?.isSaved === 'boolean' ? savedRes.isSaved : false);
      setEventIsSaved(isSavedFlag);
      const eventRating = reviewRes.data?.rating ?? reviewRes.rating;
      setEventAvgRating(eventRating?.average ?? 0);
      setEventReviewCount(eventRating?.count ?? 0);
    } catch {
      showToast('Failed to load event', 'error');
      setSheetContent('search');
      safeSnapToIndex(SHEET_INDEX.COLLAPSED);
    } finally {
      setEventDetailLoading(false);
    }
  };

  const closeEventDetail = () => {
    setSelectedEventId(null);
    setSelectedEventData(null);
    setEventDetailSnapMax(SHEET_EVENT_MAX);
    setSheetContent('search');
    setShowEventChat(false);
    setShowShareModal(false);
    safeSnapToIndex(SHEET_INDEX.COLLAPSED);
  };

  const handleEventToggleSave = async () => {
    if (!selectedEventId) return;
    try {
      if (eventIsSaved) {
        await savedAPI.unsaveItem('event', selectedEventId);
        setEventIsSaved(false);
        showToast('Removed from saved');
      } else {
        await savedAPI.saveItem('event', selectedEventId);
        setEventIsSaved(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Event saved!', 'success');
      }
    } catch {
      showToast('Failed to save event', 'error');
    }
  };

  const handleEventRSVP = async () => {
    if (!selectedEventData || !selectedEventId) return;
    const isAtCapacity = selectedEventData.max_attendees && selectedEventData.current_attendees >= selectedEventData.max_attendees;
    if (isAtCapacity) return;
    try {
      setEventRsvpLoading(true);
      await eventAPI.rsvp(selectedEventId, 'going');
      setEventRsvpStatus('going');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("You're going!", 'success');
      const evRes = await eventAPI.getById(selectedEventId);
      setSelectedEventData(evRes.data?.event || evRes.event);
    } catch (error: any) {
      showToast(`Failed to RSVP: ${error.response?.data?.message || 'Unknown error'}`, 'error');
    } finally {
      setEventRsvpLoading(false);
    }
  };

  const handleEventCancelRSVP = async () => {
    if (!selectedEventId) return;
    showAlert('Cancel RSVP', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try {
            setEventRsvpLoading(true);
            await eventAPI.cancelRsvp(selectedEventId);
            setEventRsvpStatus(null);
            showToast('RSVP cancelled', 'success');
            const evRes = await eventAPI.getById(selectedEventId);
            setSelectedEventData(evRes.data?.event || evRes.event);
          } catch { showToast('Failed to cancel RSVP', 'error'); }
          finally { setEventRsvpLoading(false); }
        },
      },
    ]);
  };

  const handleEventStartRoute = () => {
    if (!selectedEventData) return;
    const ev = selectedEventData;
    let lng: number, lat: number;
    if (ev.event_lat !== undefined) { lng = Number(ev.event_lng); lat = Number(ev.event_lat); }
    else if (ev.location && typeof ev.location === 'object') { lng = Number(ev.location.lng || ev.location.longitude); lat = Number(ev.location.lat || ev.location.latitude); }
    else { lng = Number(ev.lng || ev.longitude); lat = Number(ev.lat || ev.latitude); }
    if (isNaN(lng) || isNaN(lat)) { showToast('Location not available', 'error'); return; }
    closeEventDetail();
    setTimeout(() => startNavigationToTarget(lng, lat), 300);
  };

  // ── Helpers ──────────────────────────────────────────────

  const getCoordinatesFromPin = (pin: any): [number, number] | null => {
    let lng, lat;
    if (pin.pin_lat !== undefined && pin.pin_lng !== undefined) {
      lng = Number(pin.pin_lng);
      lat = Number(pin.pin_lat);
    } else if (pin.location && typeof pin.location === 'string') {
      const match = pin.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
      if (match) { lng = Number(match[1]); lat = Number(match[2]); }
      else return null;
    } else if (pin.location && pin.location.type === 'Point' && Array.isArray(pin.location.coordinates)) {
      lng = Number(pin.location.coordinates[0]);
      lat = Number(pin.location.coordinates[1]);
    } else if (pin.location) {
      lng = Number(pin.location.lng || pin.location.longitude);
      lat = Number(pin.location.lat || pin.location.latitude);
    } else if (pin.coordinates) {
      if (Array.isArray(pin.coordinates)) {
        lng = Number(pin.coordinates[0]);
        lat = Number(pin.coordinates[1]);
      } else {
        lng = Number(pin.coordinates.lng || pin.coordinates.longitude);
        lat = Number(pin.coordinates.lat || pin.coordinates.latitude);
      }
    } else {
      lng = Number(pin.lng || pin.longitude);
      lat = Number(pin.lat || pin.latitude);
    }
    if (isNaN(lng) || isNaN(lat)) return null;
    return [lng, lat];
  };

  const getCoordinatesFromEvent = (event: any): [number, number] | null => {
    let lng: number, lat: number;
    if (event.event_lat !== undefined && event.event_lng !== undefined) {
      lng = Number(event.event_lng); lat = Number(event.event_lat);
    } else if (event.location && typeof event.location === 'string') {
      const match = event.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
      if (match) { lng = Number(match[1]); lat = Number(match[2]); }
      else return null;
    } else if (event.location) {
      lng = Number(event.location.lng || event.location.longitude);
      lat = Number(event.location.lat || event.location.latitude);
    } else {
      lng = Number(event.lng || event.longitude);
      lat = Number(event.lat || event.latitude);
    }
    if (isNaN(lng) || isNaN(lat)) return null;
    return [lng, lat];
  };

  const formatReportTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  const getPinVariant = (pin: any): 'default' | 'highTrust' => {
    const count = pin.review_count ?? 0;
    const avg = pin.average_rating ?? 0;
    return count >= 3 && avg >= 4 ? 'highTrust' : 'default';
  };

  // ── Map Renderers ────────────────────────────────────────

  const isRecentlyCreated = (createdAt?: string) => {
    if (!createdAt) return false;
    return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
  };

  const renderPin = (pin: any, index: number) => {
    const coords = getCoordinatesFromPin(pin);
    if (!coords) return null;
    const iconName = PIN_ICONS[pin.type] || PIN_ICONS.default;
    const variant = getPinVariant(pin);
    return (
      <MapboxGL.MarkerView
        key={`pin-${pin?.id ?? index}`}
        coordinate={coords}
        anchor={{ x: 0.5, y: 0.5 }}
        allowOverlap
        allowOverlapWithPuck
      >
        <PinMarker
          iconName={iconName}
          type={pin.type || 'default'}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setDetailSnapOverride(SHEET_INDEX.COLLAPSED);
            setSelectedPoi(null);
            setSelectedPin(pin);
            if (coords) {
              cameraRef.current?.setCamera({
                centerCoordinate: coords,
                animationDuration: 700,
                animationMode: 'easeTo',
                padding: { paddingBottom: SHEET_PEEK_DETAIL, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
              });
            }
          }}
          variant={variant}
          label={pin.title || pin.building || undefined}
          isNew={isRecentlyCreated(pin.created_at)}
          zoom={zoomLevel}
        />
      </MapboxGL.MarkerView>
    );
  };

  const renderEvent = (event: any, index: number) => {
    let lng, lat;
    if (event.event_lat !== undefined && event.event_lng !== undefined) {
      lng = Number(event.event_lng);
      lat = Number(event.event_lat);
    } else if (event.location && typeof event.location === 'string') {
      const match = event.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
      if (match) { lng = Number(match[1]); lat = Number(match[2]); }
    } else if (event.location) {
      lng = Number(event.location.lng || event.location.longitude);
      lat = Number(event.location.lat || event.location.latitude);
    }
    if (isNaN(lng) || isNaN(lat)) return null;
    const coordinates: [number, number] = [lng, lat];
    const iconName = EVENT_ICONS[event.category] || EVENT_ICONS.other;
    const live = event.start_time && event.end_time && isEventLive(event.start_time, event.end_time);
    return (
      <MapboxGL.MarkerView
        key={`event-${index}`}
        coordinate={coordinates}
        anchor={{ x: 0.5, y: 0.5 }}
        allowOverlap
        allowOverlapWithPuck
      >
        <AnimatedEventMarker
          iconName={iconName}
          isLive={live}
          category={event.category || 'other'}
          onPress={() => openEventDetail(event.id)}
          label={event.title || undefined}
          isNew={isRecentlyCreated(event.created_at)}
          zoom={zoomLevel}
          attendeeCount={event.current_attendees || 0}
          attendeeInitials={
            live && event.current_attendees > 0
              ? [event.organizer_name || event.title || 'U']
                  .concat(Array(Math.min((event.current_attendees || 1) - 1, 2)).fill('?'))
                  .map((n: string) => n.charAt(0))
              : []
          }
        />
      </MapboxGL.MarkerView>
    );
  };

  const renderReport = (report: any, index: number) => {
    const lat = report.lat != null ? Number(report.lat) : null;
    const lng = report.lng != null ? Number(report.lng) : null;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;
    const coords: [number, number] = [lng, lat];
    const iconName = REPORT_ICONS[report.type] || REPORT_ICON_DEFAULT;
    return (
      <MapboxGL.MarkerView
        key={`report-${report.id ?? index}`}
        coordinate={coords}
        anchor={{ x: 0.5, y: 0.5 }}
        allowOverlap
        allowOverlapWithPuck
      >
        <ReportMarker
          iconName={iconName}
          type={report.type || 'report'}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setDetailSnapOverride(SHEET_INDEX.COLLAPSED);
            setSelectedPoi(null);
            setSelectedPin({
              id: `report-${report.id ?? index}`,
              title: (report.type || 'report')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l: string) => l.toUpperCase()),
              type: report.type || 'report',
              description: report.content || '',
              location: { lat, lng },
              created_at: report.created_at,
              __report: report,
            });
            cameraRef.current?.setCamera({
              centerCoordinate: coords,
              animationDuration: 700,
              animationMode: 'easeTo',
              padding: { paddingBottom: SHEET_PEEK_DETAIL, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
            });
          }}
        />
      </MapboxGL.MarkerView>
    );
  };

  // ── Sheet Content Renderers ──────────────────────────────

  // Simple grid-based clustering — groups items whose coords fall in the same cell
  const clusterItems = (items: any[], getCoords: (item: any) => [number, number] | null, cellSize: number) => {
    const cells: Record<string, { center: [number, number]; count: number; items: any[] }> = {};
    items.forEach(item => {
      const coords = getCoords(item);
      if (!coords) return;
      const [lng, lat] = coords;
      const key = `${Math.floor(lng / cellSize)},${Math.floor(lat / cellSize)}`;
      if (!cells[key]) cells[key] = { center: [lng, lat], count: 0, items: [] };
      cells[key].count++;
      cells[key].items.push(item);
    });
    return Object.values(cells);
  };

  // Campus bounding box — items outside this are hidden in campus mode (UTech: 18.02°N, -76.74°W)
  const CAMPUS_BOUNDS = { minLng: -76.7480, maxLng: -76.7360, minLat: 18.0170, maxLat: 18.0240 };
  const inCampusBounds = (lng: number, lat: number) =>
    lng >= CAMPUS_BOUNDS.minLng && lng <= CAMPUS_BOUNDS.maxLng &&
    lat >= CAMPUS_BOUNDS.minLat && lat <= CAMPUS_BOUNDS.maxLat;

  // Group filtering — public view shows items with no group_id, group view shows only that group's items
  const groupFilter = useCallback((item: any) => {
    if (activeGroup) return item.group_id === activeGroup.id;
    return !item.group_id;
  }, [activeGroup]);

  // Map filtering: sheet filter chips control what appears on the map
  const mapFilteredPins = useMemo(() => {
    let result = feedFilter === 'all' ? pins
      : feedFilter === 'events' || feedFilter === 'reports' ? []
      : pins.filter((p: any) => p?.type === feedFilter);
    result = result.filter(groupFilter);
    if (mode === 'campus') {
      result = result.filter((p: any) => {
        const c = getCoordinatesFromPin(p);
        return c ? inCampusBounds(c[0], c[1]) : false;
      });
    }
    return result;
  }, [pins, feedFilter, mode, groupFilter]);

  const mapFilteredEvents = useMemo(() => {
    let result = (feedFilter === 'all' || feedFilter === 'events') ? events : [];
    result = result.filter(groupFilter);
    if (mode === 'campus') {
      result = result.filter((ev: any) => {
        const c = getCoordinatesFromEvent(ev);
        return c ? inCampusBounds(c[0], c[1]) : false;
      });
    }
    return result;
  }, [events, feedFilter, mode, groupFilter]);

  // Only show reports that are not attached to a pin (standalone reports get a marker; pin reports stay in the pin's detail)
  const mapFilteredReports = useMemo(() => {
    if (feedFilter !== 'all' && feedFilter !== 'reports') return [];
    let result = reports.filter((r: any) => !r.pin_id);
    result = result.filter(groupFilter);
    if (mode === 'campus') {
      result = result.filter((r: any) => {
        const lng = r.lng != null ? Number(r.lng) : null;
        const lat = r.lat != null ? Number(r.lat) : null;
        return lng != null && lat != null ? inCampusBounds(lng, lat) : false;
      });
    }
    return result;
  }, [reports, feedFilter, mode, groupFilter]);

  // Cell size shrinks as zoom grows — at zoom 12 ~0.01 deg, zoom 10 ~0.04 deg
  const clusterCellSize = Math.max(0.005, 0.16 / Math.pow(2, zoomLevel - 10));

  const pinClusters = useMemo(
    () => clusterItems(mapFilteredPins, getCoordinatesFromPin, clusterCellSize),
    [mapFilteredPins, clusterCellSize]
  );

  const eventClusters = useMemo(
    () => clusterItems(mapFilteredEvents, (ev) => {
      let lng: number, lat: number;
      if (ev.event_lat !== undefined) { lng = Number(ev.event_lng); lat = Number(ev.event_lat); }
      else if (ev.location && typeof ev.location === 'string') {
        const m = ev.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
        if (m) { lng = Number(m[1]); lat = Number(m[2]); } else return null;
      } else if (ev.location) { lng = Number(ev.location.lng || ev.location.longitude); lat = Number(ev.location.lat || ev.location.latitude); }
      else return null;
      return isNaN(lng) || isNaN(lat) ? null : [lng, lat];
    }, clusterCellSize),
    [mapFilteredEvents, clusterCellSize]
  );

  const nearbyFeedItems = useMemo(() => {
    const items: { id: string; kind: 'event' | 'report' | 'pin'; title: string; description: string; typeLabel: string; time: string; icon: string; isLive: boolean; distance?: number; locationLabel?: string; raw: any }[] = [];

    const filteredEvents = (mode === 'campus'
      ? events.filter((e: any) => { const c = getCoordinatesFromEvent(e); return c ? inCampusBounds(c[0], c[1]) : false; })
      : events).filter(groupFilter);
    const filteredReports = (mode === 'campus'
      ? reports.filter((r: any) => { const lng = Number(r.lng); const lat = Number(r.lat); return inCampusBounds(lng, lat); })
      : reports).filter(groupFilter);
    const filteredPins = (mode === 'campus'
      ? pins.filter((p: any) => { const c = getCoordinatesFromPin(p); return c ? inCampusBounds(c[0], c[1]) : false; })
      : pins).filter(groupFilter);

    filteredEvents.forEach((e: any) => {
      const icon = EVENT_ICONS[e.category] || EVENT_ICONS.other;
      const live = !!(e.start_time && e.end_time && isEventLive(e.start_time, e.end_time));
      const timeStr = live
        ? 'Happening now'
        : e.start_time
          ? new Date(e.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : '';
      items.push({
        id: `event-${e.id}`,
        kind: 'event',
        title: e.title || 'Event',
        description: e.description || '',
        typeLabel: (e.category || 'event').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        time: timeStr,
        icon,
        isLive: live,
        distance: e.distance_meters ? Math.round(e.distance_meters) : undefined,
        raw: e,
      });
    });

    filteredReports.forEach((r: any) => {
      const icon = REPORT_ICONS[r.type] || REPORT_ICON_DEFAULT;
      const typeLabel = (r.type || 'report').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      let dist: number | undefined;
      const rLat = Number(r.lat);
      const rLng = Number(r.lng);
      if (userLocation && !isNaN(rLat) && !isNaN(rLng)) {
        const uLat = userLocation[1];
        const uLng = userLocation[0];
        const dLat = (rLat - uLat) * 111320;
        const dLng = (rLng - uLng) * 111320 * Math.cos((uLat * Math.PI) / 180);
        const m = Math.sqrt(dLat * dLat + dLng * dLng);
        if (!isNaN(m)) dist = Math.round(m);
      }
      const associatedPin = r.pin_id ? pins.find((p: any) => p.id === r.pin_id) : null;
      const locationLabel = associatedPin?.title || associatedPin?.building || '';
      items.push({
        id: `report-${r.id}`,
        kind: 'report',
        title: typeLabel,
        description: r.content || '',
        typeLabel,
        time: r.created_at ? formatReportTime(r.created_at) : '',
        icon,
        isLive: false,
        distance: dist,
        locationLabel,
        raw: r,
      });
    });

    filteredPins.forEach((p: any) => {
      const coords = getCoordinatesFromPin(p);
      let dist: number | undefined;
      if (userLocation && coords) {
        const dLat = (coords[1] - userLocation[1]) * 111320;
        const dLng = (coords[0] - userLocation[0]) * 111320 * Math.cos((userLocation[1] * Math.PI) / 180);
        const m = Math.sqrt(dLat * dLat + dLng * dLng);
        if (!isNaN(m)) dist = Math.round(m);
      }
      const pinType = p.type || 'default';
      const icon = PIN_ICONS[pinType] || 'location-outline';
      const typeLabel = pinType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      items.push({
        id: `pin-${p.id}`,
        kind: 'pin',
        title: p.title || typeLabel,
        description: p.description || '',
        typeLabel,
        time: p.created_at ? formatReportTime(p.created_at) : '',
        icon,
        isLive: false,
        distance: dist,
        locationLabel: p.building || '',
        raw: p,
      });
    });

    return items;
  }, [events, reports, userLocation, pins, mode, groupFilter]);

  // ── Neighborhood vibe ────────────────────────────────────
  const neighborhoodVibe = useMemo(() => {
    const liveEvents = events.filter((e) => e.start_time && e.end_time && isEventLive(e.start_time, e.end_time)).length;
    const recentReports = reports.filter((r) => {
      if (!r.created_at) return false;
      return Date.now() - new Date(r.created_at).getTime() < 60 * 60 * 1000;
    }).length;
    const total = liveEvents * 3 + recentReports + pins.length;
    if (total === 0) return { label: 'Quiet', color: '#6C6C70', icon: '🌙' };
    if (total < 5) return { label: 'Chill', color: '#28B873', icon: '🍃' };
    if (total < 12) return { label: 'Active', color: '#E5A200', icon: '⚡' };
    return { label: 'Buzzing', color: '#E11900', icon: '🔥' };
  }, [events, reports, pins]);

  // ── Trending items (most reported / most active) ──────────
  const trendingItems = useMemo(() => {
    const pinActivity: Record<string, { pin: any; count: number }> = {};
    reports.forEach((r) => {
      if (!r.pin_id) return;
      const pin = pins.find((p: any) => p.id === r.pin_id);
      if (!pin) return;
      if (!pinActivity[r.pin_id]) pinActivity[r.pin_id] = { pin, count: 0 };
      pinActivity[r.pin_id].count++;
    });
    const sorted = Object.values(pinActivity)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ pin, count }) => ({ ...pin, _activityCount: count, _kind: 'pin' as const }));

    // Fill with live events if not enough
    const liveEvents = events
      .filter((e) => e.start_time && e.end_time && isEventLive(e.start_time, e.end_time))
      .slice(0, 3)
      .map((e) => ({ ...e, _kind: 'event' as const }));

    return [...liveEvents, ...sorted].slice(0, 5);
  }, [reports, pins, events]);

  const FEED_FILTERS = [
    { id: 'all',          label: 'All',       icon: 'apps-outline' },
    { id: 'events',       label: 'Events',    icon: 'calendar-outline' },
    { id: 'reports',      label: 'Reports',   icon: 'flag-outline' },
    { id: 'bathroom',     label: 'Bathroom',  icon: 'water-outline' },
    { id: 'food',         label: 'Food',      icon: 'restaurant-outline' },
    { id: 'coffee',       label: 'Coffee',    icon: 'cafe-outline' },
    { id: 'study',        label: 'Study',     icon: 'book-outline' },
    { id: 'pharmacy',     label: 'Pharmacy',  icon: 'medical-outline' },
    { id: 'parking',      label: 'Parking',   icon: 'car-outline' },
    { id: 'safe_walk',    label: 'Safe Walk', icon: 'walk-outline' },
    { id: 'open_late',    label: 'Open Late', icon: 'time-outline' },
  ];

  const filteredFeedItems = useMemo(() => {
    if (feedFilter === 'all') return nearbyFeedItems;
    if (feedFilter === 'events') return nearbyFeedItems.filter(item => item.kind === 'event');
    if (feedFilter === 'reports') return nearbyFeedItems.filter(item => item.kind === 'report');
    // category chip — filter pins by type
    return nearbyFeedItems.filter(item => item.kind === 'pin' && item.raw?.type === feedFilter);
  }, [nearbyFeedItems, feedFilter]);

  const areaStatus = useMemo(() => {
    const nearbyCount = nearbyFeedItems.length;
    const activityText = nearbyCount > 0 ? `${nearbyCount} nearby` : 'Quiet now';
    return { activityText };
  }, [nearbyFeedItems]);

  const topBarContext = useMemo(() => {
    const nearbyCount = nearbyFeedItems.filter(i => i.kind === 'pin' || i.kind === 'event').length;
    const liveNow = nearbyFeedItems.find(i => i.kind === 'event' && i.isLive)?.raw;
    const safeWalkCount = nearbyFeedItems.filter(i => i.kind === 'pin' && i.raw?.type === 'safe_walk').length;
    const openLateCount = nearbyFeedItems.filter(i => i.kind === 'pin' && i.raw?.type === 'open_late').length;
    const hour = new Date().getHours();
    const isEvening = hour >= 18 || hour < 5;

    if (liveNow) {
      return {
        icon: 'radio-outline' as const,
        primary: `Live now: ${liveNow.title}`,
        secondary: 'Tap to view',
        dotColor: '#10B981',
        liveEventId: liveNow.id as string,
      };
    }

    if (isEvening && safeWalkCount > 0) {
      return {
        icon: 'shield-checkmark-outline' as const,
        primary: `${safeWalkCount} safe walk spot${safeWalkCount === 1 ? '' : 's'}`,
        secondary: 'Night safety',
        dotColor: colors.info,
        liveEventId: null as string | null,
      };
    }

    if (isEvening && openLateCount > 0) {
      return {
        icon: 'time-outline' as const,
        primary: `${openLateCount} open late spot${openLateCount === 1 ? '' : 's'}`,
        secondary: 'Evening options',
        dotColor: colors.accent,
        liveEventId: null as string | null,
      };
    }

    const areaLabel = mode === 'campus' && currentArea?.areaName ? currentArea.areaName : 'Around you';
    return {
      icon: mode === 'campus' ? ('school-outline' as const) : ('compass-outline' as const),
      primary: areaLabel,
      secondary: nearbyCount > 0 ? `${nearbyCount} nearby` : 'Nothing nearby yet',
      dotColor: nearbyCount > 0 ? '#10B981' : colors.textMuted,
      liveEventId: null as string | null,
    };
  }, [nearbyFeedItems, mode, currentArea, colors.info, colors.accent, colors.textMuted]);

  const renderSkeletonFeed = () => (
    <>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonIcon} />
          <View style={styles.skeletonInfo}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonSub} />
          </View>
          <View style={styles.skeletonTime} />
        </View>
      ))}
    </>
  );

  const renderSearchContent = () => (
    <BottomSheetScrollView
      showsVerticalScrollIndicator={false}
      style={styles.sheetScrollBackground}
      contentContainerStyle={{ paddingBottom: spacing.sm, flexGrow: 1 }}
    >
      <View
        onLayout={(e) => {
          const contentHeight = e.nativeEvent.layout.height;
          if (contentHeight < 80) return;

          // Keep the map sheet constrained to the fixed 3 snap states.
        }}
      >
      <View style={styles.searchSection}>
        <View style={styles.searchHeaderRow}>
          <View style={styles.searchPill}>
            {isSearchFocused ? (
              <TouchableOpacity onPress={handleSearchBack} style={styles.searchBackButton}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.searchPillIcon}>
                <Ionicons name="search" size={20} color={colors.text} />
              </View>
            )}
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Where to?"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (!text.trim() && currentSearchType) {
                  setCurrentSearchType('');
                }
              }}
              onSubmitEditing={handleSearch}
              onFocus={() => {
                setIsSearchFocused(true);
              safeSnapToIndex(SHEET_INDEX.FULL);
              }}
              returnKeyType="search"
            />
            {searchQuery.trim().length > 0 && !searching && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setCurrentSearchType('');
                  setSearchResults([]);
                  if (userLocation) loadAllNearby();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {searching && <ActivityIndicator color={colors.accent} size="small" />}
          </View>
          <TouchableOpacity
            style={styles.searchAddButton}
            onPress={() =>
              navigation.navigate(
                'SelectType',
                userLocation
                  ? { prefillLocation: { lat: userLocation[1], lng: userLocation[0] } }
                  : undefined
              )
            }
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.areaStatusRow}>
        {isInCampus && currentArea?.areaName ? (
          <>
            <Ionicons name="school-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.areaStatusText}>{currentArea.areaName}</Text>
            <View style={styles.areaStatusDot} />
          </>
        ) : null}
        <Ionicons name="radio-outline" size={11} color={neighborhoodVibe.color} />
        <Text style={[styles.areaStatusText, { color: neighborhoodVibe.color }]}>{neighborhoodVibe.label}</Text>
        <View style={styles.areaStatusDot} />
        <Ionicons name="locate-outline" size={12} color={colors.textSecondary} />
        <Text style={[styles.areaStatusText, { flexShrink: 0 }]} numberOfLines={1}>{areaStatus.activityText}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickActions}
        contentContainerStyle={{ paddingRight: spacing.md }}
      >
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => {
            if (userLocation) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('CreateReport', {
                location: { lat: userLocation[1], lng: userLocation[0] },
              });
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="flag-outline" size={18} color={colors.text} />
          <Text style={styles.quickActionText}>Report</Text>
        </TouchableOpacity>
        {getChipPreset().map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.quickActionButton}
            onPress={() => handleQuickAction(action.id)}
            activeOpacity={0.7}
          >
            <Ionicons name={action.icon as any} size={18} color={colors.text} />
            <Text style={styles.quickActionText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!isSheetExpandedForContent && !isSearchFocused ? (
        <View style={styles.pullUpHint}>
          <View style={styles.pullUpHintContent}>
            <Animated.View style={[styles.pullUpArrows, { transform: [{ translateY: pullHintArrowTranslateY }] }]}>
              <Ionicons name="chevron-up-outline" size={12} color={colors.textMuted} />
              <Ionicons name="chevron-up-outline" size={12} color={colors.textMuted} style={styles.pullUpArrowStacked} />
            </Animated.View>
            <Animated.Text style={[styles.pullUpHintText, { opacity: pullHintTextOpacity }]}>
              Pull up to see nearby activity
            </Animated.Text>
          </View>
        </View>
      ) : null}

      {/* Trending / Hot right now — empty state — only show if there's real content (pins exist) but nothing is trending */}
      {!isSearchFocused && isSheetExpandedForContent && trendingItems.length === 0 && pins.length >= 3 && (
        <View style={styles.trendingEmptySection}>
          <View style={styles.trendingEmptyCard}>
            <View style={styles.trendingEmptyIconWrap}>
              <Ionicons name="trending-up-outline" size={20} color={colors.accent} />
            </View>
            <View style={styles.trendingEmptyTextWrap}>
              <Text style={styles.trendingEmptyTitle}>Nothing trending yet in this area</Text>
              <Text style={styles.trendingEmptySubtext}>Reports and activity will show up here</Text>
            </View>
          </View>
        </View>
      )}
      {trendingItems.length > 0 && !isSearchFocused && isSheetExpandedForContent && (
        <View style={styles.trendingSection}>
          <View style={styles.trendingHeader}>
            <Ionicons name="trending-up-outline" size={14} color={colors.text} />
            <Text style={styles.trendingTitle}>Hot right now</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingScrollContent}
          >
            {trendingItems.map((item: any, i: number) => {
              const isEvent = item._kind === 'event';
              const iconName = isEvent
                ? (EVENT_ICONS[item.category] || EVENT_ICONS.other)
                : (PIN_ICONS[item.type] || PIN_ICONS.default);
              const label = item.title || item.type || 'Spot';
              const meta = isEvent
                ? 'Live now'
                : item._activityCount
                ? `${item._activityCount} report${item._activityCount > 1 ? 's' : ''}`
                : item.type || '';
              return (
                <TouchableOpacity
                  key={`trending-${i}`}
                  style={styles.trendingCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (isEvent) {
                      openEventDetail(item.id, getCoordinatesFromEvent(item));
                    } else {
                      setDetailSnapOverride(SHEET_INDEX.COLLAPSED);
                      setSelectedPoi(null);
                      setSelectedPin(item);
                      const coords = getCoordinatesFromPin(item);
                      if (coords) cameraRef.current?.setCamera({ centerCoordinate: coords, zoomLevel: 16, animationDuration: 800, animationMode: 'easeTo', padding: { paddingBottom: SHEET_PEEK_DETAIL, paddingTop: 0, paddingLeft: 0, paddingRight: 0 } });
                    }
                  }}
                >
                  <View style={[styles.trendingCardIcon, isEvent && { backgroundColor: colors.accentTint }]}>
                    <Ionicons name={iconName as any} size={16} color={isEvent ? colors.accent : colors.text} />
                  </View>
                  <Text style={styles.trendingCardTitle} numberOfLines={2}>{label}</Text>
                  <Text style={styles.trendingCardMeta} numberOfLines={1}>{meta}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Nearby needs prompt — shown when area has very few pins and user hasn't pinned yet */}
      {isSheetExpandedForContent && !loadingNearby && pins.length < 3 && ((user as any)?.pinsCreated ?? 0) === 0 && (
        <>
          <View style={styles.feedDivider} />
          <TouchableOpacity
          style={styles.nearbyNeedsCard}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate('SelectType', {
              prefillLocation: userLocation ? { lat: userLocation[1], lng: userLocation[0] } : undefined,
            });
          }}
        >
          <View style={styles.nearbyNeedsIcon}>
            <Ionicons name="bulb-outline" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nearbyNeedsText}>People are searching nearby</Text>
            <Text style={styles.nearbyNeedsSub}>Know a bathroom, food spot, or study space? Add it and earn +5 rep.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        </>
      )}

      {/* Feed area */}
      {isSheetExpandedForContent && (
      <View style={styles.feedSection}>
        <View style={styles.feedDivider} />

        {/* Count header + filter chips */}
        <View style={styles.feedTopRow}>
          <Text style={styles.feedHeading}>
            {loadingNearby ? 'Loading...' : `${nearbyFeedItems.length} things nearby`}
          </Text>
          {nearbyFeedItems.length > 0 && (
            <Text style={styles.feedCount}>
              {nearbyFeedItems.filter(i => i.isLive).length > 0
                ? `${nearbyFeedItems.filter(i => i.isLive).length} live`
                : ''}
            </Text>
          )}
        </View>
        

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.md }}
        >
          {FEED_FILTERS.map(f => {
            const isActive = feedFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, isActive ? styles.filterChipActive : styles.filterChipInactive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFeedFilter(f.id);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={f.icon as any}
                  size={12}
                  color={isActive ? colors.interactiveText : colors.textSecondary}
                />
                <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : styles.filterChipTextInactive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Feed items or skeleton */}
        {loadingNearby ? renderSkeletonFeed() : (() => {
          const renderFeedRow = (item: typeof filteredFeedItems[0], index: number, arr: typeof filteredFeedItems) => {
            const distanceLabel = item.distance != null
              ? item.distance < 1000
                ? `${item.distance}m away`
                : `${(item.distance / 1000).toFixed(1)}km away`
              : null;
            const metaLabel = [distanceLabel, item.locationLabel || null].filter(Boolean).join(' · ');
            const pinColor = item.kind === 'pin' ? (PIN_TYPE_COLORS[item.raw?.type] || PIN_TYPE_COLORS.default) : null;
            const iconColor = item.kind === 'event' ? colors.accent : item.kind === 'pin' ? pinColor! : colors.warning;
            const iconBg = item.kind === 'event'
              ? 'rgba(255, 255, 255, 0.06)'
              : item.kind === 'pin'
              ? pinColor! + '22'
              : colors.warning + '20';

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.feedItem, index < arr.length - 1 && styles.feedItemBorder]}
                activeOpacity={0.6}
                onPress={() => {
                  if (item.kind === 'event') {
                    openEventDetail(item.raw.id, getCoordinatesFromEvent(item.raw));
                  } else if (item.kind === 'pin') {
                    setDetailSnapOverride(SHEET_INDEX.COLLAPSED);
                    setSelectedPoi(null);
                    setSelectedPin(item.raw);
                    const coords = getCoordinatesFromPin(item.raw);
                    if (coords) {
                      cameraRef.current?.setCamera({
                        centerCoordinate: coords,
                        zoomLevel: 16,
                        animationDuration: 800,
                        animationMode: 'easeTo',
                        padding: { paddingBottom: SHEET_PEEK_DETAIL, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
                      });
                    }
                  } else {
                    const rLat = item.raw.lat != null ? Number(item.raw.lat) : null;
                    const rLng = item.raw.lng != null ? Number(item.raw.lng) : null;
                    if (rLat == null || rLng == null) return;
                    cameraRef.current?.setCamera({
                      centerCoordinate: [rLng, rLat],
                      zoomLevel: 16,
                      animationDuration: 800,
                      animationMode: 'easeTo',
                      padding: { paddingBottom: SHEET_PEEK_DETAIL, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
                    });
                    const associatedPin = item.raw.pin_id
                      ? pins.find((p) => p.id === item.raw.pin_id)
                      : pins.find((p) => {
                          const coords = getCoordinatesFromPin(p);
                          if (!coords) return false;
                          return Math.sqrt(Math.pow(coords[0] - rLng, 2) + Math.pow(coords[1] - rLat, 2)) < 0.001;
                        });
                    if (associatedPin) {
                      setDetailSnapOverride(SHEET_INDEX.COLLAPSED);
                      setSelectedPoi(null);
                      setSelectedPin(associatedPin);
                    } else {
                      setDetailSnapOverride(SHEET_INDEX.COLLAPSED);
                      setSelectedPoi(null);
                      setSelectedPin({
                        id: `report-${item.raw.id}`,
                        title: item.title,
                        type: item.raw.type || 'report',
                        description: item.description,
                        location: { lat: rLat, lng: rLng },
                      });
                    }
                  }
                }}
              >
                <View style={[styles.feedIconContainer, { backgroundColor: iconBg }]}>
                  <Ionicons name={item.icon as any} size={20} color={iconColor} />
                </View>
                <View style={styles.feedInfo}>
                  <Text style={styles.feedTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.feedSubtitle} numberOfLines={1}>
                    {item.description || item.typeLabel}
                  </Text>
                  {metaLabel.length > 0 && (
                    item.kind === 'report' ? (
                      <View style={styles.reportDistanceRow}>
                        <Ionicons name="navigate-outline" size={12} color={colors.warning} />
                        <Text style={styles.reportDistanceText} numberOfLines={1}>
                          {metaLabel}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.feedMeta} numberOfLines={1}>
                        {metaLabel}
                      </Text>
                    )
                  )}
                </View>
                <View style={styles.feedTimeRow}>
                  {item.isLive && <View style={styles.liveDot} />}
                  <Text style={styles.feedTime}>{item.time}</Text>
                </View>
              </TouchableOpacity>
            );
          };

          if (filteredFeedItems.length === 0) {
            if (nearbyFeedItems.length > 0) {
              return (
                <Text style={[styles.feedTime, { textAlign: 'center', paddingVertical: spacing.lg }]}>
                  No {feedFilter} nearby
                </Text>
              );
            }
            return (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentTint30, justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="map-outline" size={26} color={colors.accent} />
                </View>
                <Text style={{ ...typography.bodySmallSemibold, color: colors.text, textAlign: 'center' }}>
                  You're one of the first here
                </Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg }}>
                  Help others discover this area — add a bathroom, food spot, study space, or anything useful.
                </Text>
              </View>
            );
          }

          if (feedFilter !== 'all') {
            return filteredFeedItems.map((item, index, arr) => renderFeedRow(item, index, arr));
          }

          // Sectioned layout for "all" view
          const liveItems = filteredFeedItems.filter(i => i.isLive);
          const pinItems = filteredFeedItems.filter(i => i.kind === 'pin');
          const reportItems = filteredFeedItems.filter(i => i.kind === 'report');
          const nonLiveEvents = filteredFeedItems.filter(i => i.kind === 'event' && !i.isLive);

          const sections: { label: string; icon: string; iconColor: string; items: typeof filteredFeedItems; showAddCta?: boolean }[] = [];
          if (liveItems.length > 0) sections.push({ label: 'Live now', icon: 'radio-outline', iconColor: '#EF4444', items: liveItems });
          if (reportItems.length > 0) sections.push({ label: 'Community reports', icon: 'flag-outline', iconColor: colors.warning, items: reportItems });
          if (nonLiveEvents.length > 0) sections.push({ label: 'Upcoming events', icon: 'calendar-outline', iconColor: colors.accent, items: nonLiveEvents });
          // Separate recommended top-5 from the rest
          const forYouIds = new Set(forYouPins.map((p: any) => p.id));
          const forYouFeedItems = pinItems.filter(i => forYouIds.has(i.raw?.id));
          const remainingPinItems = pinItems.filter(i => !forYouIds.has(i.raw?.id));

          if (forYouFeedItems.length > 0) {
            sections.push({
              label: 'For you',
              icon: 'sparkles-outline' as any,
              iconColor: colors.accent,
              items: forYouFeedItems,
              showAddCta: false,
            });
          }
          sections.push({
            label: forYouFeedItems.length > 0 ? 'More nearby' : 'Nearby spots',
            icon: 'location-outline',
            iconColor: colors.text,
            items: remainingPinItems,
            showAddCta: pinItems.length === 0,
          });

          return sections.map((section) => (
            <View key={section.label} style={styles.feedSectionGroup}>
              <View style={styles.feedSectionHeader}>
                <Ionicons name={section.icon as any} size={12} color={section.iconColor} />
                <Text style={[styles.feedSectionLabel, { color: section.iconColor }]}>{section.label}</Text>
              </View>
              {section.items.map((item, index, arr) => renderFeedRow(item, index, arr))}
              {section.showAddCta && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    marginHorizontal: spacing.md,
                    marginBottom: spacing.xs,
                    borderRadius: borderRadius.lg,
                    borderWidth: 1,
                    borderStyle: 'dashed' as any,
                    borderColor: colors.border,
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('SelectType', {
                      prefillLocation: userLocation
                        ? { lat: userLocation[1], lng: userLocation[0] }
                        : undefined,
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentTint30, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="add" size={18} color={colors.accent} />
                  </View>
                  <View>
                    <Text style={{ ...typography.bodySmallSemibold, color: colors.text }}>Add a nearby spot</Text>
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>Bathroom, food, study space…</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          ));
        })()}

        {/* Long-press hint */}
        {!loadingNearby && (
          <View style={styles.longPressHint}>
            <Ionicons name="hand-left-outline" size={12} color={colors.textMuted} />
            <Text style={styles.longPressHintText}>Long press the map to drop a pin</Text>
          </View>
        )}
      </View>
      )}
      </View>
    </BottomSheetScrollView>
  );

  const renderResultsContent = () => (
    <>
      <View style={styles.searchSection}>
        <View style={styles.resultsSearchRow}>
          <TouchableOpacity onPress={handleSearchBack} style={styles.resultsBackButton} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.searchPill}>
            <View style={styles.searchPillIcon}>
              <Ionicons name="search" size={20} color={colors.text} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Where to?"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (!text.trim() && currentSearchType) {
                  setCurrentSearchType('');
                }
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.trim().length > 0 && !searching && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setCurrentSearchType('');
                  setSearchResults([]);
                  if (userLocation) loadAllNearby();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {searching && <ActivityIndicator color={colors.accent} size="small" />}
          </View>
        </View>
      </View>

      <View style={styles.resultsHeader}>
        <View>
          <Text style={styles.resultsTitle}>
            {getChipPreset().find((c) => c.id === currentSearchType)?.label ||
              currentSearchType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) ||
              'Results'} nearby
          </Text>
          <Text style={styles.resultsSubtitle}>
            {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
          </Text>
        </View>
      </View>

      <BottomSheetFlatList
        data={searchResults}
        keyExtractor={(item, index) => item.id || index.toString()}
        showsVerticalScrollIndicator={false}
        style={styles.sheetScrollBackground}
        renderItem={({ item }) => {
          const isEvent = item.category && item.start_time;
          const recommendation = item._recommendation;
          const iconName = isEvent
            ? (EVENT_ICONS[item.category] || EVENT_ICONS.other)
            : (PIN_ICONS[item.type] || PIN_ICONS.default);
          const subtitle = isEvent
            ? new Date(item.start_time).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
              })
            : (item.description || `${Math.round(item.distance_meters || 0)}m away`);
          const recommendationBadge =
            recommendation && typeof recommendation === 'object'
              ? `${recommendation.statusNow || 'Live signal'} • ${Math.round((recommendation.confidence || 0) * 100)}%`
              : null;
          const freshness = recommendation?.freshnessLabel || item.recommendation_freshness;
          const confidencePct = recommendation
            ? Math.round((recommendation.confidence || 0) * 100)
            : Math.round((item.recommendation_confidence || 0) * 100);
          return (
            <TouchableOpacity style={styles.resultItem} onPress={() => handleSelectResult(item)} activeOpacity={0.6}>
              <View style={[styles.resultIconContainer, isEvent && styles.resultIconContainerEvent]}>
                <Ionicons name={iconName as any} size={22} color={isEvent ? colors.accent : colors.text} />
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.resultSubtitle} numberOfLines={1}>
                  {recommendationBadge || subtitle}
                </Text>
                {(freshness || confidencePct > 0) && (
                  <View style={styles.trustBadgeRow}>
                    {freshness ? (
                      <View style={styles.trustBadge}>
                        <Ionicons name="time-outline" size={10} color={colors.textSecondary} />
                        <Text style={styles.trustBadgeText}>
                          {String(freshness).replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Text>
                      </View>
                    ) : null}
                    {confidencePct > 0 ? (
                      <View style={styles.trustBadge}>
                        <Ionicons name="shield-checkmark-outline" size={10} color={colors.textSecondary} />
                        <Text style={styles.trustBadgeText}>{confidencePct}% confidence</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.lightGray} />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={colors.lightGray} />
            <Text style={styles.emptyStateText}>No results found</Text>
            <Text style={styles.emptyStateSubtext}>Try adjusting your search</Text>
          </View>
        }
      />
    </>
  );

  const EVENT_CATEGORIES_MAP: any = {
    social:   { label: 'Social',   color: '#3DDC91' },
    academic: { label: 'Academic', color: '#05A357' },
    sports:   { label: 'Sports',   color: '#E5A200' },
    club:     { label: 'Club',     color: '#9747FF' },
    party:    { label: 'Party',    color: '#E11900' },
    music:    { label: 'Music',    color: '#F97316' },
    other:    { label: 'Other',    color: '#757575' },
  };

  const renderEventDetailContent = () => {
    if (eventDetailLoading || !selectedEventData) {
      return (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            <TouchableOpacity style={styles.evCloseBtn} onPress={closeEventDetail}>
              <Ionicons name="close" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.text} />
          </View>
        </View>
      );
    }

    const ev = selectedEventData;
    const cat = EVENT_CATEGORIES_MAP[ev.category] || EVENT_CATEGORIES_MAP.other;
    const catIcon = (EVENT_ICONS[ev.category] || EVENT_ICONS.other) as any;
    const isAtCapacity = ev.max_attendees && ev.current_attendees >= ev.max_attendees;
    const current = ev.current_attendees || 0;
    const eventCoverUri = ev.photo_url || ev.photoUrl || null;

    const formatDay = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const diff = ev.start_time ? new Date(ev.start_time).getTime() - Date.now() : 0;
    let timeUntil: string | null = null;
    if (diff > 0) {
      const h = Math.floor(diff / 3600000);
      const d = Math.floor(h / 24);
      timeUntil = d > 0 ? `${d}d` : h > 0 ? `${h}h` : `${Math.floor(diff / 60000)}m`;
    } else if (ev.start_time && ev.end_time && new Date(ev.end_time).getTime() > Date.now()) {
      timeUntil = 'Now';
    }
    const footerPad = Math.max(insets.bottom, spacing.sm);

    return (
      <View style={{ flex: 1 }}>

        {/* ── Header card — always visible at collapsed peek ── */}
        <View style={styles.evHeader}>
          <View style={styles.evHeaderCard}>
            {/* Square thumbnail */}
            {eventCoverUri ? (
              <View style={styles.evHeaderThumb}>
                <Image source={{ uri: eventCoverUri }} style={styles.evHeaderThumbImg} resizeMode="cover" />
              </View>
            ) : (
              <View style={[styles.evHeaderThumbPlaceholder, { backgroundColor: cat.color + '20' }]}>
                <Ionicons name={catIcon} size={30} color={cat.color} />
              </View>
            )}

            {/* Info column */}
            <View style={styles.evHeaderInfo}>
              <Text style={styles.evHeaderTitle} numberOfLines={2}>{ev.title}</Text>
              <View style={styles.evHeaderBadgeRow}>
                <View style={[styles.evCategoryPill, { backgroundColor: cat.color + '22' }]}>
                  <Text style={[styles.evCategoryPillText, { color: cat.color }]}>{cat.label}</Text>
                </View>
                {timeUntil === 'Now' ? (
                  <Animated.View style={[styles.evLiveBadge, { transform: [{ scale: pulseAnim }] }]}>
                    <View style={styles.evLiveDot} />
                    <Text style={styles.evLiveBadgeText}>LIVE</Text>
                  </Animated.View>
                ) : timeUntil ? (
                  <View style={styles.evTimeBadge}>
                    <Text style={styles.evTimeBadgeValue}>{timeUntil} away</Text>
                  </View>
                ) : null}
              </View>
              {ev.start_time && (
                <View style={styles.evHeaderDetailRow}>
                  <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
                  <Text style={styles.evHeaderDetailText}>{formatDay(ev.start_time)}, {formatTime(ev.start_time)}</Text>
                </View>
              )}
              <View style={styles.evHeaderDetailRow}>
                {ev.creator && <Text style={styles.evHeaderDetailText}>{ev.creator.name || 'Unknown'}</Text>}
                {ev.creator && current > 0 && <Text style={styles.evHeaderDetailText}> · {current} going</Text>}
                {!ev.creator && current > 0 && <Text style={styles.evHeaderDetailText}>{current} going</Text>}
              </View>
            </View>

            {/* Share + Close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity style={styles.evCloseBtn} onPress={() => setShowShareModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="share-outline" size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.evCloseBtn} onPress={closeEventDetail} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* RSVP button — accessible from collapsed peek */}
          {eventRsvpStatus === 'going' ? (
            <View style={styles.evCancelRow}>
              <TouchableOpacity style={styles.evRouteBtn} onPress={handleEventStartRoute} activeOpacity={0.8}>
                <Ionicons name="navigate" size={16} color={colors.interactiveText} />
                <Text style={styles.evRouteText}>Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.evCancelBtn} onPress={handleEventCancelRSVP} disabled={eventRsvpLoading} activeOpacity={0.7}>
                {eventRsvpLoading ? <ActivityIndicator color={colors.error} /> : <Text style={styles.evCancelText}>Cancel RSVP</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.evRsvpBtn, isAtCapacity && styles.evRsvpDisabled]}
              onPress={handleEventRSVP}
              disabled={eventRsvpLoading || isAtCapacity}
              activeOpacity={0.8}
            >
              {eventRsvpLoading
                ? <ActivityIndicator color={colors.interactiveText} />
                : <Text style={styles.evRsvpText}>{isAtCapacity ? 'Event full' : "I'm going"}</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Expanded body: scrollable content + pinned action buttons ── */}
        <View style={{ flex: 1 }}>
          <ScrollView
            scrollEnabled
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: spacing.sm }}
          >

            {/* ── Organizer ── */}
            {ev.creator && (
              <View style={styles.evSection}>
                <Text style={styles.evSectionLabel}>Organizer</Text>
                <View style={styles.evOrgRow}>
                  <View style={[styles.evOrgAvatar, { backgroundColor: cat.color + '20' }]}>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: cat.color }}>
                      {ev.creator.name?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.evOrgName}>{ev.creator.name || 'Unknown'}</Text>
                    {ev.creator.reputation_score ? (
                      <Text style={styles.evOrgSub}>{ev.creator.reputation_score} reputation</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={handleEventToggleSave} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={eventIsSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={eventIsSaved ? colors.accent : colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Date, Time & Location ── */}
            <View style={styles.evSection}>
              <Text style={styles.evSectionLabel}>Date, Time & Location</Text>
              <View style={styles.evInfoGrid}>
                <View style={[styles.evInfoCard, { flex: 1 }]}>
                  <View style={[styles.evInfoCardIconBadge, { backgroundColor: colors.surfaceGray }]}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  </View>
                  <Text style={styles.evInfoCardMain} numberOfLines={1}>
                    {formatDay(ev.start_time)}
                  </Text>
                  <Text style={styles.evInfoCardSub} numberOfLines={1}>
                    {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                  </Text>
                  {ev.is_recurring && ev.recurrence_pattern && (
                    <View style={styles.evRecurBadge}>
                      <Ionicons name="repeat-outline" size={9} color={colors.accent} />
                      <Text style={[styles.evRecurBadgeText, { color: colors.accent }]}>
                        {ev.recurrence_pattern.frequency === 'daily' ? 'Daily'
                          : ev.recurrence_pattern.frequency === 'weekly' ? 'Weekly'
                          : 'Recurring'}
                      </Text>
                    </View>
                  )}
                </View>

                {ev.location_name ? (
                  <TouchableOpacity
                    style={[styles.evInfoCard, { flex: 1 }]}
                    onPress={handleEventStartRoute}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.evInfoCardIconBadge, { backgroundColor: colors.accentTint }]}>
                      <Ionicons name="location-outline" size={16} color={colors.accent} />
                    </View>
                    <Text style={styles.evInfoCardMain} numberOfLines={1}>{ev.location_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                      <Text style={[styles.evInfoCardSub, { color: colors.accent }]}>Directions</Text>
                      <Ionicons name="chevron-forward" size={10} color={colors.accent} />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.evInfoCard, { flex: 1 }]}>
                    <View style={[styles.evInfoCardIconBadge, { backgroundColor: colors.surfaceGray }]}>
                      <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                    </View>
                    <Text style={[styles.evInfoCardMain, { color: colors.textMuted }]}>No location</Text>
                    <Text style={styles.evInfoCardSub}>Not specified</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── Attendees ── */}
            {current > 0 && (
              <View style={styles.evSection}>
                <Text style={styles.evSectionLabel}>Going</Text>
                <View style={styles.evAttendeesRow}>
                  {Array.from({ length: Math.min(current, 4) }).map((_, i) => {
                    const hues = [cat.color, '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];
                    return (
                      <View key={i} style={[styles.evAttendeeAvatar, { backgroundColor: hues[i % hues.length], marginLeft: i === 0 ? 0 : -8 }]}>
                        <Text style={styles.evAttendeeAvatarText}>{'ABCDE'[i]}</Text>
                      </View>
                    );
                  })}
                  {current > 4 && (
                    <View style={[styles.evAttendeeOverflow, { marginLeft: -8 }]}>
                      <Text style={styles.evAttendeeOverflowText}>+{current - 4}</Text>
                    </View>
                  )}
                  <Text style={styles.evAttendeeLabel}>{current} {current === 1 ? 'person' : 'people'} going</Text>
                </View>
                {ev.max_attendees && (
                  <View style={styles.evCapacitySection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={styles.evCapacityLabel}>{current} / {ev.max_attendees} spots filled</Text>
                      <Text style={[styles.evCapacityLabel, { color: isAtCapacity ? colors.error : colors.accent }]}>
                        {isAtCapacity ? 'Full' : `${ev.max_attendees - current} left`}
                      </Text>
                    </View>
                    <View style={styles.evCapacityBar}>
                      <View style={[styles.evCapacityFill, {
                        width: `${Math.min((current / ev.max_attendees) * 100, 100)}%`,
                        backgroundColor: isAtCapacity ? colors.error : colors.accent,
                      }]} />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── Description ── */}
            {ev.description && (
              <View style={styles.evSection}>
                <Text style={styles.evSectionLabel}>Description</Text>
                <Text style={styles.evDescText} numberOfLines={4}>{ev.description}</Text>
              </View>
            )}

          </ScrollView>

          {/* Action buttons — Chat + Review only, Share moved to header */}
          <View style={[styles.evActionBtnGroup, { paddingBottom: footerPad, paddingHorizontal: spacing.md, gap: 10 }]}>
            <TouchableOpacity
              style={styles.evActionBtnLarge}
              onPress={() => setShowEventChat(true)}
              activeOpacity={0.8}
            >
              <View style={styles.evActionBtnInner}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
                <Text style={styles.evActionBtnLargeLabel}>Chat</Text>
                {eventUnreadCounts[selectedEventId ?? ev.id] > 0 && (
                  <View style={styles.evChatUnreadBadge}>
                    <Text style={styles.evChatUnreadText}>
                      {eventUnreadCounts[selectedEventId ?? ev.id] > 99 ? '99+' : eventUnreadCounts[selectedEventId ?? ev.id]}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.evActionBtnLarge, { backgroundColor: colors.accentTint }]}
              onPress={() => { closeEventDetail(); setTimeout(() => navigation.navigate('ItemReviews', { itemType: 'event', itemId: selectedEventId, itemTitle: ev.title }), 300); }}
              activeOpacity={0.8}
            >
              <View style={styles.evActionBtnInner}>
                {eventReviewCount > 0
                  ? <Ionicons name="star" size={20} color={colors.accent} />
                  : <Ionicons name="star-outline" size={20} color={colors.accent} />}
                <Text style={[styles.evActionBtnLargeLabel, { color: colors.accent }]}>
                  {eventReviewCount > 0 ? `${eventAvgRating.toFixed(1)} (${eventReviewCount})` : 'Review'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    );
  };

  const renderDetailContent = () => {
    const detailItem = selectedPin || selectedPoi;
    if (!detailItem) return null;
    const isPoiDetail = !!selectedPoi && (!selectedPin || detailItem.id === selectedPoi.id);
    const isReportPin = !isPoiDetail && selectedPin?.id?.startsWith('report-');
    const variant = isPoiDetail ? 'default' : getPinVariant(detailItem);
    const typeLabel = (detailItem.type || 'pin').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    // For POIs, show the raw category (e.g. "University") rather than the mapped pin type ("Default")
    const displayTypeLabel = isPoiDetail && selectedPoi?.category
      ? selectedPoi.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      : typeLabel;
    const iconName = PIN_ICONS[detailItem.type] || PIN_ICONS.default;
    const pinTypeColor = PIN_TYPE_COLORS[detailItem.type] || PIN_TYPE_COLORS.default;

    // Star rating helpers
    const fullStars = Math.floor(averageRating);
    const hasHalf = averageRating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

    // Creator info
    const resolvedCreatorName =
      (detailItem.user_id && user?.id && detailItem.user_id === user.id ? 'You' : null) ||
      detailItem.creator_name ||
      detailItem.creator?.name ||
      detailItem.user?.name ||
      detailItem.display_name ||
      detailItem.full_name ||
      detailItem.username ||
      detailItem.creator_username ||
      detailItem.user_username ||
      null;
    const creatorInitial = resolvedCreatorName
      ? resolvedCreatorName.charAt(0).toUpperCase()
      : null;
    const creatorName = resolvedCreatorName;
    const addedAgo = detailItem.created_at ? formatReportTime(detailItem.created_at) : null;
    const AVATAR_COLORS = ['#3DDC91', '#5B8AF5', '#F5A623', '#E8716A', '#A78BFA', '#34D399'];
    const creatorAvatarColor = resolvedCreatorName
      ? AVATAR_COLORS[resolvedCreatorName.charCodeAt(0) % AVATAR_COLORS.length]
      : colors.surfaceGray;
    const reportData = isReportPin ? detailItem.__report || null : null;
    const reportTypeLabel = reportData?.type
      ? reportData.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      : typeLabel;
    const hasBodyContent = Boolean(
      detailItem.description ||
      (detailItem.photo_urls && detailItem.photo_urls.length > 0) ||
      (detailItem.photos && detailItem.photos.length > 0)
    );
    const detailConfidence =
      typeof detailItem.recommendation_confidence === 'number'
        ? Math.round(detailItem.recommendation_confidence * 100)
        : 0;
    const detailFreshness =
      typeof detailItem.recommendation_freshness === 'string' ? detailItem.recommendation_freshness : null;
    const detailLiveStatus =
      typeof detailItem.recommendation_status === 'string' ? detailItem.recommendation_status : null;
    const detailFooterHeight = isPoiDetail ? 8 + 42 + 6 : 20 + 42 + 10; // tighter footer for POI "Add to Community"

    // POI layout: compact card-style sheet (shorter height, tighter vertical spacing)
    if (isPoiDetail) {
      return (
        <View style={{ paddingBottom: insets.bottom + spacing.md }}>
          {/* Header + close */}
          <View style={styles.detailHeader2}>
            <View style={styles.detailHeaderBody}>
              <Text style={styles.detailTitle2} numberOfLines={2}>{detailItem.title}</Text>
            </View>
            <TouchableOpacity
              style={styles.detailCloseButton}
              onPress={() => {
                handleRecenter();
                setSelectedPin(null);
                setSelectedPoi(null);
                setSheetContent('search');
                safeSnapToIndex(SHEET_INDEX.COLLAPSED);
              }}
            >
              <Ionicons name="close" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Unlock text + optional address */}
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                Add to Community to unlock reviews, saves & reports
              </Text>
            </View>
            {selectedPoi?.address ? (
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>{selectedPoi.address}</Text>
            ) : null}
          </View>

          {/* Actions near bottom */}
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
            <View style={styles.detailActionsRow2}>
              <TouchableOpacity
                style={[styles.detailRouteButton2, { flex: 1 }]}
                onPress={startNavigation}
                activeOpacity={0.82}
              >
                <Ionicons name="navigate" size={16} color="#000000" />
                <Text style={styles.detailRouteButtonText2}>Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.detailSecondaryBtn2, { flex: 1 }]}
                onPress={() => { void handleAddPoiToCommunity(); }}
                activeOpacity={0.82}
                disabled={isCreatingPoiPin}
              >
                {isCreatingPoiPin ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={16} color={colors.text} />
                    <Text style={styles.detailSecondaryBtnText2}>Add to Map</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, overflow: 'hidden' }}>

        {/* ── STICKY HEADER (stays pinned while body scrolls) ── */}
        <View style={styles.detailStickyTop}>
        {/* ── HEADER ── */}
        <View style={styles.detailHeader2}>
          {/* Left: icon badge */}
          {!isPoiDetail && (
            <View style={[styles.detailTypeIconBadge2, { backgroundColor: (isReportPin ? colors.warning : pinTypeColor) + '16' }]}>
              {!isReportPin && <View style={[styles.detailTypeIconRing, { borderColor: pinTypeColor + '38' }]} />}
              <Ionicons
                name={(isReportPin ? (REPORT_ICONS[reportData?.type] || REPORT_ICON_DEFAULT) : iconName) as any}
                size={26}
                color={isReportPin ? colors.warning : pinTypeColor}
              />
            </View>
          )}

          {/* Center: title + meta */}
          <View style={styles.detailHeaderBody}>
            <Text style={styles.detailTitle2} numberOfLines={2}>{detailItem.title}</Text>

            {isReportPin ? (
              <View style={styles.detailMetaRow}>
                <View style={[styles.detailTypePill, { backgroundColor: colors.warning + '18' }]}>
                  <Text style={[styles.detailTypePillText, { color: colors.warning }]}>{reportTypeLabel}</Text>
                </View>
                <Text style={styles.detailMetaDot}>·</Text>
                <Text style={styles.detailMetaMuted}>
                  {reportData?.created_at ? formatReportTime(reportData.created_at) : 'Just now'}
                </Text>
              </View>
            ) : !isPoiDetail ? (
              <View style={styles.detailMetaRow}>
                {reviewCount > 0 ? (
                  <View style={styles.detailMetaChip}>
                    <Ionicons name="star" size={11} color="#FFB800" />
                    <Text style={styles.detailMetaStrong}>{averageRating.toFixed(1)}</Text>
                    <Text style={styles.detailMetaMuted}>({reviewCount})</Text>
                  </View>
                ) : (
                  <View style={styles.detailMetaChip}>
                    <Ionicons name="star-outline" size={11} color={colors.textMuted} />
                    <Text style={styles.detailMetaMuted}>No reviews</Text>
                  </View>
                )}
                <Text style={styles.detailMetaDot}>·</Text>
                <View style={[styles.detailTypePill, { backgroundColor: pinTypeColor + '16' }]}>
                  <Text style={[styles.detailTypePillText, { color: pinTypeColor }]}>{displayTypeLabel}</Text>
                </View>
                {detailItem.distance_meters != null && (
                  <>
                    <Text style={styles.detailMetaDot}>·</Text>
                    <Text style={styles.detailMetaMuted}>
                      {detailItem.distance_meters >= 1000
                        ? `${(detailItem.distance_meters / 1000).toFixed(1)} km`
                        : `${Math.round(detailItem.distance_meters)} m`}
                    </Text>
                  </>
                )}
              </View>
            ) : null}
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={styles.detailCloseButton}
            onPress={() => {
              handleRecenter();
              setSelectedPin(null);
              setSelectedPoi(null);
              setSheetContent('search');
              safeSnapToIndex(SHEET_INDEX.COLLAPSED);
            }}
          >
            <Ionicons name="close" size={17} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── ACTION BUTTONS ── */}
        <View style={styles.detailActionsRow2}>
          <TouchableOpacity
            style={[styles.detailRouteButton2, isPoiDetail && { flex: 1 }]}
            onPress={startNavigation}
            activeOpacity={0.82}
          >
            <Ionicons name="navigate" size={16} color="#000000" />
            <Text style={styles.detailRouteButtonText2}>Directions</Text>
          </TouchableOpacity>

          {isPoiDetail ? (
            <TouchableOpacity
              style={[styles.detailSecondaryBtn2, { flex: 1 }]}
              onPress={() => { void handleAddPoiToCommunity(); }}
              activeOpacity={0.82}
              disabled={isCreatingPoiPin}
            >
              {isCreatingPoiPin
                ? <ActivityIndicator size="small" color={colors.text} />
                : <>
                    <Ionicons name="add-circle-outline" size={16} color={colors.text} />
                    <Text style={styles.detailSecondaryBtnText2}>Add to Map</Text>
                  </>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              ref={(r) => { moreButtonRef.current = r; }}
              style={styles.detailSecondaryBtn2}
              onPress={() => {
                if (isReportPin) { if (reportData) setSelectedReport(reportData); return; }
                handleMorePinActions();
              }}
              activeOpacity={0.82}
            >
              <Ionicons name={isReportPin ? 'chatbubble-ellipses-outline' : 'ellipsis-horizontal'} size={16} color={colors.text} />
              <Text style={styles.detailSecondaryBtnText2}>{isReportPin ? 'Discuss' : 'More'}</Text>
            </TouchableOpacity>
          )}

          {!isReportPin && !isPoiDetail && (
            <>
              <TouchableOpacity style={styles.detailIconBtn2} onPress={handleToggleSave} activeOpacity={0.75}>
                <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved ? colors.accent : colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailIconBtn2} onPress={handleSharePin} activeOpacity={0.75}>
                <Ionicons name="share-outline" size={18} color={colors.text} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── EXPAND DIVIDER — visual cap of the sticky zone ── */}
        {!isReportPin && !isPoiDetail && <View style={styles.detailExpandDivider} />}
        </View>{/* end detailStickyTop */}

        {/* ── SCROLLABLE BODY + FOOTER ── */}
        <View
          style={
            sheetIndex === SHEET_INDEX.COLLAPSED && (animatingToSheetIndex == null || animatingToSheetIndex === SHEET_INDEX.COLLAPSED)
              ? { height: 0, overflow: 'hidden' as const }
              : { flex: 1, minHeight: 0, overflow: 'hidden' as const }
          }
        >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          style={[styles.sheetScrollBackground, { flex: 1, overflow: 'hidden' }]}
          contentContainerStyle={{
            paddingBottom: (isPoiDetail ? 0 : spacing.sm) + detailFooterHeight,
          }}
        >

        {/* POI unlock prompt */}
        {isPoiDetail && (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
              <Text style={{ ...typography.caption, color: colors.textMuted }}>
                Add to Community to unlock reviews, saves & reports
              </Text>
            </View>
            {selectedPoi?.address ? (
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>{selectedPoi.address}</Text>
            ) : null}
          </View>
        )}

        {/* Report detail body */}
        {isReportPin && (
          <>
            {/* Photo — full width, shown first if present */}
            {reportData?.image_url ? (
              <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
                <Image
                  source={{ uri: reportData.image_url }}
                  style={{ width: '100%', height: 200, borderRadius: borderRadius.md, backgroundColor: colors.surfaceGray }}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* Description */}
            <View style={styles.detailFlatSection}>
              <Text style={styles.detailFlatLabel}>What's happening</Text>
              {detailItem.description ? (
                <Text style={styles.detailFlatBody}>{detailItem.description}</Text>
              ) : (
                <Text style={styles.detailFlatEmpty}>No details added.</Text>
              )}
            </View>

            {/* Divider */}
            <View style={styles.detailExpandDivider} />

            {/* Reporter row — styled like "Posted by" */}
            <View style={styles.detailCreatorRow2}>
              <View style={[styles.detailCreatorAvatar2, { backgroundColor: reportData?.is_anonymous ? colors.surfaceGray : creatorAvatarColor }]}>
                {reportData?.is_anonymous || !creatorInitial ? (
                  <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                ) : (
                  <Text style={styles.detailCreatorAvatarText2}>{creatorInitial}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailCreatorName2}>
                  {reportData?.is_anonymous ? 'Anonymous' : (resolvedCreatorName || 'Community member')}
                </Text>
                <Text style={styles.detailCreatorSub2}>
                  {reportData?.created_at ? `Reported ${formatReportTime(reportData.created_at)}` : 'Recently reported'}
                </Text>
              </View>
              <View style={styles.detailCreatorBadge}>
                <Ionicons name="flag-outline" size={10} color={colors.textMuted} />
                <Text style={styles.detailCreatorBadgeText}>Report</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.detailExpandDivider} />

            {/* Upvote / flag actions */}
            <View style={[styles.detailFlatSection, styles.detailFlatSectionSpaced]}>
              <Text style={styles.detailFlatLabel}>Is this accurate?</Text>
              <View style={styles.verifyRow}>
                <TouchableOpacity
                  style={[styles.verifyBtn, styles.verifyBtnYes]}
                  activeOpacity={0.75}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    showToast('Thanks for confirming!', 'success');
                  }}
                >
                  <Ionicons name="checkmark" size={14} color={colors.accent} />
                  <Text style={styles.verifyBtnYesText}>Still happening</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.verifyBtn, styles.verifyBtnNo]}
                  activeOpacity={0.75}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    showToast('Thanks for the update!', 'info');
                  }}
                >
                  <Ionicons name="close" size={14} color={colors.warning} />
                  <Text style={styles.verifyBtnNoText}>No longer true</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ── ABOUT ── */}
        {!isReportPin && !isPoiDetail && (
          <View style={styles.detailFlatSection}>
            <Text style={styles.detailFlatLabel}>About</Text>
            {detailItem.description ? (
              <Text style={styles.detailFlatBody} numberOfLines={6}>{detailItem.description}</Text>
            ) : (
              <Text style={styles.detailFlatEmpty}>No description added yet.</Text>
            )}
          </View>
        )}

        {/* ── LOCATION DETAILS (building / floor / access) ── */}
        {!isReportPin && !isPoiDetail && (detailItem.building || detailItem.floor || detailItem.access_notes) && (
          <View style={[styles.detailFlatSection, styles.detailFlatSectionSpaced]}>
            <Text style={styles.detailFlatLabel}>Location</Text>
            <View style={styles.detailInfoRows}>
              {(() => {
                const rows = [
                  detailItem.building ? { icon: 'business-outline', text: detailItem.building } : null,
                  detailItem.floor ? { icon: 'layers-outline', text: `Floor ${detailItem.floor}` } : null,
                  detailItem.access_notes ? { icon: 'key-outline', text: detailItem.access_notes } : null,
                ].filter(Boolean) as { icon: string; text: string }[];
                return rows.map((row, i) => (
                  <View key={row.icon}>
                    {i > 0 && <View style={styles.detailInfoRowDivider} />}
                    <View style={styles.detailInfoRow}>
                      <View style={styles.detailInfoRowIcon}>
                        <Ionicons name={row.icon as any} size={14} color={colors.textSecondary} />
                      </View>
                      <Text style={styles.detailInfoRowText}>{row.text}</Text>
                    </View>
                  </View>
                ));
              })()}
            </View>
          </View>
        )}

        {/* ── POSTED BY ── */}
        {!isReportPin && !isPoiDetail && (
          <View style={styles.detailCreatorRow2}>
            <View style={[styles.detailCreatorAvatar2, { backgroundColor: creatorAvatarColor }]}>
              <Text style={styles.detailCreatorAvatarText2}>{creatorInitial || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailCreatorName2}>{creatorName || 'Community member'}</Text>
              <Text style={styles.detailCreatorSub2}>{addedAgo ? `Posted ${addedAgo}` : 'Recently added'}</Text>
            </View>
            <View style={styles.detailCreatorBadge}>
              <Ionicons name="person-outline" size={10} color={colors.textMuted} />
              <Text style={styles.detailCreatorBadgeText}>Member</Text>
            </View>
          </View>
        )}

        {/* ── VERIFY ── */}
        {!isReportPin && !isPoiDetail && (
          <View style={[styles.detailFlatSection, styles.detailFlatSectionSpaced]}>
            <Text style={styles.detailFlatLabel}>Is this still accurate?</Text>
            {verifyStatus === 'done' ? (
              <View style={styles.verifyDoneRow}>
                <Ionicons
                  name={verifyChoice ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={verifyChoice ? colors.accent : colors.warning}
                />
                <Text style={[styles.verifyDoneText, { color: verifyChoice ? colors.accent : colors.warning }]}>
                  {verifyChoice ? 'You marked this as accurate' : 'You flagged this as inaccurate'}
                </Text>
              </View>
            ) : (
              <View style={styles.verifyRow}>
                <TouchableOpacity
                  style={[styles.verifyBtn, styles.verifyBtnYes, verifyStatus === 'submitting' && verifyChoice === true && styles.verifyBtnSubmitting]}
                  onPress={() => handleVerifyPin(true)}
                  disabled={verifyStatus === 'submitting'}
                  activeOpacity={0.75}
                >
                  {verifyStatus === 'submitting' && verifyChoice === true
                    ? <ActivityIndicator size="small" color={colors.accent} />
                    : <><Ionicons name="checkmark" size={14} color={colors.accent} /><Text style={styles.verifyBtnYesText}>Still here</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.verifyBtn, styles.verifyBtnNo, verifyStatus === 'submitting' && verifyChoice === false && styles.verifyBtnSubmitting]}
                  onPress={() => handleVerifyPin(false)}
                  disabled={verifyStatus === 'submitting'}
                  activeOpacity={0.75}
                >
                  {verifyStatus === 'submitting' && verifyChoice === false
                    ? <ActivityIndicator size="small" color={colors.warning} />
                    : <><Ionicons name="close" size={14} color={colors.warning} /><Text style={styles.verifyBtnNoText}>Gone / wrong</Text></>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── PHOTOS ── */}
        {!isReportPin && !isPoiDetail && (() => {
          const photoList = (detailItem.photo_urls || detailItem.photos || []) as string[];
          return (
            <View style={[styles.detailFlatSection, styles.detailFlatSectionSpaced]}>
              <View style={styles.detailFlatLabelRow}>
                <Text style={[styles.detailFlatLabel, { marginBottom: 0 }]}>Photos</Text>
                {photoList.length > 0 && (
                  <View style={styles.detailFlatCountBadge}>
                    <Text style={styles.detailFlatCountBadgeText}>{photoList.length}</Text>
                  </View>
                )}
              </View>
              {photoList.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: spacing.md }}
                >
                  {photoList.slice(0, 6).map((uri: string, i: number) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.detailImageThumbWrap}
                      activeOpacity={0.82}
                      onPress={() => setPreviewImageUri(uri)}
                    >
                      <Image source={{ uri }} style={styles.detailImageThumb} resizeMode="cover" />
                      {i === 5 && photoList.length > 6 && (
                        <View style={styles.detailImageThumbOverlay}>
                          <Text style={styles.detailImageThumbOverlayText}>+{photoList.length - 6}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.detailPhotoEmptyRow}>
                  <View style={[styles.detailPhotoEmptyIconWrap, { backgroundColor: pinTypeColor + '16' }]}>
                    <Ionicons name="camera-outline" size={20} color={pinTypeColor} />
                  </View>
                  <Text style={styles.detailFlatEmpty}>No photos yet</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* ── REVIEWS ── */}
        {!isReportPin && !isPoiDetail && (
          <View style={[styles.detailFlatSection, styles.detailFlatSectionSpaced]}>
            <View style={styles.detailFlatLabelRow}>
              <Text style={[styles.detailFlatLabel, { marginBottom: 0 }]}>Reviews</Text>
              {reviewCount > 0 && (
                <View style={styles.detailFlatCountBadge}>
                  <Text style={styles.detailFlatCountBadgeText}>{reviewCount}</Text>
                </View>
              )}
            </View>
            {reviewCount > 0 ? (
              <TouchableOpacity style={styles.detailReviewRow2} onPress={handleViewReviews} activeOpacity={0.75}>
                <Text style={styles.detailReviewScore2}>{averageRating.toFixed(1)}</Text>
                <View style={styles.detailReviewMid2}>
                  <View style={styles.detailReviewStarsRow2}>
                    {Array(fullStars).fill(0).map((_, i) => <Ionicons key={`f${i}`} name="star" size={12} color="#FFB800" />)}
                    {hasHalf && <Ionicons name="star-half" size={12} color="#FFB800" />}
                    {Array(emptyStars).fill(0).map((_, i) => <Ionicons key={`e${i}`} name="star-outline" size={12} color="#FFB800" />)}
                  </View>
                  <Text style={styles.detailReviewCountLabel2}>{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</Text>
                </View>
                <View style={styles.detailReviewViewAllBtn2}>
                  <Text style={styles.detailReviewViewAllText2}>View all</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.detailFlatEmptyRow}>
                <Ionicons name="star-outline" size={14} color={colors.textMuted} />
                <Text style={styles.detailFlatEmpty}>No reviews yet</Text>
              </View>
            )}
          </View>
        )}

        {/* ── REPORTS ── */}
        {!isReportPin && !isPoiDetail && (
          <View style={[styles.detailFlatSection, styles.detailFlatSectionSpaced]}>
            <View style={styles.detailFlatLabelRow}>
              <Text style={[styles.detailFlatLabel, { marginBottom: 0 }]}>Reports</Text>
              {pinReports.length > 0 && (
                <View style={styles.detailFlatCountBadge}>
                  <Text style={styles.detailFlatCountBadgeText}>{pinReports.length}</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={handleAddReportFromPin}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.detailFlatLabelBtn}
              >
                <Ionicons name="add" size={12} color={colors.textSecondary} />
                <Text style={styles.detailFlatLabelBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
              {pinReports.length === 0 ? (
                <View style={styles.detailFlatEmptyRow}>
                  <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.detailFlatEmpty}>No reports for this pin</Text>
                </View>
              ) : (
                <View style={styles.detailReportsList}>
                  {pinReports.map((report: any, index: number) => {
                    const reportIcon = REPORT_ICONS[report.type] || REPORT_ICON_DEFAULT;
                    const rTypeLabel = (report.type || 'report').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                    const unreadCount = unreadCounts[report.id] ?? 0;
                    const isOwner = user?.id && report.user_id === user.id;
                    return (
                      <TouchableOpacity
                        key={report.id || index}
                        style={styles.detailReportItem}
                        onPress={() => report.id && setSelectedReport(report)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.detailReportIconContainer, { backgroundColor: colors.warning + '18' }]}>
                          <Ionicons name={reportIcon as any} size={14} color={colors.warning} />
                        </View>
                        <View style={styles.detailReportInfo}>
                          <Text style={styles.detailReportContent} numberOfLines={2}>
                            {report.content || rTypeLabel}
                          </Text>
                          <View style={styles.detailReportMetaRow}>
                            <View style={styles.detailReportTypePill}>
                              <Text style={styles.detailReportTypePillText}>{rTypeLabel}</Text>
                            </View>
                            <Text style={styles.detailReportTime}>
                              {report.created_at ? formatReportTime(report.created_at) : ''}
                            </Text>
                          </View>
                        </View>
                        {unreadCount > 0 && (
                          <View style={styles.detailReportUnreadBadge}>
                            <Text style={styles.detailReportUnreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                          </View>
                        )}
                        {isOwner ? (
                          <TouchableOpacity
                            style={styles.detailReportDeleteBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={async (e) => {
                              e.stopPropagation();
                              try { await reportAPI.delete(report.id); loadPinReports(); } catch {}
                            }}
                          >
                            <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                          </TouchableOpacity>
                        ) : (
                          <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
          </View>
        )}

        </BottomSheetScrollView>

      {/* ── FIXED FOOTER (absolute so it sticks to bottom of sheet) ── */}
      {!isReportPin && !isPoiDetail && (
        <View
          style={[
            styles.detailFixedFooter,
            styles.detailFixedFooterAbsolute,
            { paddingBottom: 10 },
          ]}
        >
          <TouchableOpacity style={styles.detailWriteReviewBtn} onPress={handleWriteReview} activeOpacity={0.82}>
            <Ionicons name="create-outline" size={15} color={colors.interactiveText} />
            <Text style={styles.detailWriteReviewText}>
              {reviewCount > 0 ? 'Write a review' : 'Be the first to review'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.detailCreateReportButton} onPress={handleAddReportFromPin} activeOpacity={0.7}>
            <Ionicons name="flag-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.detailCreateReportText}>Add a report</Text>
          </TouchableOpacity>
        </View>
      )}
        </View>
      </View>
    );
  };

  // ── Main Render ──────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Layer 0: The Map */}
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MAPBOX_STYLE_STANDARD}
        logoEnabled={false}
        scaleBarEnabled={false}
        onPress={handleMapPress}
        onLongPress={handleMapLongPress}
        onRegionDidChange={(feature: any) => {
          const z = feature?.properties?.zoomLevel;
          const b = feature?.properties?.heading;
          if (z != null) setZoomLevel(z);
          if (b != null) setMapBearing(b);
          if (modeRef.current === 'campus') {
            const centerLng = feature?.geometry?.coordinates?.[0];
            const centerLat = feature?.geometry?.coordinates?.[1];
            if (centerLng == null || centerLat == null) return;
            const outOfBounds =
              centerLng > -76.7360 || centerLng < -76.7480 ||
              centerLat > 18.0240  || centerLat < 18.0170;
            const zoomedOut = z != null && z < 14;
            if (outOfBounds || zoomedOut) {
              cameraRef.current?.fitBounds(
                [-76.7360, 18.0240],
                [-76.7480, 18.0170],
                [60, 40, SHEET_PEEK_BASE + 60, 40],
                500
              );
            }
          }
        }}
      >
        {stableLightPreset.current && (
          <MapboxGL.StyleImport
            id="basemap"
            existing
            config={{
              lightPreset: stableLightPreset.current,
              showPointOfInterestLabels: 'true',
            }}
          />
        )}


        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={14}
          centerCoordinate={[-76.7479, 18.0179]}
          animationMode="none"
          animationDuration={0}
        />

        {zoomLevel >= 13
          ? mapFilteredPins.map((pin, index) => renderPin(pin, index))
          : pinClusters.map((cluster, index) =>
              cluster.count === 1
                ? renderPin(cluster.items[0], index)
                : (
                  <MapboxGL.MarkerView
                    key={`cluster-pin-${index}`}
                    coordinate={cluster.center}
                    anchor={{ x: 0.5, y: 0.5 }}
                    allowOverlap
                    allowOverlapWithPuck
                  >
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        cameraRef.current?.setCamera({
                          centerCoordinate: cluster.center,
                          zoomLevel: zoomLevel + 2,
                          animationDuration: 600,
                          padding: { paddingBottom: sheetPeek, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.clusterBadge}>
                        <Text style={styles.clusterCount} numberOfLines={1}>
                          {cluster.count > 99 ? '99+' : cluster.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </MapboxGL.MarkerView>
                )
            )
        }
        {zoomLevel >= 13
          ? mapFilteredEvents.map((event, index) => renderEvent(event, index))
          : eventClusters.map((cluster, index) =>
              cluster.count === 1
                ? renderEvent(cluster.items[0], index)
                : (
                  <MapboxGL.MarkerView
                    key={`cluster-event-${index}`}
                    coordinate={cluster.center}
                    anchor={{ x: 0.5, y: 0.5 }}
                    allowOverlap
                    allowOverlapWithPuck
                  >
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        cameraRef.current?.setCamera({
                          centerCoordinate: cluster.center,
                          zoomLevel: zoomLevel + 2,
                          animationDuration: 600,
                          padding: { paddingBottom: sheetPeek, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.clusterBadge, styles.clusterBadgeEvent]}>
                        <Text style={[styles.clusterCount, styles.clusterCountEvent]} numberOfLines={1}>
                          {cluster.count > 99 ? '99+' : cluster.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </MapboxGL.MarkerView>
                )
            )
        }
        {mapFilteredReports.map((report, index) => renderReport(report, index))}

        {userLocation && <AnimatedUserMarker coordinate={userLocation} />}

        {routeCoordinates && (
          <MapboxGL.ShapeSource
            id="routeSource"
            shape={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: routeCoordinates },
            }}
          >
            {/* White halo casing */}
            <MapboxGL.LineLayer
              id="routeCasing"
              style={{
                lineColor: '#FFFFFF',
                lineWidth: 11,
                lineOpacity: 0.25,
                lineCap: 'round',
                lineJoin: 'round',
                lineEmissiveStrength: 1,
              }}
            />
            {/* Solid mint base */}
            <MapboxGL.LineLayer
              id="routeLine"
              style={{
                lineColor: '#3DDC91',
                lineWidth: 7,
                lineOpacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
                lineEmissiveStrength: 1,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        <RouteShimmer routeCoordinates={routeCoordinates} />
      </MapboxGL.MapView>

      {/* Time-of-day tint overlay — skip when route is visible so the route line stays bright (not darkened by overlay or map style fog) */}
      {!routeCoordinates?.length && (() => {
        const hour = new Date().getHours();
        let tint = 'transparent';
        if (hour >= 5 && hour < 8)  tint = 'rgba(147, 197, 253, 0.05)'; // dawn — cool blue
        else if (hour >= 18 && hour < 21) tint = 'rgba(251, 191, 36, 0.05)'; // dusk — warm amber
        else if (hour >= 21 || hour < 5) tint = 'rgba(30, 30, 60, 0.07)';   // night — deep blue
        if (tint === 'transparent') return null;
        return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: tint }]} pointerEvents="none" />;
      })()}

      {/* Happening Now floating banner */}
      {bannerVisible && happeningNowEvent && (
        <Animated.View
          style={[
            styles.happeningBanner,
            { bottom: sheetPeek + spacing.md, transform: [{ translateY: bannerAnim }] },
          ]}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.happeningBannerDot, { transform: [{ scale: pulseAnim }] }]} />
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.8}
            onPress={() => openEventDetail(happeningNowEvent.id)}
          >
            <Text style={styles.happeningBannerText} numberOfLines={1}>
              {happeningNowEvent.title}
              {liveEventCount > 1 ? ` +${liveEventCount - 1} more` : ''}
            </Text>
            <Text style={styles.happeningBannerSub}>Happening now · Tap to view</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.happeningBannerClose}
            onPress={() => {
              Animated.timing(bannerAnim, { toValue: -80, duration: 250, useNativeDriver: true }).start(() => {
                setBannerVisible(false);
              });
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {showLongPressCoachmark && !isNavigating && !selectedPin && !selectedPoi && sheetContent === 'search' && (
        <View style={[styles.coachmarkContainer, { bottom: sheetPeek - 4 }]}>
          <View style={styles.coachmarkCard}>
            <View style={styles.coachmarkTopRow}>
              <Text style={styles.coachmarkTitle}>Drop your first pin</Text>
              <TouchableOpacity
                onPress={() => {
                  AsyncStorage.setItem(MAP_LONG_PRESS_HINT_KEY, 'true').catch(() => {});
                  setShowLongPressCoachmark(false);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.coachmarkText}>Long press anywhere on the map to place a pin, event, or report. You can also tap the <Text style={{ fontWeight: '600', color: colors.text }}>+</Text> button beside the search bar.</Text>
            <TouchableOpacity
              style={styles.coachmarkButton}
              activeOpacity={0.8}
              onPress={() => {
                AsyncStorage.setItem(MAP_LONG_PRESS_HINT_KEY, 'true').catch(() => {});
                setShowLongPressCoachmark(false);
              }}
            >
              <Text style={styles.coachmarkButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isNavigating && !previewImageUri && (
        <>
          {/* Campus mode toggle – top-left */}
          <View style={[styles.campusControl, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.recenterButton}
              onPress={() => {
                if (mode === 'campus') {
                  setMode('open_world');
                  return;
                }
                setMode('campus');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={mode === 'campus' ? 'school-outline' : 'compass-outline'}
                size={18}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          {/* Recenter control – top-right */}
          <View style={[styles.glassControls, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.recenterButton}
              onPress={handleRecenter}
              activeOpacity={0.8}
            >
              <Ionicons name="paper-plane" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

        </>
      )}

      {/* Pin celebration overlay */}
      {celebrationVisible && (
        <Animated.View
          style={[
            styles.celebrationBubble,
            {
              bottom: sheetPeek + spacing.md + 52 + spacing.md,
              opacity: celebrationOpacity,
              transform: [{ translateY: celebrationTranslateY }],
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="star" size={16} color="#fff" />
          <Text style={styles.celebrationText}>+5 reputation · Pin added!</Text>
        </Animated.View>
      )}

      {/* Navigation Overlay */}
      {isNavigating && navigationData && (
        <View style={[styles.navigationContainer, { top: insets.top + spacing.sm }]}>
          <Animated.View
            style={[
              styles.navigationCard,
              { opacity: navCardFadeAnim, transform: [{ translateY: navCardSlideAnim }] },
            ]}
          >
            <View style={styles.navCardContent}>
              {/* Direction icon + instruction */}
              <View style={styles.navigationHeader}>
                <View style={styles.navigationIconWrap}>
                  {(() => {
                    const icon = getTurnIcon(currentInstruction);
                    const transform = icon === 'arrow-back'
                      ? [{ translateX: navArrowAnim }]
                      : icon === 'arrow-forward'
                      ? [{ translateX: navArrowAnimRight }]
                      : [{ translateY: navArrowAnim }];
                    return (
                      <Animated.View style={{ transform }}>
                        <Ionicons name={icon} size={28} color="#FFFFFF" />
                      </Animated.View>
                    );
                  })()}
                </View>
                <View style={styles.navigationInfo}>
                  <Text style={styles.navigationInstruction} numberOfLines={2}>
                    {currentInstruction || 'Follow the route'}
                  </Text>
                  <View style={styles.navigationDistanceBadge}>
                    <Ionicons name="location" size={10} color={colors.accent} style={{ marginRight: 3 }} />
                    <Text style={styles.navigationDistance}>
                      {distanceToNextTurn >= 1000
                        ? `${(distanceToNextTurn / 1000).toFixed(1)} km`
                        : `In ${Math.round(distanceToNextTurn)} m`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Stats + End button row */}
              <View style={styles.navigationStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {(navigationData.distance / 1000).toFixed(1)}
                    <Text style={styles.statUnit}> km</Text>
                  </Text>
                  <Text style={styles.statLabel}>Distance</Text>
                </View>
                <View style={styles.navStatsDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {Math.round(navigationData.duration / 60)}
                    <Text style={styles.statUnit}> min</Text>
                  </Text>
                  <Text style={styles.statLabel}>ETA</Text>
                </View>
                <TouchableOpacity
                  style={styles.navStopBtn}
                  onPress={stopNavigation}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                  <Text style={styles.navStopText}>End</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      )}

      {loadingNearby && pins.length === 0 && events.length === 0 && (
        <View pointerEvents="none" style={[styles.mapLoadingOverlay, { bottom: sheetPeek + spacing.sm }]}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.mapLoadingText}>Finding nearby places…</Text>
        </View>
      )}

      {!isNavigating && weather && sheetContent === 'search' && !selectedPin && !selectedPoi && (
        <View pointerEvents="none" style={[styles.floatingWeather, { bottom: sheetPeek + spacing.sm }]}>
          <Ionicons name={weather.ionIcon as any} size={14} color={colors.text} />
          <Text style={styles.floatingWeatherText}>{weather.temp}°C</Text>
        </View>
      )}

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        backgroundStyle={styles.sheetBackground}
        handleStyle={styles.sheetHandle}
        handleIndicatorStyle={styles.sheetHandleIndicator}
        style={{ ...shadows.sheet }}
        onAnimate={handleSheetAnimate}
        onChange={handleSheetChange}
        topInset={insets.top + 60}
        animationConfigs={sheetAnimationConfigs}
      >
        <View
          style={[
            styles.sheetContentFill,
            sheetContent === 'search'
              ? { paddingBottom: isSheetExpandedForContent ? spacing.sm : 0 }
              : sheetContent === 'detail'
                ? isReportDetailSheet
                  ? { paddingBottom: spacing.xs }
                  : { paddingBottom: 0 }
                : sheetContent === 'eventDetail'
                  ? { paddingBottom: 0 }
                  : { paddingBottom: navBarHeight },
          ]}
        >
          {sheetContent === 'search' && renderSearchContent()}
          {sheetContent === 'results' && renderResultsContent()}
          {sheetContent === 'detail' && renderDetailContent()}
          {sheetContent === 'eventDetail' && renderEventDetailContent()}
        </View>
      </BottomSheet>

      {/* Report Modals (kept as overlays) */}
      {showReportModal && reportModalContext && (
        <ReportModal
          visible={showReportModal}
          onClose={() => { setShowReportModal(false); setReportModalContext(null); }}
          onSuccess={(createdReport) => {
            if (reportModalContext?.pinId) {
              loadPinReports();
            }
            if (createdReport) {
              setReports((prev) => {
                if (prev.find((r) => r.id === createdReport.id)) return prev;
                return [...prev, createdReport];
              });
            } else {
              // Fallback: refresh nearby reports
              loadNearbyReports();
            }
          }}
          lat={reportModalContext.lat}
          lng={reportModalContext.lng}
          pinId={reportModalContext.pinId}
          pinTitle={reportModalContext.pinTitle}
        />
      )}

      {reportsListContext && 'pinId' in reportsListContext && reportsListContext.pinId && (
        <ReportsListModal
          visible={showReportsListModal}
          onClose={() => { setShowReportsListModal(false); setReportsListContext(null); }}
          pinId={reportsListContext.pinId}
          pinTitle={reportsListContext.pinTitle}
          lat={reportsListContext.lat ?? userLocation?.[1] ?? 0}
          lng={reportsListContext.lng ?? userLocation?.[0] ?? 0}
        />
      )}

      <ReportChatModal
        visible={!!selectedReport}
        onClose={() => {
          setSelectedReport(null);
          // Refresh unread counts after chat is closed
          if (pinReports.length > 0) {
            const ids = pinReports.map((r: any) => r.id).filter(Boolean);
            reportChatAPI.getUnreadCounts(ids).then(setUnreadCounts).catch(() => {});
          }
        }}
        report={selectedReport}
      />

      <EventChatModal
        visible={showEventChat}
        onClose={() => {
          setShowEventChat(false);
          if (selectedEventId) {
            setEventUnreadCounts((prev) => ({ ...prev, [selectedEventId]: 0 }));
          }
        }}
        event={selectedEventData ? { id: selectedEventData.id, title: selectedEventData.title, category: selectedEventData.category } : null}
      />

      <ShareEventModal
        visible={showShareModal && !!selectedEventData}
        onClose={() => setShowShareModal(false)}
        event={selectedEventData ? {
          id: selectedEventData.id,
          title: selectedEventData.title,
          description: selectedEventData.description,
          startTime: selectedEventData.start_time,
          locationName: selectedEventData.location_name,
          shareToken: selectedEventData.share_token,
        } : { id: '', title: '', startTime: '' }}
      />

      <Modal
        visible={!!previewImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUri(null)}
      >
        <View style={styles.imagePreviewOverlay}>
          <TouchableOpacity
            style={[styles.imagePreviewCloseButton, { top: insets.top + spacing.sm }]}
            onPress={() => setPreviewImageUri(null)}
            activeOpacity={0.75}
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.imagePreviewBackdrop}
            activeOpacity={1}
            onPress={() => setPreviewImageUri(null)}
          >
            {previewImageUri ? (
              <Image source={{ uri: previewImageUri }} style={styles.imagePreviewImage} resizeMode="contain" />
            ) : null}
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        visible={showPinMoreMenu}
        transparent
        animationType="none"
        onRequestClose={() => closePinMoreMenu()}
      >
        <Pressable style={styles.pinMoreBackdrop} onPress={() => closePinMoreMenu()}>
          {(() => {
            const anchor = pinMoreAnchor;
            const canDeletePin = !!(selectedPin && user && selectedPin.user_id === user.id);
            const actionCount = 5 + (canDeletePin ? 1 : 0);
            // Title row + action rows + border/padding; used before first onLayout measurement.
            const estimatedMenuHeight = (spacing.sm + spacing.xs + 20) + (actionCount * 48) + 12;
            const menuHeight = pinMoreCardHeight || estimatedMenuHeight;
            const anchorMidY = anchor ? anchor.y + (anchor.height / 2) : height / 2;
            // Drive placement from the button's actual screen position so the menu
            // reliably appears below in raised states and above near collapsed state.
            const shouldOpenBelowAnchor = anchor ? anchorMidY < height * 0.56 : isSheetExpandedForContent;
            const anchorGap = 6;
            const fallbackLeft = width - PIN_MORE_MENU_WIDTH - spacing.md;
            const fallbackTop = shouldOpenBelowAnchor
              ? insets.top + 200
              : height - menuHeight - (navBarHeight + spacing.xl);
            const rawLeft = anchor ? anchor.x + anchor.width - PIN_MORE_MENU_WIDTH : fallbackLeft;
            const left = Math.min(Math.max(spacing.md, rawLeft), width - PIN_MORE_MENU_WIDTH - spacing.md);
            const minTop = insets.top + spacing.sm;
            const maxTop = height - menuHeight - (spacing.md + Math.max(insets.bottom, 8));
            const desiredTop = anchor
              ? (shouldOpenBelowAnchor
                ? anchor.y + anchor.height + anchorGap
                : anchor.y - menuHeight - anchorGap)
              : fallbackTop;
            const top = Math.min(Math.max(minTop, desiredTop), maxTop);

            return (
          <Animated.View
            style={{
              position: 'absolute',
              left,
              top,
              transform: [{ translateY: pinMoreTranslateY }],
              opacity: pinMoreOpacity,
            }}
          >
          <Pressable
            style={styles.pinMoreCard}
            onPress={() => {}}
            onLayout={(e) => setPinMoreCardHeight(e.nativeEvent.layout.height)}
          >
            <View style={styles.pinMoreTitleRow}>
              <Text style={styles.pinMoreTitle}>More options</Text>
            </View>
            {[
              {
                id: 'save',
                label: isSaved ? 'Remove from Saved' : 'Save Place',
                icon: isSaved ? 'bookmark' : 'bookmark-outline',
                onPress: async () => {
                  closePinMoreMenu(() => {
                    void handleToggleSave();
                  });
                },
              },
              {
                id: 'reviews',
                label: 'View Reviews',
                icon: 'chatbubble-outline',
                onPress: () => {
                  closePinMoreMenu(() => {
                    handleViewReviews();
                  });
                },
              },
              {
                id: 'write-review',
                label: reviewCount > 0 ? 'Write a Review' : 'Be First to Review',
                icon: 'create-outline',
                onPress: () => {
                  closePinMoreMenu(() => {
                    handleWriteReview();
                  });
                },
              },
              {
                id: 'add-report',
                label: 'Add a Report',
                icon: 'flag-outline',
                onPress: handleAddReportFromPin,
              },
              {
                id: 'share',
                label: 'Share Place',
                icon: 'share-outline',
                onPress: async () => {
                  closePinMoreMenu(() => {
                    void handleSharePin();
                  });
                },
              },
              ...(selectedPin && user && selectedPin.user_id === user.id
                ? [{
                    id: 'delete',
                    label: 'Delete Pin',
                    icon: 'trash-outline',
                    danger: true,
                    onPress: () => {
                      closePinMoreMenu(() => {
                        handleDeletePin();
                      });
                    },
                  }]
                : []),
            ].map((item, index, arr) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.pinMoreItem,
                  item.danger && styles.pinMoreItemDanger,
                  index === arr.length - 1 && styles.pinMoreItemLast,
                ]}
                activeOpacity={0.75}
                onPress={item.onPress}
              >
                <Text style={[styles.pinMoreItemText, item.danger && styles.pinMoreItemTextDanger]}>{item.label}</Text>
                <Ionicons
                  name={item.icon as any}
                  size={22}
                  color={item.danger ? colors.error : colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </Pressable>
          </Animated.View>
            );
          })()}
        </Pressable>
      </Modal>

      {/* Group context FAB — rendered last so it sits above all other overlays */}
      {!isNavigating && !selectedPin && !selectedPoi && !isSheetExpandedForContent && sheetContent === 'search' && (
        <TouchableOpacity
          style={[
            styles.groupFab,
            {
              bottom: sheetPeek + spacing.sm,
              backgroundColor: activeGroup
                ? colors.accent
                : (isDarkMode ? 'rgba(30,30,30,0.90)' : 'rgba(255,255,255,0.94)'),
              borderWidth: activeGroup ? 0 : StyleSheet.hairlineWidth,
              borderColor: colors.border,
              zIndex: 200,
            },
          ]}
          onPress={() => setShowGroupPicker(true)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeGroup ? 'people' : 'globe-outline'}
            size={15}
            color={activeGroup ? '#fff' : colors.textMuted}
          />
          <Text
            style={[styles.groupFabLabel, { color: activeGroup ? '#fff' : colors.textMuted }]}
            numberOfLines={1}
          >
            {activeGroup ? activeGroup.name : 'Public'}
          </Text>
        </TouchableOpacity>
      )}

      <GroupPickerModal
        visible={showGroupPicker}
        onClose={() => setShowGroupPicker(false)}
        onManage={() => navigation.navigate('Groups')}
      />
    </View>
  );
}
