export const COLORS = {
  // Primary colors - Purple + Pink gradient
  primary: '#8B5CF6',
  primaryDark: '#7C3AED',
  secondary: '#EC4899',
  secondaryDark: '#DB2777',
  
  // Gradient
  gradientStart: '#8B5CF6',
  gradientEnd: '#EC4899',
  
  // Background colors (dark theme)
  background: '#0F0F0F',
  backgroundSecondary: '#1A1A1A',
  backgroundTertiary: '#252525',
  card: '#1E1E1E',
  cardHover: '#2A2A2A',
  
  // Text colors
  text: '#FFFFFF',
  textSecondary: '#A1A1A1',
  textTertiary: '#666666',
  
  // Status colors
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  // Border colors
  border: '#333333',
  borderLight: '#444444',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
  
  // Transparent
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
};

export const DARK_COLORS = {
  ...COLORS,
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 32,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const LIGHT_COLORS = {
  primary: '#9B7AF7',
  primaryDark: '#8A67EA',
  secondary: '#F08DBD',
  secondaryDark: '#E77AAE',
  gradientStart: '#B9A5FF',
  gradientEnd: '#F6BCD9',
  background: '#FAF8FF',
  backgroundSecondary: '#FFFFFF',
  backgroundTertiary: '#F4EEFF',
  card: '#FFFDFE',
  cardHover: '#F8F3FF',
  text: '#241B35',
  textSecondary: '#6B6283',
  textTertiary: '#999999',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  border: '#E7DFF9',
  borderLight: '#DCCEEF',
  overlay: 'rgba(0, 0, 0, 0.4)',
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
};

export const applyThemePalette = (palette: typeof COLORS) => {
  Object.assign(COLORS, palette);
};
