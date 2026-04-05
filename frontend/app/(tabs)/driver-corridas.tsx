import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { driverAPI, rideAPI } from '../../src/services/api';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { Ride } from '../../src/types';

export default function DriverCorridasScreen() {
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadCurrentRide = async () => {
    try {
      const response = await rideAPI.getActiveRide();
      setCurrentRide(response.data || null);
    } catch {
      setCurrentRide(null);
    }
  };

  const loadAvailableRides = async () => {
    try {
      const response = await driverAPI.getAvailableRides();
      setAvailableRides(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      setAvailableRides([]);
      const detail = error?.response?.data?.detail;
      if (detail) {
        Alert.alert('Corridas', String(detail));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([loadCurrentRide(), loadAvailableRides()]);
    };
    loadAll();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([loadCurrentRide(), loadAvailableRides()]);
  };

  const handleAcceptRide = async (rideId: string) => {
    try {
      setAcceptingRideId(rideId);
      await driverAPI.acceptRide(rideId);
      Alert.alert('Sucesso', 'Corrida aceita com sucesso.');
      await Promise.all([loadCurrentRide(), loadAvailableRides()]);
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.detail || 'Não foi possível aceitar a corrida.');
    } finally {
      setAcceptingRideId(null);
    }
  };

  const handleCurrentRideAction = async () => {
    if (!currentRide) return;

    try {
      setActionLoading(true);

      if (currentRide.status === 'driver_assigned') {
        await driverAPI.arriveRide(currentRide.id);
        Alert.alert('Sucesso', 'Status atualizado para: motorista chegou.');
      } else if (currentRide.status === 'driver_arrived') {
        await driverAPI.startRide(currentRide.id);
        Alert.alert('Sucesso', 'Corrida iniciada.');
      } else if (currentRide.status === 'in_progress') {
        await driverAPI.completeRide(currentRide.id);
        Alert.alert('Sucesso', 'Corrida finalizada.');
      }

      await Promise.all([loadCurrentRide(), loadAvailableRides()]);
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.detail || 'Não foi possível atualizar a corrida.');
    } finally {
      setActionLoading(false);
    }
  };

  const getActionButtonLabel = () => {
    if (!currentRide) return '';
    if (currentRide.status === 'driver_assigned') return 'Cheguei';
    if (currentRide.status === 'driver_arrived') return 'Iniciar corrida';
    if (currentRide.status === 'in_progress') return 'Finalizar corrida';
    return '';
  };

  const getCurrentRideStatusMeta = (status: string) => {
    switch (status) {
      case 'driver_assigned':
        return { label: 'A caminho do passageiro', color: COLORS.warning };
      case 'driver_arrived':
        return { label: 'Motorista chegou', color: COLORS.primary };
      case 'in_progress':
        return { label: 'Corrida em andamento', color: COLORS.secondary };
      case 'completed':
        return { label: 'Corrida finalizada', color: COLORS.success };
      case 'cancelled':
        return { label: 'Corrida cancelada', color: COLORS.error };
      default:
        return { label: status, color: COLORS.textSecondary };
    }
  };

  const hasActionButton =
    currentRide?.status === 'driver_assigned' ||
    currentRide?.status === 'driver_arrived' ||
    currentRide?.status === 'in_progress';

  const renderRideItem = ({ item }: { item: Ride }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="car-sport" size={20} color={COLORS.primary} />
        <Text style={styles.cardTitle}>Corrida disponível</Text>
      </View>

      <Text style={styles.routeText}>Origem: {item.origin_address}</Text>
      <Text style={styles.routeText}>Destino: {item.destination_address}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Categoria: {item.category}</Text>
        <Text style={styles.metaText}>R$ {(item.estimated_price || 0).toFixed(2)}</Text>
      </View>

      <TouchableOpacity
        style={styles.acceptButton}
        onPress={() => handleAcceptRide(item.id)}
        disabled={acceptingRideId === item.id}
      >
        {acceptingRideId === item.id ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Text style={styles.acceptButtonText}>Aceitar corrida</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={availableRides}
        keyExtractor={(item) => item.id}
        renderItem={renderRideItem}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Corridas</Text>
            <Text style={styles.subtitle}>Corridas disponíveis para aceitar</Text>

            {currentRide ? (
              <View style={styles.currentRideCard}>
                <View style={styles.cardHeader}>
                  <Ionicons name="navigate" size={20} color={COLORS.primary} />
                  <Text style={styles.cardTitle}>Corrida atual</Text>
                </View>

                <Text style={styles.routeText}>Origem: {currentRide.origin_address}</Text>
                <Text style={styles.routeText}>Destino: {currentRide.destination_address}</Text>
                <View
                  style={[
                    styles.currentRideStatusBadge,
                    {
                      backgroundColor: `${getCurrentRideStatusMeta(currentRide.status).color}20`,
                      borderColor: `${getCurrentRideStatusMeta(currentRide.status).color}55`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.currentRideStatusBadgeText,
                      { color: getCurrentRideStatusMeta(currentRide.status).color },
                    ]}
                  >
                    {getCurrentRideStatusMeta(currentRide.status).label}
                  </Text>
                </View>

                {hasActionButton ? (
                  <TouchableOpacity
                    style={styles.currentRideActionButton}
                    onPress={handleCurrentRideAction}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.acceptButtonText}>{getActionButtonLabel()}</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="time" size={24} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>Nenhuma corrida disponível</Text>
            <Text style={styles.emptyText}>Ative o modo online e atualize para buscar novas corridas.</Text>
          </View>
        }
      />
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
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cardTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  routeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
  },
  metaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  acceptButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  currentRideCard: {
    backgroundColor: `${COLORS.primary}0F`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  currentRideActionButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  currentRideStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginTop: SPACING.xs,
  },
  currentRideStatusBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.text,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});
