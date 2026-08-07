import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { reviewAPI, uploadAPI } from '../services/api';
import ImagePicker from '../components/ImagePicker';
import { useTheme } from '../context/ThemeContext';
import SelectableChip from '../components/SelectableChip';
import RatingStars, { STAR_GOLD } from '../components/RatingStars';
import { FormGroup, FormField } from '../components/FormSection';
import { useAlert } from '../context/AlertContext';

interface CreateReviewScreenProps {
  navigation: any;
  route: {
    params: {
      itemType: 'pin' | 'event';
      itemId: string;
      itemTitle: string;
    };
  };
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/**
 * Tapping one appends it to the review text. Most people will not write prose,
 * and a couple of these still produces something another user can act on.
 */
const REVIEW_PROMPTS = ['Clean', 'Quiet', 'Busy', 'Hard to find', 'Well lit', 'Free to use'];

const RATING_PROMPTS = [
  '',
  'What went wrong?',
  'What could be better?',
  'What did you think?',
  'What stood out?',
  'What made it great?',
];

export default function CreateReviewScreen({ navigation, route }: CreateReviewScreenProps) {
  const { showToast } = useAlert();
  const { itemType, itemId, itemTitle } = route.params;
  const { colors } = useTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },

        // ── Header ── matches the other three create screens, which are all
        // presented the same way and should not each look like a different app.
        handleBar: {
          alignSelf: 'center',
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.lightGray,
          marginTop: spacing.sm,
          marginBottom: spacing.sm,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
        },
        closeButton: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerInfo: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
        headerTitle: { ...typography.h5, color: colors.text },
        headerSubtitle: { ...typography.captionMedium, color: colors.textSecondary, marginTop: 1 },
        headerSpacer: { width: 36, height: 36 },

        scrollView: { flex: 1 },
        scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },

        // ── Rating hero ──
        // Unboxed on purpose. The grey card this used to sit in did nothing but
        // wash out the single most important control on the screen, and it was
        // the only card here, so it read as a stray element rather than a
        // deliberate one.
        hero: { alignItems: 'center', paddingBottom: spacing.xl },
        heroQuestion: {
          ...typography.h4,
          fontSize: 21,
          letterSpacing: -0.4,
          color: colors.text,
          marginBottom: spacing.md,
        },
        // Fixed height so the word appearing does not shift the form below it.
        heroLabelSlot: { height: 30, justifyContent: 'center', marginTop: spacing.sm },
        heroLabel: {
          ...typography.h4,
          fontSize: 22,
          letterSpacing: -0.4,
          color: STAR_GOLD,
          textAlign: 'center',
        },
        heroHint: {
          ...typography.bodySmall,
          color: colors.textMuted,
          textAlign: 'center',
        },

        // ── Text input ──
        inputWrapper: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          borderWidth: 1.25,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
        },
        input: {
          ...typography.body,
          fontSize: 15,
          lineHeight: 21,
          color: colors.text,
          height: 96,
          textAlignVertical: 'top',
          padding: 0,
        },
        charRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
        charCount: { ...typography.caption, color: colors.textMuted },

        promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
        promptChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingVertical: 7,
          paddingHorizontal: spacing.sm + 2,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: 'transparent',
        },
        promptChipUsed: { backgroundColor: colors.accentTint, borderColor: colors.accent },
        promptChipText: { ...typography.bodySmallMedium, color: colors.textSecondary },
        promptChipTextUsed: { color: colors.accent },

        // ── Footer ── pinned, like every other create screen. It used to scroll
        // with the content, so on a long review the submit button was off screen.
        footer: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        submitHint: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: 'center',
          marginBottom: spacing.sm,
        },
        submitButton: {
          backgroundColor: colors.interactiveBg,
          borderRadius: borderRadius.sm,
          paddingVertical: spacing.md,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing.xs,
        },
        // A real disabled fill rather than 35% opacity on white, which produced
        // a light grey slab that still read as the primary action.
        submitButtonDisabled: { backgroundColor: colors.surfaceGray },
        submitButtonText: { ...typography.button, color: colors.interactiveText },
        submitButtonTextDisabled: { color: colors.textMuted },
      }),
    [colors]
  );

  const canSubmit = rating > 0 && !loading;

  const handleClose = () => {
    const hasChanges = rating > 0 || comment.trim() || photos.length > 0;
    if (!hasChanges) {
      navigation.goBack();
      return;
    }
    Alert.alert('Discard review?', 'What you have written will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }
    setLoading(true);
    try {
      const photoUrls: string[] = [];
      for (const photoUri of photos) {
        try {
          const uploadResult = await uploadAPI.uploadImage(photoUri);
          photoUrls.push(uploadResult.mainUrl);
        } catch (error: any) {
          throw new Error(error?.message || 'Failed to upload one of the photos');
        }
      }
      await reviewAPI.createReview(itemType, itemId, {
        rating,
        comment: comment.trim() || undefined,
        photos: photoUrls.length > 0 ? photoUrls : undefined,
      });
      showToast('Review submitted!', 'success');
      navigation.replace('ItemReviews', { itemType, itemId, itemTitle });
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message || error?.message || 'Failed to submit review';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.handleBar} />
      <View style={s.header}>
        <View style={s.headerSpacer} />
        <View style={s.headerInfo}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {itemTitle}
          </Text>
          <Text style={s.headerSubtitle}>
            {itemType === 'event' ? 'Event review' : 'Location review'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleClose}
          style={s.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={[s.scrollContent, { paddingBottom: spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.hero}>
          <Text style={s.heroQuestion}>
            {itemType === 'event' ? 'How was the event?' : 'How was it?'}
          </Text>

          <RatingStars rating={rating} onChange={setRating} />

          <View style={s.heroLabelSlot}>
            {rating > 0 ? (
              <Text style={s.heroLabel}>{RATING_LABELS[rating]}</Text>
            ) : (
              // Not "a rating is required" — nothing has gone wrong yet, and
              // leading with a failed validation is a poor way to open.
              <Text style={s.heroHint}>Tap a star</Text>
            )}
          </View>
        </View>

        <FormGroup
          title="Your review"
          subtitle="A sentence is plenty. Say what the next person should know."
          first
        >
          <View>
            <View style={s.inputWrapper}>
              <TextInput
                style={s.input}
                // The question tracks the rating, so a one-star review is asked
                // what went wrong and a five-star one what made it great.
                placeholder={rating > 0 ? RATING_PROMPTS[rating] : 'Share your experience...'}
                placeholderTextColor={colors.textMuted}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={500}
              />
            </View>
            {comment.length > 400 && (
              <View style={s.charRow}>
                <Text style={s.charCount}>{comment.length}/500</Text>
              </View>
            )}
          </View>

          {/* These had no label at all, so a row of words simply appeared under
              the text box with nothing to say what tapping one would do. */}
          <FormField label="Quick add" hint="Tap to drop a phrase into your review.">
            <View style={s.promptRow}>
              {REVIEW_PROMPTS.map((prompt) => {
                const used = comment.toLowerCase().includes(prompt.toLowerCase());
                return (
                  <SelectableChip
                    key={prompt}
                    selected={used}
                    style={[s.promptChip, used && s.promptChipUsed]}
                    onPress={() => {
                      if (used) return;
                      setComment((c) => (c.trim() ? `${c.trim()}. ${prompt}` : prompt));
                    }}
                    accessibilityLabel={`Add "${prompt}" to your review`}
                  >
                    {used && <Ionicons name="checkmark" size={13} color={colors.accent} />}
                    <Text style={[s.promptChipText, used && s.promptChipTextUsed]}>{prompt}</Text>
                  </SelectableChip>
                );
              })}
            </View>
          </FormField>
        </FormGroup>

        <FormGroup title="Photos" subtitle="Up to three. A photo is what makes a review land.">
          {/* No field label: the ImagePicker's own button already says "Add
              photos", and the section said it too. */}
          <ImagePicker
            onImagesSelected={setPhotos}
            maxImages={3}
            existingImages={photos}
            aspectRatio={[4, 3]}
            allowsEditing={true}
            addButtonHeight={100}
          />
        </FormGroup>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {rating === 0 && <Text style={s.submitHint}>Pick a rating to submit.</Text>}
        <TouchableOpacity
          style={[s.submitButton, !canSubmit && s.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Submit review"
          accessibilityState={{ disabled: !canSubmit }}
        >
          {loading ? (
            <ActivityIndicator color={colors.interactiveText} />
          ) : (
            <>
              <Ionicons
                name="checkmark"
                size={18}
                color={canSubmit ? colors.interactiveText : colors.textMuted}
              />
              <Text style={[s.submitButtonText, !canSubmit && s.submitButtonTextDisabled]}>
                Submit review
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
