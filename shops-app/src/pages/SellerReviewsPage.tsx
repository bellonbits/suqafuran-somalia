"use client";

import React, { useState, useEffect } from 'react';
import { Star, Loader } from 'lucide-react';
import api from '@/services/api';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviewsData();
  }, []);

  const loadReviewsData = async () => {
    try {
      const res = await api.get('/reviews?limit=100').catch(() => null);

      if (res?.data) {
        const reviewsList = Array.isArray(res.data) ? res.data : [];
        setReviews(reviewsList);

        const totalReviews = reviewsList.length;
        const avgRating = totalReviews > 0
          ? (reviewsList.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / totalReviews).toFixed(1)
          : 0;
        const fiveStarCount = reviewsList.filter((r: any) => r.rating === 5).length;
        const responseRate = totalReviews > 0 ? Math.round((reviewsList.filter((r: any) => r.response).length / totalReviews) * 100) : 0;

        setStats({
          average_rating: avgRating,
          total_reviews: totalReviews,
          five_star_reviews: fiveStarCount,
          response_rate: responseRate,
        });
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-gray-500 text-sm">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Reviews</h1>
        <p className="text-gray-600 dark:text-neutral-300">Manage customer reviews and ratings</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Average Rating</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.average_rating || 0}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Total Reviews</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total_reviews || 0}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">5 Star Reviews</p>
          <p className="text-2xl font-bold text-green-600">{stats?.five_star_reviews || 0}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Response Rate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.response_rate || 0}%</p>
        </div>
      </div>

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No reviews yet</div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="bg-white dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{review.customer_name || 'Anonymous'}</p>
                  <div className="flex gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < (review.rating || 0) ? 'text-orange-500 fill-orange-500' : 'text-gray-300'}`} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString() || 'Recently'}</p>
              </div>
              <p className="text-gray-700 dark:text-neutral-200 text-sm">{review.comment || 'No comment provided'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
