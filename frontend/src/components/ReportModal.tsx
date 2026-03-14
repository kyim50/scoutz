import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { reportAPI, uploadAPI } from '../services/api';
import ImagePicker from './ImagePicker';

export type ReportType = 'hazard' | 'food_status' | 'campus_update' | 'safety' | 'accessibility' | 'general' | 'other';

const REPORT_TYPES: { value: ReportType; label: string; icon: string }[] = [
  { value: 'general',       label: 'General',       icon: 'chatbubble-outline' },
  { value: 'hazard',        label: 'Hazard',         icon: 'warning-outline' },
  { value: 'food_status',   label: 'Food',           icon: 'restaurant-outline' },
  { value: 'safety',        label: 'Safety',         icon: 'shield-outline' },
  { value: 'campus_update', label: 'Campus',         icon: 'school-outline' },
  { value: 'accessibility', label: 'Accessibility',  icon: 'accessibility-outline' },
  { value: 'other',         label: 'Other',          icon: 'ellipsis-horizontal-circle-outline' },
];

const TYPE_SUBOPTIONS: Record<ReportType, { value: string; label: string }[]> = {
  general: [
    { value: 'fyi', label: 'FYI' },
    { value: 'busy', label: 'Busy right now' },
    { value: 'quiet', label: 'Quiet right now' },
    { value: 'closed', label: 'Closed' },
    { value: 'other', label: 'Other' },
  ],
  hazard: [
    { value: 'road', label: 'Road hazard' },
    { value: 'flooding', label: 'Flooding' },
    { value: 'infrastructure', label: 'Broken infrastructure' },
    { value: 'obstruction', label: 'Obstruction' },
    { value: 'other', label: 'Other' },
  ],
  food_status: [
    { value: 'crowded', label: 'Crowded' },
    { value: 'closed', label: 'Closed' },
    { value: 'slow', label: 'Slow service' },
    { value: 'out_of_stock', label: 'Out of stock' },
    { value: 'open', label: 'Open/available' },
  ],
  campus_update: [
    { value: 'construction', label: 'Construction' },
    { value: 'parking', label: 'Parking update' },
    { value: 'hours', label: 'Hours change' },
    { value: 'new_facility', label: 'New facility' },
    { value: 'general', label: 'General' },
  ],
  safety: [
    { value: 'suspicious', label: 'Suspicious activity' },
    { value: 'lighting', label: 'Lighting issue' },
    { value: 'emergency', label: 'Emergency' },
    { value: 'crowding', label: 'Crowding concern' },
  ],
  accessibility: [
    { value: 'elevator', label: 'Elevator out' },
    { value: 'ramp', label: 'Ramp blocked' },
    { value: 'parking', label: 'Accessible parking' },
    { value: 'door', label: 'Door issue' },
    { value: 'other', label: 'Other' },
  ],
  other: [
    { value: 'other', label: 'Other' },
  ],
};

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (createdReport?: any) => void;
  lat: number;
  lng: number;
  pinId?: string;
  pinTitle?: string;
}

export default function ReportModal({
  visible,
  onClose,
  onSuccess,
  lat,
  lng,
  pinId,
  pinTitle,
}: ReportModalProps) {
  const { colors, isDarkMode } = useTheme();
  const { isAnonymous } = useAuth();
  const { showToast } = useAlert();
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<ReportType>('general');
  const [subOption, setSubOption] = useState<string>('');
  const [content, setContent] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const resetForm = () => {
    setType('hazard');
    setSubOption('');
    setContent('');
    setImageUris([]);
    setFormKey((k) => k + 1);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let imageUrl: string | undefined;
      if (imageUris.length > 0) {
        const uploadResult = await uploadAPI.uploadImage(imageUris[0]);
        imageUrl = uploadResult.mainUrl;
      }

      const metadata: Record<string, unknown> = {};
      if (subOption) {
        if (type === 'food_status') metadata.status = subOption;
        else metadata.subtype = subOption;
      }

      const response = await reportAPI.create({
        type,
        pinId,
        lat,
        lng,
        content: content.trim() || undefined,
        imageUrl,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        isAnonymous,
      });

      const success = response?.success !== false;
      if (!success) {
        showToast('Failed to submit report. Please try again.', 'error');
        return;
      }

      const createdReport =
        response?.data?.report ||
        response?.report ||
        response?.data ||
        null;

      handleClose();
      onSuccess?.(createdReport);
      showToast('Your report has been submitted.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to submit report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const subOptions = TYPE_SUBOPTIONS[type];
  const showSubOptions = subOptions.length > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
        modalContent: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xxl,
          borderTopRightRadius: borderRadius.xxl,
          maxHeight: '85%',
          ...shadows.sheet,
        },
        handleBar: {
          alignSelf: 'center',
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.lightGray,
          marginTop: spacing.sm,
          marginBottom: spacing.md,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
        },
        closeButton: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerInfo: { flex: 1, alignItems: 'center' },
        title: { ...typography.h4, color: colors.text },
        headerSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
        headerSpacer: { width: 36 },
        scrollView: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
        section: { marginBottom: spacing.md },
        label: {
          ...typography.bodySmallSemibold,
          color: colors.textSecondary,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.5,
          fontSize: 12,
          marginBottom: spacing.sm,
        },
        typeRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        typeChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceGray,
          gap: spacing.xs,
        },
        typeChipActive: { backgroundColor: colors.interactiveBg },
        typeChipText: { ...typography.bodySmallMedium, color: colors.text },
        typeChipTextActive: { color: colors.interactiveText },
        subOptionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        subOptionChip: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceGray,
        },
        subOptionChipActive: { backgroundColor: colors.interactiveBg },
        subOptionText: { ...typography.bodySmallMedium, color: colors.text },
        subOptionTextActive: { color: colors.interactiveText },
        input: {
          ...typography.body,
          fontSize: 16,
          lineHeight: 20,
          color: colors.text,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.sm,
          padding: spacing.md,
          minHeight: 80,
          textAlignVertical: 'top',
        },
        charCount: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: spacing.xs },
        footer: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
        },
        submitButton: {
          backgroundColor: colors.interactiveBg,
          borderRadius: borderRadius.sm,
          paddingVertical: 14,
          alignItems: 'center',
        },
        submitButtonDisabled: { opacity: 0.4 },
        submitButtonText: { ...typography.button, color: colors.interactiveText },
        pinContext: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          marginBottom: spacing.md,
        },
        imagePickerCompact: { marginVertical: spacing.sm },
      }),
    [colors]
  );

  const selectedType = REPORT_TYPES.find((t) => t.value === type);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.modalOverlay, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.modalContent}>
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <View style={styles.headerInfo}>
              <Text style={styles.title}>Submit report</Text>
              <Text style={styles.headerSubtitle}>{selectedType?.label || 'Report'}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {pinTitle && (
              <Text style={styles.pinContext}>Reporting on: {pinTitle}</Text>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeRow}>
                {REPORT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeChip, type === t.value && styles.typeChipActive]}
                    onPress={() => {
                      setType(t.value);
                      setSubOption('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={t.icon as any}
                      size={16}
                      color={type === t.value ? colors.interactiveText : colors.text}
                    />
                    <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {showSubOptions && (
              <View style={styles.section}>
                <Text style={styles.label}>Details</Text>
                <View style={styles.subOptionRow}>
                  {subOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.subOptionChip, subOption === opt.value && styles.subOptionChipActive]}
                      onPress={() => setSubOption(subOption === opt.value ? '' : opt.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.subOptionText, subOption === opt.value && styles.subOptionTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Context</Text>
              <TextInput
                style={styles.input}
                placeholder="Describe what you're seeing..."
                placeholderTextColor={colors.textMuted}
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={200}
              />
              <Text style={styles.charCount}>{content.length}/200</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Photo</Text>
              <View style={styles.imagePickerCompact} key={`report-photo-${formKey}`}>
                <ImagePicker
                  key={`picker-${formKey}`}
                  onImagesSelected={setImageUris}
                  maxImages={1}
                  existingImages={[]}
                  aspectRatio={[4, 3]}
                  allowsEditing={true}
                />
              </View>
            </View>

            <View style={{ height: spacing.sm }} />
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.interactiveText} />
              ) : (
                <Text style={styles.submitButtonText}>Submit report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
