import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { FeedPostSkeleton } from './Skeleton';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { feedAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

interface EventFeedProps {
  eventId: string;
  currentUserId: string;
}

const REACTION_ICONS: any = {
  like: 'thumbs-up',
  fire: 'flame',
  heart: 'heart',
};

export default function EventFeed({ eventId, currentUserId }: EventFeedProps) {
  const { colors } = useTheme();
  const { showToast } = useAlert();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFeed();
  }, [eventId]);

  const loadFeed = async () => {
    try {
      setPosts(await feedAPI.getFeed(eventId));
      setError(null);
    } catch (err) {
      console.warn('Error loading feed:', err);
      setError('Could not load the feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleReaction = async (postId: string, reactionType: string, hasReacted: boolean) => {
    try {
      if (hasReacted) {
        await feedAPI.removeReaction(postId);
      } else {
        await feedAPI.addReaction(postId, reactionType);
      }
      await loadFeed();
    } catch (error) {
      console.warn('Error handling reaction:', error);
      showToast('Failed to update reaction', 'error');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getUserReaction = (post: any): string | null => {
    const userReaction = post.userReactions?.find((r: any) => r.userId === currentUserId);
    return userReaction?.type || null;
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        centered: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        listContent: {
          paddingVertical: spacing.md,
        },
        emptyContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: spacing.xxl * 2,
        },
        emptyText: {
          ...typography.h4,
          color: colors.textSecondary,
          marginTop: spacing.md,
        },
        emptySubtext: {
          ...typography.body,
          color: colors.textMuted,
          marginTop: spacing.xs,
        },
        postContainer: {
          backgroundColor: colors.surface,
          marginBottom: spacing.md,
          marginHorizontal: spacing.md,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          borderLeftWidth: 3,
          borderLeftColor: colors.border,
          borderTopWidth: 1,
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderTopColor: colors.border,
          borderRightColor: colors.border,
          borderBottomColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 4,
        },
        postHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.md,
        },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.sm,
        },
        avatarText: {
          ...typography.body,
          color: colors.accent,
          fontWeight: '700',
        },
        authorName: {
          ...typography.body,
          fontWeight: '600',
          color: colors.text,
        },
        timestamp: {
          ...typography.caption,
          color: colors.textSecondary,
          marginTop: 2,
        },
        postContent: {
          ...typography.body,
          color: colors.text,
          lineHeight: 22,
          marginBottom: spacing.md,
        },
        postImage: {
          width: '100%',
          height: 200,
          borderRadius: borderRadius.md,
          marginBottom: spacing.md,
          backgroundColor: colors.surfaceGray,
        },
        reactionsContainer: {
          flexDirection: 'row',
          gap: spacing.sm,
          paddingTop: spacing.sm,
        },
        reactionButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceGray,
        },
        reactionButtonActive: {
          backgroundColor: colors.surfaceGray,
          borderWidth: 1,
          borderColor: colors.border,
        },
        reactionCount: {
          ...typography.caption,
          color: colors.textSecondary,
        },
        reactionCountActive: {
          color: colors.accent,
          fontWeight: '600',
        },
      }),
    [colors]
  );

  const renderPost = ({ item }: { item: any }) => {
    const userReaction = getUserReaction(item);
    
    return (
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{item.user?.name || 'Unknown'}</Text>
            <Text style={styles.timestamp}>{formatTime(item.created_at)}</Text>
          </View>
        </View>

        {item.content && (
          <Text style={styles.postContent}>{item.content}</Text>
        )}

        {item.image_url && (
          <Image
            source={{ uri: item.image_url }}
            style={styles.postImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.reactionsContainer}>
          {['like', 'fire', 'heart'].map(type => {
            const count = item.reactions?.[type] || 0;
            const hasReacted = userReaction === type;
            
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.reactionButton,
                  hasReacted && styles.reactionButtonActive,
                ]}
                onPress={() => handleReaction(item.id, type, hasReacted)}
              >
                <Ionicons
                  name={REACTION_ICONS[type]}
                  size={20}
                  color={hasReacted ? colors.accent : colors.textSecondary}
                />
                {count > 0 && (
                  <Text style={[
                    styles.reactionCount,
                    hasReacted && styles.reactionCountActive,
                  ]}>
                    {count}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {[0, 1, 2].map((i) => <FeedPostSkeleton key={i} />)}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={posts}
      renderItem={renderPost}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>No posts yet</Text>
          <Text style={styles.emptySubtext}>Be the first to share something!</Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadFeed();
          }}
          tintColor={colors.primary}
        />
      }
    />
  );
}
