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
}

export default function GroupPickerModal({ visible, onClose, onManage }: GroupPickerModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { groups, activeGroup, setActiveGroup, loadingGroups, loadGroups } = useGroup();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Keep modal mounted so the exit animation plays
  const [modalVisible, setModalVisible] = React.useState(false);

  useEffect(() => {
    console.log('[GroupPickerModal] groups from context:', JSON.stringify(groups));
    console.log('[GroupPickerModal] loadingGroups:', loadingGroups);
  }, [groups, loadingGroups]);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      console.log('[GroupPickerModal] opened — calling loadGroups()');
      loadGroups().then(() => {
        console.log('[GroupPickerModal] loadGroups() resolved');
      });
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
          maxHeight: '75%',
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
          marginBottom: spacing.sm,
        },
        title: { ...typography.h4, color: colors.text, flex: 1 },
        manageBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
        },
        manageBtnText: { ...typography.caption, color: colors.accent },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          gap: spacing.sm,
        },
        iconWrap: {
          width: 38,
          height: 38,
          borderRadius: 19,
          justifyContent: 'center',
          alignItems: 'center',
        },
        rowName: { ...typography.body, color: colors.text, flex: 1 },
        rowMeta: { ...typography.caption, color: colors.textMuted },
        checkmark: { width: 20, alignItems: 'center' },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginLeft: spacing.md + 38 + spacing.sm,
        },
        emptyText: {
          ...typography.body,
          color: colors.textMuted,
          textAlign: 'center',
          padding: spacing.lg,
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
        <TouchableOpacity style={s.row} onPress={() => handleSelect(item)} activeOpacity={0.7}>
          <View style={[s.iconWrap, { backgroundColor: selected ? colors.accent : colors.accentTint }]}>
            <Ionicons name="people" size={20} color={selected ? '#fff' : colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowName}>{item.name}</Text>
            <Text style={s.rowMeta}>{item.role === 'owner' ? 'Owner' : 'Member'}</Text>
          </View>
          <View style={s.checkmark}>
            {selected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
          </View>
        </TouchableOpacity>
        <View style={s.divider} />
      </View>
    );
  };

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        {/* Backdrop */}
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          <View style={s.sheet}>
            <View style={s.handle} />

            <View style={s.titleRow}>
              <Text style={s.title}>Viewing As</Text>
              <TouchableOpacity
                style={s.manageBtn}
                onPress={() => {
                  onClose();
                  onManage();
                }}
              >
                <Text style={s.manageBtnText}>Manage Groups</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.accent} />
              </TouchableOpacity>
            </View>

            <View>
              {/* Public option */}
              <TouchableOpacity style={s.row} onPress={() => handleSelect(null)} activeOpacity={0.7}>
                <View style={[s.iconWrap, { backgroundColor: isPublic ? colors.accent : colors.interactiveBg }]}>
                  <Ionicons name="globe-outline" size={20} color={isPublic ? '#fff' : colors.mediumGray} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>Public</Text>
                  <Text style={s.rowMeta}>All visible content</Text>
                </View>
                <View style={s.checkmark}>
                  {isPublic && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                </View>
              </TouchableOpacity>

              {loadingGroups && groups.length === 0 ? (
                <View style={s.loading}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : groups.length === 0 ? (
                <Text style={s.emptyText}>No groups yet — tap Manage Groups to create one</Text>
              ) : (
                <>
                  <View style={s.divider} />
                  {groups.map(renderGroupRow)}
                </>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
