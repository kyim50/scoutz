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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { reviewAPI, uploadAPI } from '../services/api';
import ImagePicker from '../components/ImagePicker';
import { useTheme } from '../context/ThemeContext';
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

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
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

        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderLight,
        },
        closeButton: {
          width: 32,
          height: 32,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerInfo: { flex: 1, alignItems: 'center' },
        headerTitle: { ...typography.h5, color: colors.text },
        headerSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
        headerSpacer: { width: 32 },

        scrollView: { flex: 1 },
        scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md },

        // ── Rating block ──
        ratingBlock: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.md,
          alignItems: 'center',
          gap: spacing.md,
        },
        ratingPrompt: {
          ...typography.bodySmallSemibold,
          color: colors.textSecondary,
          fontSize: 14,
        },
        starsRow: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        starBtn: {
          padding: spacing.sm,
        },
        ratingLabelRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          height: 24,
        },
        ratingLabelText: {
          ...typography.bodySmallSemibold,
          color: '#FFB800',
          fontSize: 14,
        },

        // ── Section label ──
        sectionLabel: {
          ...typography.bodySmallSemibold,
          color: colors.text,
          fontSize: 14,
          marginBottom: spacing.sm,
        },

        // ── Text input ──
        inputWrapper: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.xs,
        },
        input: {
          ...typography.body,
          fontSize: 16,
          lineHeight: 20,
          color: colors.text,
          height: 100,
          textAlignVertical: 'top',
          padding: 0,
        },
        charRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginBottom: spacing.md,
        },
        charCount: { ...typography.caption, color: colors.textMuted, fontSize: 11 },

        // ── Photos section ──
        photosSection: { marginBottom: spacing.lg },

        // ── Submit button (inside scroll) ──
        submitButton: {
          backgroundColor: colors.interactiveBg,
          borderRadius: borderRadius.md,
          paddingVertical: 16,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing.xs,
        },
        submitButtonDisabled: { opacity: 0.35 },
        submitButtonText: { ...typography.button, color: colors.interactiveText },
      }),
    [colors]
  );

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
      const msg = error?.response?.data?.error?.message || error?.message || 'Failed to submit review';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[s.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerSpacer} />
        <View style={s.headerInfo}>
          <Text style={s.headerTitle} numberOfLines={1}>{itemTitle}</Text>
          <Text style={s.headerSubtitle}>{itemType === 'event' ? 'Event review' : 'Location review'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeButton}>
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Rating block ── */}
        <View style={s.ratingBlock}>
          <Text style={s.ratingPrompt}>
            {rating === 0 ? 'Tap a star to rate' : RATING_PROMPTS[rating]}
          </Text>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                style={s.starBtn}
                activeOpacity={0.6}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={star <= rating ? '#FFB800' : colors.mediumGray}
                />
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.ratingLabelRow}>
            {rating > 0 && (
              <Text style={s.ratingLabelText}>{RATING_LABELS[rating]}</Text>
            )}
          </View>
        </View>

        {/* ── Review text ── */}
        <Text style={s.sectionLabel}>Your review</Text>
        <View style={s.inputWrapper}>
          <TextInput
            style={s.input}
            placeholder={rating > 0 ? RATING_PROMPTS[rating] : 'Share your experience...'}
            placeholderTextColor={colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={500}
          />
        </View>
        <View style={s.charRow}>
          <Text style={s.charCount}>{comment.length}/500</Text>
        </View>

        {/* ── Photos ── */}
        <View style={s.photosSection}>
          <Text style={s.sectionLabel}>Add photos</Text>
          <ImagePicker
            onImagesSelected={setPhotos}
            maxImages={3}
            existingImages={photos}
            aspectRatio={[4, 3]}
            allowsEditing={true}
            addButtonHeight={100}
          />
        </View>

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[s.submitButton, (rating === 0 || loading) && s.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.interactiveText} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={colors.interactiveText} />
              <Text style={s.submitButtonText}>Submit review</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
