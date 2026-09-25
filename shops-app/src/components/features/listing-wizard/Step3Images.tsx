"use client";

import React from 'react';
import { ImageUploader } from '../ImageUploader';
import { ListingFormData } from '../ListingWizard';

interface Step3Props {
  data: ListingFormData;
  onUpdate: (data: Partial<ListingFormData>) => void;
  onError: (error: string) => void;
}

export const ListingStep3Images: React.FC<Step3Props> = ({
  data,
  onUpdate,
  onError,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-100 mb-4">
          Add Photos *
        </h3>
        <p className="text-sm text-gray-600 dark:text-neutral-300 mb-4">
          High-quality photos help your listing stand out. Add at least 1 photo, up to 10 maximum.
        </p>

        <ImageUploader
          onImagesUpload={(images) => {
            onUpdate({ images });
            if (images.length === 0) {
              onError('');
            }
          }}
          maxImages={10}
        />
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm mb-2">
          📸 Photo Tips
        </h4>
        <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <li>• Take photos in good lighting</li>
          <li>• Show the item from multiple angles</li>
          <li>• Include any defects or wear</li>
          <li>• Avoid blurry or heavily filtered images</li>
          <li>• First photo appears as thumbnail</li>
        </ul>
      </div>
    </div>
  );
};
