"use client";

import React, { useState, useEffect } from 'react';
import { Download, Loader } from 'lucide-react';
import api from '@/services/api';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([
    { id: 1, name: 'Sales Report', type: 'sales' },
    { id: 2, name: 'Customer Report', type: 'customers' },
    { id: 3, name: 'Inventory Report', type: 'inventory' },
    { id: 4, name: 'Revenue Report', type: 'revenue' },
  ]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    try {
      const res = await api.get('/reports/stats').catch(() => null);

      if (res?.data) {
        setStats({
          total_reports: res.data.total_reports || 0,
          last_generated: res.data.last_generated || 'Never',
          report_size: res.data.report_size || 'N/A',
        });
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (reportType: string) => {
    setDownloading(reportType);
    try {
      const res = await api.get(`/reports/generate?type=${reportType}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}-report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-gray-500 text-sm">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Reports</h1>
        <p className="text-gray-600 dark:text-neutral-300">Generate and download business reports</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Total Reports Generated</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total_reports || 0}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Last Generated</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{stats?.last_generated || 'Never'}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Report Size</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{stats?.report_size || 'N/A'}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Available Reports</h2>
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-neutral-800 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900">
              <p className="font-semibold text-gray-900 dark:text-white">{report.name}</p>
              <button
                onClick={() => handleDownload(report.type)}
                disabled={downloading === report.type}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg flex items-center gap-2"
              >
                {downloading === report.type ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {downloading === report.type ? 'Downloading...' : 'Download'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
