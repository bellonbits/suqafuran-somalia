"use client";

import React, { useState } from 'react';
import { X, ArrowLeft, Home, Building2, Briefcase, MoreHorizontal, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const GoogleMap = dynamic(() => import('./GoogleMap').then(mod => ({ default: mod.GoogleMap })), {
  ssr: false,
  loading: () => <div className="w-full h-64 bg-gray-200 rounded-2xl flex items-center justify-center"><span className="text-gray-600">Loading map...</span></div>,
});

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  onSelectType: (type: string) => void;
}

const locationTypes = [
  { id: 'house', label: 'House', icon: Home },
  { id: 'apartment', label: 'Apartment', icon: Building2 },
  { id: 'office', label: 'Office', icon: Briefcase },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  address,
  postalCode,
  latitude,
  longitude,
  onSelectType,
}) => {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    onSelectType(typeId);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 min-h-screen"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <h2 className="text-2xl font-black text-gray-900 flex-1 text-center">
            What kind of place is this?
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-900" />
          </button>
        </div>

        {/* Google Map */}
        <div className="mb-8 rounded-2xl overflow-hidden h-64">
          <GoogleMap address={address} latitude={latitude} longitude={longitude} width="100%" height="100%" />
        </div>

        {/* Address Card */}
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <MapPin className="w-6 h-6 text-[#6cd4ff] flex-shrink-0 mt-1" />
            <div>
              <p className="font-bold text-gray-900 text-lg">{postalCode}</p>
              <p className="text-gray-700 font-semibold">{address}</p>
              <p className="text-emerald-600 font-bold mt-1">We'll deliver here!</p>
            </div>
          </div>
        </div>

        {/* Location Type Selection */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {locationTypes.map(({ id, label, icon: Icon }) => (
              <motion.button
                key={id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTypeSelect(id)}
                className={`py-6 px-4 rounded-2xl font-bold text-lg transition-all flex flex-col items-center gap-2 ${
                  selectedType === id
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-6 h-6" />
                {label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Confirm Button */}
        {selectedType && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              onClose();
              // Proceed with delivery
            }}
            className="w-full mt-8 py-4 bg-emerald-600 text-white font-bold rounded-full hover:bg-emerald-700 transition-colors text-lg"
          >
            Confirm Location
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
};
