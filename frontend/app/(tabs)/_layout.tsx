import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING } from '../../src/constants/theme';
import { useThemeStore } from '../../src/store/themeStore';
import { useAuthStore } from '../../src/store/authStore';

export default function TabLayout() {
  const { isDark } = useThemeStore();
  const { user } = useAuthStore();
  const isDriver = user?.role === 'driver';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { backgroundColor: isDark ? COLORS.backgroundSecondary : '#F4F0FF' }],
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="driver-mapa"
        options={{
          title: 'Mapa',
          href: isDriver ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="map" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          href: isDriver ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Histórico',
          href: isDriver ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="time" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="driver"
        options={{
          title: 'Motorista',
          href: isDriver ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="car" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="dados-pessoais"
        options={{
          title: 'Dados pessoais',
          href: null,
        }}
      />
      <Tabs.Screen
        name="driver-ganhos"
        options={{
          title: 'Ganhos',
          href: null,
        }}
      />
      <Tabs.Screen
        name="driver-corridas"
        options={{
          title: 'Corridas',
          href: null,
        }}
      />
      <Tabs.Screen
        name="driver-documentos"
        options={{
          title: 'Documentos',
          href: null,
        }}
      />
    </Tabs>
  );
}

const TabIcon = ({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) => {
  if (focused) {
    return (
      <View style={styles.activeIconContainer}>
        <LinearGradient
          colors={[COLORS.gradientStart, COLORS.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.activeIconGradient}
        >
          <Ionicons name={name} size={22} color={COLORS.white} />
        </LinearGradient>
      </View>
    );
  }
  return <Ionicons name={`${name}-outline` as keyof typeof Ionicons.glyphMap} size={22} color={color} />;
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.backgroundSecondary,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingTop: SPACING.sm,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.sm,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  activeIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
