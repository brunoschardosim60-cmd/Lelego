import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RideEstimate } from '../types';
import { getDriverMapIcon } from '../constants/driverMapIcons';

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    description: string;
    icon: string;
  };
  estimate?: RideEstimate;
  selected: boolean;
  onSelect: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  estimate,
  selected,
  onSelect,
}) => {
  const iconConfig = getDriverMapIcon(category.id);

  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.selected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {selected && (
        <LinearGradient
          colors={[COLORS.gradientStart, COLORS.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.selectedBorder}
        />
      )}
      <View style={styles.content}>
        <View style={[styles.iconContainer, selected && styles.iconSelected]}>
          <Image
            source={{ uri: iconConfig.iconUrl }}
            style={[
              styles.iconImage,
              category.id === 'moto' ? styles.iconImageMotoTint : null,
              !selected ? styles.iconImageUnselected : null,
            ]}
            resizeMode="contain"
          />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{category.name}</Text>
          <Text style={styles.description}>{category.description}</Text>
        </View>
        <View style={styles.priceContainer}>
          {estimate ? (
            <>
              <Text style={styles.price}>R$ {estimate.price.toFixed(2)}</Text>
              <Text style={styles.time}>{Math.round(estimate.duration_min)} min</Text>
            </>
          ) : (
            <Text style={styles.calculating}>Calculando...</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  selectedBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSelected: {
    backgroundColor: `${COLORS.primary}20`,
  },
  iconImage: {
    width: 28,
    height: 28,
  },
  iconImageMotoTint: {
    tintColor: '#16A34A',
  },
  iconImageUnselected: {
    opacity: 0.85,
  },
  info: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  name: {
    color: COLORS.text,
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    color: COLORS.text,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
  },
  time: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  calculating: {
    color: COLORS.textTertiary,
    fontSize: FONTS.sizes.sm,
  },
});
