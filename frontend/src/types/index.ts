export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  role: string;
  score?: number;
}

export interface RideCategory {
  id: string;
  name: string;
  description: string;
  price_per_km: number;
  price_per_minute: number;
  base_fee: number;
  icon: string;
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface RideEstimate {
  category: string;
  distance_km: number;
  duration_min: number;
  price: number;
}

export interface Ride {
  id: string;
  passenger_id: string;
  driver_id?: string;
  origin_lat: number;
  origin_lng: number;
  origin_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  category: string;
  distance_km: number;
  duration_min: number;
  estimated_price: number;
  final_price?: number;
  status: RideStatus;
  payment_method: string;
  payment_status: string;
  created_at: string;
  accepted_at?: string;
  arrived_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  driver?: Driver;
}

export type RideStatus = 
  | 'searching_driver'
  | 'driver_assigned'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  score: number;
  vehicle_type?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  vehicle_color?: string;
  lat?: number;
  lng?: number;
  heading?: number;
}

export interface Payment {
  id: string;
  ride_id: string;
  method: string;
  amount: number;
  status: string;
  pix_code?: string;
  pix_qr?: string;
}

export interface Rating {
  id: string;
  ride_id: string;
  from_user_id: string;
  to_user_id: string;
  score: number;
  comment?: string;
}
