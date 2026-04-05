import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Input } from '../../src/components/Input';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore } from '../../src/store/themeStore';
import { BORDER_RADIUS, COLORS, FONTS, LIGHT_COLORS, SPACING } from '../../src/constants/theme';

export default function PersonalDataScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const { isDark } = useThemeStore();
  const palette = isDark ? COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(palette), [palette]);

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const formatPhone = (value: string) =>
    value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Nome é obrigatório.');
      return;
    }

    if (phone.replace(/\D/g, '').length < 11) {
      Alert.alert('Atenção', 'Telefone inválido.');
      return;
    }

    setSaving(true);
    await updateUser({ name: name.trim(), phone: phone.replace(/\D/g, '') });
    setSaving(false);
    Alert.alert('Sucesso', 'Dados pessoais atualizados.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Dados pessoais</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <View style={styles.formCard}>
        <Input label="Nome" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input label="Email" value={user?.email || ''} onChangeText={() => {}} editable={false} />
        <Input label="CPF" value={(user as any)?.cpf || 'Não informado'} onChangeText={() => {}} editable={false} />
        <Input label="Telefone" value={phone} onChangeText={(text) => setPhone(formatPhone(text))} keyboardType="phone-pad" />

        <GradientButton title="Salvar alterações" onPress={handleSave} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (palette: typeof COLORS) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
      padding: SPACING.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.xl,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
    },
    backButtonPlaceholder: {
      width: 40,
      height: 40,
    },
    title: {
      color: palette.text,
      fontSize: FONTS.sizes.xl,
      fontWeight: '700',
    },
    formCard: {
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
    },
  });
