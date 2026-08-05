import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import BottomSheet from '@gorhom/bottom-sheet';
import { spacing, typography, borderRadius, shadows } from '../constants/theme';
import { MAPBOX_STYLE_STANDARD, MAPBOX_TOKEN } from '../constants/map';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

const { width, height } = Dimensions.get('window');


interface PlacePinScreenProps {
  navigation: any;
  route: any;
}

export default function PlacePinScreen({ navigation, route }: PlacePinScreenProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [centerCoordinate, setCenterCoordinate] = useState<[number, number] | null>(null);
  const initialCoordinateRef = useRef<[number, number] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const { colors, isDarkMode } = useTheme();
  const { showToast } = useAlert();
  const insets = useSafeAreaInsets();
  const prefillLocation = route?.params?.prefillLocation as { lat: number; lng: number } | undefined;

  const snapPoints = useMemo(() => [200 + insets.bottom], [insets.bottom]);
  const mapPadding = useMemo(
    () => ({ paddingBottom: 200 + insets.bottom, paddingTop: 0, paddingLeft: 0, paddingRight: 0 }),
    [insets.bottom]
  );

  useEffect(() => {
    if (!prefillLocation) return;
    const coord: [number, number] = [prefillLocation.lng, prefillLocation.lat];
    initialCoordinateRef.current = coord;
    setCenterCoordinate(coord);
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: coord,
        zoomLevel: 16,
        animationDuration: 600,
        padding: mapPadding,
      });
    }
  }, [prefillLocation, mapPadding]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        map: { flex: 1 },
        // HEAD=22, STICK=14 -> total=35; tip sits at height/2
        centerPinContainer: {
          position: 'absolute',
          top: height / 2 - 35,
          left: width / 2 - 11,
          alignItems: 'center',
        },
        centerPin: {
          alignItems: 'center',
        },
        centerPinDragging: {
          transform: [{ translateY: -8 }],
        },
        pinHead: {
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: isDarkMode ? '#FFFFFF' : '#1C1C1E',
        },
        pinHighlight: {
          width: 5,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.35)',
          position: 'absolute',
          top: 4,
          left: 5,
        },
        pinStick: {
          width: 3,
          height: 14,
          borderRadius: 1.5,
          backgroundColor: isDarkMode ? '#FFFFFF' : '#1C1C1E',
          marginTop: -1,
        },
        pinShadow: {
          width: 8,
          height: 3,
          borderRadius: 4,
          backgroundColor: 'rgba(0,0,0,0.2)',
          marginTop: 0,
        },
        backButton: {
          position: 'absolute',
          left: spacing.md,
          width: 44,
          height: 44,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          ...shadows.md,
        },
        recenterButton: {
          position: 'absolute',
          width: 40,
          height: 40,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          ...shadows.md,
        },
        sheetBg: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
        },
        sheetHandle: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
        },
        sheetHandleIndicator: {
          backgroundColor: colors.lightGray,
          width: 40,
          height: 4,
        },
        sheetContent: {
          flex: 1,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
        },
        title: {
          ...typography.h3,
          color: colors.text,
          marginBottom: spacing.xs,
          fontSize: 22,
        },
        subtitle: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          fontSize: 14,
        },
        confirmButton: {
          backgroundColor: colors.interactiveBg,
          paddingVertical: 13,
          borderRadius: borderRadius.sm,
          alignItems: 'center',
          marginTop: spacing.md,
        },
        confirmButtonText: {
          ...typography.button,
          color: colors.interactiveText,
          fontSize: 15,
        },
      }),
    [colors, insets]
  );

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const location: [number, number] = [coords.longitude, coords.latitude];
      setUserLocation(location);
      if (!initialCoordinateRef.current) {
        setCenterCoordinate(location);
        initialCoordinateRef.current = location;
        cameraRef.current?.setCamera({
          centerCoordinate: location,
          zoomLevel: 16,
          animationDuration: 1000,
          padding: mapPadding,
        });
      }
    } catch {
      const defaultLocation: [number, number] = [-76.7479, 18.0179];
      setUserLocation(defaultLocation);
      if (!initialCoordinateRef.current) {
        setCenterCoordinate(defaultLocation);
        initialCoordinateRef.current = defaultLocation;
      }
      showToast("Couldn't get your location — pan to position manually", 'info');
    }
  };

  const reverseGeocode = useCallback(async (lng: number, lat: number) => {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address,place&limit=1&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      const place = data?.features?.[0]?.place_name as string | undefined;
      setResolvedAddress(place ? place.split(',').slice(0, 2).join(',') : null);
    } catch {
      setResolvedAddress(null);
    }
  }, []);

  const handleRegionDidChange = async () => {
    if (mapRef.current) {
      const center = await mapRef.current.getCenter();
      setCenterCoordinate([center[0], center[1]]);

      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = setTimeout(() => {
        reverseGeocode(center[0], center[1]);
      }, 600);
    }
    setIsDragging(false);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  };

  const handleRecenterToUser = useCallback(() => {
    if (userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: userLocation,
        zoomLevel: 16,
        animationDuration: 600,
        padding: mapPadding,
      });
    }
  }, [userLocation, mapPadding]);

  const handleConfirm = () => {
    if (centerCoordinate) {
      const location = { lng: centerCoordinate[0], lat: centerCoordinate[1] };
      const isForEvent = route?.params?.forEvent || false;
      const isForReport = route?.params?.forReport || false;
      if (isForReport) {
        navigation.navigate('CreateReport', { location });
      } else if (isForEvent) {
        navigation.navigate('CreateEvent', { location });
      } else {
        navigation.navigate('CreatePin', { location });
      }
    }
  };

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MAPBOX_STYLE_STANDARD}
        logoEnabled={false}
        scaleBarEnabled={false}
        onRegionWillChange={() => setIsDragging(true)}
        onRegionDidChange={handleRegionDidChange}
      >
        <MapboxGL.StyleImport
          id="basemap"
          existing
          config={{
            lightPreset: isDarkMode ? 'night' : 'day',
            showPointOfInterestLabels: 'true',
          }}
        />
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={16}
          centerCoordinate={initialCoordinateRef.current || [-76.7479, 18.0179]}
          animationMode="flyTo"
          animationDuration={1000}
          padding={mapPadding}
        />
        {userLocation && (
          <MapboxGL.PointAnnotation id="user-location" coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#276EF1', borderWidth: 2.5, borderColor: '#FFFFFF' }} />
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>

      {/* Center pin */}
      <View style={styles.centerPinContainer} pointerEvents="none">
        <View style={[styles.centerPin, isDragging && { transform: [{ translateY: -8 }] }]}>
          {/* Circle head with subtle inner dot */}
          <View style={styles.pinHead}>
            <View style={styles.pinHighlight} />
          </View>
          {/* Long stick */}
          <View style={styles.pinStick} />
        </View>
        {/* Ground shadow — always visible, grows on drag */}
        <View style={[styles.pinShadow, isDragging && { width: 10, opacity: 0.15 }]} />
      </View>

      {/* Back */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + spacing.sm }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>

      {/* Recenter */}
      <TouchableOpacity
        style={[styles.recenterButton, { top: insets.top + spacing.sm, right: spacing.md, left: undefined }]}
        onPress={handleRecenterToUser}
        activeOpacity={0.8}
      >
        <Ionicons name="paper-plane" size={18} color={colors.text} />
      </TouchableOpacity>

      {/* Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        backgroundStyle={styles.sheetBg}
        handleStyle={styles.sheetHandle}
        handleIndicatorStyle={styles.sheetHandleIndicator}
        style={{ ...shadows.sheet }}
      >
        <View style={styles.sheetContent}>
          <Text style={styles.title}>
            {route?.params?.forReport ? 'Set report location' : route?.params?.forEvent ? 'Set event location' : 'Set pin location'}
          </Text>
          <Text style={styles.subtitle}>
            {resolvedAddress ? resolvedAddress : 'Drag the map to position the pin'}
          </Text>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            disabled={!centerCoordinate}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>Confirm location</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}
