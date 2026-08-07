import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { STAR_GOLD } from '../components/RatingStars';

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

  const handleMarkHelpful = useCallback(
    (reviewId: string) => {
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
    },
    [helpfulIds]
  );

  const handleDeleteReview = (review: any) => {
    showAlert('Delete review', 'Are you sure you want to delete this review?', [
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
    ]);
  };

  const filteredAndSortedReviews = useMemo(() => {
    let list = [...reviews];
    if (filterPhotos) list = list.filter((r) => r.photos?.length > 0);
    if (sortBy === 'newest')
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === 'highest') list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'lowest') list.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    return list;
  }, [reviews, sortBy, filterPhotos]);

  /**
   * Counted from the reviews actually on screen, and used as its own
   * denominator. Dividing local counts by the server's total would leave the
   * bars quietly under-filled the moment the two disagree.
   */
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const r of reviews) {
      const star = Math.round(r.rating);
      if (star >= 1 && star <= 5) counts[star - 1] += 1;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    return { counts, total };
  }, [reviews]);

  const photoReviewCount = useMemo(
    () => reviews.filter((r) => r.photos?.length > 0).length,
    [reviews]
  );

  const renderStars = (rating: number, size: number = 14) => (
    <View style={s.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        // A 4.5 average used to render as four filled stars, because the only
        // test was `star <= rating`.
        const name =
          rating >= star ? 'star' : rating >= star - 0.5 ? 'star-half' : 'star-outline';
        return (
          <Ionicons
            key={star}
            name={name as any}
            size={size}
            color={name === 'star-outline' ? colors.lightGray : STAR_GOLD}
          />
        );
      })}
    </View>
  );

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },

        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        backButton: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerInfo: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
        headerSpacer: { width: 36 },
        heroTitle: { ...typography.h5, color: colors.text, textAlign: 'center' },
        heroSubtitle: {
          ...typography.captionMedium,
          color: colors.textSecondary,
          marginTop: 2,
          textAlign: 'center',
        },

        // ── Summary ──
        // Two columns rather than a centred stack: the score needs very little
        // width and the histogram needs all it can get, so stacking them left
        // the bars in a narrow channel with wide empty margins either side.
        hero: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.md,
          marginTop: spacing.md,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surfaceGray,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        heroScore: { alignItems: 'center', gap: 5 },
        heroRatingNum: {
          ...typography.displayMedium,
          fontSize: 42,
          lineHeight: 46,
          letterSpacing: -1.5,
          color: colors.text,
          fontVariant: ['tabular-nums'],
        },
        starsRow: { flexDirection: 'row', gap: 2 },
        heroReviewCount: { ...typography.caption, color: colors.textSecondary },

        // `flex: 1` here is what makes the bars have any width at all. The
        // block used to sit inside a centred column, so it sized to its own
        // content and every track collapsed to zero — the histogram rendered
        // as a column of numbers with a gap where the bars should have been.
        distribution: { flex: 1, gap: 5 },
        distRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
        distStar: {
          ...typography.caption,
          color: colors.textSecondary,
          width: 8,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        },
        distTrack: {
          flex: 1,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.surfaceHigh,
          overflow: 'hidden',
        },
        distFill: { height: '100%', borderRadius: 3, backgroundColor: STAR_GOLD },
        distCount: {
          ...typography.caption,
          color: colors.textMuted,
          // Fits three digits; 20pt clipped any place with 100+ reviews.
          width: 26,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        },

        // ── Controls ──
        controlsSection: { paddingTop: spacing.lg, paddingBottom: spacing.md },
        controlsScroll: {
          // Breaks out of the parent's horizontal padding so the row scrolls
          // edge to edge; the last chip then peeks off screen deliberately.
          marginHorizontal: -spacing.md,
        },
        controlsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        sortChip: {
          paddingVertical: 7,
          paddingHorizontal: spacing.md - 2,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: 'transparent',
        },
        // Tinted rather than a solid white pill. Sorting is not the primary
        // action on this screen, and a white chip competed with the one button
        // that is — as well as being the loudest thing on the page.
        sortChipActive: { backgroundColor: colors.accentTint, borderColor: colors.accent },
        sortChipText: { ...typography.bodySmallMedium, color: colors.textSecondary },
        sortChipTextActive: { color: colors.accent },
        // Sorting and filtering are different jobs; in one undifferentiated row
        // "Photos" read as a fourth sort order.
        controlsSeparator: {
          width: StyleSheet.hairlineWidth,
          height: 20,
          backgroundColor: colors.border,
          marginHorizontal: spacing.xs,
        },
        filterChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 7,
          paddingHorizontal: spacing.md - 2,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: 'transparent',
          gap: 5,
        },
        filterChipDisabled: { opacity: 0.4 },

        resultCount: {
          ...typography.caption,
          color: colors.textMuted,
          paddingBottom: spacing.md,
        },

        // ── Review card ──
        reviewCard: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          // surfaceGray is eight values off surface, so on the dark theme the
          // cards had no edge at all and the list read as one grey field.
          borderColor: colors.border,
          padding: spacing.md,
          marginBottom: spacing.sm + 2,
        },
        reviewHeader: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        },
        reviewerRow: { flexDirection: 'row', flex: 1 },
        avatar: {
          width: 38,
          height: 38,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.sm,
        },
        avatarText: { ...typography.bodySemibold, color: colors.textSecondary },
        reviewerInfo: { flex: 1, gap: 3 },
        nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
        reviewerName: { ...typography.bodyMedium, color: colors.text, flexShrink: 1 },
        ownBadge: {
          ...typography.caption,
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: colors.accent,
          backgroundColor: colors.accentTint,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: borderRadius.xs + 2,
          overflow: 'hidden',
        },
        reviewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        reviewTime: { ...typography.caption, color: colors.textMuted },
        kebabButton: {
          width: 32,
          height: 32,
          borderRadius: borderRadius.round,
          justifyContent: 'center',
          alignItems: 'center',
        },
        reviewComment: {
          ...typography.body,
          fontSize: 15,
          color: colors.text,
          lineHeight: 22,
          marginTop: spacing.sm + 2,
        },
        moreLink: { ...typography.bodySemibold, fontSize: 15, color: colors.accent },
        photosScroll: { marginTop: spacing.sm + 2 },
        photosScrollContent: { flexDirection: 'row', gap: spacing.sm },
        reviewPhoto: {
          width: 84,
          height: 84,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
        },
        reviewFooter: {
          flexDirection: 'row',
          marginTop: spacing.md,
          paddingTop: spacing.sm + 2,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        // A rating with no text has nothing between header and footer, so the
        // normal separation reads as a rendering gap.
        reviewFooterTight: { marginTop: spacing.sm },
        helpfulButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingVertical: 4,
          paddingRight: spacing.sm,
        },
        helpfulText: { ...typography.bodySmallMedium, color: colors.textMuted },

        emptyState: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xxl,
          paddingHorizontal: spacing.xl,
        },
        emptyIconWrap: {
          width: 72,
          height: 72,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          alignItems: 'center',
          justifyContent: 'center',
        },
        emptyTitle: { ...typography.h5, color: colors.text, marginTop: spacing.lg },
        emptySubtitle: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: spacing.sm,
          lineHeight: 21,
        },
        emptyAction: {
          marginTop: spacing.lg,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        emptyActionText: { ...typography.bodySmallSemibold, color: colors.accent },

        // ── Footer ──
        // Pinned rather than buried in the summary card. It is the only action
        // on this screen, and inside the header it fell off the top of the list
        // the moment there was more than a screenful of reviews.
        footer: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        writeButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.md,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.interactiveBg,
          gap: spacing.sm,
        },
        writeButtonText: { ...typography.button, color: colors.interactiveText },

        lightboxBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.92)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        lightboxImage: { width: '100%', height: '80%' },
        lightboxCloseButton: {
          position: 'absolute',
          right: 16,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(255,255,255,0.15)',
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [colors]
  );

  const renderReview = (item: any) => {
    const isExpanded = expandedId === item.id;
    const isOwn = user?.id && (item.user_id === user.id || item.user?.id === user.id);
    const comment = item.comment || '';
    const showMore = comment.length > 120 && !isExpanded;
    const marked = helpfulIds.has(item.id);

    return (
      <View key={item.id} style={s.reviewCard}>
        <View style={s.reviewHeader}>
          <View style={s.reviewerRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{item.user?.name?.charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <View style={s.reviewerInfo}>
              <View style={s.nameRow}>
                <Text style={s.reviewerName} numberOfLines={1}>
                  {item.user?.name || 'Anonymous'}
                </Text>
                {isOwn && <Text style={s.ownBadge}>You</Text>}
              </View>
              <View style={s.reviewMetaRow}>
                {renderStars(item.rating || 0, 13)}
                <Text style={s.reviewTime}>{relativeTime(item.created_at)}</Text>
              </View>
            </View>
          </View>
          {isOwn && (
            <TouchableOpacity
              style={s.kebabButton}
              onPress={() => handleDeleteReview(item)}
              accessibilityRole="button"
              accessibilityLabel="Delete your review"
            >
              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {comment.length > 0 && (
          <Text style={s.reviewComment} numberOfLines={showMore ? 3 : undefined}>
            {comment}
            {showMore && (
              <Text style={s.moreLink} onPress={() => setExpandedId(item.id)}>
                {'  '}Read more
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
              <TouchableOpacity
                key={index}
                onPress={() => setLightboxUri(uri)}
                activeOpacity={0.85}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Review photo ${index + 1}`}
              >
                <Image source={{ uri }} style={s.reviewPhoto} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={[s.reviewFooter, comment.length === 0 && s.reviewFooterTight]}>
          <TouchableOpacity
            style={s.helpfulButton}
            onPress={() => handleMarkHelpful(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Mark this review as helpful"
            accessibilityState={{ selected: marked }}
          >
            {/* A heart says "liked". This control says whether the review was
                useful, which is a thumbs-up everywhere else people have met it. */}
            <Ionicons
              name={marked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={15}
              color={marked ? colors.accent : colors.textMuted}
            />
            <Text style={[s.helpfulText, marked && { color: colors.accent }]}>
              Helpful{item.helpful_count > 0 ? ` · ${item.helpful_count}` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const shownCount = filteredAndSortedReviews.length;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.heroTitle} numberOfLines={1}>
            {itemTitle}
          </Text>
          <Text style={s.heroSubtitle}>
            {itemType === 'event'
              ? 'Event'
              : (route.params as any).itemCategory
                ? ((route.params as any).itemCategory as string)
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l: string) => l.toUpperCase())
                : 'Reviews'}
          </Text>
        </View>
        <View style={s.headerSpacer} />
      </View>

      <FlatList
        data={loading ? [] : filteredAndSortedReviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderReview(item)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.xl,
        }}
        ListHeaderComponent={
          <>
            {/* Nothing to summarise before the first review, and a hero reading
                0.0 with five empty stars is a worse greeting than the empty
                state that already exists below. */}
            {!loading && totalReviews > 0 && (
              <View style={s.hero}>
                <View style={s.heroScore}>
                  <Text style={s.heroRatingNum}>{averageRating.toFixed(1)}</Text>
                  {renderStars(averageRating, 14)}
                  <Text style={s.heroReviewCount}>
                    {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                  </Text>
                </View>

                {/* A single average says little — 5.0 from one rating and 4.6
                    from ninety read identically without this. */}
                <View style={s.distribution}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = distribution.counts[star - 1];
                    const pct = distribution.total > 0 ? (count / distribution.total) * 100 : 0;
                    return (
                      <View key={star} style={s.distRow}>
                        <Text style={s.distStar}>{star}</Text>
                        <Ionicons name="star" size={9} color={STAR_GOLD} />
                        <View style={s.distTrack}>
                          {/* A lone review among hundreds still deserves a
                              visible sliver rather than rounding to nothing. */}
                          <View
                            style={[s.distFill, { width: `${count === 0 ? 0 : Math.max(pct, 3)}%` }]}
                          />
                        </View>
                        <Text style={s.distCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {!loading && totalReviews > 0 && (
              <>
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
                        accessibilityRole="button"
                        accessibilityLabel={`Sort by ${opt.label.toLowerCase()}`}
                        accessibilityState={{ selected: sortBy === opt.id }}
                      >
                        <Text style={[s.sortChipText, sortBy === opt.id && s.sortChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    <View style={s.controlsSeparator} />

                    <TouchableOpacity
                      style={[
                        s.filterChip,
                        filterPhotos && s.sortChipActive,
                        photoReviewCount === 0 && s.filterChipDisabled,
                      ]}
                      onPress={() => setFilterPhotos(!filterPhotos)}
                      disabled={photoReviewCount === 0}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Show only reviews with photos"
                      accessibilityState={{
                        selected: filterPhotos,
                        disabled: photoReviewCount === 0,
                      }}
                    >
                      <Ionicons
                        name={filterPhotos ? 'images' : 'images-outline'}
                        size={15}
                        color={filterPhotos ? colors.accent : colors.textSecondary}
                      />
                      <Text style={[s.sortChipText, filterPhotos && s.sortChipTextActive]}>
                        {/* Saying how many there are turns a guess into a decision. */}
                        Photos{photoReviewCount > 0 ? ` · ${photoReviewCount}` : ''}
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                {filterPhotos && (
                  <Text style={s.resultCount}>
                    Showing {shownCount} of {totalReviews}
                  </Text>
                )}
              </>
            )}

            {loading && (
              <View style={{ paddingTop: spacing.md }}>
                {[0, 1, 2, 3].map((i) => (
                  <AvatarRowSkeleton key={i} avatarSize={38} lines={3} />
                ))}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.emptyState}>
              <View style={s.emptyIconWrap}>
                <Ionicons
                  name={filterPhotos ? 'images-outline' : 'star-outline'}
                  size={30}
                  color={colors.textMuted}
                />
              </View>
              <Text style={s.emptyTitle}>
                {filterPhotos ? 'No reviews with photos' : 'No reviews yet'}
              </Text>
              <Text style={s.emptySubtitle}>
                {filterPhotos
                  ? 'Nobody has added a photo here yet.'
                  : `Be the first to say what this ${itemType === 'event' ? 'event' : 'place'} is like.`}
              </Text>
              {filterPhotos && (
                <TouchableOpacity style={s.emptyAction} onPress={() => setFilterPhotos(false)}>
                  <Text style={s.emptyActionText}>Show all reviews</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={s.writeButton}
          onPress={() => navigation.navigate('CreateReview', { itemType, itemId, itemTitle })}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Write a review"
        >
          <Ionicons name="create-outline" size={18} color={colors.interactiveText} />
          <Text style={s.writeButtonText}>Write a review</Text>
        </TouchableOpacity>
      </View>

      {/* Photo lightbox */}
      <Modal
        visible={!!lightboxUri}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUri(null)}
      >
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
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
