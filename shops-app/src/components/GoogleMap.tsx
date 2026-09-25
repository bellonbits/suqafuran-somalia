"use client";

import React, { useEffect, useRef } from 'react';

interface GoogleMapProps {
  address?: string;
  latitude?: number;
  longitude?: number;
  width?: string;
  height?: string;
  className?: string;
}

export const GoogleMap: React.FC<GoogleMapProps> = ({
  address = "Africa",
  latitude,
  longitude,
  width = "100%",
  height = "100%",
  className = "",
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    // Initialize map when component mounts
    if (!mapRef.current) return;

    // Use provided coordinates or default to East Africa
    const center = latitude && longitude
      ? { lat: latitude, lng: longitude }
      : { lat: 5.0, lng: 46.0 };

    // Load Google Maps script if not already loaded
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initializeMap();
      };
      document.head.appendChild(script);
    } else {
      initializeMap();
    }

    function initializeMap() {
      if (!mapRef.current) return;

      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        zoom: latitude && longitude ? 15 : 6,
        center: center,
        styles: [
          {
            featureType: "all",
            elementType: "labels.text.fill",
            stylers: [{ color: "#616161" }],
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#e9e9e9" }],
          },
        ],
      });

      // Remove old marker if exists
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      // Add a marker for the location
      markerRef.current = new google.maps.Marker({
        position: center,
        map: mapInstanceRef.current,
        title: address || "Delivery location",
        icon: latitude && longitude
          ? 'http://maps.google.com/mapfiles/ms/icons/0277BD.png'
          : 'http://maps.google.com/mapfiles/ms/icons/9e9e9e.png',
      });
    }
  }, [latitude, longitude, address]);

  return (
    <div
      ref={mapRef}
      className={`bg-gray-200 rounded-2xl overflow-hidden ${className}`}
      style={{ width, height }}
    />
  );
};
