import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../constants/theme';
import { groupAPI } from '../services/api';
import { useGroup, Group, GroupMember } from '../context/GroupContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

interface GroupDetailScreenProps {
  navigation: any;
  route: { params: { groupId: string } };
}

export default function GroupDetailScreen({ navigation, route }: GroupDetailScreenProps) {
  const { groupId } = route.params;
  const { colors } = useTheme();
  const { showToast, showAlert } = useAlert();
  const { user } = useAuth();
  const { loadGroups, activeGroup, setActiveGroup, groups } = useGroup();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<(Group & { members?: GroupMember[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [addUsername, setAddUsername] = useState('');
  const [adding, setAdding] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [refreshingCode, setRefreshingCode] = useState(false);

  const isOwner = group?.owner_id === user?.id;
  const isActive = activeGroup?.id === groupId;

  const fetchGroup = useCallback(async () => {
    try {
      const res = await groupAPI.getGroup(groupId);
      setGroup(res?.data?.group ?? null);
    } catch (e: any) {
      showToast('Failed to load group', 'error');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const handleCopyCode = async () => {
    if (!group?.invite_code) return;
    await Clipboard.setStringAsync(group.invite_code);
    showToast('Invite code copied', 'success');
  };

  const handleRefreshCode = async () => {
    if (!group) return;
    setRefreshingCode(true);
    try {
      const res = await groupAPI.refreshInviteCode(groupId);
      setGroup(prev => prev ? { ...prev, invite_code: res?.data?.invite_code } : prev);
      showToast('Invite code refreshed', 'success');
    } catch {
      showToast('Failed to refresh code', 'error');
    } finally {
      setRefreshingCode(false);
    }
  };

  const handleAddMember = async () => {
    const username = addUsername.trim();
    if (!username) return;
    setAdding(true);
    try {
      await groupAPI.addMember(groupId, username);
      setAddUsername('');
      await fetchGroup();
      showToast('Member added', 'success');
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Failed to add member';
      showToast(msg, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = (member: GroupMember) => {
    const isMyself = member.user_id === user?.id;
    const title = isMyself ? 'Leave Group' : `Remove ${member.user?.name || 'member'}`;
    const message = isMyself
      ? 'Are you sure you want to leave this group?'
      : `Remove ${member.user?.name || 'this member'} from the group?`;

    showAlert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isMyself ? 'Leave' : 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await groupAPI.removeMember(groupId, member.user_id);
            if (isMyself) {
              if (isActive) await setActiveGroup(null);
              await loadGroups();
              navigation.goBack();
            } else {
              await fetchGroup();
              showToast('Member removed', 'success');
            }
          } catch (e: any) {
            const msg = e?.response?.data?.error?.message || 'Failed to remove member';
            showToast(msg, 'error');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    showAlert('Delete Group', `Delete "${group?.name}"? This cannot be undone. All linked content will become public.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await groupAPI.deleteGroup(groupId);
            if (isActive) await setActiveGroup(null);
            await loadGroups();
            navigation.goBack();
            showToast('Group deleted', 'success');
          } catch {
            showToast('Failed to delete group', 'error');
          }
        },
      },
    ]);
  };

  const handleRename = async () => {
    const name = newName.trim();
    if (!name || !group) return;
    setRenaming(true);
    try {
      await groupAPI.renameGroup(groupId, name);
      setGroup(prev => prev ? { ...prev, name } : prev);
      if (isActive) await setActiveGroup({ ...group, name });
      await loadGroups();
      setShowRename(false);
      setNewName('');
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message || 'Failed to rename', 'error');
    } finally {
      setRenaming(false);
    }
  };

  const toggleActive = async () => {
    if (isActive) {
      await setActiveGroup(null);
    } else if (group) {
      await setActiveGroup(group);
    }
  };

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
          borderBottomColor: colors.border,
        },
        backBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerTitle: { ...typography.h4, color: colors.text, flex: 1, textAlign: 'center' },
        headerMore: {
          width: 36,
          height: 36,
          borderRadius: 18,
          justifyContent: 'center',
          alignItems: 'center',
        },
        scroll: { flex: 1 },
        scrollContent: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
        section: {},
        sectionLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
        // Active toggle
        activeToggle: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: isActive ? colors.accent : colors.border,
          ...shadows.sm,
        },
        activeToggleText: { ...typography.body, color: colors.text, flex: 1 },
        activeToggleChip: {
          backgroundColor: isActive ? colors.accent : colors.inputBg,
          borderRadius: borderRadius.round,
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
        },
        activeToggleChipText: { ...typography.label, color: isActive ? '#fff' : colors.textMuted, fontSize: 11 },
        // Invite code
        codeCard: {
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          gap: spacing.sm,
        },
        codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        codeText: {
          ...typography.mono,
          color: colors.text,
          fontSize: 18,
          letterSpacing: 2,
          flex: 1,
        },
        codeBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.inputBg,
          justifyContent: 'center',
          alignItems: 'center',
        },
        codeHint: { ...typography.caption, color: colors.textMuted },
        // Add member
        addRow: { flexDirection: 'row', gap: spacing.sm },
        addInput: {
          flex: 1,
          backgroundColor: colors.inputBg,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 10,
          ...typography.body,
          color: colors.text,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        addBtn: {
          backgroundColor: colors.accent,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          justifyContent: 'center',
          alignItems: 'center',
          minWidth: 64,
          height: 44,
        },
        addBtnDisabled: { opacity: 0.5 },
        addBtnText: { ...typography.buttonSmall, color: '#fff' },
        // Members
        memberItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        },
        memberDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginLeft: 44,
        },
        memberAvatar: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.accentTint,
          justifyContent: 'center',
          alignItems: 'center',
        },
        memberName: { ...typography.body, color: colors.text, flex: 1 },
        memberRole: { ...typography.caption, color: colors.textMuted },
        memberRemoveBtn: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.errorTint ?? 'rgba(255,59,48,0.1)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        membersCard: {
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
          paddingHorizontal: spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        // Danger
        dangerBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          backgroundColor: 'rgba(255,59,48,0.08)',
          borderRadius: borderRadius.md,
          paddingVertical: 14,
        },
        dangerBtnText: { ...typography.button, color: colors.error },
        // Rename modal
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: borderRadius.xl,
          borderTopRightRadius: borderRadius.xl,
          padding: spacing.lg,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
          gap: spacing.md,
        },
        sheetHandle: {
          width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm,
        },
        sheetTitle: { ...typography.h4, color: colors.text },
        renameInput: {
          backgroundColor: colors.inputBg,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          ...typography.body,
          color: colors.text,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        submitBtn: { backgroundColor: colors.accent, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
        submitBtnDisabled: { opacity: 0.5 },
        submitBtnText: { ...typography.button, color: '#fff' },
        cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
        cancelBtnText: { ...typography.body, color: colors.textMuted },
      }),
    [colors, insets.bottom, isActive]
  );

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!group) return null;

  const members: GroupMember[] = group.members ?? [];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{group.name}</Text>
        {isOwner ? (
          <TouchableOpacity style={s.headerMore} onPress={() => { setNewName(group.name); setShowRename(true); }}>
            <Ionicons name="pencil-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Active context toggle */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Map Context</Text>
          <TouchableOpacity style={s.activeToggle} onPress={toggleActive} activeOpacity={0.75}>
            <Ionicons name={isActive ? 'eye' : 'eye-off-outline'} size={20} color={isActive ? colors.accent : colors.mediumGray} />
            <Text style={s.activeToggleText}>
              {isActive ? 'Viewing group content on map' : 'Tap to filter map to this group'}
            </Text>
            <View style={s.activeToggleChip}>
              <Text style={s.activeToggleChipText}>{isActive ? 'ACTIVE' : 'OFF'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Invite code */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Invite Code</Text>
          <View style={s.codeCard}>
            <View style={s.codeRow}>
              <Text style={s.codeText}>{group.invite_code}</Text>
              <TouchableOpacity style={s.codeBtn} onPress={handleCopyCode}>
                <Ionicons name="copy-outline" size={16} color={colors.text} />
              </TouchableOpacity>
              {isOwner && (
                <TouchableOpacity style={s.codeBtn} onPress={handleRefreshCode} disabled={refreshingCode}>
                  {refreshingCode
                    ? <ActivityIndicator size="small" color={colors.accent} />
                    : <Ionicons name="refresh-outline" size={16} color={colors.text} />
                  }
                </TouchableOpacity>
              )}
            </View>
            <Text style={s.codeHint}>Share this code for others to join</Text>
          </View>
        </View>

        {/* Add member (owner only) */}
        {isOwner && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Add Member</Text>
            <View style={s.addRow}>
              <TextInput
                style={s.addInput}
                placeholder="Username"
                placeholderTextColor={colors.textMuted}
                value={addUsername}
                onChangeText={setAddUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleAddMember}
              />
              <TouchableOpacity
                style={[s.addBtn, (!addUsername.trim() || adding) && s.addBtnDisabled]}
                onPress={handleAddMember}
                disabled={!addUsername.trim() || adding}
              >
                {adding
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.addBtnText}>Add</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Members list */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Members · {members.length}</Text>
          <View style={s.membersCard}>
            {members.map((m, idx) => {
              const isSelf = m.user_id === user?.id;
              const canRemove = isOwner ? m.role !== 'owner' : isSelf;
              return (
                <View key={m.id}>
                  {idx > 0 && <View style={s.memberDivider} />}
                  <View style={s.memberItem}>
                    <View style={s.memberAvatar}>
                      <Ionicons name="person" size={18} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName}>{m.user?.name || 'Unknown'}</Text>
                      <Text style={s.memberRole}>
                        {m.role === 'owner' ? 'Owner' : 'Member'}{isSelf ? ' · You' : ''}
                      </Text>
                    </View>
                    {canRemove && (
                      <TouchableOpacity style={s.memberRemoveBtn} onPress={() => handleRemoveMember(m)}>
                        <Ionicons
                          name={isSelf ? 'exit-outline' : 'close'}
                          size={14}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Delete group (owner only) */}
        {isOwner && (
          <TouchableOpacity style={s.dangerBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={s.dangerBtnText}>Delete Group</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Rename modal */}
      <Modal visible={showRename} transparent animationType="slide" onRequestClose={() => setShowRename(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Rename Group</Text>
            <TextInput
              style={s.renameInput}
              value={newName}
              onChangeText={setNewName}
              maxLength={50}
              autoFocus
              selectTextOnFocus
            />
            <TouchableOpacity
              style={[s.submitBtn, (!newName.trim() || renaming) && s.submitBtnDisabled]}
              onPress={handleRename}
              disabled={!newName.trim() || renaming}
            >
              {renaming
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.submitBtnText}>Save</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowRename(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
