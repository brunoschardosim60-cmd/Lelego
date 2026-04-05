import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { authAPI } from '../../src/services/api';
import { GradientButton } from '../../src/components/GradientButton';
import { Input } from '../../src/components/Input';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

type Gender = 'male' | 'female' | 'other';

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isValidCPF = (value: string) => {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
};

const GenderOption = ({ label, icon, selected, onPress }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; selected: boolean; onPress: () => void;
}) => (
  <TouchableOpacity style={[styles.genderOpt, selected && styles.genderOptSel]} onPress={onPress}>
    <Ionicons name={icon} size={20} color={selected ? COLORS.primary : COLORS.textSecondary} />
    <Text style={[styles.genderOptText, selected && styles.genderOptTextSel]}>{label}</Text>
  </TouchableOpacity>
);

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  const fmtPhone = (t: string) =>
    t.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);

  const fmtCPF = (t: string) =>
    t.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2').substring(0, 14);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Nome é obrigatório';
    if (!email) next.email = 'Email é obrigatório';
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = 'Email inválido';
    if (!phone) next.phone = 'Telefone é obrigatório';
    else if (phone.replace(/\D/g, '').length < 11) next.phone = 'Telefone inválido';
    if (!cpf) next.cpf = 'CPF é obrigatório';
    else if (!isValidCPF(cpf)) next.cpf = 'CPF inválido';
    if (!password) next.password = 'Senha é obrigatória';
    else if (password.length < 6) next.password = 'Mínimo 6 caracteres';
    if (password !== confirmPassword) next.confirmPassword = 'Senhas não conferem';
    setErrors(next);
    return !Object.keys(next).length;
  };

  const handleRegister = async () => {
    setApiError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.register({
        name: name.trim(), email: normalizeEmail(email), password,
        phone: phone.replace(/\D/g, ''),
        cpf: cpf.replace(/\D/g, ''),
        gender,
      });
      await login(res.data.user, res.data.access_token);
      router.replace('/(tabs)');
    } catch (e: any) {
      setApiError(e.response?.data?.detail ?? 'Falha ao criar conta. Tente novamente.');
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
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Preencha seus dados para começar</Text>
          </View>

          <View style={styles.form}>
            {apiError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errorText}>{apiError}</Text>
              </View>
            ) : null}

              <Input label="Nome completo" placeholder="Seu nome" value={name}
                onChangeText={(t) => { setName(t); setApiError(''); }}
                icon="person" autoCapitalize="words" error={errors.name}
              />
              <Input label="Email" placeholder="seu@email.com" value={email}
                onChangeText={(t) => { setEmail(t); setApiError(''); }}
                keyboardType="email-address" autoCapitalize="none" icon="mail" error={errors.email}
              />
              <Input label="Telefone" placeholder="(11) 99999-9999" value={phone}
                onChangeText={(t) => setPhone(fmtPhone(t))}
                keyboardType="phone-pad" icon="call" error={errors.phone}
              />
              <Input label="CPF" placeholder="000.000.000-00" value={cpf}
                onChangeText={(t) => setCpf(fmtCPF(t))}
                keyboardType="numeric" icon="document-text" error={errors.cpf}
              />

              <View style={styles.genderWrap}>
                <Text style={styles.genderLabel}>Gênero</Text>
                <View style={styles.genderRow}>
                  <GenderOption label="Masculino" icon="male" selected={gender === 'male'} onPress={() => setGender('male')} />
                  <GenderOption label="Feminino" icon="female" selected={gender === 'female'} onPress={() => setGender('female')} />
                  <GenderOption label="Outro" icon="person" selected={gender === 'other'} onPress={() => setGender('other')} />
                </View>
              </View>

              <Input label="Senha" placeholder="••••••••" value={password}
                onChangeText={(t) => { setPassword(t); setApiError(''); }}
                secureTextEntry icon="lock-closed" error={errors.password}
              />
              <Input label="Confirmar senha" placeholder="••••••••" value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setApiError(''); }}
                secureTextEntry icon="lock-closed" error={errors.confirmPassword}
              />

            <GradientButton title="Criar conta" onPress={handleRegister} loading={loading} style={styles.registerButton} />

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
            <Text style={styles.footerText}>Já tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Entrar</Text>
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
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  genderWrap: { marginBottom: SPACING.lg },
  genderLabel: { color: COLORS.text, fontSize: FONTS.sizes.md, fontWeight: '500', marginBottom: SPACING.sm },
  genderRow: { flexDirection: 'row', gap: SPACING.sm },
  genderOpt: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, paddingVertical: SPACING.md,
    backgroundColor: COLORS.backgroundSecondary, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  genderOptSel: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}15` },
  genderOptText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: '500' },
  genderOptTextSel: { color: COLORS.primary },
  registerButton: {
    marginTop: SPACING.md,
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
