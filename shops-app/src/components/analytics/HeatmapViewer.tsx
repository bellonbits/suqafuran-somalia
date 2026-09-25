"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface ClickData {
  x: number;
  y: number;
  element_id?: string;
  element_type: string;
}

interface HeatmapViewerProps {
  clicks: ClickData[];
  pageWidth: number;
  pageHeight: number;
}

export function HeatmapViewer({ clicks, pageWidth, pageHeight }: HeatmapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!canvasRef.current || !clicks.length) return;

    setIsLoading(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = pageWidth;
    canvas.height = Math.min(pageHeight, 1200); // Cap height for display

    // Create heatmap
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    // Initialize with transparent background
    for (let i = 3; i < data.length; i += 4) {
      data[i] = 0; // alpha
    }

    // Build heatmap from clicks
    clicks.forEach((click) => {
      const x = Math.floor((click.x / pageWidth) * canvas.width);
      const y = Math.floor((click.y / pageHeight) * canvas.height);

      // Draw gaussian blur around click (15px radius)
      const radius = 15;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const px = x + dx;
          const py = y + dy;

          if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const intensity = Math.max(0, 1 - distance / radius);

            const idx = (py * canvas.width + px) * 4;

            // Heatmap colors: blue → green → yellow → red
            if (intensity > 0) {
              if (data[idx + 3] === 0) {
                // First hit
                data[idx] = Math.floor(255 * intensity); // R
                data[idx + 1] = Math.floor(100 * intensity); // G
                data[idx + 2] = Math.floor(200 * (1 - intensity)); // B
                data[idx + 3] = Math.floor(100 * intensity); // A
              } else {
                // Blend with existing
                data[idx] = Math.min(255, data[idx] + Math.floor(100 * intensity));
                data[idx + 1] = Math.min(255, data[idx + 1] + Math.floor(50 * intensity));
                data[idx + 2] = Math.max(0, data[idx + 2] - Math.floor(50 * intensity));
                data[idx + 3] = Math.min(200, data[idx + 3] + Math.floor(50 * intensity));
              }
            }
          }
        }
      }
    });

    ctx.putImageData(imageData, 0, 0);
    setIsLoading(false);
  }, [clicks, pageWidth, pageHeight]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden"
    >
      {isLoading && (
        <div className="flex items-center justify-center h-64 text-slate-400">
          Rendering heatmap...
        </div>
      )}
      <div className="overflow-x-auto bg-black">
        <canvas
          ref={canvasRef}
          className="cursor-crosshair"
          style={{ minWidth: '100%', height: 'auto', display: isLoading ? 'none' : 'block' }}
        />
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-slate-700 flex items-center gap-4 justify-center flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-xs text-slate-300">Low Activity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#02CCFE] rounded"></div>
          <span className="text-xs text-slate-300">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span className="text-xs text-slate-300">High</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-xs text-slate-300">Very High</span>
        </div>
      </div>
    </motion.div>
  );
}
