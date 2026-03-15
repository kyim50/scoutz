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
import { useGroup } from '../context/GroupContext';
import { reportAPI, uploadAPI } from '../services/api';
import ImagePicker from '../components/ImagePicker';

export type ReportType = 'hazard' | 'food_status' | 'campus_update' | 'safety' | 'accessibility' | 'general' | 'other';

const REPORT_TYPES: { value: ReportType; label: string; icon: string; color: string; tint: string }[] = [
  { value: 'general',       label: 'General',       icon: 'chatbubble-outline',              color: '#28B873', tint: 'rgba(40,184,115,0.12)' },
  { value: 'hazard',        label: 'Hazard',         icon: 'warning-outline',                 color: '#FF9500', tint: 'rgba(255,149,0,0.12)' },
  { value: 'food_status',   label: 'Food',           icon: 'restaurant-outline',              color: '#FF6B35', tint: 'rgba(255,107,53,0.12)' },
  { value: 'safety',        label: 'Safety',         icon: 'shield-outline',                  color: '#FF3B30', tint: 'rgba(255,59,48,0.12)' },
  { value: 'campus_update', label: 'Campus',         icon: 'school-outline',                  color: '#5856D6', tint: 'rgba(88,86,214,0.12)' },
  { value: 'accessibility', label: 'Accessibility',  icon: 'accessibility-outline',           color: '#007AFF', tint: 'rgba(0,122,255,0.12)' },
  { value: 'other',         label: 'Other',          icon: 'ellipsis-horizontal-circle-outline', color: '#8E8E93', tint: 'rgba(142,142,147,0.12)' },
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
  const { activeGroup } = useGroup();
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

    if (!content.trim()) {
      showToast('Please add a description.', 'error');
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
        content: content.trim(),
        imageUrl,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        isAnonymous,
        groupId: activeGroup?.id,
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
        params: createdReport ? { newReport: createdReport, targetReportId: createdReport.id } : undefined,
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

        scrollView: { flex: 1, paddingHorizontal: spacing.md },

        section: { marginBottom: spacing.lg },

        label: {
          ...typography.captionMedium,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: spacing.xs,
        },

        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.borderLight,
          marginBottom: spacing.lg,
        },

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

        // ── Type chips ──
        typeRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        typeChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 7,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceGray,
          gap: spacing.xs,
        },
        typeChipText: { ...typography.bodySmallMedium, color: colors.text },

        // ── Chips (sub-options & signal) ──
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        chip: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: 'transparent',
        },
        chipActive: {
          backgroundColor: colors.accentTint,
          borderColor: colors.accent,
        },
        chipText: { ...typography.bodySmallMedium, color: colors.textSecondary },
        chipTextActive: { color: colors.accent },

        // ── Text input ──
        inputWrapper: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.sm,
          padding: spacing.sm,
        },
        input: {
          ...typography.bodySmall,
          color: colors.text,
          minHeight: 80,
          textAlignVertical: 'top',
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.xs,
        },
        charRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xs },
        charCount: { ...typography.caption, color: colors.textMuted },

        footer: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.borderLight,
        },
        submitButton: {
          backgroundColor: colors.interactiveBg,
          paddingVertical: spacing.md,
          borderRadius: borderRadius.sm,
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
          <Text style={s.headerSubtitle}>{selectedTypeObj.label}</Text>
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
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {pinTitle && (
          <View style={s.pinContextPill}>
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <Text style={s.pinContextText}>{pinTitle}</Text>
          </View>
        )}

        {/* Type */}
        <View style={s.section}>
          <Text style={s.label}>Type</Text>
          <View style={s.typeRow}>
            {REPORT_TYPES.map((t) => {
              const active = type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[s.typeChip, active && { backgroundColor: t.tint }]}
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
                  <Ionicons name={t.icon as any} size={15} color={active ? t.color : colors.textSecondary} />
                  <Text style={[s.typeChipText, active && { color: t.color, fontWeight: '600' }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Sub options */}
        {subOptions.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <Text style={s.label}>Details</Text>
              <View style={s.chipRow}>
                {subOptions.map((opt) => {
                  const active = subOption === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setSubOption(active ? '' : opt.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* Signal fields */}
        {signalFields.length > 0 && (
          <>
            <View style={s.divider} />

            {signalFields.includes('open_now') && (
              <View style={s.section}>
                <Text style={s.label}>Open now</Text>
                <View style={s.chipRow}>
                  {OPEN_NOW_OPTIONS.map((opt) => {
                    const active = openNow === opt.value;
                    return (
                      <TouchableOpacity key={opt.value} style={[s.chip, active && s.chipActive]} onPress={() => setOpenNow(active ? '' : opt.value)} activeOpacity={0.7}>
                        <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {signalFields.includes('crowd_level') && (
              <View style={s.section}>
                <Text style={s.label}>Crowd level</Text>
                <View style={s.chipRow}>
                  {CROWD_LEVEL_OPTIONS.map((opt) => {
                    const active = crowdLevel === opt.value;
                    return (
                      <TouchableOpacity key={opt.value} style={[s.chip, active && s.chipActive]} onPress={() => setCrowdLevel(active ? '' : opt.value)} activeOpacity={0.7}>
                        <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {signalFields.includes('purchase_required') && (
              <View style={s.section}>
                <Text style={s.label}>Purchase required</Text>
                <View style={s.chipRow}>
                  {PURCHASE_REQUIRED_OPTIONS.map((opt) => {
                    const active = purchaseRequired === opt.value;
                    return (
                      <TouchableOpacity key={opt.value} style={[s.chip, active && s.chipActive]} onPress={() => setPurchaseRequired(active ? '' : opt.value)} activeOpacity={0.7}>
                        <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {signalFields.includes('accessibility') && (
              <View style={s.section}>
                <Text style={s.label}>Accessibility</Text>
                <View style={s.chipRow}>
                  {ACCESSIBILITY_LEVEL_OPTIONS.map((opt) => {
                    const active = accessibilityLevel === opt.value;
                    return (
                      <TouchableOpacity key={opt.value} style={[s.chip, active && s.chipActive]} onPress={() => setAccessibilityLevel(active ? '' : opt.value)} activeOpacity={0.7}>
                        <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {signalFields.includes('safety') && (
              <View style={s.section}>
                <Text style={s.label}>Safety level</Text>
                <View style={s.chipRow}>
                  {SAFETY_LEVEL_OPTIONS.map((opt) => {
                    const active = safetyLevel === opt.value;
                    return (
                      <TouchableOpacity key={opt.value} style={[s.chip, active && s.chipActive]} onPress={() => setSafetyLevel(active ? '' : opt.value)} activeOpacity={0.7}>
                        <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {/* Context */}
        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.label}>What's happening?</Text>
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
        </View>

        {/* Photo */}
        <View style={s.divider} />
        <View style={[s.section, { marginBottom: 0 }]}>
          <Text style={s.label}>Photo (optional)</Text>
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

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[s.submitButton, (loading || !content.trim()) && s.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !content.trim()}
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
