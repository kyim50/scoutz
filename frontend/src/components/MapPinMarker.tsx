import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/** Head 22 + stick 14, so the tip sits 35pt below the top of the marker. */
export const PIN_HEAD = 22;
export const PIN_STICK = 14;
export const PIN_HEIGHT = PIN_HEAD + PIN_STICK - 1;

interface MapPinMarkerProps {
  /** Lifts the pin off the ground and spreads its shadow, as when dragging. */
  raised?: boolean;
}

/**
 * The marker shown at the centre of the map while placing a pin.
 *
 * Lives here rather than in PlacePinScreen because the static thumbnail on the
 * create form has to show the same thing: the two screens are a step apart in
 * one flow, and a green Mapbox teardrop on the confirmation of a white
 * head-and-stick reads as a different place being described.
 */
export default function MapPinMarker({ raised }: MapPinMarkerProps) {
  const { isDarkMode } = useTheme();

  const s = useMemo(
    () =>
      StyleSheet.create({
        wrap: { alignItems: 'center' },
        pin: { alignItems: 'center' },
        head: {
          width: PIN_HEAD,
          height: PIN_HEAD,
          borderRadius: PIN_HEAD / 2,
          backgroundColor: isDarkMode ? '#FFFFFF' : '#1C1C1E',
        },
        highlight: {
          width: 5,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.35)',
          position: 'absolute',
          top: 4,
          left: 5,
        },
        stick: {
          width: 3,
          height: PIN_STICK,
          borderRadius: 1.5,
          backgroundColor: isDarkMode ? '#FFFFFF' : '#1C1C1E',
          marginTop: -1,
        },
        shadow: {
          width: 8,
          height: 3,
          borderRadius: 4,
          backgroundColor: 'rgba(0,0,0,0.2)',
        },
      }),
    [isDarkMode]
  );

  return (
    <View style={s.wrap} pointerEvents="none">
      <View style={[s.pin, raised && { transform: [{ translateY: -8 }] }]}>
        <View style={s.head}>
          <View style={s.highlight} />
        </View>
        <View style={s.stick} />
      </View>
      <View style={[s.shadow, raised && { width: 10, opacity: 0.15 }]} />
    </View>
  );
}
