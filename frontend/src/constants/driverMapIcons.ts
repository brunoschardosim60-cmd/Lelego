export type DriverVehicleType = 'car' | 'moto' | 'comfort' | 'women' | 'default';

export interface DriverMapIconConfig {
  // Label is used on web markers.
  label: string;
  // Ionicons name is used on native markers.
  iconName: string;
  color: string;
  // Image URL is used by Google Maps web and native marker image mode.
  iconUrl: string;
  // Route color by selected ride category.
  routeColor: string;
}

// Central place to customize driver icons shown on the map.
export const DRIVER_MAP_ICONS: Record<DriverVehicleType, DriverMapIconConfig> = {
  car: {
    label: '🚗',
    iconName: 'car',
    color: '#111111',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/744/744465.png',
    routeColor: '#111111',
  },
  moto: {
    label: '🛵',
    iconName: 'bicycle',
    color: '#F59E0B',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png',
    routeColor: '#16A34A',
  },
  comfort: {
    label: '🚙',
    iconName: 'car-sport',
    color: '#0EA5E9',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
    routeColor: '#7C3AED',
  },
  women: {
    label: '🚘',
    iconName: 'woman',
    color: '#EC4899',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/194/194938.png',
    routeColor: '#EC4899',
  },
  default: {
    label: '🚕',
    iconName: 'car-outline',
    color: '#111111',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/744/744465.png',
    routeColor: '#111111',
  },
};

export const normalizeVehicleType = (vehicleType?: string): DriverVehicleType => {
  const value = (vehicleType || '').toLowerCase().trim();

  if (['moto', 'motorcycle', 'bike'].includes(value)) return 'moto';
  if (['car', 'carro', 'sedan', 'uberx'].includes(value)) return 'car';
  if (['comfort', 'executive', 'premium'].includes(value)) return 'comfort';
  if (['women', 'female', 'mulher', 'mulheres'].includes(value)) return 'women';

  if (value === 'car' || value === 'moto' || value === 'comfort' || value === 'women') {
    return value;
  }

  return 'default';
};

export const getDriverMapIcon = (vehicleType?: string): DriverMapIconConfig => {
  return DRIVER_MAP_ICONS[normalizeVehicleType(vehicleType)];
};

export const getRouteColorByCategory = (category?: string): string => {
  return DRIVER_MAP_ICONS[normalizeVehicleType(category)].routeColor;
};

export const getDriverMapWebLabel = (vehicleType?: string): string => {
  const normalized = normalizeVehicleType(vehicleType);
  if (normalized === 'moto') return 'MOTO';
  if (normalized === 'car') return 'CAR';
  if (normalized === 'comfort') return 'CFT';
  if (normalized === 'women') return 'ELA';
  return 'DR';
};
