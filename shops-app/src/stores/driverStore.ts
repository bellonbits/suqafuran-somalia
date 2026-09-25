import { create } from 'zustand';
import { DriverProfile, JobOffer, ActiveDelivery, DriverWallet } from '@/services/driver';

interface DriverState {
  // Profile
  profile: DriverProfile | null;
  setProfile: (profile: DriverProfile | null) => void;

  // Location
  currentLocation: { lat: number; lng: number; heading?: number } | null;
  setLocation: (lat: number, lng: number, heading?: number) => void;

  // Job Offers
  offers: JobOffer[];
  setOffers: (offers: JobOffer[]) => void;
  addOffer: (offer: JobOffer) => void;
  removeOffer: (offerId: string) => void;

  // Active Deliveries
  activeDeliveries: ActiveDelivery[];
  setActiveDeliveries: (deliveries: ActiveDelivery[]) => void;
  updateDelivery: (delivery: ActiveDelivery) => void;
  removeDelivery: (deliveryId: string) => void;

  // Wallet
  wallet: DriverWallet | null;
  setWallet: (wallet: DriverWallet) => void;

  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  selectedDeliveryId: string | null;
  setSelectedDeliveryId: (id: string | null) => void;
  mapCenter: { lat: number; lng: number } | null;
  setMapCenter: (center: { lat: number; lng: number }) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  // Profile
  profile: null,
  setProfile: (profile) => set({ profile }),

  // Location
  currentLocation: null,
  setLocation: (lat, lng, heading) => set({ currentLocation: { lat, lng, heading } }),

  // Job Offers
  offers: [],
  setOffers: (offers) => set({ offers }),
  addOffer: (offer) => set((state) => ({ offers: [offer, ...state.offers] })),
  removeOffer: (offerId) =>
    set((state) => ({
      offers: state.offers.filter((o) => o.id !== offerId),
    })),

  // Active Deliveries
  activeDeliveries: [],
  setActiveDeliveries: (deliveries) => set({ activeDeliveries: deliveries }),
  updateDelivery: (delivery) =>
    set((state) => ({
      activeDeliveries: state.activeDeliveries.map((d) =>
        d.id === delivery.id ? delivery : d
      ),
    })),
  removeDelivery: (deliveryId) =>
    set((state) => ({
      activeDeliveries: state.activeDeliveries.filter((d) => d.id !== deliveryId),
    })),

  // Wallet
  wallet: null,
  setWallet: (wallet) => set({ wallet }),

  // UI State
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  selectedDeliveryId: null,
  setSelectedDeliveryId: (id) => set({ selectedDeliveryId: id }),
  mapCenter: null,
  setMapCenter: (center) => set({ mapCenter: center }),
  zoom: 15,
  setZoom: (zoom) => set({ zoom }),
}));
