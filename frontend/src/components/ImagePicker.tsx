import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoImagePicker from 'expo-image-picker';
import { spacing, typography, borderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

interface ImagePickerProps {
  onImagesSelected: (imageUris: string[]) => void;
  maxImages?: number;
  existingImages?: string[];
  aspectRatio?: [number, number];
  allowsEditing?: boolean;
  addButtonHeight?: number;
}

export default function ImagePicker({
  onImagesSelected,
  maxImages = 5,
  existingImages = [],
  aspectRatio = [4, 3],
  allowsEditing = true,
  addButtonHeight = 120,
}: ImagePickerProps) {
  const { colors } = useTheme();
  const { showAlert, showToast } = useAlert();
  const [images, setImages] = useState<string[]>(existingImages);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { marginTop: spacing.xs },
        imagesScrollView: { marginBottom: spacing.md },
        imageContainer: { position: 'relative', marginRight: spacing.sm },
        image: {
          width: 120,
          height: 120,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceGray,
        },
        removeButton: {
          position: 'absolute',
          top: 6,
          right: 6,
          width: 22,
          height: 22,
          backgroundColor: colors.surface,
          borderRadius: 11,
          justifyContent: 'center',
          alignItems: 'center',
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
            android: { elevation: 4 },
          }),
        },
        // Two shapes. With no photos yet this is a compact row, because a tall
        // dashed box for an optional field pushes the fields people actually
        // fill in below the fold. Once there are photos the taller tile makes
        // sense — it sits in a grid alongside them.
        addButton: {
          flexDirection: 'row',
          gap: spacing.sm,
          height: 56,
          borderRadius: borderRadius.md,
          borderWidth: 1.25,
          borderColor: colors.border,
          borderStyle: 'dashed',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.surfaceGray,
        },
        addButtonTall: {
          flexDirection: 'column',
          gap: 0,
          height: addButtonHeight,
        },
        addButtonText: { ...typography.bodySmallMedium, color: colors.textSecondary },
        addButtonTextTall: { marginTop: spacing.xs },
      }),
    [colors, addButtonHeight]
  );
  const [loading, setLoading] = useState(false);

  const requestPermissions = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ExpoImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission Required',
          'Camera permission is required to take photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    } else {
      const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission Required',
          'Photo library permission is required to select images.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  const pickImage = async (type: 'camera' | 'library') => {
    if (images.length >= maxImages) {
      showToast(`You can only select up to ${maxImages} images.`, 'error');
      return;
    }

    const hasPermission = await requestPermissions(type);
    if (!hasPermission) return;

    try {
      setLoading(true);
      
      const result = type === 'camera' 
        ? await ExpoImagePicker.launchCameraAsync({
            mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
            allowsEditing,
            aspect: aspectRatio,
            quality: 0.8,
          })
        : await ExpoImagePicker.launchImageLibraryAsync({
            mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
            allowsEditing,
            aspect: aspectRatio,
            quality: 0.8,
          });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImage = result.assets[0].uri;
        const updatedImages = [...images, newImage];
        setImages(updatedImages);
        onImagesSelected(updatedImages);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('Failed to pick image. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    onImagesSelected(updatedImages);
  };

  const showOptions = () => {
    showAlert(
      'Select Image',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Choose from Library',
          onPress: () => pickImage('library'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Selected Images */}
      {images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.imagesScrollView}
        >
          {images.map((uri, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri }} style={styles.image} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Image Button */}
      {images.length < maxImages && (
        <TouchableOpacity
          style={[styles.addButton, images.length > 0 && styles.addButtonTall]}
          onPress={showOptions}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={images.length === 0 ? 'Add photos' : 'Add more photos'}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Ionicons
                name="camera-outline"
                size={images.length > 0 ? 32 : 20}
                color={colors.textSecondary}
              />
              <Text
                style={[styles.addButtonText, images.length > 0 && styles.addButtonTextTall]}
              >
                {images.length === 0 ? 'Add photos' : `Add more (${images.length}/${maxImages})`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
