import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { CardSkeleton, SkeletonList } from '../components/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { userAPI, reportAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

const REPORT_ICONS: Record<string, string> = {
  hazard: 'warning-outline',
  food_status: 'restaurant-outline',
  campus_update: 'school-outline',
  safety: 'shield-outline',
  accessibility: 'accessibility-outline',
  general: 'flag-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatExpiry(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `Expires in ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Expires in ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Expires in ${diffDays}d`;
}

interface UserReportsScreenProps {
  navigation: any;
}

export default function UserReportsScreen({ navigation }: UserReportsScreenProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { showAlert, showToast } = useAlert();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingReportIds, setDeletingReportIds] = useState<string[]>([]);
  const insets = useSafeAreaInsets();

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          marginBottom: spacing.sm,
        },
        headerBtn: {
          width: 40,
          height: 40,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerTitle: { ...typography.h3, color: colors.text },
        headerSpacer: { width: 40 },

        listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xl },

        card: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        cardRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        },
        iconWrap: {
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: colors.surfaceHigh,
          justifyContent: 'center',
          alignItems: 'center',
        },
        cardInfo: { flex: 1 },
        cardTitle: { ...typography.bodySmallSemibold, color: colors.text },
        cardSub: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize', marginTop: 1 },
        deleteBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(255, 69, 58, 0.16)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        cardContent: {
          ...typography.bodySmall,
          color: colors.textSecondary,
          marginTop: spacing.sm,
        },
        cardFooter: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: spacing.sm,
          paddingTop: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        expiryText: { ...typography.caption, color: colors.textMuted },
        expiryWarn: { ...typography.caption, color: colors.warning },
        timeText: { ...typography.caption, color: colors.textMuted },

        emptyState: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xxl * 2,
        },
        emptyIcon: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.md,
        },
        emptyTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.xs },
        emptySub: {
          ...typography.bodySmall,
          color: colors.textMuted,
          textAlign: 'center',
          paddingHorizontal: spacing.xl,
        },
      }),
    [colors]
  );

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    if (!user) return;
    try {
      const response = await userAPI.getUserReports(user.id);
      setReports(response.data?.reports || []);
    } catch {
      showToast('Failed to load your reports', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const handleDelete = (reportId: string) => {
    showAlert('Delete Report', 'Are you sure you want to delete this report?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (deletingReportIds.includes(reportId)) return;
          setDeletingReportIds((prev) => [...prev, reportId]);
          try {
            await reportAPI.delete(reportId);
            setReports(prev => prev.filter(r => r.id !== reportId));
            showToast('Report deleted from your profile and feed.', 'success');
          } catch {
            showToast('Failed to delete report', 'error');
          } finally {
            setDeletingReportIds((prev) => prev.filter((id) => id !== reportId));
          }
        },
      },
    ]);
  };

  const handleViewOnMap = (report: any) => {
    const lat = report.lat ?? report.location?.lat;
    const lng = report.lng ?? report.location?.lng;
    if (lat && lng) {
      navigation.navigate('Main', {
        screen: 'Map',
        params: { targetLocation: { lat, lng }, targetName: 'Report' },
      });
    }
  };

  const renderReport = ({ item }: { item: any }) => {
    const icon = REPORT_ICONS[item.type] || 'flag-outline';
    const typeLabel = (item.type || 'report').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    const expiry = formatExpiry(item.expires_at);
    const isExpiringSoon = item.expires_at && (new Date(item.expires_at).getTime() - Date.now()) < 3 * 3600_000;
    const isDeleting = deletingReportIds.includes(item.id);

    return (
      <TouchableOpacity style={s.card} onPress={() => handleViewOnMap(item)} activeOpacity={0.7}>
        <View style={s.cardRow}>
          <View style={s.iconWrap}>
            <Ionicons name={icon as any} size={20} color={colors.text} />
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardTitle}>{typeLabel}</Text>
            <Text style={s.cardSub}>{item.content ? item.content.slice(0, 40) : typeLabel}</Text>
          </View>
          <TouchableOpacity
            style={[s.deleteBtn, isDeleting && { opacity: 0.6 }]}
            onPress={(e) => { e.stopPropagation?.(); handleDelete(item.id); }}
            activeOpacity={0.7}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>

        {item.content ? (
          <Text style={s.cardContent} numberOfLines={2}>{item.content}</Text>
        ) : null}

        <View style={s.cardFooter}>
          <Text style={isExpiringSoon ? s.expiryWarn : s.expiryText}>
            {expiry || ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={s.timeText}>{formatTime(item.created_at)}</Text>
            <Text style={[s.timeText, { marginLeft: 8 }]}>· View on map</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={s.container}>
        <SkeletonList count={5} style={{ paddingTop: spacing.md }}>
            {() => <CardSkeleton lines={2} hasFooter style={{ marginHorizontal: spacing.md }} />}
          </SkeletonList>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Reports</Text>
        <View style={s.headerSpacer} />
      </View>

      <FlatList
        data={reports}
        renderItem={renderReport}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Ionicons name="flag-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No reports yet</Text>
            <Text style={s.emptySub}>Reports you file will appear here. Tap a pin and add a report to get started.</Text>
          </View>
        }
      />
    </View>
  );
}
