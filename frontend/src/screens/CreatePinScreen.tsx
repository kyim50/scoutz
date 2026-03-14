import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { pinAPI, uploadAPI } from '../services/api';
import ImagePicker from '../components/ImagePicker';

const PIN_TYPES = [
  { value: 'bathroom', label: 'Bathroom', icon: 'water-outline' },
  { value: 'food', label: 'Food', icon: 'restaurant-outline' },
  { value: 'pharmacy', label: 'Pharmacy', icon: 'medical-outline' },
  { value: 'study', label: 'Study Space', icon: 'book-outline' },
  { value: 'charging', label: 'Charging', icon: 'flash-outline' },
  { value: 'other', label: 'Other', icon: 'location-outline' },
];

interface CreatePinScreenProps {
  navigation: any;
  route: any;
}

export default function CreatePinScreen({ navigation, route }: CreatePinScreenProps) {
  const { showToast } = useAlert();
  const [type, setType] = useState('bathroom');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        handleBar: {
          alignSelf: 'center',
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.lightGray,
          marginTop: spacing.sm,
          marginBottom: spacing.sm,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
        },
        closeButton: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.round,
          backgroundColor: colors.surfaceGray,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerInfo: { flex: 1, alignItems: 'center' },
        headerTitle: { ...typography.h4, color: colors.text, fontSize: 18 },
        headerSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 1, fontSize: 11 },
        headerSpacer: { width: 36 },

        scrollView: { flex: 1, paddingHorizontal: spacing.md },

        section: { marginBottom: spacing.md },
        label: {
          ...typography.bodySmallSemibold,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontSize: 11,
          marginBottom: spacing.xs,
        },

        typeRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
        typeChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 7,
          paddingHorizontal: spacing.sm,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.surfaceGray,
          gap: spacing.xs,
        },
        typeChipActive: {
          backgroundColor: colors.interactiveBg,
        },
        typeChipText: { ...typography.bodySmallMedium, color: colors.text, fontSize: 13 },
        typeChipTextActive: { color: colors.interactiveText },

        input: {
          ...typography.body,
          fontSize: 15,
          lineHeight: 18,
          color: colors.text,
          backgroundColor: colors.surfaceGray,
          borderRadius: borderRadius.sm,
          minHeight: 46,
          paddingHorizontal: spacing.md,
          paddingVertical: 0,
          textAlignVertical: 'center',
        },
        textArea: {
          height: 74,
          paddingTop: spacing.sm,
          textAlignVertical: 'top',
        },
        inputRow: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        inputHalf: { flex: 1 },

        footer: {
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
        },
        createButton: {
          backgroundColor: colors.interactiveBg,
          paddingVertical: 12,
          borderRadius: borderRadius.sm,
          alignItems: 'center',
        },
        createButtonDisabled: { opacity: 0.4 },
        createButtonText: { ...typography.button, color: colors.interactiveText, fontSize: 15 },
      }),
    [colors]
  );

  React.useEffect(() => {
    if (route?.params?.location) {
      setLocation(route.params.location);
    } else if (route) {
      navigation.replace('PlacePin');
    }
  }, [route?.params?.location]);

  const handleCreate = async () => {
    if (!title.trim()) {
      showToast('Please enter a title', 'error');
      return;
    }

    if (!location) {
      showToast('Could not determine pin location', 'error');
      return;
    }

    setLoading(true);
    try {
      // Upload all images in parallel rather than sequentially
      let photoUrls: string[] = [];
      if (images.length > 0) {
        const uploadResults = await Promise.allSettled(
          images.map((uri) => uploadAPI.uploadImage(uri))
        );
        let failedUploads = 0;
        for (const result of uploadResults) {
          if (result.status === 'fulfilled') {
            photoUrls.push(result.value.mainUrl);
          } else {
            console.error('Image upload failed:', result.reason);
            failedUploads++;
          }
        }
        if (failedUploads > 0) {
          showToast(`${failedUploads} photo${failedUploads > 1 ? 's' : ''} failed to upload`, 'error');
        }
      }

      const result = await pinAPI.create({
        location: {
          lat: Number(location.lat),
          lng: Number(location.lng),
        },
        type,
        title,
        description: description || undefined,
        building: building || undefined,
        floor: floor || undefined,
        accessNotes: accessNotes || undefined,
        tags: [],
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      });

      showToast('Pin created successfully!', 'success');
      // Pass the new pin back so MapScreen can add it immediately (optimistic)
      const newPin = result?.data?.pin;
      navigation.navigate('Main', { screen: 'Map', params: newPin ? { newPin } : undefined });
    } catch (error: any) {
      // 409 means a similar pin already exists nearby — offer to verify it instead
      if (error?.response?.status === 409) {
        const existingPin = error.response?.data?.error?.details?.existingPin;
        Alert.alert(
          'Similar pin nearby',
          'A pin of this type already exists within 20 metres. Would you like to verify the existing one instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Verify instead',
              onPress: () =>
                navigation.navigate('Main', {
                  screen: 'Map',
                  params: existingPin ? { highlightPinId: existingPin.id } : undefined,
                }),
            },
          ]
        );
        return;
      }
      const apiMessage = error?.response?.data?.error?.message;
      showToast(apiMessage || error.message || 'Could not create pin', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = PIN_TYPES.find((t) => t.value === type);

  return (
    <KeyboardAvoidingView style={[s.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.handleBar} />
      <View style={s.header}>
        <View style={s.headerSpacer} />
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>Add a pin</Text>
          <Text style={s.headerSubtitle}>
            {selectedType?.label || 'Location'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            const hasChanges = title.trim() || description.trim() || building.trim() || floor.trim() || accessNotes.trim() || images.length > 0;
            if (hasChanges) {
              Alert.alert('Discard changes?', 'Your pin details will be lost.', [
                { text: 'Keep editing', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
              ]);
            } else {
              navigation.goBack();
            }
          }}
          style={s.closeButton}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.section}>
          <Text style={s.label}>Type</Text>
          <View style={s.typeRow}>
            {PIN_TYPES.map((pinType) => (
              <TouchableOpacity
                key={pinType.value}
                style={[s.typeChip, type === pinType.value && s.typeChipActive]}
                onPress={() => setType(pinType.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={pinType.icon as any}
                  size={15}
                  color={type === pinType.value ? colors.interactiveText : colors.text}
                />
                <Text style={[s.typeChipText, type === pinType.value && s.typeChipTextActive]}>
                  {pinType.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Title</Text>
          <TextInput
            style={s.input}
            placeholder="e.g., Library 3rd Floor Restroom"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Description</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Add details to help others find it..."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={s.section}>
          <Text style={s.label}>Location details</Text>
          <View style={s.inputRow}>
            <TextInput
              style={[s.input, s.inputHalf]}
              placeholder="Building"
              placeholderTextColor={colors.textMuted}
              value={building}
              onChangeText={setBuilding}
            />
            <TextInput
              style={[s.input, s.inputHalf]}
              placeholder="Floor"
              placeholderTextColor={colors.textMuted}
              value={floor}
              onChangeText={setFloor}
              keyboardType="default"
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Access instructions</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="How to get there..."
            placeholderTextColor={colors.textMuted}
            value={accessNotes}
            onChangeText={setAccessNotes}
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={[s.section, { marginBottom: 0 }]}>
          <Text style={s.label}>Photos</Text>
          <ImagePicker
            onImagesSelected={setImages}
            maxImages={5}
            existingImages={images}
          />
        </View>

      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[s.createButton, loading && s.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.interactiveText} />
          ) : (
            <Text style={s.createButtonText}>Create pin</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
