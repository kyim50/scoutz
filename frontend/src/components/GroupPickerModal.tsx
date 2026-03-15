import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useGroup, Group } from '../context/GroupContext';
import { useTheme } from '../context/ThemeContext';

interface GroupPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onManage: () => void;
}

export default function GroupPickerModal({ visible, onClose, onManage }: GroupPickerModalProps) {
  const { colors } = useTheme();
  const { groups, activeGroup, setActiveGroup, loadingGroups } = useGroup();

  const handleSelect = async (group: Group | null) => {
    await setActiveGroup(group);
    onClose();
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl,
          maxHeight: '70%',
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
        emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
        loading: { padding: spacing.lg },
      }),
    [colors]
  );

  const isPublic = activeGroup === null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={s.sheet}>
            <View style={s.handle} />

            <View style={s.titleRow}>
              <Text style={s.title}>Viewing As</Text>
              <TouchableOpacity style={s.manageBtn} onPress={() => { onClose(); onManage(); }}>
                <Text style={s.manageBtnText}>Manage Groups</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {/* Public option */}
            <TouchableOpacity style={s.row} onPress={() => handleSelect(null)} activeOpacity={0.7}>
              <View style={[s.iconWrap, { backgroundColor: isPublic ? colors.accent : colors.inputBg }]}>
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

            {groups.length > 0 && <View style={s.divider} />}

            {loadingGroups && groups.length === 0 ? (
              <View style={s.loading}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : groups.length === 0 ? (
              <Text style={s.emptyText}>No groups yet — tap Manage Groups to create one</Text>
            ) : (
              <FlatList
                data={groups}
                keyExtractor={g => g.id}
                scrollEnabled={groups.length > 4}
                ItemSeparatorComponent={() => <View style={s.divider} />}
                renderItem={({ item }) => {
                  const selected = activeGroup?.id === item.id;
                  return (
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
                  );
                }}
              />
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
