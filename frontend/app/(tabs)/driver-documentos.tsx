import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { driverAPI } from '../../src/services/api';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

type DriverProfile = {
  driver_status?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  vehicle_type?: string;
  state?: string;
};

export default function DriverDocumentosScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DriverProfile>({});

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await driverAPI.getProfile();
        setProfile(response.data ?? {});
      } catch (error) {
        console.log('Error loading driver profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const statusText = profile.driver_status === 'approved'
    ? 'aprovado'
    : profile.driver_status === 'pending'
      ? 'em análise'
      : 'pendente';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Documentos</Text>
        <Text style={styles.subtitle}>Gerencie seus documentos de motorista</Text>

        <TouchableOpacity style={styles.docCard}>
          <View style={styles.docLeft}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
            <Text style={styles.docLabel}>Status da aprovação</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.docCard}>
          <View style={styles.docLeft}>
            <Ionicons name="car-sport" size={20} color={COLORS.primary} />
            <Text style={styles.docLabel}>Veículo</Text>
          </View>
          <Text style={styles.metaValue}>
            {profile.vehicle_model ? `${profile.vehicle_model} (${profile.vehicle_plate || 'sem placa'})` : 'Não informado'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.docCard}>
          <View style={styles.docLeft}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.docLabel}>Estado de atuação</Text>
          </View>
          <Text style={styles.metaValue}>{profile.state || 'Não informado'}</Text>
        </TouchableOpacity>
      </View>
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
    gap: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  docCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    marginRight: SPACING.sm,
  },
  docLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: `${COLORS.warning}20`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    maxWidth: '45%',
    textAlign: 'right',
  },
});
