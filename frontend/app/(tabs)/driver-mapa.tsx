import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { driverAPI } from '../../src/services/api';
import { PlaceSuggestion, searchAddressSuggestions } from '../../src/services/places';
import { Input } from '../../src/components/Input';
import MapComponent from '../../src/components/MapComponent';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { Driver, Location as AppLocation, Ride } from '../../src/types';

const RIDE_CATEGORIES = [
  { id: 'all', label: 'Todas' },
  { id: 'moto', label: 'Moto' },
  { id: 'car', label: 'Carro' },
  { id: 'comfort', label: 'Comfort' },
  { id: 'women', label: 'Mulheres' },
];

export default function DriverMapaScreen() {
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState<AppLocation | null>(null);
  const [destinationCity, setDestinationCity] = useState('');
  const [preferredCategory, setPreferredCategory] = useState('all');
  const [availableRides, setAvailableRides] = useState<Ride[]>([]);
  const [showRouteCard, setShowRouteCard] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedCitySuggestion, setSelectedCitySuggestion] = useState<PlaceSuggestion | null>(null);
  const [cityLookupLoading, setCityLookupLoading] = useState(false);

  const requestMarkers: Driver[] = useMemo(() => {
    return availableRides
      .filter((ride) => Number.isFinite(ride.origin_lat) && Number.isFinite(ride.origin_lng))
      .map((ride, idx) => ({
        id: `request-${ride.id}-${idx}`,
        name: 'Solicitação',
        phone: '',
        score: 0,
        vehicle_type: ride.category,
        lat: ride.origin_lat,
        lng: ride.origin_lng,
      }));
  }, [availableRides]);

  const filteredRides = useMemo(() => {
    const cityFilter = destinationCity.trim().toLowerCase();

    return availableRides.filter((ride) => {
      const categoryMatch = preferredCategory === 'all' || ride.category === preferredCategory;
      const cityMatch = !cityFilter || (ride.destination_address || '').toLowerCase().includes(cityFilter);
      return categoryMatch && cityMatch;
    });
  }, [availableRides, destinationCity, preferredCategory]);

  const selectedDestination = useMemo(() => {
    const selectedRide = filteredRides[0];
    if (!selectedRide) return null;
    return {
      lat: selectedRide.destination_lat,
      lng: selectedRide.destination_lng,
      address: selectedRide.destination_address,
    };
  }, [filteredRides]);

  const previewDestination = selectedCitySuggestion
    ? {
        lat: selectedCitySuggestion.lat,
        lng: selectedCitySuggestion.lng,
        address: selectedCitySuggestion.address,
      }
    : null;


  const loadDriverLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setOrigin({
        lat: -23.55052,
        lng: -46.633308,
        address: 'São Paulo, SP',
      });
      return;
    }

    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

    let addressLabel = 'Sua localização';
    try {
      const reverse = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      const first = reverse[0];
      if (first) {
        addressLabel = [first.city, first.region].filter(Boolean).join(', ') || addressLabel;
      }
    } catch {
      // ignore reverse geocode errors
    }

    setOrigin({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      address: addressLabel,
    });

    try {
      await driverAPI.updateLocation(location.coords.latitude, location.coords.longitude, location.coords.heading || 0);
    } catch {
      // backend simples pode não suportar tudo
    }
  }, []);

  const loadAvailableRides = useCallback(async () => {
    try {
      const response = await driverAPI.getAvailableRides();
      const rides = Array.isArray(response.data) ? response.data : [];
      setAvailableRides(rides);
    } catch {
      setAvailableRides([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadDriverLocation(), loadAvailableRides()]);
    } finally {
      setLoading(false);
    }
  }, [loadDriverLocation, loadAvailableRides]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    let active = true;

    const normalized = destinationCity.trim();
    if (normalized.length < 3) {
      setCitySuggestions([]);
      setCityLookupLoading(false);
      return;
    }

    setCityLookupLoading(true);
    const timer = setTimeout(async () => {
      try {
        // Priorizar sugestões próximas à localização do motorista
        const suggestions = await searchAddressSuggestions(
          normalized,
          5,
          origin?.lat,
          origin?.lng
        );
        if (!active) return;
        setCitySuggestions(suggestions);
      } catch {
        if (!active) return;
        setCitySuggestions([]);
      } finally {
        if (active) {
          setCityLookupLoading(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [destinationCity, origin?.lat, origin?.lng]);

  const applyCitySuggestion = useCallback((suggestion: PlaceSuggestion) => {
    setDestinationCity(suggestion.address);
    setSelectedCitySuggestion(suggestion);
    setCitySuggestions([]);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      loadAvailableRides();
      if (origin) {
        driverAPI.updateLocation(origin.lat, origin.lng).catch(() => undefined);
      }
    }, 7000);

    return () => clearInterval(timer);
  }, [loadAvailableRides, origin]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fullMapContainer}>
        <MapComponent
          origin={origin}
          destination={previewDestination || selectedDestination}
          drivers={requestMarkers}
          showRoute={!!(previewDestination || selectedDestination)}
          style={styles.fullMap}
        />

        <View style={styles.bottomOverlay}>
          <TouchableOpacity
            style={styles.routeCardToggle}
            onPress={() => setShowRouteCard((prev) => !prev)}
          >
            <View>
              <Text style={styles.routeCardToggleTitle}>Preferência de rota</Text>
              <Text style={styles.routeCardToggleText}>
                {destinationCity ? destinationCity : 'Opcional. Se vazio, mostra qualquer corrida próxima'}
              </Text>
            </View>
            <Ionicons
              name={showRouteCard ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={COLORS.text}
            />
          </TouchableOpacity>

          {showRouteCard ? (
            <View style={styles.routeCard}>
              <Input
                label="Cidade para onde deseja ir"
                placeholder="Opcional. Ex: Campinas"
                value={destinationCity}
                onChangeText={(text) => {
                  setDestinationCity(text);
                  if (
                    selectedCitySuggestion &&
                    text.trim().toLowerCase() !== selectedCitySuggestion.address.toLowerCase()
                  ) {
                    setSelectedCitySuggestion(null);
                  }
                }}
              />

              {cityLookupLoading ? (
                <View style={styles.suggestionsLoadingRow}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.suggestionsLoadingText}>Buscando locais...</Text>
                </View>
              ) : null}

              {citySuggestions.length > 0 ? (
                <View style={styles.suggestionsCard}>
                  <FlatList
                    keyboardShouldPersistTaps="handled"
                    data={citySuggestions}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => applyCitySuggestion(item)}
                      >
                        <Ionicons name="location" size={16} color={COLORS.primary} />
                        <Text style={styles.suggestionText}>{item.address}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              ) : null}

              <Text style={styles.preferenceLabel}>Tipo de rota</Text>
              <View style={styles.categoryRow}>
                {RIDE_CATEGORIES.map((category) => {
                  const selected = preferredCategory === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                      onPress={() => setPreferredCategory(category.id)}
                    >
                      <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.routeSummaryText}>
                {filteredRides.length > 0
                  ? `${filteredRides.length} corrida(s) próxima(s) dentro do filtro`
                  : 'Nenhuma corrida encontrada com esse filtro'}
              </Text>
            </View>
          ) : null}
        </View>
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
  fullMapContainer: {
    flex: 1,
  },
  fullMap: {
    flex: 1,
  },
  bottomOverlay: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    bottom: SPACING.xl,
  },
  routeCardToggle: {
    backgroundColor: `${COLORS.background}EE`,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeCardToggleTitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    fontWeight: '700',
  },
  routeCardToggleText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    maxWidth: 240,
  },
  routeCard: {
    backgroundColor: `${COLORS.background}F5`,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  suggestionsCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    maxHeight: 160,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    backgroundColor: COLORS.backgroundSecondary,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONTS.sizes.sm,
  },
  suggestionsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.sm,
  },
  suggestionsLoadingText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
  },
  preferenceLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.backgroundSecondary,
  },
  categoryChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}1A`,
  },
  categoryChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: COLORS.primary,
  },
  routeSummaryText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
});
