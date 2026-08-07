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
import { RowSkeleton, SkeletonList } from '../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { groupAPI } from '../services/api';
import { useGroup, Group } from '../context/GroupContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

interface GroupsScreenProps {
  navigation: any;
}

export default function GroupsScreen({ navigation }: GroupsScreenProps) {
  const { colors } = useTheme();
  const { showToast } = useAlert();
  const { groups, loadGroups, loadingGroups, activeGroup } = useGroup();
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
      showToast(e?.response?.data?.error?.message || 'Invalid invite code', 'error');
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
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
          gap: spacing.sm,
        },
        backBtn: {
          width: 36,
          height: 36,
          borderRadius: 9999,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerCenter: { flex: 1, alignItems: 'center' },
        headerTitle: {
          fontSize: 17,
          fontWeight: '700' as const,
          color: colors.text,
          letterSpacing: -0.2,
        },
        headerSpacer: { width: 40 },
        headerActions: { flexDirection: 'row', gap: spacing.xs },
        iconBtn: {
          width: 36,
          height: 36,
          borderRadius: 9999,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        sectionLabel: {
          ...typography.captionMedium,
          color: colors.textMuted,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.xs,
          textTransform: 'uppercase' as const,
          letterSpacing: 1,
        },
        listContent: { paddingBottom: spacing.xxl },
        rowWrap: {
          backgroundColor: colors.surfaceGray,
          marginHorizontal: spacing.md,
          borderRadius: borderRadius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: 'hidden' as const,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: 13,
          gap: spacing.sm,
        },
        rowDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginLeft: spacing.md + 34 + spacing.sm,
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
          ...typography.bodySemibold,
          color: colors.text,
        },
        rowMeta: {
          ...typography.caption,
          color: colors.textMuted,
          marginTop: 1,
        },
        activeBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: colors.accentTint,
          borderRadius: borderRadius.round,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        activeBadgeText: {
          fontSize: 10,
          fontWeight: '700' as const,
          color: colors.accent,
          letterSpacing: 0.3,
        },
        emptyContainer: {
          alignItems: 'center',
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xxl,
          gap: spacing.sm,
        },
        emptyIconWrap: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        emptyTitle: {
          fontSize: 17,
          fontWeight: '700' as const,
          color: colors.text,
          textAlign: 'center' as const,
        },
        emptyHint: {
          ...typography.caption,
          color: colors.textMuted,
          textAlign: 'center' as const,
          lineHeight: 19,
        },
        actionStrip: {
          backgroundColor: colors.surfaceGray,
          marginHorizontal: spacing.md,
          marginTop: spacing.md,
          borderRadius: borderRadius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: 'hidden' as const,
        },
        actionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
          gap: spacing.sm,
        },
        actionRowDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginLeft: spacing.md + 32 + spacing.sm,
        },
        actionIconWrap: {
          width: 32,
          height: 32,
          borderRadius: 9,
          backgroundColor: colors.accentTint,
          justifyContent: 'center',
          alignItems: 'center',
        },
        actionLabel: {
          ...typography.body,
          color: colors.text,
          flex: 1,
        },
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        sheet: {
          backgroundColor: colors.surface,
          // 28 and a hairline edge to match the auth sheets — this was the one
          // sheet in the app using a smaller radius and no border.
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
          gap: spacing.md,
        },
        sheetHandle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: 'center' as const,
          marginBottom: spacing.xs,
        },
        sheetTitle: { ...typography.h4, color: colors.text },
        sheetSub: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs },
        input: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 13,
          ...typography.body,
          color: colors.text,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        submitBtn: {
          // Was colors.accent with interactiveText, i.e. black on green in dark
          // mode — poor contrast, and the only green primary in the app.
          backgroundColor: colors.interactiveBg,
          borderRadius: borderRadius.md,
          height: 46,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        // Recessed rather than faded: opacity on a filled button leaves
        // something that still reads as pressable.
        submitBtnDisabled: { backgroundColor: colors.surfaceGray },
        submitBtnText: { ...typography.button, color: colors.interactiveText },
        submitBtnTextDisabled: { color: colors.textMuted },
        cancelBtn: { alignItems: 'center' as const, paddingVertical: spacing.xs },
        cancelBtnText: { ...typography.body, color: colors.textMuted },
      }),
    [colors, insets.bottom]
  );

  const renderItem = ({ item, index }: { item: Group; index: number }) => {
    const isActive = activeGroup?.id === item.id;
    const isFirst = index === 0;
    const isLast = index === groups.length - 1;
    return (
      <View style={[
        isFirst && isLast ? s.rowWrap :
        isFirst ? { ...s.rowWrap, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 } :
        isLast ? { ...s.rowWrap, borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 0 } :
        { ...s.rowWrap, borderRadius: 0, marginTop: 0, borderBottomWidth: 0 },
      ]}>
        <TouchableOpacity
          style={s.row}
          onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
          activeOpacity={0.7}
        >
          <View style={[s.iconWrap, { backgroundColor: isActive ? colors.accent : colors.accentTint }]}>
            <Ionicons name="people" size={17} color={isActive ? colors.interactiveText : colors.accent} />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowName}>{item.name}</Text>
            <Text style={s.rowMeta}>{item.role === 'owner' ? 'Owner' : 'Member'}</Text>
          </View>
          {isActive && (
            <View style={s.activeBadge}>
              <Ionicons name="checkmark-circle" size={11} color={colors.accent} />
              <Text style={s.activeBadgeText}>Active</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Groups</Text>
        </View>
        <View style={s.headerActions}>
          {groups.length > 0 ? (
            <>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => setShowJoin(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Join a group with an invite code"
              >
                <Ionicons name="enter-outline" size={17} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => setShowCreate(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Create a group"
              >
                <Ionicons name="add" size={19} color={colors.text} />
              </TouchableOpacity>
            </>
          ) : (
            // Hidden while the empty state is on screen: it already offers both
            // actions as labelled full-width rows.
            <View style={s.headerSpacer} />
          )}
        </View>
      </View>

      {loadingGroups && groups.length === 0 ? (
        <View>
          <SkeletonList count={4}>{() => <RowSkeleton />}</SkeletonList>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.id}
          renderItem={renderItem}
          style={{ flex: 1 }}
          contentContainerStyle={[s.listContent, groups.length === 0 && { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          ListHeaderComponent={groups.length > 0 ? (
            <Text style={s.sectionLabel}>Your groups</Text>
          ) : null}
          ListFooterComponent={
            <View style={s.actionStrip}>
              <TouchableOpacity style={s.actionRow} onPress={() => setShowCreate(true)} activeOpacity={0.7}>
                <View style={s.actionIconWrap}>
                  <Ionicons name="add" size={16} color={colors.accent} />
                </View>
                <Text style={s.actionLabel}>Create a group</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={s.actionRowDivider} />
              <TouchableOpacity style={s.actionRow} onPress={() => setShowJoin(true)} activeOpacity={0.7}>
                <View style={s.actionIconWrap}>
                  <Ionicons name="enter-outline" size={16} color={colors.accent} />
                </View>
                <Text style={s.actionLabel}>Join with invite code</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="people-outline" size={28} color={colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>No groups yet</Text>
              <Text style={s.emptyHint}>
                Pins and reports you post to a group are only visible to its
                members — useful for a class, a team, or a few friends.
              </Text>
            </View>
          }
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Create a group</Text>
            <Text style={s.sheetSub}>
              You&apos;ll get an invite code to share once it&apos;s created.
            </Text>
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
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={colors.interactiveText} size="small" />
                : <Text style={[s.submitBtnText, !newGroupName.trim() && s.submitBtnTextDisabled]}>Create</Text>
              }
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
            <Text style={s.sheetTitle}>Join a group</Text>
            <Text style={s.sheetSub}>Enter the invite code shared by the group owner.</Text>
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
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={colors.interactiveText} size="small" />
                : <Text style={[s.submitBtnText, !inviteCode.trim() && s.submitBtnTextDisabled]}>Join</Text>
              }
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
