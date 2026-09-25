"use client";

import React, { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { imageService } from '../../services/imageService';

import { resolveMediaUrl } from '../../services/api';

interface ImageUploaderProps {
  onImagesUpload: (images: Array<{ url: string; filename: string }>) => void;
  maxImages?: number;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImagesUpload,
  maxImages = 10,
  disabled = false,
}) => {
  const [images, setImages] = useState<Array<{ url: string; filename: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (images.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const uploadedImages = await imageService.uploadMultipleImages(files);
      const newImages = [...images, ...uploadedImages];
      setImages(newImages);
      onImagesUpload(newImages);
    } catch (err) {
      setError('Failed to upload images. Please try again.');
      console.error('Image upload error:', err);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesUpload(newImages);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        imageFiles.forEach((f) => dataTransfer.items.add(f));
        input.files = dataTransfer.files;
        handleFileSelect({ target: input } as any);
      }
    }
  };

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          loading || disabled
            ? 'border-gray-300 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-950/50'
            : 'border-blue-300 dark:border-blue-700 hover:border-blue-400 cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          disabled={loading || disabled}
          className="hidden"
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-[#5bc0e8] animate-spin" />
            <p className="text-sm text-gray-600 dark:text-neutral-300">Uploading...</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex flex-col items-center gap-3"
          >
            <Upload className="h-8 w-8 text-[#5bc0e8] dark:text-[#6cd4ff]" />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-300 mt-1">
                PNG, JPG, GIF up to 10MB each ({images.length}/{maxImages})
              </p>
            </div>
          </button>
        )}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </motion.div>
      )}

      {images.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-3">
            Uploaded Images ({images.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group"
              >
                <img
                  src={resolveMediaUrl(image.url) || image.url}
                  alt={`Upload preview ${index + 1}`}
                  className="w-full aspect-square rounded-lg object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
