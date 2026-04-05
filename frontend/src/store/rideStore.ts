import { create } from 'zustand';
import { Location, Ride, RideEstimate, Driver } from '../types';

interface RideState {
  origin: Location | null;
  destination: Location | null;
  selectedCategory: string;
  estimates: RideEstimate[];
  currentRide: Ride | null;
  nearbyDrivers: Driver[];
  isSearching: boolean;
  
  setOrigin: (location: Location | null) => void;
  setDestination: (location: Location | null) => void;
  setSelectedCategory: (category: string) => void;
  setEstimates: (estimates: RideEstimate[]) => void;
  setCurrentRide: (ride: Ride | null) => void;
  setNearbyDrivers: (drivers: Driver[]) => void;
  setIsSearching: (searching: boolean) => void;
  clearRide: () => void;
}

export const useRideStore = create<RideState>((set) => ({
  origin: null,
  destination: null,
  selectedCategory: 'car',
  estimates: [],
  currentRide: null,
  nearbyDrivers: [],
  isSearching: false,

  setOrigin: (origin) => set({ origin }),
  setDestination: (destination) => set({ destination }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setEstimates: (estimates) => set({ estimates }),
  setCurrentRide: (currentRide) => set({ currentRide }),
  setNearbyDrivers: (nearbyDrivers) => set({ nearbyDrivers }),
  setIsSearching: (isSearching) => set({ isSearching }),
  clearRide: () => set({
    origin: null,
    destination: null,
    estimates: [],
    currentRide: null,
    isSearching: false,
  }),
}));
