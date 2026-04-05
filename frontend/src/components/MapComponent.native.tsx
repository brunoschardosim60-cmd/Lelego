import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { getDriverMapIcon, getRouteColorByCategory } from '../constants/driverMapIcons';
import { useThemeStore } from '../store/themeStore';
import {
  calculateDistanceKm,
  decodeGooglePolyline,
  Driver,
  estimateDurationMinutes,
  Location,
} from './mapUtils';

const GOOGLE_MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAP_ID;
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

interface MapComponentProps {
  origin: Location | null;
  destination?: Location | null;
  drivers?: Driver[];
  showRoute?: boolean;
  style?: any;
  onRouteInfo?: (distanceKm: number, durationMin: number) => void;
  routeCategory?: string;
}

// Dark mode map style for Google Maps - matching app purple/dark theme
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#2c2c2c' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1a2c1a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2c2c2c' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1a1a' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3c3c3c' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2c2c2c' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0f0f1a' }],
  },
];

const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5f5774' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f3ecff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ecdfff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e8f2ff' }] },
];

const MapComponent: React.FC<MapComponentProps> = ({
  origin,
  destination,
  drivers = [],
  showRoute = false,
  style,
  onRouteInfo,
  routeCategory,
}) => {
  const { isDark } = useThemeStore();
  const mapRef = useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);

  const distance = useMemo(() => {
    if (!origin || !destination) return null;
    return calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
  }, [origin, destination]);

  const duration = durationMinutes ?? (distance ? estimateDurationMinutes(distance) : null);
  const routeColor = getRouteColorByCategory(routeCategory);

  // Animate to new region when origin changes
  useEffect(() => {
    if (mapRef.current && origin) {
      if (destination && showRoute) {
        // Fit to show both origin and destination
        mapRef.current.fitToCoordinates(
          [
            { latitude: origin.lat, longitude: origin.lng },
            { latitude: destination.lat, longitude: destination.lng },
          ],
          {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          }
        );
      } else {
        // Animate to user location
        mapRef.current.animateToRegion(
          {
            latitude: origin.lat,
            longitude: origin.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500
        );
      }
    }
  }, [origin, destination, showRoute]);

  useEffect(() => {
    let isMounted = true;

    const setFallbackRoute = () => {
      if (!origin || !destination || !showRoute) {
        setRouteCoordinates([]);
        setDurationMinutes(null);
        return;
      }

      setRouteCoordinates([
        { latitude: origin.lat, longitude: origin.lng },
        { latitude: destination.lat, longitude: destination.lng },
      ]);
      if (distance) {
        setDurationMinutes(estimateDurationMinutes(distance));
      }
    };

    const loadRoute = async () => {
      if (!origin || !destination || !showRoute) {
        setFallbackRoute();
        return;
      }

      if (!GOOGLE_MAPS_API_KEY) {
        setFallbackRoute();
        return;
      }

      try {
        const originParam = `${origin.lat},${origin.lng}`;
        const destinationParam = `${destination.lat},${destination.lng}`;
        const endpoint = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destinationParam)}&mode=driving&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;

        const response = await fetch(endpoint);
        if (!response.ok) {
          setFallbackRoute();
          return;
        }

        const data = await response.json();
        const route = data?.routes?.[0];
        const leg = route?.legs?.[0];
        const polyline = route?.overview_polyline?.points;

        if (!route || !polyline) {
          setFallbackRoute();
          return;
        }

        const decoded = decodeGooglePolyline(polyline);
        if (!isMounted || decoded.length === 0) return;

        setRouteCoordinates(decoded);
        const etaSeconds = leg?.duration?.value;
        const distanceMeters = leg?.distance?.value;
        if (typeof etaSeconds === 'number') {
          setDurationMinutes(Math.max(1, Math.round(etaSeconds / 60)));
        }
        if (typeof etaSeconds === 'number' && typeof distanceMeters === 'number') {
          onRouteInfo?.(distanceMeters / 1000, etaSeconds / 60);
        }
      } catch {
        if (!isMounted) return;
        setFallbackRoute();
      }
    };

    loadRoute();

    return () => {
      isMounted = false;
    };
  }, [origin, destination, showRoute, distance, onRouteInfo]);

  // Loading state when no origin
  if (!origin) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando mapa...</Text>
        </View>
      </View>
    );
  }

  // Calculate initial region
  const getInitialRegion = () => {
    if (destination && showRoute) {
      const minLat = Math.min(origin.lat, destination.lat);
      const maxLat = Math.max(origin.lat, destination.lat);
      const minLng = Math.min(origin.lng, destination.lng);
      const maxLng = Math.max(origin.lng, destination.lng);
      
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
        longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02),
      };
    }
    
    return {
      latitude: origin.lat,
      longitude: origin.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  return (
    <View style={[styles.container, style]}>
      {/* Native Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        googleMapId={GOOGLE_MAP_ID}
        style={styles.map}
        customMapStyle={isDark ? darkMapStyle : lightMapStyle}
        initialRegion={getInitialRegion()}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={true}
        showsIndoors={false}
        toolbarEnabled={false}
        loadingEnabled={true}
        loadingBackgroundColor={COLORS.background}
        loadingIndicatorColor={COLORS.primary}
      >
        {/* User location marker */}
        <Marker
          coordinate={{
            latitude: origin.lat,
            longitude: origin.lng,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.userMarker}>
            <View style={styles.userMarkerInner} />
          </View>
        </Marker>

        {/* Destination marker */}
        {destination && showRoute && (
          <Marker
            coordinate={{
              latitude: destination.lat,
              longitude: destination.lng,
            }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.destinationMarker}>
              <View style={styles.destinationMarkerPin} />
            </View>
          </Marker>
        )}

        {/* Driver markers */}
        {drivers
          .filter((driver) => typeof driver.lat === 'number' && typeof driver.lng === 'number')
          .map((driver) => {
          const driverType = (driver.vehicle_type ?? driver.type ?? '').toLowerCase();
          const iconConfig = getDriverMapIcon(driverType);

          return (
          <Marker
            key={driver.id}
            coordinate={{
              latitude: driver.lat as number,
              longitude: driver.lng as number,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driver.heading || 0}
          >
            <View style={[styles.driverMarker, { borderColor: iconConfig.color, backgroundColor: `${iconConfig.color}1A` }]}>
              <Image
                source={{ uri: iconConfig.iconUrl }}
                style={[styles.driverMarkerImage, driverType === 'moto' ? { tintColor: '#16A34A' } : undefined]}
                resizeMode="contain"
              />
            </View>
          </Marker>
          );
        })}

        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={routeColor}
            strokeWidth={5}
            geodesic
          />
        )}
      </MapView>

      {/* Route Info */}
      {destination && distance !== null && showRoute && (
        <View style={styles.routeInfo}>
          <View style={styles.routeItem}>
            <Ionicons name="navigate" size={14} color={COLORS.primary} />
            <Text style={styles.routeText}>{distance.toFixed(1)} km</Text>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeItem}>
            <Ionicons name="time" size={14} color={COLORS.secondary} />
            <Text style={styles.routeText}>{duration} min</Text>
          </View>
        </View>
      )}

      {/* Drivers Count */}
      {drivers.length > 0 && !showRoute && (
        <View style={styles.driversCount}>
          <Ionicons name="car" size={14} color={COLORS.success} />
          <Text style={styles.driversText}>{drivers.length} motoristas</Text>
        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}40`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  userMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  destinationMarker: {
    alignItems: 'center',
  },
  destinationMarkerPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.secondary,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  driverMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${COLORS.success}1A`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  driverMarkerImage: {
    width: 30,
    height: 30,
  },
  routeInfo: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.md,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  routeDivider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  driversCount: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: `${COLORS.success}30`,
  },
  driversText: {
    color: COLORS.success,
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    marginLeft: SPACING.xs,
  },
});

export default MapComponent;
