import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface PhotoUploadProps {
  label: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  value?: string; // base64 image
  onChange: (base64: string) => void;
  cameraType?: 'front' | 'back';
  aspectRatio?: [number, number];
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  label,
  description,
  icon,
  value,
  onChange,
  cameraType = 'back',
  aspectRatio = [4, 3],
}) => {
  const [loading, setLoading] = useState(false);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'Precisamos de acesso à câmera e galeria para enviar fotos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  const pickImage = async (useCamera: boolean) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setLoading(true);
    try {
      let result;
      
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: aspectRatio,
          quality: 0.7,
          base64: true,
          cameraType: cameraType === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: aspectRatio,
          quality: 0.7,
          base64: true,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const base64Image = `data:image/jpeg;base64,${asset.base64}`;
          onChange(base64Image);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erro', 'Não foi possível capturar a imagem. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const showOptions = () => {
    Alert.alert(
      'Selecionar foto',
      'Escolha como deseja adicionar a foto',
      [
        {
          text: 'Câmera',
          onPress: () => pickImage(true),
        },
        {
          text: 'Galeria',
          onPress: () => pickImage(false),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  const removeImage = () => {
    Alert.alert(
      'Remover foto',
      'Tem certeza que deseja remover esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => onChange(''),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      
      <TouchableOpacity
        style={[styles.uploadArea, value && styles.uploadAreaWithImage]}
        onPress={value ? removeImage : showOptions}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : value ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: value }} style={styles.image} resizeMode="cover" />
            <View style={styles.imageOverlay}>
              <View style={styles.removeButton}>
                <Ionicons name="close" size={20} color={COLORS.white} />
              </View>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                <Text style={styles.successText}>Foto adicionada</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <LinearGradient
              colors={[`${COLORS.primary}30`, `${COLORS.secondary}30`]}
              style={styles.iconContainer}
            >
              <Ionicons name={icon} size={32} color={COLORS.primary} />
            </LinearGradient>
            <Text style={styles.uploadText}>Toque para adicionar</Text>
            <View style={styles.optionsRow}>
              <View style={styles.optionBadge}>
                <Ionicons name="camera" size={14} color={COLORS.textSecondary} />
                <Text style={styles.optionText}>Câmera</Text>
              </View>
              <View style={styles.optionBadge}>
                <Ionicons name="images" size={14} color={COLORS.textSecondary} />
                <Text style={styles.optionText}>Galeria</Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  uploadArea: {
    height: 180,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    overflow: 'hidden',
  },
  uploadAreaWithImage: {
    borderStyle: 'solid',
    borderColor: COLORS.success,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  uploadText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    fontWeight: '500',
    marginBottom: SPACING.md,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  optionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  optionText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  successText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.success,
    fontWeight: '600',
  },
});

export default PhotoUpload;
