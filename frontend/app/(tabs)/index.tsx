import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
  Modal,
  PanResponder,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';
import { rideAPI, driverAPI } from '../../src/services/api';
import { PlaceSuggestion, searchAddressSuggestions } from '../../src/services/places';
import { GradientButton } from '../../src/components/GradientButton';
import { CategoryCard } from '../../src/components/CategoryCard';
import { Input } from '../../src/components/Input';
import MapComponent from '../../src/components/MapComponent';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';
import { RideEstimate } from '../../src/types';

const { height } = Dimensions.get('window');

type ScreenState = 'map' | 'selectDestination' | 'selectCategory' | 'searching' | 'rideActive';

const categories = [
  { id: 'moto', name: 'LetsGo Moto', description: 'Mais barato e rápido', icon: 'motorcycle' },
  { id: 'car', name: 'LetsGo Carro', description: 'Categoria padrão', icon: 'car' },
  { id: 'comfort', name: 'LetsGo Comfort', description: 'Mais espaço e conforto', icon: 'car-sport' },
  { id: 'women', name: 'LetsGo Mulheres', description: 'Motoristas mulheres', icon: 'woman' },
];

const LETSGO_BG = '#0f0a1a';
const LETSGO_PURPLE = '#8B5CF6';
const LETSGO_PINK = '#EC4899';
const LETSGO_ICON = '#C4B5FD';
const COLLAPSED_SHEET_TOP = Math.round(height * 0.56);
const MIN_SHEET_TOP = Math.round(height * 0.28);
const MAX_SHEET_TOP = Math.round(height * 0.70);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isGuestMode } = useAuthStore();
  const {
    origin,
    destination,
    selectedCategory,
    estimates,
    currentRide,
    nearbyDrivers,
    setOrigin,
    setDestination,
    setSelectedCategory,
    setEstimates,
    setCurrentRide,
    setNearbyDrivers,
    clearRide,
  } = useRideStore();

  const [screenState, setScreenState] = useState<ScreenState>('map');
  const [loading, setLoading] = useState(false);
  const [destinationText, setDestinationText] = useState('');
  const [originText, setOriginText] = useState('');
  const [useLiveLocation, setUseLiveLocation] = useState(true);
  const [requestingRide, setRequestingRide] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [sheetTop, setSheetTop] = useState(COLLAPSED_SHEET_TOP);
  const [originSuggestions, setOriginSuggestions] = useState<PlaceSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [originLookupLoading, setOriginLookupLoading] = useState(false);
  const [destinationLookupLoading, setDestinationLookupLoading] = useState(false);
  const [selectedOriginSuggestion, setSelectedOriginSuggestion] = useState<PlaceSuggestion | null>(null);
  const [selectedDestinationSuggestion, setSelectedDestinationSuggestion] = useState<PlaceSuggestion | null>(null);
  const sheetTopRef = useRef(COLLAPSED_SHEET_TOP);
  const sheetDragStartTop = useRef(COLLAPSED_SHEET_TOP);
  const originSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user?.role === 'driver') {
      router.replace('/(tabs)/driver-mapa');
    }
  }, [router, user?.role]);

  useEffect(() => {
    return () => {
      if (originSearchTimeoutRef.current) {
        clearTimeout(originSearchTimeoutRef.current);
      }
      if (destinationSearchTimeoutRef.current) {
        clearTimeout(destinationSearchTimeoutRef.current);
      }
    };
  }, []);

  const getCurrentLocation = useCallback(async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      let addressStr = 'Localização atual';
      try {
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (address[0]) {
          const addr = address[0];
          addressStr = [addr.street, addr.streetNumber, addr.district].filter(Boolean).join(', ') || 
                       [addr.city, addr.region].filter(Boolean).join(', ') || 
                       'Localização atual';
        }
      } catch (e) {
        console.log('Geocode error:', e);
      }

      setOrigin({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        address: addressStr,
      });
      if (useLiveLocation) {
        setOriginText(addressStr);
      }

      if (isAuthenticated) {
        try {
          const response = await driverAPI.getNearby(location.coords.latitude, location.coords.longitude);
          setNearbyDrivers(response.data);
        } catch (error) {
          console.log('Error loading drivers:', error);
        }

        try {
          const rideResponse = await rideAPI.getActiveRide();
          if (rideResponse.data) {
            setCurrentRide(rideResponse.data);
            setScreenState('rideActive');
          }
        } catch {
          console.log('No active ride');
        }
      }
    } catch (error) {
      console.log('Location error:', error);
      setOrigin({
        lat: -23.550520,
        lng: -46.633308,
        address: 'São Paulo, SP',
      });
      if (useLiveLocation) {
        setOriginText('São Paulo, SP');
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setCurrentRide, setNearbyDrivers, setOrigin, useLiveLocation]);

  const requestLocationPermission = useCallback(async () => {
    // Timeout de segurança: se a permissão não retornar em 5s usar localização padrão
    const fallback = setTimeout(() => {
      setOrigin({ lat: -23.550520, lng: -46.633308, address: 'São Paulo, SP' });
      setOriginText('São Paulo, SP');
    }, 5000);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      clearTimeout(fallback);
      if (status === 'granted') {
        setLocationPermission(true);
        await getCurrentLocation();
      } else {
        Alert.alert(
          'Permissão de Localização',
          'Precisamos da sua localização para encontrar motoristas próximos e calcular rotas.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Permitir', onPress: () => Location.requestForegroundPermissionsAsync() }
          ]
        );
        setOrigin({
          lat: -23.550520,
          lng: -46.633308,
          address: 'São Paulo, SP',
        });
        setOriginText('São Paulo, SP');
      }
    } catch (error) {
      clearTimeout(fallback);
      console.log('Location permission error:', error);
      setOrigin({
        lat: -23.550520,
        lng: -46.633308,
        address: 'São Paulo, SP',
      });
      setOriginText('São Paulo, SP');
    }
  }, [getCurrentLocation, setOrigin]);

  useEffect(() => {
    requestLocationPermission();
  }, [requestLocationPermission]);

  useEffect(() => {
    if (!locationPermission || !useLiveLocation) return;
    
    // Update location every 2 seconds for real-time tracking
    const interval = setInterval(() => {
      getCurrentLocation();
    }, 2000);

    return () => clearInterval(interval);
  }, [getCurrentLocation, locationPermission, useLiveLocation]);

  useEffect(() => {
    sheetTopRef.current = sheetTop;
  }, [sheetTop]);

  useEffect(() => {
    setSheetTop(COLLAPSED_SHEET_TOP);
  }, [screenState]);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        sheetDragStartTop.current = sheetTopRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextTop = clamp(sheetDragStartTop.current + gestureState.dy, MIN_SHEET_TOP, MAX_SHEET_TOP);
        setSheetTop(nextTop);
      },
      onPanResponderRelease: (_, gestureState) => {
        const snapTop = gestureState.dy > 8
          ? MAX_SHEET_TOP
          : COLLAPSED_SHEET_TOP;
        setSheetTop(snapTop);
      },
      onPanResponderTerminate: () => {
        setSheetTop((currentTop) =>
          currentTop > (COLLAPSED_SHEET_TOP + MAX_SHEET_TOP) / 2 ? MAX_SHEET_TOP : COLLAPSED_SHEET_TOP
        );
      },
    })
  ).current;

  const handleSetDestination = async () => {
    if (!origin) return;

    let rideOrigin = origin;
    const normalizedOrigin = (originText || '').trim();
    const currentOriginAddress = (origin.address || '').trim();

    if (normalizedOrigin && normalizedOrigin !== currentOriginAddress) {
      try {
        const geocodedOrigin = await Location.geocodeAsync(normalizedOrigin);
        if (!geocodedOrigin[0]) {
          Alert.alert('Origem inválida', 'Não encontramos essa origem. Tente outro endereço.');
          return;
        }
        rideOrigin = {
          lat: geocodedOrigin[0].latitude,
          lng: geocodedOrigin[0].longitude,
          address: normalizedOrigin,
        };
        setOrigin(rideOrigin);
        setUseLiveLocation(false);
      } catch {
        Alert.alert('Origem inválida', 'Não foi possível localizar a origem informada.');
        return;
      }
    }

    const normalizedDestination = destinationText.trim();
    if (!normalizedDestination) {
      Alert.alert('Destino inválido', 'Digite um destino para continuar.');
      return;
    }

    let resolvedDestination: { lat: number; lng: number; address: string } | null = null;

    try {
      const suggestions = await searchAddressSuggestions(normalizedDestination, 1);
      if (suggestions[0]) {
        resolvedDestination = {
          lat: suggestions[0].lat,
          lng: suggestions[0].lng,
          address: suggestions[0].address,
        };
      }
    } catch {
      // fallback below
    }

    if (!resolvedDestination) {
      try {
        const geocodedDestination = await Location.geocodeAsync(normalizedDestination);
        if (!geocodedDestination[0]) {
          Alert.alert('Destino inválido', 'Não encontramos esse destino. Tente outro endereço.');
          return;
        }
        resolvedDestination = {
          lat: geocodedDestination[0].latitude,
          lng: geocodedDestination[0].longitude,
          address: normalizedDestination,
        };
      } catch {
        Alert.alert('Destino inválido', 'Não foi possível localizar o destino informado.');
        return;
      }
    }

    const newDestination = resolvedDestination;
    
    setDestination(newDestination);
    setDestinationText(newDestination.address);
    setDestinationSuggestions([]);
    setScreenState('selectCategory');

    if (isAuthenticated) {
      try {
        const response = await rideAPI.estimate({
          origin_lat: rideOrigin.lat,
          origin_lng: rideOrigin.lng,
          destination_lat: newDestination.lat,
          destination_lng: newDestination.lng,
          origin_address: rideOrigin.address || '',
          destination_address: newDestination.address,
          category: 'car',
        });
        setEstimates(response.data);
      } catch (error) {
        console.log('Error getting estimates:', error);
      }
    } else {
      const mockEstimates = categories
        .filter(cat => cat.id !== 'women')
        .map(cat => ({
          category: cat.id,
          distance_km: 5.2,
          duration_min: 15,
          price: cat.id === 'moto' ? 12.50 : cat.id === 'comfort' ? 22.00 : 16.80
        }));
      setEstimates(mockEstimates);
    }
  };

  const lookupOriginSuggestions = useCallback((query: string) => {
    if (originSearchTimeoutRef.current) {
      clearTimeout(originSearchTimeoutRef.current);
    }

    const normalized = query.trim();
    if (normalized.length < 3) {
      setOriginSuggestions([]);
      setOriginLookupLoading(false);
      return;
    }

    setOriginLookupLoading(true);
    originSearchTimeoutRef.current = setTimeout(async () => {
      try {
        // Priorizar sugestões próximas à localização do usuário
        const suggestions = await searchAddressSuggestions(
          normalized,
          5,
          origin?.lat,
          origin?.lng
        );
        setOriginSuggestions(suggestions);
      } catch {
        setOriginSuggestions([]);
      } finally {
        setOriginLookupLoading(false);
      }
    }, 350);
  }, [origin?.lat, origin?.lng]);

  const lookupDestinationSuggestions = useCallback((query: string) => {
    if (destinationSearchTimeoutRef.current) {
      clearTimeout(destinationSearchTimeoutRef.current);
    }

    const normalized = query.trim();
    if (normalized.length < 3) {
      setDestinationSuggestions([]);
      setDestinationLookupLoading(false);
      return;
    }

    setDestinationLookupLoading(true);
    destinationSearchTimeoutRef.current = setTimeout(async () => {
      try {
        // Priorizar sugestões próximas à localização do usuário
        const suggestions = await searchAddressSuggestions(
          normalized,
          5,
          origin?.lat,
          origin?.lng
        );
        setDestinationSuggestions(suggestions);
      } catch {
        setDestinationSuggestions([]);
      } finally {
        setDestinationLookupLoading(false);
      }
    }, 350);
  }, [origin?.lat, origin?.lng]);

  const applyOriginSuggestion = useCallback((suggestion: PlaceSuggestion) => {
    setOriginText(suggestion.address);
    setOrigin({ lat: suggestion.lat, lng: suggestion.lng, address: suggestion.address });
    setSelectedOriginSuggestion(suggestion);
    setUseLiveLocation(false);
    setOriginSuggestions([]);
  }, [setOrigin]);

  const applyDestinationSuggestion = useCallback((suggestion: PlaceSuggestion) => {
    setDestinationText(suggestion.address);
    setSelectedDestinationSuggestion(suggestion);
    setDestinationSuggestions([]);
  }, []);

  const handleRouteInfo = (distanceKm: number, durationMin: number) => {
    const BASE = 3;
    const VALOR_KM = 2;
    const VALOR_MIN = 0.5;
    const MULTIPLIERS: Record<string, number> = { moto: 0.7, car: 1.0, comfort: 1.4, women: 1.1 };
    const realEstimates = categories.map(cat => ({
      category: cat.id,
      distance_km: distanceKm,
      duration_min: Math.round(durationMin),
      price: parseFloat(
        ((BASE + distanceKm * VALOR_KM + durationMin * VALOR_MIN) * (MULTIPLIERS[cat.id] ?? 1)).toFixed(2)
      ),
    }));
    setEstimates(realEstimates);
  };

  const handleRequestRide = async () => {
    if (isGuestMode || !isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    if (!origin || !destination) return;

    setRequestingRide(true);
    try {
      const response = await rideAPI.request({
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        origin_address: origin.address || '',
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        destination_address: destination.address || '',
        category: selectedCategory,
      });
      
      setCurrentRide(response.data);
      setScreenState('searching');
      
      setTimeout(() => {
        const updatedRide = {
          ...response.data,
          status: 'driver_assigned',
          driver: {
            id: 'driver-1',
            name: 'Carlos Silva',
            phone: '(11) 98765-4321',
            score: 980,
            vehicle_type: selectedCategory,
            vehicle_model: 'Toyota Corolla',
            vehicle_plate: 'ABC-1234',
            vehicle_color: 'Prata'
          },
        };
        setCurrentRide(updatedRide);
        setScreenState('rideActive');
      }, 3000);
      
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao solicitar corrida');
    } finally {
      setRequestingRide(false);
    }
  };

  const handleCancelRide = async () => {
    if (!currentRide) return;

    Alert.alert(
      'Cancelar corrida',
      'Tem certeza que deseja cancelar esta corrida?',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isAuthenticated) {
                await rideAPI.cancelRide(currentRide.id);
              }
              clearRide();
              setScreenState('map');
              setDestinationText('');
            } catch (error: any) {
              Alert.alert('Erro', error.response?.data?.detail || 'Erro ao cancelar');
            }
          },
        },
      ]
    );
  };

  const getEstimateForCategory = (categoryId: string): RideEstimate | undefined => {
    return estimates.find((e) => e.category === categoryId);
  };

  const filteredCategories = categories.filter((cat) => {
    if (cat.id === 'women' && user?.gender !== 'female') return false;
    return true;
  });

  const originPreview = useLiveLocation
    ? origin
    : (selectedOriginSuggestion
      ? {
          lat: selectedOriginSuggestion.lat,
          lng: selectedOriginSuggestion.lng,
          address: selectedOriginSuggestion.address,
        }
      : null);

  const destinationPreview = selectedDestinationSuggestion
    ? {
        lat: selectedDestinationSuggestion.lat,
        lng: selectedDestinationSuggestion.lng,
        address: selectedDestinationSuggestion.address,
      }
    : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Obtendo sua localização...</Text>
      </View>
    );
  }

  const showRoute = screenState === 'selectCategory' || screenState === 'searching' || screenState === 'rideActive';
  const mapOrigin = screenState === 'selectDestination'
    ? (originPreview
      ? { lat: originPreview.lat, lng: originPreview.lng, address: originPreview.address }
      : origin)
    : origin;
  const mapDestination = screenState === 'selectDestination'
    ? (destinationPreview
      ? { lat: destinationPreview.lat, lng: destinationPreview.lng, address: destinationPreview.address }
      : null)
    : (showRoute ? destination : null);
  const showRouteOnMap = screenState === 'selectDestination'
    ? Boolean(mapOrigin && mapDestination)
    : showRoute;
  const bottomSheetColors = ['#1A1230', '#241338', '#2E1238'] as const;
  const mapFadeColors = ['rgba(15,10,26,0)', 'rgba(15,10,26,0.7)', '#1A1230'] as const;
  const mapFadeHeight = Math.max(height - sheetTop + 72, Math.round(height * 0.42));

  return (
    <LinearGradient
      colors={[LETSGO_BG, LETSGO_BG]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapComponent
          origin={mapOrigin}
          destination={mapDestination}
          drivers={nearbyDrivers}
          showRoute={showRouteOnMap}
          onRouteInfo={handleRouteInfo}
          routeCategory={selectedCategory}
        />
        <LinearGradient
          pointerEvents="none"
          colors={mapFadeColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.mapFade, { height: mapFadeHeight }]}
        />
      </View>

      {/* Top Bar */}
      <SafeAreaView style={styles.topBar}>
        <View style={styles.topBarContent}>
          <LinearGradient
            colors={[COLORS.gradientStart, COLORS.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoContainer}
          >
            <Text style={styles.logoText}>LetsGo</Text>
          </LinearGradient>
          {isGuestMode && (
            <TouchableOpacity 
              style={styles.loginBadge}
              onPress={() => router.push('/(auth)/login')}
            >
              <Ionicons name="person-circle-outline" size={20} color={LETSGO_ICON} />
              <Text style={styles.loginBadgeText}>Entrar</Text>
            </TouchableOpacity>
          )}
          {locationPermission && (
            <View style={styles.gpsBadge}>
              <Ionicons name="locate" size={16} color={LETSGO_ICON} />
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Bottom Sheet */}
      <View style={[styles.bottomSheet, { top: sheetTop }]}>
        <LinearGradient
          colors={bottomSheetColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.bottomSheetGradient}
        >
          <View style={styles.dragHandleArea} {...sheetPanResponder.panHandlers}>
            <View style={styles.dragPill} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.bottomSheetScroll}>
          {screenState === 'map' && (
            <>
              <Text style={styles.greeting}>
                Olá{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
              </Text>
              <Text style={styles.question}>Para onde vamos?</Text>
              <TouchableOpacity
                style={styles.destinationInput}
                onPress={() => setScreenState('selectDestination')}
              >
                <Ionicons name="search" size={20} color={LETSGO_ICON} />
                <Text style={styles.destinationPlaceholder}>Buscar destino</Text>
              </TouchableOpacity>

              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.quickAction}>
                  <View style={styles.quickActionIcon}>
                    <Ionicons name="home" size={20} color={LETSGO_ICON} />
                  </View>
                  <Text style={styles.quickActionText}>Casa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickAction}>
                  <View style={styles.quickActionIcon}>
                    <Ionicons name="briefcase" size={20} color={LETSGO_ICON} />
                  </View>
                  <Text style={styles.quickActionText}>Trabalho</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickAction}>
                  <View style={styles.quickActionIcon}>
                    <Ionicons name="star" size={20} color={LETSGO_ICON} />
                  </View>
                  <Text style={styles.quickActionText}>Favoritos</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {screenState === 'selectDestination' && (
            <>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setScreenState('map')}>
                  <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>Escolha o destino</Text>
                <View style={{ width: 24 }} />
              </View>

              <View style={styles.locationInputs}>
                {/* Origem */}
                {useLiveLocation ? (
                  <View style={styles.currentLocationButton}>
                    <TouchableOpacity
                      onPress={() => {
                        setUseLiveLocation(false);
                        setOriginText('');
                        setSelectedOriginSuggestion(null);
                      }}
                      style={styles.locationRow}
                    >
                      <View style={[styles.locationDot, { backgroundColor: LETSGO_PURPLE }]} />
                      <View style={styles.locationColumn}>
                        <Text style={styles.locationLabel}>Localização atual</Text>
                        <Text style={styles.locationAddress}>{origin?.address || 'Carregando...'}</Text>
                      </View>
                      <Ionicons name="close" size={20} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.locationRow}>
                      <View style={[styles.locationDot, { backgroundColor: LETSGO_PURPLE }]} />
                      <Input
                        placeholder="De onde?"
                        value={originText}
                        onChangeText={(text) => {
                          setOriginText(text);
                          if (
                            selectedOriginSuggestion &&
                            text.trim().toLowerCase() !== selectedOriginSuggestion.address.toLowerCase()
                          ) {
                            setSelectedOriginSuggestion(null);
                          }
                          lookupOriginSuggestions(text);
                        }}
                        style={styles.locationInput}
                      />
                    </View>

                    {originLookupLoading && (
                      <View style={styles.suggestionsCard}>
                        <ActivityIndicator size="small" color={LETSGO_ICON} />
                        <Text style={styles.suggestionsLoadingText}>Buscando...</Text>
                      </View>
                    )}

                    {originSuggestions.length > 0 && (
                      <View style={styles.suggestionsCard}>
                        <FlatList
                          scrollEnabled={false}
                          keyboardShouldPersistTaps="handled"
                          data={originSuggestions}
                          keyExtractor={(item) => item.id}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={styles.suggestionItem}
                              onPress={() => applyOriginSuggestion(item)}
                            >
                              <Ionicons name="navigate" size={16} color={LETSGO_ICON} />
                              <Text style={styles.suggestionText}>{item.address}</Text>
                            </TouchableOpacity>
                          )}
                        />
                      </View>
                    )}
                  </>
                )}
              </View>

              <View style={styles.locationLine} />

              {/* Destino */}
              <View style={styles.locationInputs}>
                <View style={styles.locationRow}>
                  <View style={[styles.locationDot, { backgroundColor: LETSGO_PINK }]} />
                  <Input
                    placeholder="Para onde?"
                    value={destinationText}
                    onChangeText={(text) => {
                      setDestinationText(text);
                      if (
                        selectedDestinationSuggestion &&
                        text.trim().toLowerCase() !== selectedDestinationSuggestion.address.toLowerCase()
                      ) {
                        setSelectedDestinationSuggestion(null);
                      }
                      lookupDestinationSuggestions(text);
                    }}
                    style={styles.locationInput}
                  />
                </View>

                {destinationLookupLoading && (
                  <View style={styles.suggestionsCard}>
                    <ActivityIndicator size="small" color={LETSGO_ICON} />
                    <Text style={styles.suggestionsLoadingText}>Buscando...</Text>
                  </View>
                )}

                {destinationSuggestions.length > 0 && (
                  <View style={styles.suggestionsCard}>
                    <FlatList
                      scrollEnabled={false}
                      keyboardShouldPersistTaps="handled"
                      data={destinationSuggestions}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.suggestionItem}
                          onPress={() => applyDestinationSuggestion(item)}
                        >
                          <Ionicons name="flag" size={16} color={LETSGO_ICON} />
                          <Text style={styles.suggestionText}>{item.address}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </View>

              <GradientButton
                title="Confirmar destino"
                onPress={handleSetDestination}
                disabled={!destinationText}
              />
            </>
          )}

          {screenState === 'selectCategory' && (
            <>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setScreenState('selectDestination')}>
                  <Ionicons name="arrow-back" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>Escolha a categoria</Text>
                <View style={{ width: 24 }} />
              </View>

              <View style={styles.categoryList}>
                {filteredCategories.map((cat) => (
                  <CategoryCard
                    key={cat.id}
                    category={cat}
                    estimate={getEstimateForCategory(cat.id)}
                    selected={selectedCategory === cat.id}
                    onSelect={() => setSelectedCategory(cat.id)}
                  />
                ))}
              </View>

              <GradientButton
                title="Solicitar corrida"
                onPress={handleRequestRide}
                loading={requestingRide}
              />
            </>
          )}

          {screenState === 'searching' && (
            <View style={styles.searchingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.searchingText}>Buscando motorista...</Text>
              <Text style={styles.searchingSubtext}>Isso pode levar alguns segundos</Text>
              <GradientButton
                title="Cancelar"
                onPress={handleCancelRide}
                variant="outline"
                style={styles.cancelButton}
              />
            </View>
          )}

          {screenState === 'rideActive' && currentRide && (
            <>
              <View style={styles.rideStatusBadge}>
                <Text style={styles.rideStatusText}>
                  {currentRide.status === 'driver_assigned' && 'Motorista a caminho'}
                  {currentRide.status === 'driver_arrived' && 'Motorista chegou!'}
                  {currentRide.status === 'in_progress' && 'Em viagem'}
                </Text>
              </View>

              {currentRide.driver && (
                <BlurView intensity={35} tint="dark" style={[styles.glassCard, styles.driverInfo]}>
                  <View style={styles.driverAvatar}>
                    <Ionicons name="person" size={30} color={COLORS.primary} />
                  </View>
                  <View style={styles.driverDetails}>
                    <Text style={styles.driverName}>{currentRide.driver.name}</Text>
                    <Text style={styles.vehicleInfo}>
                      {currentRide.driver.vehicle_model} • {currentRide.driver.vehicle_plate}
                    </Text>
                    <Text style={styles.vehicleColor}>{currentRide.driver.vehicle_color}</Text>
                  </View>
                  <TouchableOpacity style={styles.callButton}>
                    <Ionicons name="call" size={20} color={COLORS.white} />
                  </TouchableOpacity>
                </BlurView>
              )}

              <BlurView intensity={35} tint="dark" style={[styles.glassCard, styles.rideDetails]}>
                <View style={styles.rideDetailRow}>
                  <Text style={styles.rideDetailLabel}>Preço estimado</Text>
                  <Text style={styles.rideDetailValue}>
                    R$ {currentRide.estimated_price.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.rideDetailRow}>
                  <Text style={styles.rideDetailLabel}>Distância</Text>
                  <Text style={styles.rideDetailValue}>{currentRide.distance_km} km</Text>
                </View>
              </BlurView>

              {currentRide.status !== 'in_progress' && (
                <GradientButton
                  title="Cancelar corrida"
                  onPress={handleCancelRide}
                  variant="outline"
                />
              )}
            </>
          )}
          </ScrollView>
        </LinearGradient>
      </View>

      {/* Login Modal */}
      <Modal
        visible={showLoginModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[COLORS.gradientStart, COLORS.gradientEnd]}
              style={styles.modalIcon}
            >
              <Ionicons name="person" size={32} color={COLORS.white} />
            </LinearGradient>
            <Text style={styles.modalTitle}>Login necessário</Text>
            <Text style={styles.modalText}>
              Para solicitar uma corrida, você precisa estar logado em sua conta.
            </Text>
            <GradientButton
              title="Fazer login"
              onPress={() => {
                setShowLoginModal(false);
                router.push('/(auth)/login');
              }}
              style={styles.modalButton}
            />
            <GradientButton
              title="Criar conta"
              onPress={() => {
                setShowLoginModal(false);
                router.push('/(auth)/register');
              }}
              variant="outline"
              style={styles.modalButton}
            />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowLoginModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LETSGO_BG,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: LETSGO_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
    fontSize: FONTS.sizes.md,
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mapFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  logoContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  logoText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  loginBadge: {
    position: 'absolute',
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,18,38,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.25)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  loginBadgeText: {
    color: LETSGO_ICON,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  gpsBadge: {
    position: 'absolute',
    left: SPACING.lg,
    backgroundColor: 'rgba(24,18,38,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.25)',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1230',
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  bottomSheetGradient: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxxl : SPACING.xl,
  },
  dragHandleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.md,
  },
  dragPill: {
    width: 52,
    height: 5,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.26)',
    marginBottom: 6,
  },
  bottomSheetScroll: {
    flex: 1,
  },
  greeting: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FONTS.sizes.md,
    marginBottom: SPACING.xs,
  },
  question: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  destinationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11,9,18,0.75)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.35)',
    marginBottom: SPACING.xl,
  },
  destinationPlaceholder: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: FONTS.sizes.lg,
    marginLeft: SPACING.md,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  quickActionText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  sheetTitle: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
  },
  locationInputs: {
    marginBottom: SPACING.xl,
  },
  currentLocationButton: {
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.2)',
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(11,9,18,0.55)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationColumn: {
    flex: 1,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING.md,
  },
  locationLabel: {
    color: 'rgba(196,181,253,0.9)',
    fontSize: FONTS.sizes.xs,
    marginBottom: 2,
  },
  locationAddress: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
  },
  locationLine: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginLeft: 5,
    marginVertical: SPACING.xs,
  },
  locationInput: {
    flex: 1,
    marginBottom: 0,
  },
  locationText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    flex: 1,
  },
  originInputField: {
    flex: 1,
    marginBottom: 0,
  },
  originBoxWrapper: {
    flex: 1,
  },
  destinationInputField: {
    flex: 1,
    marginBottom: 0,
  },
  suggestionsCard: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.25)',
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(26, 18, 48, 0.95)',
    maxHeight: 170,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(196, 181, 253, 0.12)',
  },
  suggestionText: {
    flex: 1,
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
  },
  suggestionsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  suggestionsLoadingText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  categoryList: {
    marginBottom: SPACING.lg,
  },
  searchingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  searchingText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    marginTop: SPACING.lg,
  },
  searchingSubtext: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FONTS.sizes.md,
    marginTop: SPACING.sm,
  },
  cancelButton: {
    marginTop: SPACING.xl,
    width: '100%',
  },
  rideStatusBadge: {
    backgroundColor: 'rgba(236,72,153,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.35)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  rideStatusText: {
    color: LETSGO_PINK,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  glassCard: {
    backgroundColor: 'rgba(8, 7, 14, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.22)',
    overflow: 'hidden',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${COLORS.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  driverName: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
  },
  vehicleInfo: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  vehicleColor: {
    color: 'rgba(196,181,253,0.9)',
    fontSize: FONTS.sizes.xs,
    marginTop: 2,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LETSGO_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideDetails: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  rideDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  rideDetailLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FONTS.sizes.md,
  },
  rideDetailValue: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xxl,
    width: '100%',
    alignItems: 'center',
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  modalButton: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  modalCancel: {
    paddingVertical: SPACING.md,
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
  },
});
