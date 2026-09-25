"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageSquare, Search, Filter, ArrowLeft, MoreVertical, Phone, Mail, Loader } from 'lucide-react';
import api from '@/services/api';

export default function AgentInquiriesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const res = await api.get('/support/tickets');
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(t =>
    (t.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-[#6cd4ff]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="bg-slate-800 border-b border-slate-700 p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/agent-dashboard" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <h1 className="text-3xl font-black text-white">Inquiries</h1>
          <span className="ml-auto px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-bold">
            {tickets.filter(t => t.status === 'open').length} Open
          </span>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search inquiries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#6cd4ff]"
            />
          </div>
          <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition-colors">
            <Filter className="w-5 h-5" />
            Filter
          </button>
        </div>
      </div>

      <div className="p-6">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-lg">
            <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-300 font-medium">No inquiries</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900">
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300">Subject</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300">Contact</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <motion.tr key={ticket.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-white">{ticket.title}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          {ticket.customer_email && (
                            <a href={`mailto:${ticket.customer_email}`} className="p-1 hover:bg-slate-600 rounded transition-colors text-slate-400 hover:text-sky-400">
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex w-fit ${
                          ticket.status === 'open' ? 'bg-red-900/30 text-red-400' :
                          ticket.status === 'closed' ? 'bg-green-900/30 text-green-400' :
                          'bg-yellow-900/30 text-yellow-400'
                        }`}>
                          {ticket.status || 'Open'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">{new Date(ticket.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm">
                        <button className="p-1 hover:bg-slate-600 rounded transition-colors">
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
