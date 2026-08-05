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
import { CardSkeleton } from '../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useSavedItems, useToggleSaved, isOfflineError } from '../hooks/queries';
import { ErrorState, EmptyState } from '../components/StateView';
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

const EVENT_CATEGORIES: { [key: string]: { icon: string; color: string } } = {
  social: { icon: 'people', color: '#276EF1' },
  academic: { icon: 'school', color: '#05A357' },
  sports: { icon: 'fitness', color: '#E5A200' },
  club: { icon: 'flag', color: '#9747FF' },
  party: { icon: 'beer', color: '#E11900' },
  other: { icon: 'calendar', color: '#757575' },
};

interface SavedItemsScreenProps {
  navigation: any;
}

export default function SavedItemsScreen({ navigation }: SavedItemsScreenProps) {
  const { colors } = useTheme();
  const { showToast, showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState<'pins' | 'events'>('pins');
  const insets = useSafeAreaInsets();

  // React Query handles loading, error, caching and refetch — this screen used
  // to hand-roll all four with useState and lost its data on every remount.
  const itemType = activeTab === 'pins' ? 'pin' : 'event';
  const { data: savedItems = [], isLoading, isRefetching, isError, error, refetch } =
    useSavedItems(itemType);
  const toggleSaved = useToggleSaved();

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

        tabRow: {
          flexDirection: 'row',
          marginHorizontal: spacing.md,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.sm,
          padding: 3,
          marginBottom: spacing.sm,
        },
        tab: {
          flex: 1,
          paddingVertical: spacing.sm + 2,
          alignItems: 'center',
          borderRadius: borderRadius.sm - 2,
        },
        tabActive: {
          backgroundColor: colors.surfaceHigh,
        },
        tabText: { ...typography.bodySmallSemibold, color: colors.textMuted },
        tabTextActive: { color: colors.text },

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
          justifyContent: 'center',
          alignItems: 'center',
        },
        pinIconWrap: {
          backgroundColor: colors.surfaceHigh,
        },
        cardInfo: { flex: 1 },
        cardTitle: { ...typography.bodySmallSemibold, color: colors.text },
        cardSub: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize', marginTop: 1 },
        unsaveBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.surfaceHigh,
          justifyContent: 'center',
          alignItems: 'center',
        },

        cardDesc: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          marginTop: spacing.sm,
        },
        eventTimeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          marginTop: spacing.sm,
        },
        eventTime: { ...typography.caption, color: colors.textMuted },

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

  const handleUnsave = (itemType: 'pin' | 'event', itemId: string) => {
    showAlert('Remove saved item', 'Remove this from your saved list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await toggleSaved.mutateAsync({ itemType, itemId, saved: true });
            showToast('Removed from saved.', 'success');
          } catch {
            showToast('Failed to unsave item', 'error');
          }
        },
      },
    ]);
  };

  const handleNavigateToItem = (item: any) => {
    if (item.item_type === 'pin') {
      navigation.navigate('Main', {
        screen: 'Map',
        params: {
          targetLocation: {
            lat: item.item?.pin_lat || item.item?.location?.lat,
            lng: item.item?.pin_lng || item.item?.location?.lng,
          },
          targetName: item.item?.title,
        },
      });
    } else {
      navigation.navigate('Main', {
        screen: 'Map',
        params: {
          targetEventId: item.item_id,
        },
      });
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: any }) => {
    if (!item.item) return null;
    const isPin = item.item_type === 'pin';

    let iconName: string;
    let iconColor: string;
    let iconBg: string;

    if (isPin) {
      iconName = PIN_ICONS[item.item.type] || PIN_ICONS.default;
      iconColor = colors.text;
      iconBg = colors.surfaceHigh;
    } else {
      const cat = EVENT_CATEGORIES[item.item.category] || EVENT_CATEGORIES.other;
      iconName = cat.icon;
      iconColor = cat.color;
      iconBg = cat.color + '18';
    }

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => handleNavigateToItem(item)}
        activeOpacity={0.7}
      >
        <View style={s.cardRow}>
          <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName as any} size={20} color={iconColor} />
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardTitle}>{item.item.title}</Text>
            <Text style={s.cardSub}>{isPin ? item.item.type : item.item.category}</Text>
          </View>
          <TouchableOpacity
            style={s.unsaveBtn}
            onPress={() => handleUnsave(item.item_type, item.item_id)}
            activeOpacity={0.7}
          >
            <Ionicons name="bookmark" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>

        {item.item.description ? (
          <Text style={s.cardDesc} numberOfLines={2}>{item.item.description}</Text>
        ) : null}

        {!isPin && item.item.start_time && (
          <View style={s.eventTimeRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={s.eventTime}>{formatDate(item.item.start_time)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Saved</Text>
        <View style={s.headerSpacer} />
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'pins' && s.tabActive]}
          onPress={() => setActiveTab('pins')}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === 'pins' && s.tabTextActive]}>Pins</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'events' && s.tabActive]}
          onPress={() => setActiveTab('events')}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === 'events' && s.tabTextActive]}>Events</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View>
          {[0, 1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} lines={2} style={{ marginHorizontal: spacing.md, marginTop: i === 0 ? spacing.md : 0 }} />
          ))}
        </View>
      ) : isError ? (
        // Previously a failure showed a toast and an empty list, which reads as
        // "you have nothing saved". Now it says what happened and offers a retry.
        <ErrorState
          subject="your saved items"
          offline={isOfflineError(error)}
          onRetry={refetch}
        />
      ) : (
        <FlatList
          data={savedItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              icon={activeTab === 'pins' ? 'bookmark-outline' : 'calendar-outline'}
              title={activeTab === 'pins' ? 'No saved places yet' : 'No saved events yet'}
              body={
                activeTab === 'pins'
                  ? 'Tap the bookmark on any place to keep it here.'
                  : "Save events you're interested in and they'll show up here."}
              actionLabel="Explore the map"
              onAction={() => navigation.navigate('Main', { screen: 'Map' })}
            />
          }
        />
      )}
    </View>
  );
}
