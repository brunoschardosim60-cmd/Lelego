import axios, { isAxiosError } from 'axios';
import { authStorage } from '../utils/authStorage';
import { Driver, Ride, RideEstimate, User } from '../types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://realtime-matching.preview.emergentagent.com';
const IS_LOCAL_DEV_BACKEND = /localhost|127\.0\.0\.1/i.test(BACKEND_URL);

type ApiResult<T> = Promise<{ data: T }>;

type RideRequestPayload = {
  origin_lat: number;
  origin_lng: number;
  origin_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  category: string;
};

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await authStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await authStorage.removeItem('token');
      await authStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

const LOCAL_DEV_USERS: Record<string, User & { password: string; driver_online?: boolean }> = {
  'admin@letsgo.local': {
    id: 'admin-1',
    name: 'Bruno Admin',
    email: 'admin@letsgo.local',
    phone: '00000000000',
    gender: 'male',
    role: 'admin',
    cpf: '08818900579',
    password: 'Aa1234@Lets',
    driver_online: false,
  } as User & { password: string; driver_online?: boolean },
  'brunoschardosim60@gmail.com': {
    id: 'user-1',
    name: 'Bruno Usuario',
    email: 'brunoschardosim60@gmail.com',
    phone: '11999999999',
    gender: 'male',
    role: 'passenger',
    cpf: '52998224725',
    password: 'Aa1234@Lets',
    driver_online: false,
  } as User & { password: string; driver_online?: boolean },
};

let mockDriverOnline = false;
let mockHistory: Ride[] = [];
let mockActiveRide: Ride | null = null;
let mockAvailableRides: Ride[] = [
  {
    id: 'ride-local-1',
    passenger_id: 'passenger-local-1',
    origin_lat: -23.55052,
    origin_lng: -46.633308,
    origin_address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    destination_lat: -23.561414,
    destination_lng: -46.655881,
    destination_address: 'Shopping Eldorado, São Paulo - SP',
    category: 'car',
    distance_km: 6.4,
    duration_min: 18,
    estimated_price: 24.9,
    status: 'searching_driver',
    payment_method: 'card',
    payment_status: 'pending',
    created_at: new Date().toISOString(),
  },
  {
    id: 'ride-local-2',
    passenger_id: 'passenger-local-2',
    origin_lat: -23.5489,
    origin_lng: -46.6388,
    origin_address: 'Rua da Consolação, 900 - Consolação, São Paulo - SP',
    destination_lat: -23.5881,
    destination_lng: -46.6844,
    destination_address: 'Morumbi Shopping, São Paulo - SP',
    category: 'moto',
    distance_km: 8.2,
    duration_min: 21,
    estimated_price: 19.4,
    status: 'searching_driver',
    payment_method: 'pix',
    payment_status: 'pending',
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
];

const mockNearbyDrivers: Driver[] = [
  {
    id: 'driver-local-1',
    name: 'Carlos Silva',
    phone: '(11) 99999-0001',
    score: 985,
    vehicle_type: 'car',
    vehicle_model: 'Toyota Corolla',
    vehicle_plate: 'ABC-1234',
    vehicle_color: 'Prata',
    lat: -23.5512,
    lng: -46.6342,
    heading: 35,
  },
  {
    id: 'driver-local-2',
    name: 'Marina Souza',
    phone: '(11) 99999-0002',
    score: 972,
    vehicle_type: 'moto',
    vehicle_model: 'Honda PCX',
    vehicle_plate: 'DEF-5678',
    vehicle_color: 'Preta',
    lat: -23.553,
    lng: -46.6319,
    heading: 290,
  },
];

const categories = [
  { id: 'moto', multiplier: 0.75 },
  { id: 'car', multiplier: 1 },
  { id: 'comfort', multiplier: 1.35 },
  { id: 'women', multiplier: 1.15 },
];

function responseOf<T>(data: T): ApiResult<T> {
  return Promise.resolve({ data });
}

function shouldUseLocalFallback(error: unknown): boolean {
  if (!IS_LOCAL_DEV_BACKEND) {
    return false;
  }

  if (!isAxiosError(error)) {
    return true;
  }

  const status = error.response?.status;
  return !status || status === 404 || status >= 500;
}

function distanceInKm(originLat: number, originLng: number, destinationLat: number, destinationLng: number) {
  const earthRadiusKm = 6371;
  const dLat = ((destinationLat - originLat) * Math.PI) / 180;
  const dLng = ((destinationLng - originLng) * Math.PI) / 180;
  const lat1 = (originLat * Math.PI) / 180;
  const lat2 = (destinationLat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildEstimate(data: RideRequestPayload, category: string): RideEstimate {
  const distance_km = Math.max(distanceInKm(data.origin_lat, data.origin_lng, data.destination_lat, data.destination_lng), 1.2);
  const duration_min = Math.max(Math.round(distance_km * 3.4), 6);
  const multiplier = categories.find((item) => item.id === category)?.multiplier ?? 1;
  const price = Number((4.5 + distance_km * 2.6 + duration_min * 0.45) * multiplier).toFixed(2);

  return {
    category,
    distance_km: Number(distance_km.toFixed(1)),
    duration_min,
    price: Number(price),
  };
}

function buildRide(data: RideRequestPayload, overrides?: Partial<Ride>): Ride {
  const estimate = buildEstimate(data, data.category);
  return {
    id: overrides?.id || `ride-${Date.now()}`,
    passenger_id: overrides?.passenger_id || 'user-1',
    driver_id: overrides?.driver_id,
    origin_lat: data.origin_lat,
    origin_lng: data.origin_lng,
    origin_address: data.origin_address,
    destination_lat: data.destination_lat,
    destination_lng: data.destination_lng,
    destination_address: data.destination_address,
    category: data.category,
    distance_km: estimate.distance_km,
    duration_min: estimate.duration_min,
    estimated_price: estimate.price,
    final_price: overrides?.final_price,
    status: overrides?.status || 'searching_driver',
    payment_method: overrides?.payment_method || 'card',
    payment_status: overrides?.payment_status || 'pending',
    created_at: overrides?.created_at || new Date().toISOString(),
    driver: overrides?.driver,
    accepted_at: overrides?.accepted_at,
    arrived_at: overrides?.arrived_at,
    started_at: overrides?.started_at,
    completed_at: overrides?.completed_at,
    cancelled_at: overrides?.cancelled_at,
    cancelled_by: overrides?.cancelled_by,
  };
}

async function getStoredUser(): Promise<User | null> {
  const rawUser = await authStorage.getItem('user');
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as User;
  } catch {
    return null;
  }
}

async function getLocalProfile() {
  const storedUser = await getStoredUser();
  if (!storedUser) {
    return null;
  }

  return {
    ...storedUser,
    driver_online: mockDriverOnline,
  };
}

async function loginLocalUser(data: { email: string; password: string; login_as?: 'driver' | 'passenger' }) {
  const userRecord = LOCAL_DEV_USERS[data.email.trim().toLowerCase()];
  if (!userRecord || userRecord.password !== data.password) {
    const error = new Error('Email ou senha inválidos');
    (error as Error & { response?: { data?: { detail: string } } }).response = {
      data: { detail: 'Email ou senha inválidos' },
    };
    throw error;
  }

  const role =
    userRecord.email === 'brunoschardosim60@gmail.com' && data.login_as === 'driver'
      ? 'driver'
      : userRecord.role;

  return responseOf({
    access_token: `local-dev-token-${userRecord.id}`,
    token_type: 'bearer',
    user: {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      phone: userRecord.phone,
      gender: userRecord.gender,
      role,
    },
  });
}

// Auth APIs
export const authAPI = {
  register: async (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    gender: string;
    cpf: string;
  }) => {
    try {
      return await api.post('/auth/register', data);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      LOCAL_DEV_USERS[data.email.trim().toLowerCase()] = {
        id: `user-${Date.now()}`,
        name: data.name,
        email: data.email.trim().toLowerCase(),
        phone: data.phone,
        gender: data.gender,
        role: 'passenger',
        cpf: data.cpf,
        password: data.password,
        driver_online: false,
      } as User & { password: string; driver_online?: boolean };

      return loginLocalUser({ email: data.email, password: data.password });
    }
  },

  login: async (data: { email: string; password: string; login_as?: 'driver' | 'passenger' }) => {
    try {
      return await api.post('/auth/login', data);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }
      return loginLocalUser(data);
    }
  },

  getMe: async () => {
    try {
      return await api.get('/auth/me');
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      const profile = await getLocalProfile();
      return responseOf(profile);
    }
  },
};

// Ride APIs
export const rideAPI = {
  getCategories: () => api.get('/rides/categories'),

  estimate: async (data: RideRequestPayload) => {
    try {
      return await api.post('/rides/estimate', data);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      return responseOf(categories.map((category) => buildEstimate(data, category.id)));
    }
  },

  request: async (data: RideRequestPayload) => {
    try {
      return await api.post('/rides/request', data);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      mockActiveRide = buildRide(data, { status: 'searching_driver' });
      return responseOf(mockActiveRide);
    }
  },

  getActiveRide: async () => {
    try {
      return await api.get('/rides/active/current');
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      return responseOf(mockActiveRide);
    }
  },

  getRide: async (rideId: string) => {
    try {
      return await api.get(`/rides/${rideId}`);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      const ride = [mockActiveRide, ...mockAvailableRides, ...mockHistory].find((item) => item?.id === rideId) || null;
      return responseOf(ride);
    }
  },

  cancelRide: async (rideId: string) => {
    try {
      return await api.post(`/rides/${rideId}/cancel`);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      if (mockActiveRide?.id === rideId) {
        const cancelledRide = {
          ...mockActiveRide,
          status: 'cancelled' as const,
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'user',
        };
        mockHistory = [cancelledRide, ...mockHistory];
        mockActiveRide = null;
        return responseOf(cancelledRide);
      }

      return responseOf({ success: true });
    }
  },

  getHistory: async () => {
    try {
      return await api.get('/rides/history/list');
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      return responseOf(mockHistory);
    }
  },
};

// Driver APIs
export const driverAPI = {
  getNearby: async (lat: number, lng: number, radius: number = 5) => {
    try {
      return await api.get(`/drivers/nearby?lat=${lat}&lng=${lng}&radius_km=${radius}`);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      return responseOf(
        mockNearbyDrivers.filter((driver) => {
          if (typeof driver.lat !== 'number' || typeof driver.lng !== 'number') {
            return false;
          }
          return distanceInKm(lat, lng, driver.lat, driver.lng) <= radius;
        })
      );
    }
  },

  getStats: async () => {
    try {
      return await api.get('/driver/stats');
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      const completedRides = mockHistory.filter((ride) => ride.status === 'completed');
      const totalEarned = completedRides.reduce((sum, ride) => sum + (ride.final_price || ride.estimated_price || 0), 0);
      const today = new Date().toDateString();
      const todayCompleted = completedRides.filter((ride) => new Date(ride.created_at).toDateString() === today);

      return responseOf({
        today_earnings: todayCompleted.reduce((sum, ride) => sum + (ride.final_price || ride.estimated_price || 0), 0),
        month_earnings: totalEarned,
        total_rides: completedRides.length,
        today_rides: todayCompleted.length,
      });
    }
  },

  getProfile: async () => {
    try {
      return await api.get('/auth/me');
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      return responseOf(await getLocalProfile());
    }
  },

  getAvailableRides: async () => {
    try {
      return await api.get('/driver/rides/available');
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      return responseOf(mockAvailableRides);
    }
  },

  toggleOnline: async () => {
    try {
      return await api.post('/driver/toggle-online');
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      mockDriverOnline = !mockDriverOnline;
      return responseOf({ driver_online: mockDriverOnline });
    }
  },

  updateLocation: async (lat: number, lng: number, heading: number = 0) => {
    try {
      return await api.post(`/driver/location?lat=${lat}&lng=${lng}&heading=${heading}`);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      return responseOf({ lat, lng, heading, driver_online: mockDriverOnline });
    }
  },

  acceptRide: async (rideId: string) => {
    try {
      return await api.post(`/driver/rides/${rideId}/accept`);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      const ride = mockAvailableRides.find((item) => item.id === rideId);
      if (!ride) {
        throw error;
      }

      mockAvailableRides = mockAvailableRides.filter((item) => item.id !== rideId);
      mockActiveRide = {
        ...ride,
        status: 'driver_assigned',
        driver_id: 'driver-local-1',
        driver: mockNearbyDrivers[0],
        accepted_at: new Date().toISOString(),
      };
      return responseOf(mockActiveRide);
    }
  },

  arriveRide: async (rideId: string) => {
    try {
      return await api.post(`/driver/rides/${rideId}/arrive`);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      if (mockActiveRide?.id === rideId) {
        mockActiveRide = {
          ...mockActiveRide,
          status: 'driver_arrived',
          arrived_at: new Date().toISOString(),
        };
      }
      return responseOf(mockActiveRide);
    }
  },

  startRide: async (rideId: string) => {
    try {
      return await api.post(`/driver/rides/${rideId}/start`);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      if (mockActiveRide?.id === rideId) {
        mockActiveRide = {
          ...mockActiveRide,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        };
      }
      return responseOf(mockActiveRide);
    }
  },

  completeRide: async (rideId: string) => {
    try {
      return await api.post(`/driver/rides/${rideId}/complete`);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      if (mockActiveRide?.id === rideId) {
        const completedRide = {
          ...mockActiveRide,
          status: 'completed' as const,
          final_price: mockActiveRide.estimated_price,
          completed_at: new Date().toISOString(),
        };
        mockHistory = [completedRide, ...mockHistory];
        mockActiveRide = null;
        return responseOf(completedRide);
      }

      return responseOf({ success: true });
    }
  },
};

// Payment APIs
export const paymentAPI = {
  getMethods: () => api.get('/payments/methods'),

  authorize: async (rideId: string, method: string) => {
    try {
      return await api.post(`/payments/authorize?ride_id=${rideId}&method=${method}`);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      return responseOf({ id: `payment-${rideId}`, method, status: 'authorized' });
    }
  },

  capture: async (paymentId: string) => {
    try {
      return await api.post(`/payments/${paymentId}/capture`);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      return responseOf({ id: paymentId, status: 'captured' });
    }
  },
};

// Rating APIs
export const ratingAPI = {
  create: async (data: {
    ride_id: string;
    to_user_id: string;
    score: number;
    comment?: string;
  }) => {
    try {
      return await api.post('/ratings', data);
    } catch (error) {
      if (!shouldUseLocalFallback(error)) {
        throw error;
      }

      return responseOf({ ...data, id: `rating-${Date.now()}` });
    }
  },
};

export default api;
