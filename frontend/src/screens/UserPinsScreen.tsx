import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { CardSkeleton, SkeletonList } from '../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { userAPI, pinAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

const PIN_ICONS: { [key: string]: string } = {
  bathroom: 'water',
  food: 'restaurant',
  pharmacy: 'medical',
  study: 'book',
  charging: 'flash',
  default: 'location',
};

interface UserPinsScreenProps {
  navigation: any;
}

export default function UserPinsScreen({ navigation }: UserPinsScreenProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { showAlert, showToast } = useAlert();
  const [pins, setPins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingPinIds, setDeletingPinIds] = useState<string[]>([]);
  const insets = useSafeAreaInsets();

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          marginBottom: spacing.sm,
        },
        headerBtn: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerTitle: { ...typography.h3, color: colors.text },
        headerSpacer: { width: 40 },

        listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xl },

        card: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        cardRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        },
        iconWrap: {
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: colors.surfaceHigh,
          justifyContent: 'center',
          alignItems: 'center',
        },
        cardInfo: { flex: 1 },
        cardTitle: { ...typography.bodySmallSemibold, color: colors.text },
        cardSub: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize', marginTop: 1 },
        deleteBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(255, 69, 58, 0.16)',
          justifyContent: 'center',
          alignItems: 'center',
        },

        cardDesc: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          marginTop: spacing.sm,
        },

        cardFooter: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: spacing.sm,
          paddingTop: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
        statText: { ...typography.caption, color: colors.textMuted },
        mapBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
        mapBtnText: { ...typography.caption, fontWeight: '600', color: colors.text },

        emptyState: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xxl * 2,
        },
        emptyIcon: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.md,
        },
        emptyTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.xs },
        emptySub: {
          ...typography.bodySmall,
          color: colors.textMuted,
          textAlign: 'center',
          paddingHorizontal: spacing.xl,
        },
      }),
    [colors]
  );

  useEffect(() => {
    loadPins();
  }, []);

  const loadPins = async () => {
    if (!user) return;
    try {
      const response = await userAPI.getUserPins(user.id);
      setPins(response.data?.pins || []);
    } catch (error) {
      console.error('Error loading pins:', error);
      showToast('Failed to load your pins', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPins();
  };

  const handleDeletePin = (pinId: string) => {
    showAlert('Delete Pin', 'Are you sure you want to delete this pin?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (deletingPinIds.includes(pinId)) return;
          setDeletingPinIds((prev) => [...prev, pinId]);
          try {
            await pinAPI.delete(pinId);
            setPins((prev) => prev.filter((p) => p.id !== pinId));
            showToast('Pin deleted from your profile and map.', 'success');
          } catch (error) {
            showToast('Failed to delete pin', 'error');
          } finally {
            setDeletingPinIds((prev) => prev.filter((id) => id !== pinId));
          }
        },
      },
    ]);
  };

  const handleViewOnMap = (pin: any) => {
    navigation.navigate('Main', {
      screen: 'Map',
      params: {
        targetLocation: { lat: pin.pin_lat || pin.location?.lat, lng: pin.pin_lng || pin.location?.lng },
        targetName: pin.title,
      },
    });
  };

  const renderPin = ({ item }: { item: any }) => {
    const icon = PIN_ICONS[item.type] || PIN_ICONS.default;
    const isDeleting = deletingPinIds.includes(item.id);
    return (
      <TouchableOpacity style={s.card} onPress={() => handleViewOnMap(item)} activeOpacity={0.7}>
        <View style={s.cardRow}>
          <View style={s.iconWrap}>
            <Ionicons name={icon as any} size={20} color={colors.text} />
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardTitle}>{item.title}</Text>
            <Text style={s.cardSub}>{item.type}{item.building ? ` · ${item.building}` : ''}</Text>
          </View>
          <TouchableOpacity
            style={[s.deleteBtn, isDeleting && { opacity: 0.6 }]}
            onPress={(e) => { e.stopPropagation?.(); handleDeletePin(item.id); }}
            activeOpacity={0.7}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>

        {item.description ? (
          <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={s.cardFooter}>
          <View style={s.statRow}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={s.statText}>{item.verification_count || 0} verified</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
              onPress={(e) => { e.stopPropagation?.(); showToast('Pin editing coming soon', 'info'); }}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={13} color={colors.textMuted} />
              <Text style={[s.statText, { color: colors.textMuted }]}>Edit</Text>
            </TouchableOpacity>
            <View style={s.mapBtn}>
              <Text style={s.mapBtnText}>View on map</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.text} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={s.container}>
        <SkeletonList count={5} style={{ paddingTop: spacing.md }}>
            {() => <CardSkeleton lines={2} hasFooter style={{ marginHorizontal: spacing.md }} />}
          </SkeletonList>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Pins</Text>
        <View style={s.headerSpacer} />
      </View>

      <FlatList
        data={pins}
        renderItem={renderPin}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Ionicons name="location-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No pins yet</Text>
            <Text style={s.emptySub}>Start contributing by adding pins to the map!</Text>
          </View>
        }
      />
    </View>
  );
}
