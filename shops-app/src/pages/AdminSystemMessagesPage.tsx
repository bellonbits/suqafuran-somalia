'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/navigation';
import { useAuthStore } from '@/store/useAuth';
import { Send, Users, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react';

export default function SystemMessagesPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [messageType, setMessageType] = useState('general');
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [singleUserId, setSingleUserId] = useState('');
  const [userIds, setUserIds] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [dryRun, setDryRun] = useState(false);

  const navItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
    ...item,
    icon: <Icon className="w-5 h-5" />
  }));

  const handleSendSingle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!singleUserId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a user ID',
        variant: 'destructive'
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Message cannot be empty',
        variant: 'destructive'
      });
      return;
    }

    setSending(true);
    try {
      const response = await api.post('/admin/system-messages/send', {
        recipient_user_id: parseInt(singleUserId),
        message: message,
        message_type: messageType
      });

      toast({
        title: 'Success',
        description: `Message sent to user ${singleUserId}`,
      });

      setSingleUserId('');
      setMessage('');
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to send message',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendBulk = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userIds.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter user IDs (comma-separated)',
        variant: 'destructive'
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Message cannot be empty',
        variant: 'destructive'
      });
      return;
    }

    const ids = userIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

    if (ids.length === 0) {
      toast({
        title: 'Error',
        description: 'Please enter valid user IDs',
        variant: 'destructive'
      });
      return;
    }

    setSending(true);
    try {
      const response = await api.post('/admin/system-messages/send-bulk', {
        recipient_user_ids: ids,
        message: message,
        message_type: messageType,
        dry_run: dryRun
      });

      toast({
        title: 'Success',
        description: `${response.data.success} message${response.data.success !== 1 ? 's' : ''} sent${dryRun ? ' (dry run)' : ''}`,
      });

      if (response.data.failed > 0) {
        toast({
          title: 'Warning',
          description: `${response.data.failed} message${response.data.failed !== 1 ? 's' : ''} failed to send`,
          variant: 'destructive'
        });
      }

      if (!dryRun) {
        setUserIds('');
        setMessage('');
      }
    } catch (error: any) {
      console.error('Failed to send bulk messages:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to send messages',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout title="System Messages" navItems={navItems} userRole="admin">
      <div className="container mx-auto py-8 px-4 max-w-4xl space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MessageCircle className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">System Messages</h1>
          </div>
          <p className="text-slate-600 dark:text-neutral-200">Send messages from Suqafuran account to users</p>
        </div>

        {/* Info Card */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-900">
                <strong>Verified Account:</strong> Messages sent from Suqafuran will appear with a blue verification tick, making them stand out as official communications from the platform.
              </p>
            </div>
          </div>
        </Card>

        {/* Mode Selector */}
        <div className="flex gap-4">
          <button
            onClick={() => setMode('single')}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              mode === 'single'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-slate-800 dark:text-neutral-100 hover:bg-gray-300'
            }`}
          >
            Send to One User
          </button>
          <button
            onClick={() => setMode('bulk')}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              mode === 'bulk'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-slate-800 dark:text-neutral-100 hover:bg-gray-300'
            }`}
          >
            Send to Multiple Users
          </button>
        </div>

        {/* Send Form */}
        <Card className="p-8">
          <form onSubmit={mode === 'single' ? handleSendSingle : handleSendBulk} className="space-y-6">
            {/* Message Type */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Message Type</label>
              <select
                value={messageType}
                onChange={(e) => setMessageType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="general">General Announcement</option>
                <option value="promotional">Promotional Message</option>
                <option value="announcement">Important Announcement</option>
                <option value="support">Support Message</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Used for categorizing and tracking messages</p>
            </div>

            {/* Recipient(s) */}
            {mode === 'single' ? (
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Recipient User ID</label>
                <input
                  type="number"
                  value={singleUserId}
                  onChange={(e) => setSingleUserId(e.target.value)}
                  placeholder="Enter user ID (e.g., 123)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Recipient User IDs</label>
                <textarea
                  value={userIds}
                  onChange={(e) => setUserIds(e.target.value)}
                  placeholder="Enter user IDs separated by commas (e.g., 1,2,3,4,5)"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">Comma-separated list of user IDs. Max 10,000 recipients.</p>
              </div>
            )}

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Message Content</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message (max 5,000 characters)"
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={5000}
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-slate-400">Max 5,000 characters</p>
                <span className="text-xs text-slate-600 dark:text-neutral-200">{message.length}/5,000</span>
              </div>
            </div>

            {/* Dry Run for Bulk */}
            {mode === 'bulk' && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-neutral-900/40 rounded-lg">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  id="dry-run"
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="dry-run" className="text-sm text-slate-700 dark:text-neutral-200">
                  <strong>Dry run:</strong> Validate recipients without sending messages
                </label>
              </div>
            )}

            {/* Send Button */}
            <button
              type="submit"
              disabled={sending}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              {sending ? 'Sending...' : mode === 'single' ? 'Send Message' : 'Send Messages'}
            </button>
          </form>
        </Card>

        {/* Guidelines */}
        <Card className="p-6 bg-amber-50 border-amber-200">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 space-y-2">
              <p><strong>Best Practices:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Keep messages concise and actionable</li>
                <li>Use promotional messages sparingly to avoid spam perception</li>
                <li>Include support contact info in support messages</li>
                <li>Test with a small group before bulk sending</li>
                <li>Monitor user feedback and unsubscribe rates</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
