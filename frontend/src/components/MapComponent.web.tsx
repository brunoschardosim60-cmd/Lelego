import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { useThemeStore } from '../store/themeStore';
import {
  calculateDistanceKm,
  Driver,
  estimateDurationMinutes,
  Location,
} from './mapUtils';
import { getDriverMapIcon, getRouteColorByCategory } from '../constants/driverMapIcons';


const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string;
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAP_ID || undefined;

interface MapComponentProps {
  origin: Location | null;
  destination?: Location | null;
  drivers?: Driver[];
  showRoute?: boolean;
  style?: any;
  onRouteInfo?: (distanceKm: number, durationMin: number) => void;
  routeCategory?: string;
}

// Dark map style matching the app's purple/dark theme
const darkStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f1a' }] },
];

const lightStyle = [
  { elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5f5774' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f3ecff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ecdfff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e8f2ff' }] },
];

// ── Singleton script loader ───────────────────────────────────────────────────
declare global {
  interface Window { google: any; _gmCbs?: (() => void)[]; _gmReady?: () => void; }
}
let _mapUID = 0;

function getBearing(startLat: number, startLng: number, endLat: number, endLng: number): number {
  const lat1 = startLat * Math.PI / 180;
  const lng1 = startLng * Math.PI / 180;
  const lat2 = endLat * Math.PI / 180;
  const lng2 = endLng * Math.PI / 180;
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function loadMapsSDK(cb: () => void) {
  if (typeof window === 'undefined') return;
  if (window.google?.maps) { cb(); return; }
  (window._gmCbs = window._gmCbs || []).push(cb);
  if (document.getElementById('gmap-sdk')) return;
  window._gmReady = () => { window._gmCbs?.forEach(f => f()); window._gmCbs = []; };
  const s = document.createElement('script');
  s.id = 'gmap-sdk';
  s.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=directions&callback=_gmReady&loading=async`;
  document.head.appendChild(s);
}
// ─────────────────────────────────────────────────────────────────────────────

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
  const domId = useRef(`gmap-${++_mapUID}`);
  const gmapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const driverMarkersRef = useRef<Map<any, any>>(new Map());
  const moveIntervalsRef = useRef<Map<any, ReturnType<typeof setInterval>>>(new Map());
  const [sdkReady, setSdkReady] = useState(false);

  const distance = origin && destination
    ? calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng)
    : null;
  const duration = distance ? estimateDurationMinutes(distance) : null;
  const routeColor = getRouteColorByCategory(routeCategory);

  // Load Google Maps JS SDK once
  useEffect(() => {
    loadMapsSDK(() => setSdkReady(true));
  }, []);

  // Initialize map instance after SDK is ready
  useEffect(() => {
    if (!sdkReady || !origin) return;
    const el = document.getElementById(domId.current);
    if (!el || gmapRef.current) return;
    gmapRef.current = new window.google.maps.Map(el, {
      center: { lat: origin.lat, lng: origin.lng },
      zoom: 15,
      styles: isDark ? darkStyle : lightStyle,
      mapId: MAP_ID,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
    });
  }, [sdkReady, origin, isDark]);

  useEffect(() => {
    if (!gmapRef.current) return;
    gmapRef.current.setOptions({
      styles: isDark ? darkStyle : lightStyle,
      backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
    });
  }, [isDark]);

  // Smooth movement helper
  const moveMarkerSmooth = (marker: any, newPos: { lat: number; lng: number }, id: any) => {
    const existing = moveIntervalsRef.current.get(id);
    if (existing) clearInterval(existing);
    const start = marker.getPosition();
    if (!start) { marker.setPosition(newPos); return; }
    let step = 0;
    const steps = 40;
    const interval = setInterval(() => {
      step++;
      const t = step / steps;
      marker.setPosition({
        lat: start.lat() + (newPos.lat - start.lat()) * t,
        lng: start.lng() + (newPos.lng - start.lng()) * t,
      });
      if (step >= steps) {
        clearInterval(interval);
        moveIntervalsRef.current.delete(id);
      }
    }, 20);
    moveIntervalsRef.current.set(id, interval);
  };

  // Static markers: origin, destination, route
  useEffect(() => {
    if (!gmapRef.current || !origin) return;
    const map = gmapRef.current;
    const G = window.google.maps;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (routeRef.current) { routeRef.current.setMap(null); routeRef.current = null; }
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    // Origin marker (purple circle)
    markersRef.current.push(new G.Marker({
      map,
      position: { lat: origin.lat, lng: origin.lng },
      icon: {
        path: G.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#8B5CF6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      zIndex: 10,
    }));

    if (destination && showRoute) {
      markersRef.current.push(new G.Marker({
        map,
        position: { lat: destination.lat, lng: destination.lng },
        icon: {
          path: G.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#EC4899',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1,
        },
        zIndex: 10,
      }));

      // Real route via Directions API
      const directionsService = new G.DirectionsService();
      directionsRendererRef.current = new G.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: routeColor,
          strokeWeight: 4,
          strokeOpacity: 0.9,
        },
      });
      directionsRendererRef.current.setMap(map);

      directionsService.route(
        {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: G.TravelMode.DRIVING,
        },
        (result: any, status: string) => {
          if (status === 'OK') {
            directionsRendererRef.current?.setDirections(result);
            const leg = result.routes[0].legs[0];
            onRouteInfo?.(leg.distance.value / 1000, leg.duration.value / 60);
          } else {
            // Fallback: straight line
            routeRef.current = new G.Polyline({
              map,
              path: [
                { lat: origin.lat, lng: origin.lng },
                { lat: destination.lat, lng: destination.lng },
              ],
              strokeColor: routeColor,
              strokeWeight: 4,
              strokeOpacity: 0.9,
              geodesic: true,
            });
          }
          const bounds = new G.LatLngBounds();
          bounds.extend({ lat: origin.lat, lng: origin.lng });
          bounds.extend({ lat: destination.lat, lng: destination.lng });
          map.fitBounds(bounds, { top: 80, right: 40, bottom: 100, left: 40 });
        }
      );
    } else {
      map.panTo({ lat: origin.lat, lng: origin.lng });
    }
  }, [origin, destination, showRoute, sdkReady, routeColor, onRouteInfo]);

  // Driver markers: persistent by ID with smooth movement
  useEffect(() => {
    if (!gmapRef.current || !sdkReady) return;
    const map = gmapRef.current;
    const G = window.google.maps;

    const currentIds = new Set(drivers.map(d => d.id ?? `${d.lat}_${d.lng}`));

    // Remove markers for drivers no longer present
    driverMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        driverMarkersRef.current.delete(id);
        const iv = moveIntervalsRef.current.get(id);
        if (iv) { clearInterval(iv); moveIntervalsRef.current.delete(id); }
      }
    });

    drivers.slice(0, 10).forEach(d => {
      if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return;
      const id = d.id ?? `${d.lat}_${d.lng}`;
      const iconConfig = getDriverMapIcon(d.vehicle_type ?? d.type);
      const icon = {
        url: iconConfig.iconUrl,
        scaledSize: new G.Size(40, 40),
        anchor: new G.Point(20, 20),
      };

      if (driverMarkersRef.current.has(id)) {
        const marker = driverMarkersRef.current.get(id);
        // Rotate icon based on direction before moving
        const pos = marker.getPosition();
        if (pos) {
          const angle = getBearing(pos.lat(), pos.lng(), d.lat, d.lng);
          if (angle > 0) marker.setIcon({ ...icon });
        }
        moveMarkerSmooth(marker, { lat: d.lat, lng: d.lng }, id);
      } else {
        const marker = new G.Marker({
          map,
          position: { lat: d.lat, lng: d.lng },
          icon,
          title: d.name ?? 'Motorista',
          zIndex: 5,
        });
        driverMarkersRef.current.set(id, marker);
      }
    });
  }, [drivers, sdkReady]);

  // Cleanup intervals on unmount
  useEffect(() => {
    const intervals = moveIntervalsRef.current;
    const markers = driverMarkersRef.current;
    return () => {
      intervals.forEach(iv => clearInterval(iv));
      markers.forEach(m => m.setMap(null));
    };
  }, []);

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

  return (
    <View style={[styles.container, style]}>
      {/* Loading overlay until SDK is ready */}
      {!sdkReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}

      {/* Google Maps mounts into this native div */}
      {React.createElement('div', {
        id: domId.current,
        style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
      })}

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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
