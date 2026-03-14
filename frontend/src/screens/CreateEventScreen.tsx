import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { eventAPI, uploadAPI } from '../services/api';
import RecurrenceSelector from '../components/RecurrenceSelector';
import ImagePicker from '../components/ImagePicker';

const EVENT_CATEGORIES = [
  { value: 'social', label: 'Social', icon: 'people-outline' },
  { value: 'academic', label: 'Academic', icon: 'school-outline' },
  { value: 'sports', label: 'Sports', icon: 'fitness-outline' },
  { value: 'club', label: 'Club', icon: 'flag-outline' },
  { value: 'party', label: 'Party', icon: 'beer-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

interface CreateEventScreenProps {
  navigation: any;
  route: any;
}

export default function CreateEventScreen({ navigation, route }: CreateEventScreenProps) {
  const { showToast } = useAlert();
  const [category, setCategory] = useState('social');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>('PM');
  const [duration, setDuration] = useState('2h');
  const [customDays, setCustomDays] = useState('');
  const [customHours, setCustomHours] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<any>(null);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [coverImage, setCoverImage] = useState<string[]>([]);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const DURATION_OPTIONS = [
    { value: '30m', label: '30 min' },
    { value: '1h', label: '1 hr' },
    { value: '2h', label: '2 hrs' },
    { value: '3h', label: '3 hrs' },
    { value: '4h', label: '4 hrs' },
    { value: '6h', label: '6 hrs' },
    { value: '8h', label: '8 hrs' },
    { value: '12h', label: '12 hrs' },
    { value: '1d', label: '1 day' },
    { value: '2d', label: '2 days' },
    { value: '3d', label: '3 days' },
    { value: 'custom', label: 'Custom' },
  ];

  const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const rows: { day: number; inMonth: boolean; date: Date }[][] = [];
    let current: typeof rows[0] = [];
    for (let i = 0; i < firstDay; i++) {
      const d = daysInPrev - firstDay + 1 + i;
      current.push({ day: d, inMonth: false, date: new Date(year, month - 1, d) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      current.push({ day: d, inMonth: true, date: new Date(year, month, d) });
      if (current.length === 7) { rows.push(current); current = []; }
    }
    if (current.length > 0) {
      let nextDay = 1;
      while (current.length < 7) {
        current.push({ day: nextDay, inMonth: false, date: new Date(year, month + 1, nextDay) });
        nextDay++;
      }
      rows.push(current);
    }
    return rows;
  }, [calendarMonth]);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const isToday = useCallback((d: Date) => isSameDay(d, new Date()), []);

  const goToPrevMonth = () => {
    setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const handleHourChange = (text: string) => {
    const digits = text.replace(/\D/g, '').substring(0, 2);
    const num = parseInt(digits, 10);
    if (digits === '' || (num >= 0 && num <= 12)) setHour(digits);
  };

  const handleMinuteChange = (text: string) => {
    const digits = text.replace(/\D/g, '').substring(0, 2);
    const num = parseInt(digits, 10);
    if (digits === '' || (num >= 0 && num <= 59)) setMinute(digits);
  };

  const handleMinuteBlur = () => {
    if (minute.length === 1) setMinute(minute.padStart(2, '0'));
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
        headerSpacer: { width: 36 },

        scrollView: { flex: 1, paddingHorizontal: spacing.md },

        section: { marginBottom: spacing.lg },
        label: {
          ...typography.captionMedium,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: spacing.xs,
        },

        categoryRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
        },
        categoryChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceGray,
          gap: spacing.xs,
        },
        categoryChipActive: {
          backgroundColor: colors.interactiveBg,
        },
        categoryChipText: { ...typography.bodySmallMedium, color: colors.text },
        categoryChipTextActive: { color: colors.interactiveText },

        input: {
          ...typography.bodySmall,
          color: colors.text,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.sm,
          minHeight: 46,
          paddingHorizontal: spacing.md,
          paddingVertical: 0,
          textAlignVertical: 'center',
        },
        textArea: {
          height: 88,
          paddingTop: spacing.sm,
          textAlignVertical: 'top',
        },
        inputRow: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        inputHalf: { flex: 1 },

        calendarContainer: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          padding: spacing.xs,
        },
        calendarHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xs,
          paddingBottom: spacing.sm,
        },
        calendarNav: {
          width: 32,
          height: 32,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
        },
        calendarMonthText: {
          ...typography.bodySmallSemibold,
          color: colors.text,
        },
        dayLabelsRow: {
          flexDirection: 'row',
          marginBottom: spacing.xs,
        },
        dayLabel: {
          flex: 1,
          textAlign: 'center',
          ...typography.captionBold,
          color: colors.textMuted,
        },
        calendarRow: {
          flexDirection: 'row',
        },
        dayCell: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xs,
        },
        dayCellInner: {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
        },
        dayCellSelected: {
          backgroundColor: colors.interactiveBg,
        },
        dayCellToday: {
          borderWidth: 1,
          borderColor: colors.textMuted,
        },
        dayText: {
          ...typography.bodySmallMedium,
          color: colors.text,
        },
        dayTextOutside: {
          color: colors.textMuted,
          opacity: 0.4,
        },
        dayTextSelected: {
          color: colors.interactiveText,
          fontWeight: '700',
        },
        dayTextToday: {
          fontWeight: '700',
        },
        dayTextPast: {
          color: colors.textMuted,
          opacity: 0.5,
        },

        timeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        timeInput: {
          ...typography.h4,
          lineHeight: 22,
          color: colors.text,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.sm,
          paddingVertical: 0,
          paddingHorizontal: spacing.sm,
          textAlign: 'center',
          textAlignVertical: 'center',
          minWidth: 50,
          height: 42,
        },
        timeColon: {
          ...typography.h4,
          color: colors.textMuted,
          marginHorizontal: -2,
        },
        meridiemRow: {
          flexDirection: 'row',
          borderRadius: borderRadius.sm,
          overflow: 'hidden',
          marginLeft: spacing.xs,
        },
        meridiemButton: {
          paddingVertical: 10,
          paddingHorizontal: spacing.sm,
          backgroundColor: colors.surfaceGray,
        },
        meridiemButtonActive: {
          backgroundColor: colors.interactiveBg,
        },
        meridiemText: { ...typography.bodySmallMedium, color: colors.textMuted },
        meridiemTextActive: { color: colors.interactiveText },

        durationRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        durationChip: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceGray,
        },
        durationChipActive: {
          backgroundColor: colors.interactiveBg,
        },
        durationChipText: { ...typography.bodySmallMedium, color: colors.text },
        durationChipTextActive: { color: colors.interactiveText },
        customDurationRow: {
          flexDirection: 'row',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        customDurationField: {
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.sm,
          paddingVertical: spacing.sm,
          height: 64,
        },
        customDurationInput: {
          ...typography.h3,
          color: colors.text,
          textAlign: 'center',
          width: '100%',
          paddingHorizontal: 0,
          paddingVertical: 0,
          height: 30,
        },
        customDurationUnit: {
          ...typography.caption,
          color: colors.textMuted,
          marginTop: 2,
        },

        switchRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        switchLabel: { ...typography.bodySmallMedium, color: colors.text },
        switchHelper: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
        recurrenceButton: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.sm,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.sm,
          marginTop: spacing.xs,
          gap: spacing.sm,
        },
        recurrenceButtonText: { ...typography.bodySmall, color: colors.text, flex: 1 },

        footer: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
        },
        createButton: {
          backgroundColor: colors.interactiveBg,
          paddingVertical: spacing.md,
          borderRadius: borderRadius.sm,
          alignItems: 'center',
        },
        createButtonDisabled: { opacity: 0.4 },
        createButtonText: { ...typography.button, color: colors.interactiveText },
      }),
    [colors]
  );

  React.useEffect(() => {
    if (route?.params?.location) {
      setLocation(route.params.location);
    } else if (route) {
      navigation.replace('PlacePin', { forEvent: true });
    }
  }, [route?.params?.location]);

  const buildStartTimeISO = (): string | null => {
    try {
      if (!selectedDate) return null;

      let hours = parseInt(hour, 10);
      const minutes = parseInt(minute || '0', 10);
      if (isNaN(hours)) return null;

      if (meridiem === 'PM' && hours !== 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;

      const dateObj = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        hours,
        minutes,
      );
      if (isNaN(dateObj.getTime())) return null;
      return dateObj.toISOString();
    } catch {
      return null;
    }
  };

  const parseDurationToHours = (val: string): number => {
    if (val === '30m') return 0.5;
    if (val === '1h') return 1;
    if (val === '2h') return 2;
    if (val === '3h') return 3;
    if (val === '4h') return 4;
    if (val === '6h') return 6;
    if (val === '8h') return 8;
    if (val === '12h') return 12;
    if (val === '1d') return 24;
    if (val === '2d') return 48;
    if (val === '3d') return 72;
    if (val === 'custom') {
      const d = parseFloat(customDays) || 0;
      const h = parseFloat(customHours) || 0;
      return d * 24 + h || 2;
    }
    try {
      const lower = val.toLowerCase();
      const dayMatch = lower.match(/(\d+\.?\d*)\s*d/);
      const hourMatch = lower.match(/(\d+\.?\d*)\s*h/);
      const minMatch = lower.match(/(\d+\.?\d*)\s*m/);
      let hours = 0;
      if (dayMatch) hours += parseFloat(dayMatch[1]) * 24;
      if (hourMatch) hours += parseFloat(hourMatch[1]);
      if (minMatch) hours += parseFloat(minMatch[1]) / 60;
      return hours || 2;
    } catch {
      return 2;
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      showToast('Please enter an event title', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('Please enter a description', 'error');
      return;
    }
    if (!selectedDate || !hour.trim()) {
      showToast('Please select a date and time', 'error');
      return;
    }
    if (!location) {
      showToast('Could not determine event location', 'error');
      return;
    }
    if (duration === 'custom' && !customDays && !customHours) {
      showToast('Please enter a custom duration', 'error');
      return;
    }

    const startTime = buildStartTimeISO();
    if (!startTime) {
      showToast('Invalid date or time', 'error');
      return;
    }

    const durationHours = duration ? parseDurationToHours(duration) : 2;
    const endTime = new Date(new Date(startTime).getTime() + durationHours * 60 * 60 * 1000).toISOString();

    setLoading(true);
    try {
      let photoUrl: string | undefined;
      if (coverImage.length > 0) {
        try {
          const uploadResult = await uploadAPI.uploadImage(coverImage[0]);
          photoUrl = uploadResult.mainUrl;
        } catch (uploadError) {
          console.error('Error uploading cover image:', uploadError);
          showToast('Cover photo failed to upload — event will be created without it', 'error');
        }
      }

      const createResponse = await eventAPI.create({
        location,
        title: title.trim(),
        description: description.trim(),
        category,
        startTime,
        endTime,
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        tags: [],
        photoUrl,
        locationName: locationName.trim() || undefined,
        isRecurring,
        recurrencePattern: isRecurring ? recurrencePattern : undefined,
      });

      const message = isRecurring
        ? 'Recurring event series created!'
        : 'Event created successfully!';

      showToast(message, 'success');

      const createdEvent =
        createResponse?.data?.event ||
        createResponse?.event ||
        createResponse?.data ||
        null;

      navigation.navigate('Main', {
        screen: 'Map',
        params: createdEvent ? { newEvent: createdEvent } : undefined,
      });
    } catch (error: any) {
      showToast(error.message || 'Could not create event', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getRecurrenceText = () => {
    if (!recurrencePattern) return 'Set up recurrence';
    if (recurrencePattern.frequency === 'daily') return 'Repeats daily';
    if (recurrencePattern.frequency === 'weekly' && recurrencePattern.daysOfWeek) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayNames = recurrencePattern.daysOfWeek.map((d: number) => days[d]).join(', ');
      return `Every ${dayNames}`;
    }
    return 'Custom recurrence';
  };

  const selectedCategory = EVENT_CATEGORIES.find((c) => c.value === category);

  return (
    <KeyboardAvoidingView style={[s.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.handleBar} />
      <View style={s.header}>
        <View style={s.headerSpacer} />
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>Create event</Text>
          <Text style={s.headerSubtitle}>{selectedCategory?.label || 'Event'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            const hasChanges = title.trim() || description.trim() || selectedDate || coverImage.length > 0;
            if (hasChanges) {
              Alert.alert('Discard changes?', 'Your event details will be lost.', [
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

      <ScrollView style={s.scrollView} contentContainerStyle={{ paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.section}>
          <Text style={s.label}>Category</Text>
          <View style={s.categoryRow}>
            {EVENT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[s.categoryChip, category === cat.value && s.categoryChipActive]}
                onPress={() => setCategory(cat.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={16}
                  color={category === cat.value ? colors.interactiveText : colors.text}
                />
                <Text style={[s.categoryChipText, category === cat.value && s.categoryChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Title</Text>
          <TextInput
            style={s.input}
            placeholder="e.g., Study Session for Finals"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Date</Text>
          <View style={s.calendarContainer}>
            <View style={s.calendarHeader}>
              <TouchableOpacity onPress={goToPrevMonth} style={s.calendarNav} activeOpacity={0.6}>
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </TouchableOpacity>
              <Text style={s.calendarMonthText}>
                {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={goToNextMonth} style={s.calendarNav} activeOpacity={0.6}>
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={s.dayLabelsRow}>
              {DAY_LABELS.map((label, i) => (
                <Text key={i} style={s.dayLabel}>{label}</Text>
              ))}
            </View>
            {calendarDays.map((row, ri) => (
              <View key={ri} style={s.calendarRow}>
                {row.map((cell, ci) => {
                  const selected = selectedDate && isSameDay(cell.date, selectedDate);
                  const today = isToday(cell.date);
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  const isPast = cell.inMonth && cell.date < now;
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={s.dayCell}
                      onPress={() => {
                        if (!isPast) {
                          setSelectedDate(cell.date);
                          if (cell.date.getMonth() !== calendarMonth.getMonth()) {
                            setCalendarMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                          }
                        }
                      }}
                      activeOpacity={isPast ? 1 : 0.6}
                    >
                      <View style={[
                        s.dayCellInner,
                        selected && s.dayCellSelected,
                        !selected && today && s.dayCellToday,
                      ]}>
                        <Text style={[
                          s.dayText,
                          !cell.inMonth && s.dayTextOutside,
                          selected && s.dayTextSelected,
                          !selected && today && s.dayTextToday,
                          isPast && !selected && s.dayTextPast,
                        ]}>
                          {cell.day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Time</Text>
          <View style={s.timeRow}>
            <TextInput
              style={s.timeInput}
              placeholder="12"
              placeholderTextColor={colors.textMuted}
              value={hour}
              onChangeText={handleHourChange}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={s.timeColon}>:</Text>
            <TextInput
              style={s.timeInput}
              placeholder="00"
              placeholderTextColor={colors.textMuted}
              value={minute}
              onChangeText={handleMinuteChange}
              onBlur={handleMinuteBlur}
              keyboardType="number-pad"
              maxLength={2}
            />
            <View style={s.meridiemRow}>
              <TouchableOpacity
                style={[s.meridiemButton, meridiem === 'AM' && s.meridiemButtonActive]}
                onPress={() => setMeridiem('AM')}
                activeOpacity={0.7}
              >
                <Text style={[s.meridiemText, meridiem === 'AM' && s.meridiemTextActive]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.meridiemButton, meridiem === 'PM' && s.meridiemButtonActive]}
                onPress={() => setMeridiem('PM')}
                activeOpacity={0.7}
              >
                <Text style={[s.meridiemText, meridiem === 'PM' && s.meridiemTextActive]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Duration</Text>
          <View style={s.durationRow}>
            {DURATION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[s.durationChip, duration === opt.value && s.durationChipActive]}
                onPress={() => setDuration(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[s.durationChipText, duration === opt.value && s.durationChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {duration === 'custom' && (
            <View style={s.customDurationRow}>
              <View style={s.customDurationField}>
                <TextInput
                  style={s.customDurationInput}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={customDays}
                  onChangeText={(t) => setCustomDays(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                />
                <Text style={s.customDurationUnit}>days</Text>
              </View>
              <View style={s.customDurationField}>
                <TextInput
                  style={s.customDurationInput}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={customHours}
                  onChangeText={(t) => setCustomHours(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                />
                <Text style={s.customDurationUnit}>hrs</Text>
              </View>
            </View>
          )}
        </View>

        <View style={s.section}>
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchLabel}>Recurring event</Text>
              <Text style={s.switchHelper}>Repeat on a schedule</Text>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={(value) => {
                setIsRecurring(value);
                if (value && !recurrencePattern) {
                  setShowRecurrenceModal(true);
                }
              }}
              trackColor={{ false: colors.border, true: colors.interactiveBg }}
              thumbColor={colors.surface}
            />
          </View>

          {isRecurring && (
            <TouchableOpacity
              style={s.recurrenceButton}
              onPress={() => setShowRecurrenceModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="repeat" size={18} color={colors.text} />
              <Text style={s.recurrenceButtonText}>{getRecurrenceText()}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.label}>Description</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="What's this event about?"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Venue</Text>
          <TextInput
            style={s.input}
            placeholder="e.g., Main Library, Room 204"
            placeholderTextColor={colors.textMuted}
            value={locationName}
            onChangeText={setLocationName}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Max attendees</Text>
          <TextInput
            style={s.input}
            placeholder="Leave blank for unlimited"
            placeholderTextColor={colors.textMuted}
            value={maxAttendees}
            onChangeText={setMaxAttendees}
            keyboardType="number-pad"
          />
        </View>

        <View style={[s.section, { marginBottom: 0 }]}>
          <Text style={s.label}>Cover image</Text>
          <ImagePicker
            onImagesSelected={setCoverImage}
            maxImages={1}
            existingImages={coverImage}
            aspectRatio={[16, 9]}
            allowsEditing={true}
          />
        </View>

      </ScrollView>

      <RecurrenceSelector
        visible={showRecurrenceModal}
        onClose={() => {
          setShowRecurrenceModal(false);
          if (!recurrencePattern) setIsRecurring(false);
        }}
        onSelect={(pattern) => {
          setRecurrencePattern(pattern);
          setShowRecurrenceModal(false);
        }}
        initialPattern={recurrencePattern}
      />

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[s.createButton, loading && s.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.interactiveText} />
          ) : (
            <Text style={s.createButtonText}>Create event</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
