import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { driverAPI } from '../../src/services/api';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function DriverGanhosScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today_earnings: 0,
    month_earnings: 0,
    total_rides: 0,
    today_rides: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await driverAPI.getStats();
        setStats({
          today_earnings: Number(response.data?.today_earnings ?? 0),
          month_earnings: Number(response.data?.month_earnings ?? 0),
          total_rides: Number(response.data?.total_rides ?? 0),
          today_rides: Number(response.data?.today_rides ?? 0),
        });
      } catch (error) {
        console.log('Error loading driver stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

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
        <Text style={styles.title}>Ganhos</Text>
        <Text style={styles.subtitle}>Resumo financeiro do motorista</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="wallet" size={18} color={COLORS.primary} />
            <Text style={styles.label}>Hoje</Text>
          </View>
          <Text style={styles.value}>R$ {stats.today_earnings.toFixed(2)}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="calendar" size={18} color={COLORS.primary} />
            <Text style={styles.label}>Mês</Text>
          </View>
          <Text style={styles.value}>R$ {stats.month_earnings.toFixed(2)}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="speedometer" size={18} color={COLORS.primary} />
            <Text style={styles.label}>Corridas hoje</Text>
          </View>
          <Text style={styles.value}>{stats.today_rides}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="car-sport" size={18} color={COLORS.primary} />
            <Text style={styles.label}>Total de corridas</Text>
          </View>
          <Text style={styles.value}>{stats.total_rides}</Text>
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
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  value: {
    fontSize: FONTS.sizes.xxl,
    color: COLORS.text,
    fontWeight: '700',
  },
});
