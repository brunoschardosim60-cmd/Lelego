import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { driverAPI, rideAPI } from '../../src/services/api';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { Ride } from '../../src/types';

export default function DriverScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [updatingOnline, setUpdatingOnline] = useState(false);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);

  const loadPanelData = async () => {
    try {
      const [profileResponse, rideResponse] = await Promise.allSettled([
        driverAPI.getProfile(),
        rideAPI.getActiveRide(),
      ]);

      if (profileResponse.status === 'fulfilled') {
        setIsOnline(!!profileResponse.value.data?.driver_online);
      }

      if (rideResponse.status === 'fulfilled') {
        setCurrentRide(rideResponse.value.data || null);
      } else {
        setCurrentRide(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPanelData();
  }, []);

  const handleToggleOnline = async () => {
    if (updatingOnline) {
      return;
    }

    setUpdatingOnline(true);
    try {
      const response = await driverAPI.toggleOnline();
      if (typeof response.data?.driver_online === 'boolean') {
        setIsOnline(response.data.driver_online);
      } else {
        await loadPanelData();
      }
    } catch (error: any) {
      Alert.alert('Atenção', error?.response?.data?.detail || 'Não foi possível atualizar status online.');
      await loadPanelData();
    } finally {
      setUpdatingOnline(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Painel do Motorista</Text>
        <Text style={styles.subtitle}>Controles e atalhos do motorista</Text>

        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusLabel}>Disponibilidade</Text>
            <Text style={styles.statusValue}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            disabled={updatingOnline}
            thumbColor={COLORS.white}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            style={styles.onlineSwitch}
          />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/driver-mapa')}>
            <Ionicons name="map" size={20} color={COLORS.primary} />
            <Text style={styles.actionText}>Mapa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/driver-ganhos')}>
            <Ionicons name="wallet" size={20} color={COLORS.primary} />
            <Text style={styles.actionText}>Ganhos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.currentRideCard}>
          <Text style={styles.currentRideTitle}>Status atual</Text>
          {currentRide ? (
            <>
              <Text style={styles.currentRideText}>Você está com uma corrida ativa.</Text>
              <Text style={styles.currentRideMeta}>Destino: {currentRide.destination_address}</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(tabs)/driver-corridas')}>
                <Text style={styles.primaryButtonText}>Abrir corrida atual</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.currentRideText}>Nenhuma corrida ativa no momento.</Text>
              <Text style={styles.currentRideMeta}>Use a aba Mapa para acompanhar rotas e preferências.</Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  statusCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  statusValue: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.text,
    fontWeight: '700',
    marginTop: SPACING.xs,
  },
  onlineSwitch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  actionCard: {
    flex: 1,
    minHeight: 84,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  actionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: '700',
  },
  currentRideCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  currentRideTitle: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  currentRideText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  currentRideMeta: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    fontWeight: '700',
  },
});
