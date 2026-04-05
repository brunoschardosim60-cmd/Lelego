import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { authAPI } from '../../src/services/api';
import { GradientButton } from '../../src/components/GradientButton';
import { Input } from '../../src/components/Input';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState('');

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!email) next.email = 'Email é obrigatório';
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = 'Email inválido';
    if (!password) next.password = 'Senha é obrigatória';
    else if (password.length < 6) next.password = 'Mínimo 6 caracteres';
    setErrors(next);
    return !Object.keys(next).length;
  };

  const handleLogin = async () => {
    setApiError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const isDriverMode = params.mode === 'driver';
      const res = await authAPI.login({
        email: normalizeEmail(email),
        password,
        ...(isDriverMode ? { login_as: 'driver' } : {}),
      });
      await login(res.data.user, res.data.access_token);
      router.replace('/(tabs)');
    } catch (e: any) {
      setApiError(e.response?.data?.detail ?? 'Falha ao fazer login. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
                <Ionicons name="car-sport" size={32} color="#fff" />
            </View>
            <Text style={styles.title}>Bem-vindo de volta</Text>
            <Text style={styles.subtitle}>Entre na sua conta para continuar</Text>
          </View>

          <View style={styles.form}>
            {apiError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errorText}>{apiError}</Text>
              </View>
            ) : null}

            <Input
              label="Email"
              placeholder="seu@email.com"
              value={email}
              onChangeText={(t) => { setEmail(t); setApiError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail"
              error={errors.email}
            />
            <Input
              label="Senha"
              placeholder="••••••••"
              value={password}
              onChangeText={(t) => { setPassword(t); setApiError(''); }}
              secureTextEntry
              icon="lock-closed"
              error={errors.password}
            />

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            <GradientButton title="Entrar" onPress={handleLogin} loading={loading} />

            <View style={styles.socialSection}>
              <Text style={styles.socialTitle}>Ou continue com</Text>
              <TouchableOpacity style={styles.socialButton} onPress={() => setApiError('Login com Google precisa de credenciais OAuth. Posso configurar isso na sequência.')}>
                <Ionicons name="logo-google" size={18} color={COLORS.primary} />
                <Text style={styles.socialButtonText}>Entrar com Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} onPress={() => setApiError('Login com Apple precisa de credenciais da Apple e build iOS. Posso preparar essa integração na sequência.')}>
                <Ionicons name="logo-apple" size={18} color={COLORS.text} />
                <Text style={styles.socialButtonText}>Entrar com Apple</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Criar conta</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: SPACING.xxxl,
    marginBottom: SPACING.xxl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  form: {
    marginBottom: SPACING.xl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: `${COLORS.error}18`,
    borderWidth: 1,
    borderColor: `${COLORS.error}40`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
    flex: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.xl,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
  },
  socialSection: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  socialTitle: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
  },
  socialButtonText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
  },
  footerLink: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
});
