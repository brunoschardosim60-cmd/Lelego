import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../src/services/api';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { authStorage } from '../../src/utils/authStorage';

type Tab = 'dashboard' | 'drivers' | 'users' | 'rides';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const loadData = useCallback(async (token: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, usersRes, ridesRes] = await Promise.all([
        api.get('/admin/dashboard', { headers }),
        api.get('/admin/users?limit=100', { headers }),
        api.get('/admin/rides?limit=50', { headers }),
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data.users || []);
      setPendingDrivers(usersRes.data.users?.filter((u: any) => u.driver_status === 'pending') || []);
      setRides(ridesRes.data.rides || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadAdminToken = useCallback(async () => {
    try {
      const token = await authStorage.getItem('admin_token');
      
      if (!token) {
        router.replace('/admin');
        return;
      }
      
      setAdminToken(token);
      await loadData(token);
    } catch (error) {
      console.error('Error loading admin token:', error);
      router.replace('/admin');
    }
  }, [loadData, router]);

  useEffect(() => {
    loadAdminToken();
  }, [loadAdminToken]);

  const onRefresh = () => {
    if (adminToken) {
      setRefreshing(true);
      loadData(adminToken);
    }
  };

  const handleApproveDriver = async (userId: string) => {
    if (!adminToken) return;
    
    try {
      await api.post(`/admin/drivers/${userId}/approve`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      Alert.alert('Sucesso', 'Motorista aprovado!');
      loadData(adminToken);
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao aprovar');
    }
  };

  const handleRejectDriver = async (userId: string) => {
    if (!adminToken) return;
    
    try {
      await api.post(`/admin/drivers/${userId}/reject`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      Alert.alert('Sucesso', 'Motorista rejeitado');
      loadData(adminToken);
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao rejeitar');
    }
  };

  const handleBlockUser = async (userId: string, isBlocked: boolean) => {
    if (!adminToken) return;
    
    const action = isBlocked ? 'unblock' : 'block';
    try {
      await api.post(`/admin/users/${userId}/${action}`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      Alert.alert('Sucesso', isBlocked ? 'Usuário desbloqueado' : 'Usuário bloqueado');
      loadData(adminToken);
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro na operação');
    }
  };

  const handleLogout = async () => {
    await authStorage.removeItem('admin_token');
    await authStorage.removeItem('admin_user');
    router.replace('/admin');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando painel...</Text>
      </View>
    );
  }

  const tabs: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'drivers', label: 'Motoristas', icon: 'car' },
    { id: 'users', label: 'Usuários', icon: 'people' },
    { id: 'rides', label: 'Corridas', icon: 'navigate' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[COLORS.gradientStart, COLORS.gradientEnd]}
            style={styles.headerLogo}
          >
            <Ionicons name="shield-checkmark" size={20} color={COLORS.white} />
          </LinearGradient>
          <Text style={styles.headerTitle}>LetsGo Admin</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.id ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {activeTab === 'dashboard' && stats && (
          <View style={styles.dashboardGrid}>
            <StatCard title="Total de Usuários" value={stats.total_users} icon="people" color={COLORS.info} />
            <StatCard title="Motoristas Ativos" value={stats.total_drivers} icon="car" color={COLORS.success} />
            <StatCard title="Motoristas Pendentes" value={stats.pending_drivers} icon="time" color={COLORS.warning} />
            <StatCard title="Total de Corridas" value={stats.total_rides} icon="navigate" color={COLORS.primary} />
            <StatCard title="Corridas Completas" value={stats.completed_rides} icon="checkmark-circle" color={COLORS.success} />
            <StatCard title="Taxa de Cancelamento" value={`${stats.cancellation_rate}%`} icon="close-circle" color={COLORS.error} />
            <StatCard title="Receita Total" value={`R$ ${stats.total_revenue?.toFixed(2) || '0.00'}`} icon="cash" color={COLORS.success} large />
            <StatCard title="Ganhos do App (15%)" value={`R$ ${stats.app_earnings?.toFixed(2) || '0.00'}`} icon="wallet" color={COLORS.primary} large />
          </View>
        )}

        {activeTab === 'drivers' && (
          <View>
            <Text style={styles.sectionTitle}>Motoristas Pendentes ({pendingDrivers.length})</Text>
            {pendingDrivers.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum motorista pendente</Text>
            ) : (
              pendingDrivers.map((driver) => (
                <View key={driver.id} style={styles.driverCard}>
                  <View style={styles.driverInfo}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>
                        {driver.name?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.driverDetails}>
                      <Text style={styles.driverName}>{driver.name}</Text>
                      <Text style={styles.driverEmail}>{driver.email}</Text>
                      <Text style={styles.driverVehicle}>
                        {driver.vehicle_model} • {driver.vehicle_plate} • {driver.vehicle_color}
                      </Text>
                      <Text style={styles.driverState}>Estado: {driver.state}</Text>
                    </View>
                  </View>
                  <View style={styles.driverActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApproveDriver(driver.id)}
                    >
                      <Ionicons name="checkmark" size={20} color={COLORS.white} />
                      <Text style={styles.actionButtonText}>Aprovar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleRejectDriver(driver.id)}
                    >
                      <Ionicons name="close" size={20} color={COLORS.white} />
                      <Text style={styles.actionButtonText}>Rejeitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>
              Todos os Motoristas ({users.filter(u => u.driver_status === 'approved').length})
            </Text>
            {users.filter(u => u.driver_status === 'approved').map((driver) => (
              <View key={driver.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{driver.name}</Text>
                  <Text style={styles.userEmail}>{driver.email}</Text>
                  <Text style={styles.userDetail}>
                    Score: {driver.score} • Corridas: {driver.total_rides || 0}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.blockButton, !driver.is_active && styles.unblockButton]}
                  onPress={() => handleBlockUser(driver.id, !driver.is_active)}
                >
                  <Ionicons
                    name={driver.is_active ? 'ban' : 'checkmark-circle'}
                    size={20}
                    color={driver.is_active ? COLORS.error : COLORS.success}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'users' && (
          <View>
            <Text style={styles.sectionTitle}>Todos os Usuários ({users.length})</Text>
            {users.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={styles.userHeader}>
                    <Text style={styles.userName}>{user.name}</Text>
                    {user.role === 'admin' && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>Admin</Text>
                      </View>
                    )}
                    {user.driver_status === 'approved' && (
                      <View style={styles.driverBadge}>
                        <Text style={styles.driverBadgeText}>Motorista</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <Text style={styles.userDetail}>CPF: {user.cpf} • Score: {user.score}</Text>
                </View>
                {user.role !== 'admin' && (
                  <TouchableOpacity
                    style={[styles.blockButton, !user.is_active && styles.unblockButton]}
                    onPress={() => handleBlockUser(user.id, !user.is_active)}
                  >
                    <Ionicons
                      name={user.is_active ? 'ban' : 'checkmark-circle'}
                      size={20}
                      color={user.is_active ? COLORS.error : COLORS.success}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'rides' && (
          <View>
            <Text style={styles.sectionTitle}>Últimas Corridas ({rides.length})</Text>
            {rides.map((ride) => (
              <View key={ride.id} style={styles.rideCard}>
                <View style={styles.rideHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(ride.status) }]}>
                      {getStatusLabel(ride.status)}
                    </Text>
                  </View>
                  <Text style={styles.ridePrice}>R$ {(ride.final_price || ride.estimated_price)?.toFixed(2)}</Text>
                </View>
                <Text style={styles.rideAddress} numberOfLines={1}>De: {ride.origin_address}</Text>
                <Text style={styles.rideAddress} numberOfLines={1}>Para: {ride.destination_address}</Text>
                <Text style={styles.rideDetail}>
                  {ride.distance_km} km • {ride.duration_min} min • {ride.category}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const StatCard = ({ title, value, icon, color, large }: any) => (
  <View style={[styles.statCard, large && styles.statCardLarge]}>
    <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return COLORS.success;
    case 'cancelled': return COLORS.error;
    case 'in_progress': return COLORS.info;
    default: return COLORS.warning;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed': return 'Concluída';
    case 'cancelled': return 'Cancelada';
    case 'in_progress': return 'Em andamento';
    case 'driver_assigned': return 'Motorista aceito';
    case 'driver_arrived': return 'Motorista chegou';
    case 'searching_driver': return 'Buscando motorista';
    default: return status;
  }
};

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
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: SPACING.md,
  },
  logoutButton: {
    padding: SPACING.sm,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    marginRight: SPACING.sm,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statCardLarge: {
    width: '100%',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  statValue: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statTitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
  driverCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  driverInfo: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
  },
  driverDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  driverName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  driverEmail: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  driverVehicle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  driverState: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  driverActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  approveButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.error,
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  userName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  userDetail: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
    marginTop: SPACING.xs,
  },
  adminBadge: {
    backgroundColor: `${COLORS.primary}20`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  adminBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  driverBadge: {
    backgroundColor: `${COLORS.success}20`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  driverBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.success,
    fontWeight: '600',
  },
  blockButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.error}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockButton: {
    backgroundColor: `${COLORS.success}20`,
  },
  rideCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  ridePrice: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  rideAddress: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  rideDetail: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textTertiary,
    marginTop: SPACING.sm,
  },
});
