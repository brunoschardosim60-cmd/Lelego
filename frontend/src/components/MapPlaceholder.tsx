import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';

interface MapPlaceholderProps {
  origin?: { lat: number; lng: number; address?: string } | null;
  children?: React.ReactNode;
}

// Web placeholder for the map
export const MapPlaceholder: React.FC<MapPlaceholderProps> = ({ origin, children }) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.backgroundSecondary, COLORS.background]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="map" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Mapa Interativo</Text>
          <Text style={styles.subtitle}>
            Disponível no aplicativo móvel
          </Text>
          {origin && (
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={20} color={COLORS.secondary} />
              <Text style={styles.locationText}>
                {origin.address || `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xl,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.sm,
  },
  locationText: {
    marginLeft: SPACING.sm,
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
  },
});

export default MapPlaceholder;
