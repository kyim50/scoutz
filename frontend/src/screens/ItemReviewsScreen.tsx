import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  FlatList,
  ScrollView,
  Modal,
} from 'react-native';
import { AvatarRowSkeleton } from '../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { reviewAPI } from '../services/api';
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface ItemReviewsScreenProps {
  navigation: any;
  route: {
    params: {
      itemType: 'pin' | 'event';
      itemId: string;
      itemTitle: string;
    };
  };
}

function relativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.floor(day / 30);
  return `${month}mo ago`;
}

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'highest', label: 'Highest' },
  { id: 'lowest', label: 'Lowest' },
] as const;

type SortId = (typeof SORT_OPTIONS)[number]['id'];

export default function ItemReviewsScreen({ navigation, route }: ItemReviewsScreenProps) {
  const { showToast, showAlert } = useAlert();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { itemType, itemId, itemTitle } = route.params;
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortId>('newest');
  const [filterPhotos, setFilterPhotos] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [helpfulIds, setHelpfulIds] = useState<Set<string>>(new Set());
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const helpfulDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      const response = await reviewAPI.getReviews(itemType, itemId);
      setReviews(response.data?.reviews || []);
      setAverageRating(response.data?.rating?.average || 0);
      setTotalReviews(response.data?.rating?.count || 0);
    } catch (error) {
      console.error('Error loading reviews:', error);
      showToast('Failed to load reviews', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  const handleMarkHelpful = useCallback((reviewId: string) => {
    const isCurrentlyHelpful = helpfulIds.has(reviewId);
    setHelpfulIds((prev) => {
      const next = new Set(prev);
      isCurrentlyHelpful ? next.delete(reviewId) : next.add(reviewId);
      return next;
    });
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, helpful_count: (r.helpful_count || 0) + (isCurrentlyHelpful ? -1 : 1) }
          : r
      )
    );
    if (helpfulDebounce.current[reviewId]) clearTimeout(helpfulDebounce.current[reviewId]);
    helpfulDebounce.current[reviewId] = setTimeout(async () => {
      try {
        await reviewAPI.markHelpful(reviewId);
      } catch {
        // revert on failure
        setHelpfulIds((prev) => {
          const next = new Set(prev);
          isCurrentlyHelpful ? next.add(reviewId) : next.delete(reviewId);
          return next;
        });
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? { ...r, helpful_count: (r.helpful_count || 0) + (isCurrentlyHelpful ? 1 : -1) }
              : r
          )
        );
        showToast('Failed to mark as helpful', 'error');
      }
    }, 800);
  }, [helpfulIds]);

  const handleDeleteReview = (review: any) => {
    showAlert(
      'Delete review',
      'Are you sure you want to delete this review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await reviewAPI.deleteReview(review.id);
              loadReviews();
              showToast('Review deleted', 'success');
            } catch {
              showToast('Failed to delete review', 'error');
            }
          },
        },
      ]
    );
  };

  const filteredAndSortedReviews = useMemo(() => {
    let list = [...reviews];
    if (filterPhotos) list = list.filter((r) => r.photos?.length > 0);
    if (sortBy === 'newest') list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === 'highest') list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'lowest') list.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    return list;
  }, [reviews, sortBy, filterPhotos]);

  const renderStars = (rating: number, size: number = 14) => (
    <View style={s.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={star <= rating ? '#FFB800' : colors.lightGray}
        />
      ))}
    </View>
  );

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderLight,
        },
        backButton: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerInfo: { flex: 1, alignItems: 'center' },
        headerSpacer: { width: 36 },
        heroTitle: {
          ...typography.h4,
          color: colors.text,
          textAlign: 'center',
        },
        heroSubtitle: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          marginTop: 4,
          textAlign: 'center',
        },

        hero: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.lg,
          marginTop: spacing.md,
          borderRadius: borderRadius.lg,
          alignItems: 'center',
          backgroundColor: colors.surfaceGray,
        },
        heroRatingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        heroRatingNum: {
          ...typography.displayMedium,
          color: colors.text,
          lineHeight: 44,
        },
        starsRow: { flexDirection: 'row', gap: 2 },
        heroReviewCount: {
          ...typography.body,
          color: colors.textSecondary,
        },

        writeButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: spacing.lg,
          paddingVertical: 14,
          paddingHorizontal: spacing.lg,
          borderRadius: borderRadius.md,
          backgroundColor: colors.interactiveBg,
          gap: spacing.sm,
        },
        writeButtonText: { ...typography.button, color: colors.interactiveText },

        controlsSection: {
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
        },
        distribution: { gap: 4, marginTop: spacing.md, marginBottom: spacing.xs },
        distRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        distStar: {
          ...typography.caption,
          color: colors.textSecondary,
          width: 8,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        },
        distTrack: {
          flex: 1,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.surfaceHigh,
          overflow: 'hidden',
        },
        distFill: { height: '100%', borderRadius: 3, backgroundColor: '#FFB800' },
        distCount: {
          ...typography.caption,
          color: colors.textMuted,
          width: 20,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        },
        controlsLabel: {
          ...typography.bodySmallSemibold,
          color: colors.textSecondary,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        controlsScroll: {
          // Breaks out of the parent's horizontal padding so the row scrolls
          // edge to edge; the last chip then peeks off screen deliberately.
          marginHorizontal: -spacing.md,
        },
        controlsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          // Padding moves onto the content so the chips still line up with the
          // page margin while the scroll itself spans the full width.
          paddingHorizontal: spacing.md,
        },
        sortChip: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
        },
        sortChipActive: {
          backgroundColor: colors.interactiveBg,
        },
        sortChipText: { ...typography.bodySmallMedium, color: colors.text },
        sortChipTextActive: { color: colors.interactiveText },
        filterChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          gap: spacing.xs,
        },
        filterChipActive: {
          backgroundColor: colors.interactiveBg,
        },

        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.borderLight,
        },

        listContent: {
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
        },
        reviewCard: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        reviewHeader: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        },
        reviewerRow: { flexDirection: 'row', flex: 1 },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.sm,
        },
        avatarText: { ...typography.bodySmallSemibold, color: colors.textSecondary },
        reviewerInfo: { flex: 1 },
        reviewerName: { ...typography.bodyMedium, color: colors.text, marginBottom: 2 },
        reviewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        reviewTime: { ...typography.bodySmall, color: colors.textMuted },
        kebabButton: {
          width: 32,
          height: 32,
          borderRadius: borderRadius.round,
          justifyContent: 'center',
          alignItems: 'center',
        },
        reviewComment: {
          ...typography.body,
          color: colors.text,
          lineHeight: 24,
          marginTop: spacing.sm,
        },
        moreLink: { ...typography.bodySemibold, color: colors.text },
        photosScroll: { marginTop: spacing.sm },
        photosScrollContent: { flexDirection: 'row', gap: spacing.sm },
        reviewPhoto: {
          width: 80,
          height: 80,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
        },
        reviewFooter: {
          flexDirection: 'row',
          marginTop: spacing.md,
          paddingTop: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.borderLight,
        },
        // A rating with no text has nothing between header and footer, so the
        // normal separation reads as a rendering gap.
        reviewFooterTight: { marginTop: spacing.sm },
        helpfulButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        helpfulText: { ...typography.bodySmall, color: colors.textMuted },

        emptyState: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xxl * 2,
          paddingHorizontal: spacing.xl,
        },
        emptyTitle: { ...typography.h4, color: colors.text, marginTop: spacing.lg },
        emptySubtitle: {
          ...typography.body,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: spacing.sm,
          paddingHorizontal: spacing.lg,
          lineHeight: 24,
        },

        lightboxBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.92)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        lightboxImage: { width: '100%', height: '80%' },
        lightboxCloseButton: {
          position: 'absolute',
          top: 16,
          right: 16,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(255,255,255,0.15)',
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [colors, insets.bottom]
  );

  const renderReview = (item: any) => {
    const isExpanded = expandedId === item.id;
    const isOwn = user?.id && (item.user_id === user.id || item.user?.id === user.id);
    const comment = item.comment || '';
    const showMore = comment.length > 120 && !isExpanded;

    return (
      <View key={item.id} style={s.reviewCard}>
        <View style={s.reviewHeader}>
          <View style={s.reviewerRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {item.user?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={s.reviewerInfo}>
              <Text style={s.reviewerName} numberOfLines={1}>
                {item.user?.name || 'Anonymous'}
              </Text>
              <View style={s.reviewMetaRow}>
                {renderStars(item.rating || 0, 12)}
                <Text style={s.reviewTime}>{relativeTime(item.created_at)}</Text>
              </View>
            </View>
          </View>
          {isOwn && (
            <TouchableOpacity style={s.kebabButton} onPress={() => handleDeleteReview(item)}>
              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {comment.length > 0 && (
          <Text style={s.reviewComment} numberOfLines={showMore ? 3 : undefined}>
            {comment}
            {showMore && (
              <Text style={s.moreLink} onPress={() => setExpandedId(item.id)}>
                {' '}more
              </Text>
            )}
          </Text>
        )}

        {item.photos && item.photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.photosScroll}
            contentContainerStyle={s.photosScrollContent}
          >
            {item.photos.slice(0, 4).map((uri: string, index: number) => (
              <TouchableOpacity key={index} onPress={() => setLightboxUri(uri)} activeOpacity={0.85}>
                <Image source={{ uri }} style={s.reviewPhoto} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={[s.reviewFooter, comment.length === 0 && s.reviewFooterTight]}>
          <TouchableOpacity style={s.helpfulButton} onPress={() => handleMarkHelpful(item.id)}>
            <Ionicons
              name={helpfulIds.has(item.id) ? 'heart' : 'heart-outline'}
              size={14}
              color={helpfulIds.has(item.id) ? colors.error : colors.textMuted}
            />
            <Text style={[s.helpfulText, helpfulIds.has(item.id) && { color: colors.error }]}>
              Helpful{item.helpful_count > 0 ? ` (${item.helpful_count})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.heroTitle} numberOfLines={1}>{itemTitle}</Text>
          <Text style={s.heroSubtitle}>
            {itemType === 'event' ? 'Event' : (route.params as any).itemCategory
              ? ((route.params as any).itemCategory as string).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
              : 'Reviews'}
          </Text>
        </View>
        <View style={s.headerSpacer} />
      </View>

      <FlatList
        data={loading ? [] : filteredAndSortedReviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderReview(item)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.text} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        ListHeaderComponent={
          <>
            <View style={s.hero}>
              <View style={s.heroRatingRow}>
                <Text style={s.heroRatingNum}>{averageRating.toFixed(1)}</Text>
                {renderStars(Math.round(averageRating * 2) / 2, 20)}
                <Text style={s.heroReviewCount}>
                  {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                </Text>
              </View>

              {/* A single average says little — 5.0 from one rating and 4.6
                  from ninety read identically without this. */}
              {totalReviews > 0 && (
                <View style={s.distribution}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r: any) => Math.round(r.rating) === star).length;
                    const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                    return (
                      <View key={star} style={s.distRow}>
                        <Text style={s.distStar}>{star}</Text>
                        <Ionicons name="star" size={9} color="#FFB800" />
                        <View style={s.distTrack}>
                          <View style={[s.distFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={s.distCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <TouchableOpacity
                style={s.writeButton}
                onPress={() => navigation.navigate('CreateReview', { itemType, itemId, itemTitle })}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.interactiveText} />
                <Text style={s.writeButtonText}>Write a review</Text>
              </TouchableOpacity>
            </View>

            <View style={s.controlsSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.controlsRow}
                style={s.controlsScroll}
              >
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.sortChip, sortBy === opt.id && s.sortChipActive]}
                    onPress={() => setSortBy(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.sortChipText, sortBy === opt.id && s.sortChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[s.filterChip, filterPhotos && s.filterChipActive]}
                  onPress={() => setFilterPhotos(!filterPhotos)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={filterPhotos ? 'images' : 'images-outline'}
                    size={16}
                    color={filterPhotos ? colors.interactiveText : colors.textSecondary}
                  />
                  <Text style={[s.sortChipText, filterPhotos && s.sortChipTextActive]}>
                    Photos
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
            <View style={s.divider} />
            {loading && (
              <View style={{ paddingHorizontal: spacing.md }}>
                {[0, 1, 2, 3].map((i) => (
                  <AvatarRowSkeleton key={i} avatarSize={40} lines={3} />
                ))}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.emptyState}>
              <Ionicons name={filterPhotos ? 'images-outline' : 'chatbubble-outline'} size={48} color={colors.lightGray} />
              <Text style={s.emptyTitle}>{filterPhotos ? 'No photo reviews' : 'No reviews yet'}</Text>
              <Text style={s.emptySubtitle}>
                {filterPhotos
                  ? 'No reviews with photos have been posted yet.'
                  : `Be the first to review this ${itemType}.`}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Photo lightbox */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity
          style={[s.lightboxBackdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
          activeOpacity={1}
          onPress={() => setLightboxUri(null)}
        >
          {lightboxUri && (
            <Image source={{ uri: lightboxUri }} style={s.lightboxImage} resizeMode="contain" />
          )}
          <TouchableOpacity
            style={[s.lightboxCloseButton, { top: insets.top + 16 }]}
            onPress={() => setLightboxUri(null)}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
