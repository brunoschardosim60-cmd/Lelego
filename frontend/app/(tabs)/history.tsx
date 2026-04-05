import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '../../src/store/authStore';
import { rideAPI } from '../../src/services/api';
import { GradientButton } from '../../src/components/GradientButton';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { Ride } from '../../src/types';

export default function HistoryScreen() {
  const router = useRouter();
  const { isAuthenticated, isGuestMode, logout } = useAuthStore();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRides = useCallback(async () => {
    if (!isAuthenticated || isGuestMode) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      const response = await rideAPI.getHistory();
      setRides(response.data);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        await logout();
        setRides([]);
        return;
      }
      console.log('Error loading history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, isGuestMode, logout]);

  useEffect(() => {
    loadRides();
  }, [loadRides]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRides();
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'Concluída', color: COLORS.success };
      case 'cancelled':
        return { label: 'Cancelada', color: COLORS.error };
      default:
        return { label: status, color: COLORS.textSecondary };
    }
  };

  const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
    switch (category) {
      case 'moto':
        return 'bicycle';
      case 'comfort':
        return 'car-sport';
      case 'women':
        return 'woman';
      default:
        return 'car';
    }
  };

  const renderRideItem = ({ item }: { item: Ride }) => {
    const statusInfo = getStatusInfo(item.status);
    
    return (
      <TouchableOpacity style={styles.rideCard}>
        <View style={styles.rideHeader}>
          <View style={styles.categoryIcon}>
            <Ionicons
              name={getCategoryIcon(item.category)}
              size={24}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.rideInfo}>
            <Text style={styles.rideDate}>
              {format(new Date(item.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}20` }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
          <Text style={styles.ridePrice}>
            R$ {(item.final_price || item.estimated_price).toFixed(2)}
          </Text>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.origin_address}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.secondary }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.destination_address}
            </Text>
          </View>
        </View>

        <View style={styles.rideFooter}>
          <View style={styles.rideMetric}>
            <Ionicons name="navigate" size={14} color={COLORS.textSecondary} />
            <Text style={styles.rideMetricText}>{item.distance_km} km</Text>
          </View>
          <View style={styles.rideMetric}>
            <Ionicons name="time" size={14} color={COLORS.textSecondary} />
            <Text style={styles.rideMetricText}>{Math.round(item.duration_min)} min</Text>
          </View>
          <View style={styles.rideMetric}>
            <Ionicons name="card" size={14} color={COLORS.textSecondary} />
            <Text style={styles.rideMetricText}>
              {item.payment_method === 'card' ? 'Cartão' : 
               item.payment_method === 'pix' ? 'PIX' : 'Dinheiro'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Guest mode message
  if (isGuestMode || !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={[COLORS.gradientStart, COLORS.gradientEnd]}
            style={styles.emptyIcon}
          >
            <Ionicons name="person-outline" size={40} color={COLORS.white} />
          </LinearGradient>
          <Text style={styles.emptyTitle}>Faça login</Text>
          <Text style={styles.emptyText}>
            Para ver seu histórico de corridas, faça login ou crie uma conta.
          </Text>
          <GradientButton
            title="Fazer login"
            onPress={() => router.push('/(auth)/login')}
            style={{ marginTop: SPACING.xl, width: '80%' }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {rides.length === 0 ? (
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={[COLORS.gradientStart, COLORS.gradientEnd]}
            style={styles.emptyIcon}
          >
            <Ionicons name="car" size={40} color={COLORS.white} />
          </LinearGradient>
          <Text style={styles.emptyTitle}>Nenhuma corrida ainda</Text>
          <Text style={styles.emptyText}>
            Suas corridas aparecerão aqui após você solicitar sua primeira viagem.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          renderItem={renderRideItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
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
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  rideCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: `${COLORS.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  rideDate: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.xs,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  ridePrice: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  routeContainer: {
    marginBottom: SPACING.lg,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.md,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: COLORS.border,
    marginLeft: 4,
    marginVertical: SPACING.xs,
  },
  routeText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  rideFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  rideMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.xl,
  },
  rideMetricText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
