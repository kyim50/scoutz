import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { reportAPI, uploadAPI } from '../services/api';
import ImagePicker from '../components/ImagePicker';

export type ReportType = 'hazard' | 'food_status' | 'campus_update' | 'safety' | 'accessibility' | 'general' | 'other';

const REPORT_TYPES: { value: ReportType; label: string; icon: string; description: string }[] = [
  { value: 'general',       label: 'General',       icon: 'chatbubble-outline',   description: 'Quick note or update' },
  { value: 'hazard',        label: 'Hazard',         icon: 'warning-outline',      description: 'Physical danger' },
  { value: 'food_status',   label: 'Food',           icon: 'restaurant-outline',   description: 'Food spot status' },
  { value: 'safety',        label: 'Safety',         icon: 'shield-outline',       description: 'Safety concern' },
  { value: 'campus_update', label: 'Campus',         icon: 'school-outline',       description: 'Campus change' },
  { value: 'accessibility', label: 'Accessibility',  icon: 'accessibility-outline', description: 'Access issue' },
  { value: 'other',         label: 'Other',          icon: 'ellipsis-horizontal-circle-outline', description: 'Something else' },
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
    { value: 'open', label: 'Open' },
    { value: 'crowded', label: 'Crowded' },
    { value: 'closed', label: 'Closed' },
    { value: 'slow', label: 'Slow service' },
    { value: 'out_of_stock', label: 'Out of stock' },
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

const CONTEXT_PLACEHOLDERS: Record<ReportType, string> = {
  general:        'What do you want people to know?',
  hazard:         'Describe the hazard...',
  food_status:    'What\'s the situation?',
  campus_update:  'What changed?',
  safety:         'Describe what you\'re seeing...',
  accessibility:  'What\'s the issue?',
  other:          'Describe what\'s going on...',
};

const OPEN_NOW_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'limited', label: 'Limited' },
  { value: 'closed', label: 'Closed' },
];

const CROWD_LEVEL_OPTIONS = [
  { value: 'quiet', label: 'Quiet' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'busy', label: 'Busy' },
  { value: 'packed', label: 'Packed' },
];

const PURCHASE_REQUIRED_OPTIONS = [
  { value: 'no', label: 'No purchase' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'yes', label: 'Required' },
];

const ACCESSIBILITY_LEVEL_OPTIONS = [
  { value: 'accessible', label: 'Accessible' },
  { value: 'limited', label: 'Limited' },
  { value: 'not_accessible', label: 'Not accessible' },
];

const SAFETY_LEVEL_OPTIONS = [
  { value: 'safe', label: 'Safe' },
  { value: 'caution', label: 'Use caution' },
  { value: 'unsafe', label: 'Unsafe' },
];

// Which live-signal fields are relevant per report type
const SIGNAL_FIELDS: Record<ReportType, string[]> = {
  general:        ['open_now', 'crowd_level', 'purchase_required', 'accessibility', 'safety'],
  food_status:    ['open_now', 'crowd_level', 'purchase_required'],
  campus_update:  ['open_now', 'crowd_level'],
  safety:         ['safety'],
  accessibility:  ['accessibility'],
  hazard:         [],
  other:          [],
};

interface CreateReportScreenProps {
  navigation: any;
  route: any;
}

export default function CreateReportScreen({ navigation, route }: CreateReportScreenProps) {
  const { colors } = useTheme();
  const { isAnonymous } = useAuth();
  const { showToast } = useAlert();
  const insets = useSafeAreaInsets();
  const location = route?.params?.location as { lat: number; lng: number } | undefined;
  const pinId = route?.params?.pinId as string | undefined;
  const pinTitle = route?.params?.pinTitle as string | undefined;

  const [type, setType] = useState<ReportType>('general');
  const [subOption, setSubOption] = useState<string>('');
  const [content, setContent] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [openNow, setOpenNow] = useState('');
  const [crowdLevel, setCrowdLevel] = useState('');
  const [purchaseRequired, setPurchaseRequired] = useState('');
  const [accessibilityLevel, setAccessibilityLevel] = useState('');
  const [safetyLevel, setSafetyLevel] = useState('');
  const [loading, setLoading] = useState(false);

  const subOptions = TYPE_SUBOPTIONS[type];
  const selectedTypeObj = REPORT_TYPES.find((t) => t.value === type)!;
  const signalFields = SIGNAL_FIELDS[type] ?? [];

  const handleSubmit = async () => {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      showToast('Location is required.', 'error');
      return;
    }

    if (type === 'safety' && subOption === 'emergency') {
      Alert.alert(
        'Emergency?',
        'If this is a life-threatening emergency, call 911 immediately.\n\nContinue to file a non-emergency report?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'File report', onPress: () => submitReport() },
        ],
        { cancelable: true }
      );
      return;
    }

    submitReport();
  };

  const submitReport = async () => {
    setLoading(true);
    try {
      let imageUrl: string | undefined;
      if (imageUris.length > 0) {
        try {
          const uploadResult = await uploadAPI.uploadImage(imageUris[0]);
          imageUrl = uploadResult.mainUrl;
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          showToast('Photo failed to upload — report will be created without it', 'error');
        }
      }

      const metadata: Record<string, unknown> = {};
      if (subOption) {
        if (type === 'food_status') metadata.status = subOption;
        else metadata.subtype = subOption;
      }
      if (openNow) metadata.open_now = openNow;
      if (crowdLevel) metadata.crowd_level = crowdLevel;
      if (purchaseRequired) metadata.purchase_required = purchaseRequired;
      if (accessibilityLevel) metadata.accessibility_level = accessibilityLevel;
      if (safetyLevel) metadata.safety_level = safetyLevel;

      // Preserve old behavior for subtype-driven statuses while filling structured fields.
      if (!metadata.open_now && (subOption === 'open' || subOption === 'closed')) {
        metadata.open_now = subOption;
      }
      if (!metadata.crowd_level && (subOption === 'crowded' || subOption === 'busy' || subOption === 'quiet')) {
        metadata.crowd_level = subOption === 'crowded' ? 'busy' : subOption;
      }

      const response = await reportAPI.create({
        type,
        pinId,
        lat: location.lat,
        lng: location.lng,
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

      showToast('Report submitted.', 'success');
      navigation.navigate('Main', {
        screen: 'Map',
        params: createdReport ? { newReport: createdReport } : undefined,
      });
    } catch (error: any) {
      showToast(error.message || 'Failed to submit report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },

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
        headerInfo: { flex: 1, alignItems: 'center' },
        headerTitle: { ...typography.h5, color: colors.text },
        headerSubtitle: { ...typography.captionMedium, color: colors.textSecondary, marginTop: 1 },
        headerSpacer: { width: 36, height: 36 },

        scrollView: { flex: 1 },
        scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },

        // ── Pin context pill ──
        pinContextPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.round,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          alignSelf: 'flex-start',
          marginBottom: spacing.md,
        },
        pinContextText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },

        sectionLabel: {
          ...typography.bodySmallSemibold,
          color: colors.text,
          marginBottom: spacing.xs,
        },

        // ── Type grid ──
        typeGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        typeCard: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceGray,
          gap: spacing.xs,
        },
        typeCardActive: { backgroundColor: colors.interactiveBg },
        typeCardText: { ...typography.bodySmallMedium, color: colors.text },
        typeCardTextActive: { color: colors.interactiveText },

        // ── Sub options ──
        subRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
        subChip: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: 'transparent',
        },
        subChipActive: {
          backgroundColor: colors.accentTint,
          borderColor: colors.accent,
        },
        subChipText: { ...typography.captionBold, color: colors.textSecondary },
        subChipTextActive: { color: colors.accent },
        signalGroup: {
          marginBottom: spacing.sm,
        },
        signalGroupLabel: {
          ...typography.captionBold,
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        },

        // ── Text input ──
        inputWrapper: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          padding: spacing.sm,
          marginBottom: spacing.xs,
        },
        input: {
          ...typography.bodySmall,
          color: colors.text,
          minHeight: 68,
          textAlignVertical: 'top',
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.xs,
        },
        charRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.md },
        charCount: { ...typography.caption, color: colors.textMuted },

        photosSection: { marginBottom: spacing.xs },

        footer: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xs,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.borderLight,
        },
        submitButton: {
          backgroundColor: colors.interactiveBg,
          paddingVertical: spacing.md,
          borderRadius: borderRadius.md,
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

  if (!location) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.handleBar} />
        <View style={s.header}>
          <View style={s.headerSpacer} />
          <View style={s.headerInfo}>
            <Text style={s.headerTitle}>Submit report</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeButton}>
            <Ionicons name="close" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
            No location set. Go back and try again.
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[s.submitButton, { marginTop: spacing.lg, paddingHorizontal: spacing.xl }]}>
            <Text style={s.submitButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[s.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.handleBar} />
      <View style={s.header}>
        <View style={s.headerSpacer} />
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>Submit report</Text>
          <Text style={s.headerSubtitle}>{selectedTypeObj.description}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            const hasChanges = content.trim() || subOption || imageUris.length > 0;
            if (hasChanges) {
              Alert.alert('Discard changes?', 'Your report details will be lost.', [
                { text: 'Keep editing', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
              ]);
            } else {
              navigation.goBack();
            }
          }}
          style={s.closeButton}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {isAnonymous && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center', backgroundColor: colors.surfaceGray, borderRadius: borderRadius.round, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.xs }}>
          <Ionicons name="eye-off-outline" size={12} color={colors.textSecondary} />
          <Text style={{ ...typography.captionBold, color: colors.textSecondary }}>Posting anonymously</Text>
        </View>
      )}

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pin context */}
        {pinTitle && (
          <View style={s.pinContextPill}>
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <Text style={s.pinContextText}>{pinTitle}</Text>
          </View>
        )}

        {/* Type */}
        <Text style={s.sectionLabel}>Type</Text>
        <View style={s.typeGrid}>
          {REPORT_TYPES.map((t) => {
            const active = type === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                style={[s.typeCard, active && s.typeCardActive]}
                onPress={() => {
                  setType(t.value);
                  setSubOption('');
                  setOpenNow('');
                  setCrowdLevel('');
                  setPurchaseRequired('');
                  setAccessibilityLevel('');
                  setSafetyLevel('');
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={t.icon as any}
                  size={15}
                  color={active ? colors.interactiveText : colors.textSecondary}
                />
                <Text style={[s.typeCardText, active && s.typeCardTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sub options */}
        {subOptions.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Details</Text>
            <View style={s.subRow}>
              {subOptions.map((opt) => {
                const active = subOption === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.subChip, active && s.subChipActive]}
                    onPress={() => setSubOption(active ? '' : opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.subChipText, active && s.subChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {signalFields.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Live signal (optional)</Text>

            {signalFields.includes('open_now') && (
              <View style={s.signalGroup}>
                <Text style={s.signalGroupLabel}>Open now</Text>
                <View style={s.subRow}>
                  {OPEN_NOW_OPTIONS.map((opt) => {
                    const active = openNow === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.subChip, active && s.subChipActive]}
                        onPress={() => setOpenNow(active ? '' : opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.subChipText, active && s.subChipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {signalFields.includes('crowd_level') && (
              <View style={s.signalGroup}>
                <Text style={s.signalGroupLabel}>Crowd level</Text>
                <View style={s.subRow}>
                  {CROWD_LEVEL_OPTIONS.map((opt) => {
                    const active = crowdLevel === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.subChip, active && s.subChipActive]}
                        onPress={() => setCrowdLevel(active ? '' : opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.subChipText, active && s.subChipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {signalFields.includes('purchase_required') && (
              <View style={s.signalGroup}>
                <Text style={s.signalGroupLabel}>Purchase required</Text>
                <View style={s.subRow}>
                  {PURCHASE_REQUIRED_OPTIONS.map((opt) => {
                    const active = purchaseRequired === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.subChip, active && s.subChipActive]}
                        onPress={() => setPurchaseRequired(active ? '' : opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.subChipText, active && s.subChipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {signalFields.includes('accessibility') && (
              <View style={s.signalGroup}>
                <Text style={s.signalGroupLabel}>Accessibility</Text>
                <View style={s.subRow}>
                  {ACCESSIBILITY_LEVEL_OPTIONS.map((opt) => {
                    const active = accessibilityLevel === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.subChip, active && s.subChipActive]}
                        onPress={() => setAccessibilityLevel(active ? '' : opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.subChipText, active && s.subChipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {signalFields.includes('safety') && (
              <View style={s.signalGroup}>
                <Text style={s.signalGroupLabel}>Safety</Text>
                <View style={s.subRow}>
                  {SAFETY_LEVEL_OPTIONS.map((opt) => {
                    const active = safetyLevel === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.subChip, active && s.subChipActive]}
                        onPress={() => setSafetyLevel(active ? '' : opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.subChipText, active && s.subChipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {/* Context */}
        <Text style={s.sectionLabel}>What's happening?</Text>
        <View style={s.inputWrapper}>
          <TextInput
            style={s.input}
            placeholder={CONTEXT_PLACEHOLDERS[type]}
            placeholderTextColor={colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={200}
          />
        </View>
        <View style={s.charRow}>
          <Text style={s.charCount}>{content.length}/200</Text>
        </View>

        {/* Photo */}
        <View style={s.photosSection}>
          <Text style={s.sectionLabel}>Add a photo</Text>
          <ImagePicker
            onImagesSelected={setImageUris}
            maxImages={1}
            existingImages={[]}
            aspectRatio={[4, 3]}
            allowsEditing={true}
            addButtonHeight={96}
          />
        </View>
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          style={[s.submitButton, loading && s.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.interactiveText} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={colors.interactiveText} />
              <Text style={s.submitButtonText}>Submit report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
