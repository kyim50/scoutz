import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useGroup, Group } from '../context/GroupContext';
import { useTheme } from '../context/ThemeContext';

interface GroupPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onManage: () => void;
}

export default function GroupPickerModal({ visible, onClose, onManage }: GroupPickerModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { groups, activeGroup, setActiveGroup, loadingGroups } = useGroup();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = React.useState(false);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      slideAnim.setValue(400);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 320,
          mass: 0.8,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 400, duration: 140, useNativeDriver: true }),
      ]).start(() => setModalVisible(false));
    }
  }, [visible]);

  const handleSelect = async (group: Group | null) => {
    Haptics.selectionAsync().catch(() => {});
    await setActiveGroup(group);
    onClose();
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
        backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xxl,
          borderTopRightRadius: borderRadius.xxl,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          // `border` is six values off the surface in the dark theme, so the
          // grab handle was very nearly invisible.
          backgroundColor: colors.lightGray,
          alignSelf: 'center',
          marginBottom: spacing.md,
        },

        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md + 4,
          paddingBottom: spacing.sm + 2,
        },
        title: {
          ...typography.caption,
          fontWeight: '600',
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.7,
          flex: 1,
        },
        manageBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          paddingVertical: 4,
          paddingLeft: spacing.sm,
        },
        manageBtnText: { ...typography.captionMedium, color: colors.accent, fontWeight: '600' },

        // Rows are separated by space and a fill rather than by hairlines. The
        // selection needs somewhere to live, and a tinted row says which option
        // is active from across the screen in a way a 20pt tick never does.
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm + 4,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.sm + 4,
          paddingVertical: spacing.sm + 4,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: 'transparent',
        },
        rowSelected: { backgroundColor: colors.accentTint, borderColor: colors.accent },

        iconWrap: {
          width: 38,
          height: 38,
          borderRadius: 11,
          justifyContent: 'center',
          alignItems: 'center',
        },
        rowBody: { flex: 1, gap: 2 },
        rowName: { ...typography.bodySemibold, fontSize: 15, color: colors.text },
        rowMeta: { ...typography.caption, color: colors.textMuted },

        emptyWrap: {
          alignItems: 'center',
          marginHorizontal: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          borderRadius: borderRadius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          gap: spacing.sm,
        },
        emptyIcon: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.accentTint,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 2,
        },
        emptyTitle: { ...typography.bodySemibold, fontSize: 15, color: colors.text, textAlign: 'center' },
        emptySub: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: 'center',
          lineHeight: 18,
        },
        emptyBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: spacing.xs,
          backgroundColor: colors.accent,
          paddingHorizontal: spacing.md,
          paddingVertical: 9,
          borderRadius: borderRadius.round,
        },
        emptyBtnText: { ...typography.captionMedium, color: '#000', fontWeight: '600' },

        skeletonRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm + 4,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.sm + 4,
          paddingVertical: spacing.sm + 4,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surfaceGray,
        },
        skeletonIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.border },
        skeletonBody: { flex: 1, gap: 6 },
        skeletonLine: { height: 11, borderRadius: 6, backgroundColor: colors.border },
      }),
    [colors, insets.bottom]
  );

  const isPublic = activeGroup === null;

  /**
   * One row, one job: choosing an audience.
   *
   * The right-hand mark used to be a chevron when unselected and a tick when
   * selected, so the same slot meant "goes somewhere" in one state and "is
   * chosen" in the other — and the chevron was drawn in `border`, which is
   * near-invisible on this surface. It is a radio now, because that is what
   * this list is.
   */
  const renderRow = (opts: {
    key: string;
    icon: string;
    name: string;
    meta: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      key={opts.key}
      style={[s.row, opts.selected && s.rowSelected]}
      onPress={opts.onPress}
      activeOpacity={0.75}
      accessibilityRole="radio"
      accessibilityLabel={`${opts.name}. ${opts.meta}`}
      accessibilityState={{ selected: opts.selected }}
    >
      <View
        style={[
          s.iconWrap,
          { backgroundColor: opts.selected ? colors.accent : colors.surfaceHigh },
        ]}
      >
        <Ionicons
          name={opts.icon as any}
          size={19}
          color={opts.selected ? '#000' : colors.textSecondary}
        />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowName} numberOfLines={1}>
          {opts.name}
        </Text>
        <Text style={s.rowMeta} numberOfLines={1}>
          {opts.meta}
        </Text>
      </View>
      <Ionicons
        name={opts.selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={opts.selected ? colors.accent : colors.borderDark}
      />
    </TouchableOpacity>
  );

  /** "Owner · 4 members", falling back to the role when the count is absent. */
  const groupMeta = (g: Group) => {
    const role = g.role === 'owner' ? 'Owner' : 'Member';
    if (typeof g.member_count !== 'number') return role;
    return `${role} · ${g.member_count} ${g.member_count === 1 ? 'member' : 'members'}`;
  };

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <View style={s.sheet}>
            <View style={s.handle} />

            <View style={s.titleRow}>
              <Text style={s.title}>Viewing as</Text>
              <TouchableOpacity
                style={s.manageBtn}
                onPress={() => {
                  onClose();
                  onManage();
                }}
                accessibilityRole="button"
                accessibilityLabel="Manage groups"
              >
                <Text style={s.manageBtnText}>Manage</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {renderRow({
              key: 'public',
              icon: 'globe-outline',
              name: 'Public',
              // Says what you will see, which is the question this sheet asks.
              meta: 'Everything on the map',
              selected: isPublic,
              onPress: () => handleSelect(null),
            })}

            {loadingGroups && groups.length === 0 ? (
              [0, 1].map((i) => (
                <View key={i} style={s.skeletonRow}>
                  <View style={s.skeletonIcon} />
                  <View style={s.skeletonBody}>
                    <View style={[s.skeletonLine, { width: '45%' }]} />
                    <View style={[s.skeletonLine, { width: '28%', opacity: 0.5 }]} />
                  </View>
                </View>
              ))
            ) : groups.length === 0 ? (
              <View style={s.emptyWrap}>
                <View style={s.emptyIcon}>
                  <Ionicons name="people-outline" size={22} color={colors.accent} />
                </View>
                <Text style={s.emptyTitle}>No groups yet</Text>
                <Text style={s.emptySub}>
                  Create a group to share pins and reports with friends or teammates.
                </Text>
                <TouchableOpacity
                  style={s.emptyBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    onClose();
                    onManage();
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons name="add" size={14} color="#000" />
                  <Text style={s.emptyBtnText}>Create a group</Text>
                </TouchableOpacity>
              </View>
            ) : (
              groups.map((g) =>
                renderRow({
                  key: g.id,
                  icon: 'people',
                  name: g.name,
                  meta: groupMeta(g),
                  selected: activeGroup?.id === g.id,
                  onPress: () => handleSelect(g),
                })
              )
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
