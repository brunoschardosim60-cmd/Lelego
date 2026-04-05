import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore } from '../../src/store/themeStore';
import { GradientButton } from '../../src/components/GradientButton';
import { Input } from '../../src/components/Input';
import { PhotoUpload } from '../../src/components/PhotoUpload';
import { COLORS, LIGHT_COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import api from '../../src/services/api';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, isGuestMode } = useAuthStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const palette = isDark ? COLORS : LIGHT_COLORS;
  const styles = createStyles(palette);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverForm, setDriverForm] = useState({
    vehicle_type: 'car',
    vehicle_color: '',
    vehicle_plate: '',
    vehicle_model: '',
    state: 'SP',
    cnh_photo: '',
    face_photo: '',
    vehicle_photo: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Tem certeza que deseja sair da sua conta?');
      if (!confirmed) return;

      await logout();
      window.location.href = '/';
      return;
    }

    Alert.alert('Sair', 'Tem certeza que deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const handleDriverApplication = async () => {
    if (!driverForm.vehicle_model || !driverForm.vehicle_plate || !driverForm.vehicle_color) {
      Alert.alert('Erro', 'Preencha todos os campos do veiculo');
      return;
    }

    if (!driverForm.cnh_photo) {
      Alert.alert('Erro', 'Adicione a foto da sua CNH');
      return;
    }

    if (!driverForm.vehicle_photo) {
      Alert.alert('Erro', 'Adicione a foto do seu veiculo');
      return;
    }

    if (!driverForm.face_photo) {
      Alert.alert('Erro', 'Adicione uma selfie');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/driver/apply', driverForm);
      Alert.alert(
        'Sucesso!',
        'Sua solicitacao foi enviada com as fotos. Aguarde a aprovacao do administrador.',
        [{ text: 'OK', onPress: () => setShowDriverModal(false) }]
      );
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao enviar solicitacao');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDriverLogin = async () => {
    if (Platform.OS === 'web') {
      setShowDriverModal(false);
      await logout();
      window.location.href = '/login?mode=driver';
      return;
    }

    Alert.alert('Entrar como motorista', 'Se voce ja tem cadastro, faca login com sua conta de motorista.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Ir para login',
        onPress: async () => {
          setShowDriverModal(false);
          await logout();
          router.replace('/(auth)/login?mode=driver');
        },
      },
    ]);
  };

  if (isGuestMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.guestContainer}>
          <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.guestIcon}>
            <Ionicons name="person-outline" size={40} color={palette.white} />
          </LinearGradient>
          <Text style={styles.guestTitle}>Faca login</Text>
          <Text style={styles.guestText}>
            Para acessar seu perfil e todas as funcionalidades, faca login ou crie uma conta.
          </Text>
          <GradientButton
            title="Fazer login"
            onPress={() => router.push('/(auth)/login')}
            style={styles.guestButton}
          />
          <GradientButton
            title="Criar conta"
            onPress={() => router.push('/(auth)/register')}
            variant="outline"
            style={styles.guestButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  const menuItems = [
    { icon: 'person-outline' as const, label: 'Dados pessoais', onPress: () => router.push('/(tabs)/dados-pessoais') },
    { icon: 'card-outline' as const, label: 'Formas de pagamento', onPress: () => {} },
    { icon: 'location-outline' as const, label: 'Enderecos salvos', onPress: () => {} },
    { icon: 'notifications-outline' as const, label: 'Notificacoes', onPress: () => {} },
    { icon: 'shield-checkmark-outline' as const, label: 'Seguranca', onPress: () => {} },
    { icon: 'help-circle-outline' as const, label: 'Ajuda', onPress: () => {} },
    { icon: 'document-text-outline' as const, label: 'Termos de uso', onPress: () => {} },
  ];

  const totalRides = Number((user as any)?.total_rides ?? 0);
  const averageRating = Number((user as any)?.average_rating ?? 5.0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <LinearGradient
            colors={[COLORS.gradientStart, COLORS.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
          </LinearGradient>
          <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalRides}</Text>
              <Text style={styles.statLabel}>Corridas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{averageRating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Avaliacao</Text>
            </View>
          </View>
        </View>

        {user?.role !== 'driver' ? (
          <View style={styles.driverSection}>
            <TouchableOpacity style={styles.becomeDriverButton} onPress={() => setShowDriverModal(true)}>
              <LinearGradient
                colors={[`${COLORS.primary}20`, `${COLORS.secondary}20`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.becomeDriverGradient}
              >
                <View style={styles.becomeDriverIcon}>
                  <Ionicons name="car-sport" size={24} color={COLORS.primary} />
                </View>
                <View style={styles.becomeDriverContent}>
                  <Text style={styles.becomeDriverTitle}>Quero ser motorista</Text>
                  <Text style={styles.becomeDriverText}>Ganhe dinheiro extra dirigindo com a LetsGo</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={COLORS.textSecondary} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.menuContainer}>
          <View style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.menuLabel}>{isDark ? 'Modo escuro' : 'Modo claro'}</Text>
            <Switch
              value={!isDark}
              onValueChange={toggleTheme}
              thumbColor={COLORS.white}
              trackColor={{ false: palette.border, true: palette.primary }}
            />
          </View>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
              <View style={styles.menuIconContainer}>
                <Ionicons name={item.icon} size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <Text style={styles.version}>LetsGo v2.0.0</Text>
      </ScrollView>

      <Modal
        visible={showDriverModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDriverModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDriverModal(false)}>
              <Ionicons name="close" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Cadastro de Motorista</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.formSection}>Dados do Veiculo</Text>

            <Text style={styles.inputLabel}>Tipo de veiculo</Text>
            <View style={styles.vehicleTypes}>
              {[
                { id: 'moto', label: 'Moto', icon: 'bicycle' },
                { id: 'car', label: 'Carro', icon: 'car' },
                { id: 'comfort', label: 'Comfort', icon: 'car-sport' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.vehicleType, driverForm.vehicle_type === type.id && styles.vehicleTypeSelected]}
                  onPress={() => setDriverForm({ ...driverForm, vehicle_type: type.id })}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={24}
                    color={driverForm.vehicle_type === type.id ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.vehicleTypeText,
                      driverForm.vehicle_type === type.id && styles.vehicleTypeTextSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Modelo do veiculo"
              placeholder="Ex: Toyota Corolla 2020"
              value={driverForm.vehicle_model}
              onChangeText={(text) => setDriverForm({ ...driverForm, vehicle_model: text })}
            />

            <Input
              label="Placa do veiculo"
              placeholder="Ex: ABC-1234"
              value={driverForm.vehicle_plate}
              onChangeText={(text) => setDriverForm({ ...driverForm, vehicle_plate: text.toUpperCase() })}
              autoCapitalize="characters"
            />

            <Input
              label="Cor do veiculo"
              placeholder="Ex: Prata"
              value={driverForm.vehicle_color}
              onChangeText={(text) => setDriverForm({ ...driverForm, vehicle_color: text })}
            />

            <Text style={styles.inputLabel}>Estado</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateScroll}>
              {BRAZILIAN_STATES.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={[styles.stateChip, driverForm.state === state && styles.stateChipSelected]}
                  onPress={() => setDriverForm({ ...driverForm, state })}
                >
                  <Text
                    style={[
                      styles.stateChipText,
                      driverForm.state === state && styles.stateChipTextSelected,
                    ]}
                  >
                    {state}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.formSection}>Documentos</Text>

            <PhotoUpload
              label="CNH (Frente e Verso)"
              description="Tire uma foto clara da sua CNH"
              icon="document-text"
              value={driverForm.cnh_photo}
              onChange={(base64) => setDriverForm({ ...driverForm, cnh_photo: base64 })}
            />

            <PhotoUpload
              label="Foto do Veiculo"
              description="Foto do seu veiculo por fora"
              icon="car"
              value={driverForm.vehicle_photo}
              onChange={(base64) => setDriverForm({ ...driverForm, vehicle_photo: base64 })}
            />

            <PhotoUpload
              label="Selfie"
              description="Tire uma foto do seu rosto"
              icon="person"
              value={driverForm.face_photo}
              onChange={(base64) => setDriverForm({ ...driverForm, face_photo: base64 })}
              cameraType="front"
              aspectRatio={[1, 1]}
            />

            <GradientButton
              title="Enviar solicitacao"
              onPress={handleDriverApplication}
              loading={submitting}
              style={styles.submitButton}
            />

            <TouchableOpacity onPress={handleDriverLogin} style={styles.driverLoginOption}>
              <Text style={styles.driverLoginOptionText}>Ja tem cadastro de motorista? Fazer login</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (palette: typeof COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: palette.white,
  },
  userName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: palette.text,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    fontSize: FONTS.sizes.md,
    color: palette.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xl,
    backgroundColor: palette.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: palette.text,
  },
  statLabel: {
    fontSize: FONTS.sizes.sm,
    color: palette.textSecondary,
    marginTop: SPACING.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: palette.border,
  },
  driverSection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: palette.text,
    marginBottom: SPACING.md,
  },
  becomeDriverButton: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  becomeDriverGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  becomeDriverIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  becomeDriverContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  becomeDriverTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: palette.text,
  },
  becomeDriverText: {
    fontSize: FONTS.sizes.sm,
    color: palette.textSecondary,
    marginTop: 2,
  },
  menuContainer: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${palette.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: FONTS.sizes.lg,
    color: palette.text,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.error,
    marginBottom: SPACING.xl,
  },
  logoutText: {
    fontSize: FONTS.sizes.lg,
    color: palette.error,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  version: {
    textAlign: 'center',
    fontSize: FONTS.sizes.sm,
    color: palette.textTertiary,
    marginBottom: SPACING.xxl,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  guestIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  guestTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: palette.text,
    marginBottom: SPACING.sm,
  },
  guestText: {
    fontSize: FONTS.sizes.md,
    color: palette.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  guestButton: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: palette.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    color: palette.text,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.xl,
  },
  formSection: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: palette.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: palette.text,
    marginBottom: SPACING.sm,
  },
  vehicleTypes: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  vehicleType: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: palette.card,
    borderRadius: BORDER_RADIUS.lg,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  vehicleTypeSelected: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}15`,
  },
  vehicleTypeText: {
    fontSize: FONTS.sizes.sm,
    color: palette.textSecondary,
    marginTop: SPACING.xs,
  },
  vehicleTypeTextSelected: {
    color: palette.primary,
    fontWeight: '600',
  },
  stateScroll: {
    marginBottom: SPACING.lg,
  },
  stateChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: palette.card,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  stateChipSelected: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}15`,
  },
  stateChipText: {
    fontSize: FONTS.sizes.md,
    color: palette.textSecondary,
  },
  stateChipTextSelected: {
    color: palette.primary,
    fontWeight: '600',
  },
  submitButton: {
    marginBottom: SPACING.md,
  },
  driverLoginOption: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  driverLoginOptionText: {
    fontSize: FONTS.sizes.md,
    color: palette.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
