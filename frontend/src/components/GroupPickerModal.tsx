import React, { useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useGroup, Group } from '../context/GroupContext';
import { useTheme } from '../context/ThemeContext';

interface GroupPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onManage: () => void;
  chipOpacity?: Animated.Value;
}

export default function GroupPickerModal({ visible, onClose, onManage, chipOpacity }: GroupPickerModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { groups, activeGroup, setActiveGroup, loadingGroups, loadGroups } = useGroup();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = React.useState(false);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      loadGroups();
      slideAnim.setValue(400);
      fadeAnim.setValue(0);
      if (chipOpacity) chipOpacity.setValue(0);
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
        ...(chipOpacity ? [Animated.timing(chipOpacity, { toValue: 1, duration: 140, useNativeDriver: true })] : []),
      ]).start(() => setModalVisible(false));
    }
  }, [visible]);

  const handleSelect = async (group: Group | null) => {
    await setActiveGroup(group);
    onClose();
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'transparent',
          justifyContent: 'flex-end',
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.45)',
        },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: 'center',
          marginBottom: spacing.md,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
        },
        title: {
          ...typography.caption,
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          flex: 1,
        },
        manageBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingVertical: 4,
          paddingHorizontal: spacing.xs,
        },
        manageBtnText: {
          ...typography.caption,
          color: colors.accent,
          fontWeight: '500' as const,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: 11,
          gap: spacing.sm,
        },
        iconWrap: {
          width: 34,
          height: 34,
          borderRadius: 10,
          justifyContent: 'center',
          alignItems: 'center',
        },
        rowBody: { flex: 1 },
        rowName: {
          ...typography.bodySmallMedium,
          color: colors.text,
        },
        rowMeta: {
          ...typography.caption,
          color: colors.textMuted,
          marginTop: 1,
        },
        checkmark: { width: 22, alignItems: 'center' },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginHorizontal: spacing.md,
        },
        emptyWrap: {
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
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
        emptyTitle: {
          ...typography.bodySmallMedium,
          color: colors.text,
          textAlign: 'center',
        },
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
        emptyBtnText: {
          ...typography.captionMedium,
          color: '#000',
          fontWeight: '600' as const,
        },
        loading: { padding: spacing.lg, alignItems: 'center' },
      }),
    [colors, insets.bottom]
  );

  const isPublic = activeGroup === null;

  const renderGroupRow = (item: Group) => {
    const selected = activeGroup?.id === item.id;
    return (
      <View key={item.id}>
        <View style={s.divider} />
        <TouchableOpacity style={s.row} onPress={() => handleSelect(item)} activeOpacity={0.7}>
          <View style={[s.iconWrap, { backgroundColor: selected ? colors.accent : colors.accentTint }]}>
            <Ionicons name="people" size={17} color={selected ? '#000' : colors.accent} />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowName}>{item.name}</Text>
            <Text style={s.rowMeta}>{item.role === 'owner' ? 'Owner' : 'Member'}</Text>
          </View>
          <View style={s.checkmark}>
            {selected
              ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              : <Ionicons name="chevron-forward" size={15} color={colors.border} />
            }
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <View style={s.sheet}>
            <View style={s.handle} />

            {/* Header */}
            <View style={s.titleRow}>
              <Text style={s.title}>Viewing as</Text>
              <TouchableOpacity
                style={s.manageBtn}
                onPress={() => { onClose(); onManage(); }}
              >
                <Text style={s.manageBtnText}>Manage</Text>
                <Ionicons name="chevron-forward" size={11} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {/* Public row */}
            <TouchableOpacity style={s.row} onPress={() => handleSelect(null)} activeOpacity={0.7}>
              <View style={[s.iconWrap, { backgroundColor: isPublic ? colors.accent : colors.accentTint }]}>
                <Ionicons name="globe-outline" size={17} color={isPublic ? '#000' : colors.accent} />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowName}>Public</Text>
                <Text style={s.rowMeta}>All visible content</Text>
              </View>
              <View style={s.checkmark}>
                {isPublic
                  ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  : <Ionicons name="chevron-forward" size={15} color={colors.border} />
                }
              </View>
            </TouchableOpacity>

            {/* Groups */}
            {loadingGroups && groups.length === 0 ? (
              <View style={s.loading}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : groups.length === 0 ? (
              <View style={s.emptyWrap}>
                <View style={s.divider} />
                <View style={[s.emptyIcon, { marginTop: spacing.sm }]}>
                  <Ionicons name="people-outline" size={22} color={colors.accent} />
                </View>
                <Text style={s.emptyTitle}>No groups yet</Text>
                <Text style={s.emptySub}>Create a group to share pins and reports with friends or teammates.</Text>
                <TouchableOpacity
                  style={s.emptyBtn}
                  activeOpacity={0.85}
                  onPress={() => { onClose(); onManage(); }}
                >
                  <Ionicons name="add" size={14} color="#000" />
                  <Text style={s.emptyBtnText}>Create a group</Text>
                </TouchableOpacity>
              </View>
            ) : (
              groups.map(renderGroupRow)
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
