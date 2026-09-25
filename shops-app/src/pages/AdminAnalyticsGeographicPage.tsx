"use client";

import React, { useState, useEffect } from 'react';
import { MapPin, TrendingUp, Calendar, RefreshCw, Users, Globe } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs';

interface CityData {
  city: string;
  latitude: number;
  longitude: number;
  country: string;
  visitor_count: number;
  unique_users: number;
}

interface CountryData {
  country: string;
  visitor_count: number;
  unique_users: number;
}

// Shared intensity scale so the map markers, city table, and country cards
// all read the same "how busy is this place" language at a glance.
const INTENSITY_LEVELS = [
  { label: 'Low', threshold: 0, color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  { label: 'Medium', threshold: 0.25, color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  { label: 'High', threshold: 0.5, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  { label: 'Very High', threshold: 0.75, color: '#ef4444', bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
] as const;

function getIntensity(count: number, max: number) {
  const ratio = max > 0 ? count / max : 0;
  let level = INTENSITY_LEVELS[0];
  for (const l of INTENSITY_LEVELS) {
    if (ratio >= l.threshold) level = l;
  }
  return { ...level, ratio };
}

export default function GeographicAnalytics() {
  const [cities, setCities] = useState<CityData[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.body.appendChild(script);
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await analyticsService.getGeographicAnalytics(days);
      const citiesData = res.data?.cities || [];
      setCities(citiesData);
      setCountries(res.data?.countries || []);
      setLastRefresh(new Date());

      if (mapLoaded) {
        drawMap(citiesData);
      }
    } catch (error) {
      console.error('Failed to fetch geographic analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const drawMap = (citiesData: CityData[]) => {
    const mapElement = document.getElementById('analytics-map');
    if (!mapElement || typeof (window as any).google === 'undefined') return;

    // Default center (world view)
    let center = { lat: 20, lng: 0 };
    let zoom = 2;

    // If there's data, center on average location
    if (citiesData.length > 0) {
      const avgLat = citiesData.reduce((sum, c) => sum + c.latitude, 0) / citiesData.length;
      const avgLng = citiesData.reduce((sum, c) => sum + c.longitude, 0) / citiesData.length;
      center = { lat: avgLat, lng: avgLng };
      zoom = 6;
    }

    const map = new (window as any).google.maps.Map(mapElement, {
      zoom,
      center,
      styles: [
        {
          featureType: 'all',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#616161' }],
        },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#e9e9e9' }],
        },
      ],
    });

    // Only add markers if there's data
    if (citiesData.length > 0) {
      const maxVisitors = Math.max(...citiesData.map(c => c.visitor_count));

      citiesData.forEach((city) => {
        const scale = Math.max(8, Math.min(26, (city.visitor_count / maxVisitors) * 26));
        const intensity = getIntensity(city.visitor_count, maxVisitors);

        const marker = new (window as any).google.maps.Marker({
          position: { lat: city.latitude, lng: city.longitude },
          map,
          title: `${city.city} — ${city.visitor_count} visitors (${intensity.label})`,
          icon: {
            path: (window as any).google.maps.SymbolPath.CIRCLE,
            scale,
            fillColor: intensity.color,
            fillOpacity: 0.85,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        });

        const infoWindow = new (window as any).google.maps.InfoWindow({
          content: `
            <div style="font-family: system-ui;">
              <strong>${city.city}, ${city.country}</strong><br/>
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${intensity.color};margin-right:4px;"></span>${intensity.label} traffic<br/>
              Visitors: ${city.visitor_count}<br/>
              Unique Users: ${city.unique_users}
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
          setSelectedCity(city);
        });
      });
    }
  };

  useEffect(() => {
    if (mapLoaded) {
      fetchAnalytics();
    }
  }, [days, mapLoaded]);

  const navItems = ADMIN_NAV_ITEMS.map(item => ({
    ...item,
    icon: <item.icon className="w-5 h-5" />
  }));

  return (
    <DashboardLayout title="Realtime Analytics" navItems={navItems} userRole="admin">
    <AnalyticsTabs />
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-900/40 dark:bg-black">
      <div className="sticky top-0 z-30 bg-white dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white dark:text-white">Geographic Analytics</h1>
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600 dark:text-neutral-200 dark:text-neutral-300" />
            <label className="text-sm font-semibold text-slate-900 dark:text-white dark:text-white">Period:</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white dark:text-white"
            >
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          {lastRefresh && (
            <span className="text-xs text-slate-400 dark:text-neutral-400 ml-auto">
              Last: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 overflow-hidden">
          <div id="analytics-map" style={{ width: '100%', height: '500px' }} />
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50">
              <p className="text-slate-600 dark:text-neutral-200">Loading map...</p>
            </div>
          )}
          {cities.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40">
              <span className="text-xs font-bold text-slate-500 dark:text-neutral-400">Traffic:</span>
              {INTENSITY_LEVELS.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-neutral-300">
                  <span className={`w-2.5 h-2.5 rounded-full ${l.dot}`} />
                  {l.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {cities.length > 0 && (
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 dark:border-neutral-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white dark:text-white">Visitors by City</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-neutral-900/40 dark:bg-neutral-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200 dark:text-neutral-200">City</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200 dark:text-neutral-200">Country</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200 dark:text-neutral-200">Visitors</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200 dark:text-neutral-200">Users</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200 dark:text-neutral-200">Traffic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {(() => {
                    const maxVisitors = Math.max(...cities.map((c) => c.visitor_count), 1);
                    return cities.map((city, idx) => {
                      const intensity = getIntensity(city.visitor_count, maxVisitors);
                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedCity(city)}
                          className={`hover:bg-slate-50 dark:hover:bg-neutral-900 cursor-pointer ${selectedCity?.city === city.city ? intensity.bg : ''}`}
                        >
                          <td className="px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white dark:text-white">{city.city}</td>
                          <td className="px-6 py-3 text-sm text-slate-900 dark:text-white dark:text-white">{city.country}</td>
                          <td className="px-6 py-3 text-sm font-bold text-blue-600">{city.visitor_count.toLocaleString()}</td>
                          <td className="px-6 py-3 text-sm text-slate-900 dark:text-white dark:text-white">{city.unique_users}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${intensity.bg} ${intensity.text}`}>
                                {intensity.label}
                              </span>
                              <div className="w-16 h-1.5 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${intensity.dot}`}
                                  style={{ width: `${Math.max(6, intensity.ratio * 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {countries.length > 0 && (
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 dark:border-neutral-800 flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white dark:text-white">Visitors by Country</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {(() => {
                const maxVisitors = Math.max(...countries.map((c) => c.visitor_count), 1);
                return countries.map((country, idx) => {
                  const intensity = getIntensity(country.visitor_count, maxVisitors);
                  return (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50 dark:bg-neutral-900/40 dark:bg-neutral-900 rounded-lg border-l-4"
                      style={{ borderLeftColor: intensity.color }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white dark:text-white">{country.country}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${intensity.bg} ${intensity.text}`}>
                          {intensity.label}
                        </span>
                      </div>
                      <p className="text-2xl font-black text-purple-600 mt-2">{country.visitor_count.toLocaleString()}</p>
                      <p className="text-xs text-slate-400 dark:text-neutral-300 mt-1">{country.unique_users} unique</p>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
