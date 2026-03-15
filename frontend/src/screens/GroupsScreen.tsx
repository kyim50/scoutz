import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows } from '../constants/theme';
import { groupAPI } from '../services/api';
import { useGroup, Group } from '../context/GroupContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

interface GroupsScreenProps {
  navigation: any;
}

export default function GroupsScreen({ navigation }: GroupsScreenProps) {
  const { colors, isDarkMode } = useTheme();
  const { showToast, showAlert } = useAlert();
  const { groups, loadGroups, loadingGroups, activeGroup, setActiveGroup } = useGroup();
  const insets = useSafeAreaInsets();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  }, [loadGroups]);

  const handleCreate = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      await groupAPI.createGroup(name);
      await loadGroups();
      setNewGroupName('');
      setShowCreate(false);
      showToast('Group created', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message || 'Failed to create group', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    const code = inviteCode.trim();
    if (!code) return;
    setSubmitting(true);
    try {
      await groupAPI.joinByInviteCode(code);
      await loadGroups();
      setInviteCode('');
      setShowJoin(false);
      showToast('Joined group', 'success');
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || 'Invalid invite code';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
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
        headerActions: { flexDirection: 'row', gap: spacing.xs },
        actionBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.inputBg,
          justifyContent: 'center',
          alignItems: 'center',
        },
        list: { flex: 1 },
        listContent: { padding: spacing.md, gap: spacing.sm },
        emptyContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: spacing.xxl,
          gap: spacing.sm,
        },
        emptyIcon: { opacity: 0.3 },
        emptyTitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
        emptyHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center', opacity: 0.7 },
        card: {
          backgroundColor: colors.card,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          ...shadows.sm,
        },
        cardActive: {
          borderColor: colors.accent,
          borderWidth: 1.5,
        },
        cardIcon: {
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: colors.accentTint,
          justifyContent: 'center',
          alignItems: 'center',
        },
        cardIconActive: { backgroundColor: colors.accent },
        cardBody: { flex: 1 },
        cardName: { ...typography.bodySemibold, color: colors.text },
        cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
        cardBadge: {
          backgroundColor: colors.accentTint,
          borderRadius: borderRadius.round,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
        },
        cardBadgeText: { ...typography.label, color: colors.accent, fontSize: 10 },
        // Modal
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
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: 'center',
          marginBottom: spacing.sm,
        },
        sheetTitle: { ...typography.h4, color: colors.text },
        input: {
          backgroundColor: colors.inputBg,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          ...typography.body,
          color: colors.text,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        submitBtn: {
          backgroundColor: colors.accent,
          borderRadius: borderRadius.md,
          paddingVertical: 14,
          alignItems: 'center',
        },
        submitBtnDisabled: { opacity: 0.5 },
        submitBtnText: { ...typography.button, color: '#fff' },
        cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
        cancelBtnText: { ...typography.body, color: colors.textMuted },
      }),
    [colors, insets.bottom]
  );

  const renderItem = ({ item }: { item: Group }) => {
    const isActive = activeGroup?.id === item.id;
    return (
      <TouchableOpacity
        style={[s.card, isActive && s.cardActive]}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
        activeOpacity={0.75}
      >
        <View style={[s.cardIcon, isActive && s.cardIconActive]}>
          <Ionicons name="people" size={20} color={isActive ? '#fff' : colors.accent} />
        </View>
        <View style={s.cardBody}>
          <Text style={s.cardName}>{item.name}</Text>
          <Text style={s.cardMeta}>{item.role === 'owner' ? 'Owner' : 'Member'}</Text>
        </View>
        {isActive && (
          <View style={s.cardBadge}>
            <Text style={s.cardBadgeText}>ACTIVE</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.mediumGray} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Groups</Text>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.actionBtn} onPress={() => setShowJoin(true)}>
            <Ionicons name="enter-outline" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => setShowCreate(true)}>
            <Ionicons name="add" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loadingGroups && groups.length === 0 ? (
        <View style={s.emptyContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.id}
          renderItem={renderItem}
          style={s.list}
          contentContainerStyle={[s.listContent, groups.length === 0 && { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.mediumGray} style={s.emptyIcon} />
              <Text style={s.emptyTitle}>No groups yet</Text>
              <Text style={s.emptyHint}>Create a group or join one with an invite code</Text>
            </View>
          }
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Create Group</Text>
            <TextInput
              style={s.input}
              placeholder="Group name"
              placeholderTextColor={colors.textMuted}
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={50}
              autoFocus
            />
            <TouchableOpacity
              style={[s.submitBtn, (!newGroupName.trim() || submitting) && s.submitBtnDisabled]}
              onPress={handleCreate}
              disabled={!newGroupName.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.submitBtnText}>Create</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowCreate(false); setNewGroupName(''); }}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join Group Modal */}
      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Join Group</Text>
            <TextInput
              style={s.input}
              placeholder="Invite code"
              placeholderTextColor={colors.textMuted}
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoFocus
            />
            <TouchableOpacity
              style={[s.submitBtn, (!inviteCode.trim() || submitting) && s.submitBtnDisabled]}
              onPress={handleJoin}
              disabled={!inviteCode.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.submitBtnText}>Join</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowJoin(false); setInviteCode(''); }}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
