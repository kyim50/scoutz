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
import SelectableChip from '../components/SelectableChip';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { useGroup } from '../context/GroupContext';
import { reportAPI, uploadAPI } from '../services/api';
import ImagePicker from '../components/ImagePicker';
import { FormGroup, FormField, FormDivider } from '../components/FormSection';

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

/**
 * How long each report type stays up, mirroring TTL_CONFIG in the backend's
 * report.service.ts. Surfaced because expiry is the point of a report — it is
 * what makes it current rather than permanent like a pin — and nothing on the
 * screen said so.
 */
const REPORT_LIFETIME: Record<string, string> = {
  hazard: '24 hours',
  general: '12 hours',
  food_status: '6 hours',
  safety: '48 hours',
  campus_update: '7 days',
  accessibility: '3 days',
  other: '24 hours',
};

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

  // Preselected from the type picker's tag shortcut.
  const [type, setType] = useState<ReportType>(
    (route?.params?.presetType as ReportType) ?? 'general'
  );
  const [subOption, setSubOption] = useState<string>('');
  /** Free text for the "Other" detail chip, which otherwise leads nowhere. */
  const [otherDetail, setOtherDetail] = useState('');
  const [content, setContent] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [openNow, setOpenNow] = useState('');
  const [crowdLevel, setCrowdLevel] = useState('');
  const [purchaseRequired, setPurchaseRequired] = useState('');
  const [accessibilityLevel, setAccessibilityLevel] = useState('');
  const [safetyLevel, setSafetyLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMoreDetail, setShowMoreDetail] = useState(false);

  /**
   * The chips are real signal — "Busy right now" plus a crowd level says as
   * much as a sentence would. Requiring free text on top meant a user could
   * answer every structured question and still find submit greyed out, with
   * nothing on screen explaining why.
   */
  const hasStructuredSignal = Boolean(
    subOption || openNow || crowdLevel || purchaseRequired || accessibilityLevel || safetyLevel
  );
  const canSubmit = Boolean(content.trim()) || hasStructuredSignal;

  /** Shown on the collapsed row so answers aren't hidden without a trace. */
  const signalCount = [openNow, crowdLevel, purchaseRequired, accessibilityLevel, safetyLevel]
    .filter(Boolean).length;

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
        if (subOption === 'other' && otherDetail.trim()) {
          metadata.subtype_detail = otherDetail.trim();
        }
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
        headerSubtitle: { ...typography.captionBold, marginTop: 1, letterSpacing: 0.1 },
        headerSpacer: { width: 36, height: 36 },

        scrollView: { flex: 1, paddingHorizontal: spacing.md },

        /** Vertical rhythm between the disclosed signal fields. */
        signalFields: { gap: 20, marginTop: 18 },

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
        charRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
        charCount: { ...typography.caption, color: colors.textMuted },

        footer: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          // Opaque with a divider: the footer floats over the scroll view, so
          // without these the content ran underneath the button and the two
          // overlapped at the bottom of the list.
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
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
        submitButtonDisabled: { backgroundColor: colors.surfaceGray },
        submitButtonText: { ...typography.button, color: colors.interactiveText },
        submitButtonTextDisabled: { color: colors.textMuted },
        discloseRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        discloseTextWrap: { flex: 1, gap: 2 },
        discloseTitle: { ...typography.bodySemibold, color: colors.text, fontSize: 15 },
        discloseSub: { ...typography.caption, color: colors.textMuted },
        otherInput: {
          marginTop: spacing.sm,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          borderWidth: 1.25,
          borderColor: colors.borderDark,
          color: colors.text,
          fontSize: 15,
          height: 44,
          paddingHorizontal: spacing.md,
        },
        lifetimeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          // Belongs to the chips above it, so it sits close to them and lets
          // the group rhythm own the space below.
          marginTop: 10,
        },
        lifetimeText: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
        lifetimeStrong: { color: colors.textSecondary, fontWeight: '600' },
        submitHint: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: 'center',
          marginBottom: spacing.sm,
        },
      }),
    [colors]
  );

  if (!location) {
    return (
      <View style={s.container}>
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
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {pinTitle && (
          <View style={s.pinContextPill}>
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <Text style={s.pinContextText}>{pinTitle}</Text>
          </View>
        )}

        <FormGroup title="What are you reporting?" first>
          <FormField label="Type">
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

              {/* Expiry is the point of a report — it is what keeps it current
                  rather than permanent like a pin — and nothing said so. The icon
                  carries the type's colour so the choice above is echoed here
                  rather than the row reading as generic boilerplate. */}
              <View style={s.lifetimeRow}>
                <Ionicons name="time-outline" size={13} color={selectedTypeObj.color} />
                <Text style={s.lifetimeText}>
                  Stays on the map for{' '}
                  <Text style={s.lifetimeStrong}>{REPORT_LIFETIME[type] ?? '24 hours'}</Text>, longer if
                  people reply.
                </Text>
              </View>
          </FormField>

          {subOptions.length > 0 && (
            <FormField label="Details" hint="Pick the closest — this is what people scan for.">
                <View style={s.chipRow}>
                  {subOptions.map((opt) => {
                    const active = subOption === opt.value;
                    return (
                      <SelectableChip
                        key={opt.value}
                        selected={active}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => setSubOption(active ? '' : opt.value)}
                        accessibilityLabel={opt.label}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                      </SelectableChip>
                    );
                  })}
                </View>

                {/* Choosing "Other" with nowhere to say what is a dead end. */}
                {subOption === 'other' && (
                  <TextInput
                    style={s.otherInput}
                    placeholder="What kind of thing?"
                    placeholderTextColor={colors.textMuted}
                    value={otherDetail}
                    onChangeText={setOtherDetail}
                    maxLength={60}
                    autoFocus
                  />
                )}
            </FormField>
          )}
        </FormGroup>

        {/* Signal fields — collapsed by default.
            Rendered flat, five groups of chips at identical weight read as a
            wall of required questions. Most reports are one tap; the rest are
            for people who want to say more. */}
        {signalFields.length > 0 && (
          <>
            <FormDivider />

            <TouchableOpacity
              style={s.discloseRow}
              onPress={() => setShowMoreDetail((v) => !v)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={showMoreDetail ? 'Hide extra detail' : 'Add more detail'}
              accessibilityState={{ expanded: showMoreDetail }}
            >
              <View style={s.discloseTextWrap}>
                <Text style={s.discloseTitle}>Add more detail</Text>
                <Text style={s.discloseSub}>
                  {signalCount > 0
                    ? `${signalCount} added`
                    : 'Optional — hours, crowd, access and safety'}
                </Text>
              </View>
              <Ionicons
                name={showMoreDetail ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {showMoreDetail && (
              <View style={s.signalFields}>
            {signalFields.includes('open_now') && (
              <FormField label="Open now">
                  <View style={s.chipRow}>
                    {OPEN_NOW_OPTIONS.map((opt) => {
                      const active = openNow === opt.value;
                      return (
                        <SelectableChip key={opt.value} selected={active} style={[s.chip, active && s.chipActive]} onPress={() => setOpenNow(active ? '' : opt.value)} accessibilityLabel={opt.label}>
                          <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                        </SelectableChip>
                      );
                    })}
                  </View>
              </FormField>
            )}

            {signalFields.includes('crowd_level') && (
              <FormField label="Crowd level">
                  <View style={s.chipRow}>
                    {CROWD_LEVEL_OPTIONS.map((opt) => {
                      const active = crowdLevel === opt.value;
                      return (
                        <SelectableChip key={opt.value} selected={active} style={[s.chip, active && s.chipActive]} onPress={() => setCrowdLevel(active ? '' : opt.value)} accessibilityLabel={opt.label}>
                          <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                        </SelectableChip>
                      );
                    })}
                  </View>
              </FormField>
            )}

            {signalFields.includes('purchase_required') && (
              <FormField label="Purchase required">
                  <View style={s.chipRow}>
                    {PURCHASE_REQUIRED_OPTIONS.map((opt) => {
                      const active = purchaseRequired === opt.value;
                      return (
                        <SelectableChip key={opt.value} selected={active} style={[s.chip, active && s.chipActive]} onPress={() => setPurchaseRequired(active ? '' : opt.value)} accessibilityLabel={opt.label}>
                          <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                        </SelectableChip>
                      );
                    })}
                  </View>
              </FormField>
            )}

            {signalFields.includes('accessibility') && (
              <FormField label="Accessibility">
                  <View style={s.chipRow}>
                    {ACCESSIBILITY_LEVEL_OPTIONS.map((opt) => {
                      const active = accessibilityLevel === opt.value;
                      return (
                        <SelectableChip key={opt.value} selected={active} style={[s.chip, active && s.chipActive]} onPress={() => setAccessibilityLevel(active ? '' : opt.value)} accessibilityLabel={opt.label}>
                          <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                        </SelectableChip>
                      );
                    })}
                  </View>
              </FormField>
            )}

            {signalFields.includes('safety') && (
              <FormField label="Safety level">
                  <View style={s.chipRow}>
                    {SAFETY_LEVEL_OPTIONS.map((opt) => {
                      const active = safetyLevel === opt.value;
                      return (
                        <SelectableChip key={opt.value} selected={active} style={[s.chip, active && s.chipActive]} onPress={() => setSafetyLevel(active ? '' : opt.value)} accessibilityLabel={opt.label}>
                          <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                        </SelectableChip>
                      );
                    })}
                  </View>
              </FormField>
            )}
              </View>
            )}
          </>
        )}

        <FormGroup
          title="In your words"
          subtitle="One line is enough. This is what people read first."
        >
          {/* No field label: the group title already names this control, and
              stacking "WHAT'S HAPPENING?" under "In your words" would be two
              headings for one textarea. */}
          <View>
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
            {content.length > 140 && (
              // Only once the limit is in sight. A counter reading 0/200 on an
              // untouched field is noise that says nothing.
              <View style={s.charRow}>
                <Text style={s.charCount}>{content.length}/200</Text>
              </View>
            )}
          </View>

          <FormField label="Photo" hint="Optional — but a photo is what makes a report believable.">
              <ImagePicker
                onImagesSelected={setImageUris}
                maxImages={1}
                existingImages={[]}
                aspectRatio={[4, 3]}
                allowsEditing={true}
                addButtonHeight={96}
              />
          </FormField>
        </FormGroup>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {!canSubmit && (
          <Text style={s.submitHint}>Pick a detail above or describe what&apos;s happening.</Text>
        )}
        <TouchableOpacity
          style={[s.submitButton, !canSubmit && s.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !canSubmit}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Submit report"
          accessibilityState={{ disabled: !canSubmit }}
        >
          {loading ? (
            <ActivityIndicator color={canSubmit ? colors.interactiveText : colors.textMuted} />
          ) : (
            <>
              <Ionicons
                name="checkmark"
                size={18}
                color={canSubmit ? colors.interactiveText : colors.textMuted}
              />
              <Text style={[s.submitButtonText, !canSubmit && s.submitButtonTextDisabled]}>
                Submit report
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
