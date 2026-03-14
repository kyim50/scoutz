import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoImagePicker from 'expo-image-picker';
import { spacing, typography, borderRadius } from '../constants/theme';
import { userAPI, uploadAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

interface EditProfileScreenProps {
  navigation: any;
}

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const { showAlert, showToast } = useAlert();
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl || null);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    if (!username || username === (user?.username || '')) {
      setUsernameStatus('idle');
      return;
    }
    usernameDebounceRef.current = setTimeout(() => {
      const valid = username.length >= 3 && /^[a-z0-9_.]+$/.test(username);
      setUsernameStatus(valid ? 'valid' : 'invalid');
    }, 400);
    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, [username, user?.username]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      let avatarUrl = user.avatarUrl;
      if (avatarUri && avatarUri !== user.avatarUrl) {
        try {
          const uploadResult = await uploadAPI.uploadImage(avatarUri);
          avatarUrl = uploadResult.thumbnailUrl;
        } catch (error: any) {
          showToast(error?.message || 'Failed to upload profile photo', 'error');
          setLoading(false);
          return;
        }
      }

      await userAPI.updateProfile(user.id, {
        name: name.trim(),
        username: username.trim() || undefined,
        bio: bio.trim() || undefined,
        avatar_url: avatarUrl,
      });

      await refreshUser();
      showToast('Profile updated', 'success');
      navigation.goBack();
    } catch (error: any) {
      showToast(error.message || 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeAvatar = () => {
    showAlert('Change Photo', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ExpoImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { showToast('Camera permission required', 'error'); return; }
          const result = await ExpoImagePicker.launchCameraAsync({
            mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]) setAvatarUri(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { showToast('Photo library permission required', 'error'); return; }
          const result = await ExpoImagePicker.launchImageLibraryAsync({
            mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]) setAvatarUri(result.assets[0].uri);
        },
      },
      ...(avatarUri ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => setAvatarUri(null) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },

        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingTop: insets.top + spacing.xs,
          paddingBottom: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderLight,
        },
        closeButton: {
          width: 32,
          height: 32,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerInfo: { flex: 1, alignItems: 'center' },
        headerTitle: { ...typography.bodySemibold, color: colors.text, fontSize: 16 },
        headerSpacer: { width: 32 },

        scrollView: { flex: 1 },
        scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xxl },

        // ── Avatar ──
        avatarArea: { alignItems: 'center', marginBottom: spacing.xl },
        avatarWrap: { position: 'relative' },
        avatarImg: {
          width: 90,
          height: 90,
          borderRadius: 45,
        },
        avatarFallback: {
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: colors.interactiveBg,
          justifyContent: 'center',
          alignItems: 'center',
        },
        avatarInitial: { fontSize: 36, fontWeight: '700', color: colors.interactiveText },
        cameraBadge: {
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.accent,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2.5,
          borderColor: colors.surface,
        },
        changePhotoText: {
          ...typography.caption,
          color: colors.accent,
          fontWeight: '600',
          marginTop: spacing.sm,
          fontSize: 13,
        },

        // ── Sections ──
        sectionLabel: {
          ...typography.bodySmallSemibold,
          color: colors.text,
          fontSize: 14,
          marginBottom: spacing.sm,
        },
        section: { marginBottom: spacing.lg },

        inputWrapper: {
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.lg,
          paddingHorizontal: spacing.md,
          minHeight: 52,
          justifyContent: 'center',
        },
        inputWrapperRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        atPrefix: {
          ...typography.body,
          fontSize: 16,
          color: colors.textMuted,
          marginRight: 2,
        },
        input: {
          ...typography.body,
          fontSize: 16,
          lineHeight: 20,
          color: colors.text,
          paddingHorizontal: 0,
          paddingVertical: 0,
          textAlignVertical: 'center',
        },
        textArea: {
          minHeight: 90,
          paddingTop: spacing.sm,
          textAlignVertical: 'top',
        },
        charRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xs },
        charCount: { ...typography.caption, color: colors.textMuted, fontSize: 11 },

        // ── Footer ──
        footer: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.borderLight,
        },
        saveBtn: {
          backgroundColor: colors.interactiveBg,
          paddingVertical: 15,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing.xs,
        },
        saveBtnDisabled: { opacity: 0.35 },
        saveBtnText: { ...typography.button, color: colors.interactiveText },
      }),
    [colors, insets.top]
  );

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            const hasChanges =
              name !== (user?.name || '') ||
              username !== (user?.username || '') ||
              bio !== (user?.bio || '') ||
              avatarUri !== (user?.avatarUrl || null);
            if (hasChanges) {
              Alert.alert('Discard changes?', 'Your profile edits will be lost.', [
                { text: 'Keep editing', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
              ]);
            } else {
              navigation.goBack();
            }
          }}
          style={s.closeButton}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>Edit profile</Text>
        </View>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={s.avatarArea}>
          <TouchableOpacity style={s.avatarWrap} onPress={handleChangeAvatar} activeOpacity={0.8}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarInitial}>{name.charAt(0).toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={s.cameraBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleChangeAvatar} activeOpacity={0.7}>
            <Text style={s.changePhotoText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Name</Text>
          <View style={s.inputWrapper}>
            <TextInput
              style={s.input}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Username */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Username</Text>
          <View style={[s.inputWrapper, s.inputWrapperRow]}>
            <Text style={s.atPrefix}>@</Text>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="handle"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {usernameStatus === 'valid' && (
              <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginRight: 4 }} />
            )}
            {usernameStatus === 'invalid' && (
              <Ionicons name="close-circle" size={18} color={colors.error} style={{ marginRight: 4 }} />
            )}
          </View>
          {usernameStatus === 'invalid' && (
            <Text style={{ ...typography.caption, color: colors.error, marginTop: 4, fontSize: 11 }}>
              Minimum 3 characters, letters, numbers, _ and . only
            </Text>
          )}
        </View>

        {/* Bio */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Bio</Text>
          <View style={s.inputWrapper}>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="Tell us about yourself..."
              placeholderTextColor={colors.textMuted}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={200}
            />
          </View>
          <View style={s.charRow}>
            <Text style={s.charCount}>{bio.length}/200</Text>
          </View>
        </View>

      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[s.saveBtn, loading && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.interactiveText} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={colors.interactiveText} />
              <Text style={s.saveBtnText}>Save changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
