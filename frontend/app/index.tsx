import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/authStore';
import { GradientButton } from '../src/components/GradientButton';
import { COLORS, FONTS, SPACING } from '../src/constants/theme';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, setGuestMode } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, router]);

  const handleGuestMode = () => {
    setGuestMode(true);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundSecondary]}
        style={styles.gradient}
      >
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={[COLORS.gradientStart, COLORS.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Ionicons name="car-sport" size={60} color={COLORS.white} />
          </LinearGradient>
          <Text style={styles.logoText}>LetsGo</Text>
          <Text style={styles.tagline}>Sua mobilidade, nosso compromisso</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="flash"
            title="Rápido"
            description="Motoristas sempre por perto"
          />
          <FeatureItem
            icon="shield-checkmark"
            title="Seguro"
            description="Viagens monitoradas"
          />
          <FeatureItem
            icon="wallet"
            title="Econômico"
            description="Preços justos sempre"
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          <GradientButton
            title="Criar conta"
            onPress={() => router.push('/(auth)/register')}
            style={styles.button}
          />
          <GradientButton
            title="Já tenho conta"
            onPress={() => router.push('/(auth)/login')}
            variant="outline"
            style={styles.button}
          />
          
          {/* Guest Mode Button */}
          <TouchableOpacity 
            style={styles.guestButton}
            onPress={handleGuestMode}
          >
            <Ionicons name="eye-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.guestButtonText}>Entrar sem login</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.terms}>
          Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade
        </Text>
      </LinearGradient>
    </View>
  );
}

const FeatureItem = ({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIcon}>
      <Ionicons name={icon} size={24} color={COLORS.primary} />
    </View>
    <View style={styles.featureText}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: height * 0.08,
    paddingBottom: SPACING.xxl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  featuresContainer: {
    marginBottom: SPACING.xxl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    marginLeft: SPACING.lg,
  },
  featureTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  featureDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  buttonsContainer: {
    marginTop: 'auto',
  },
  button: {
    marginBottom: SPACING.md,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.sm,
  },
  guestButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
    marginLeft: SPACING.sm,
  },
  terms: {
    textAlign: 'center',
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
    marginTop: SPACING.lg,
    lineHeight: 16,
  },
});
