import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAPBOX_TOKEN } from '../constants/map';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface LocationThumbnailProps {
  lat: number;
  lng: number;
  /** Shown beside the map — a street name or place name if known. */
  label?: string;
  height?: number;
}

/**
 * A static map of the point being described.
 *
 * The create forms ask for a title, description and access notes for a place
 * the user chose two screens ago and hasn't seen since. Without this there is
 * no confirmation the pin lands where they meant, and no way to notice a
 * mis-drop until it is on the map.
 *
 * Uses Mapbox's Static Images API rather than a live MapView: this is a
 * confirmation, not something to pan around, and a real map here would mean a
 * second GL context inside a scrolling form.
 */
export default function LocationThumbnail({
  lat,
  lng,
  label,
  height = 96,
}: LocationThumbnailProps) {
  const { colors, isDarkMode } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const uri = useMemo(() => {
    if (!MAPBOX_TOKEN) return null;
    const style = isDarkMode ? 'dark-v11' : 'streets-v12';
    // The marker colour has no leading '#': the API takes a bare hex triplet.
    const marker = `pin-s+3ddc91(${lng},${lat})`;
    return (
      `https://api.mapbox.com/styles/v1/mapbox/${style}/static/` +
      `${marker}/${lng},${lat},15,0/600x${Math.round(height * 2)}@2x` +
      `?access_token=${MAPBOX_TOKEN}&logo=false&attribution=false`
    );
  }, [lat, lng, height, isDarkMode]);

  const s = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          borderRadius: borderRadius.md,
          overflow: 'hidden',
          backgroundColor: colors.surfaceGray,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        image: { width: '100%', height },
        centre: { height, alignItems: 'center', justifyContent: 'center', gap: 6 },
        fallbackText: { ...typography.caption, color: colors.textMuted },
        labelRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        labelText: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
      }),
    [colors, height]
  );

  return (
    <View style={s.wrap} accessibilityLabel={label ? `Map showing ${label}` : 'Map of the chosen location'}>
      {uri && !failed ? (
        <>
          <Image
            source={{ uri }}
            style={s.image}
            resizeMode="cover"
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setFailed(true);
              setLoading(false);
            }}
          />
          {loading && (
            <View style={[s.centre, StyleSheet.absoluteFillObject]}>
              <ActivityIndicator size="small" color={colors.textMuted} />
            </View>
          )}
        </>
      ) : (
        // Offline or no token: coordinates still confirm the point, which is
        // the job. Failing to a blank box would not.
        <View style={s.centre}>
          <Ionicons name="location-outline" size={18} color={colors.textMuted} />
          <Text style={s.fallbackText}>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </Text>
        </View>
      )}

      <View style={s.labelRow}>
        <Ionicons name="pin-outline" size={13} color={colors.accent} />
        <Text style={s.labelText} numberOfLines={1}>
          {label || 'Your pin will land here'}
        </Text>
      </View>
    </View>
  );
}
