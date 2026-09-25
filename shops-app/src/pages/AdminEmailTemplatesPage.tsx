'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/navigation';
import { useAuthStore } from '@/store/useAuth';
import { Mail, Edit2, Trash2, Plus, Eye, Save, X, Send, Megaphone, XCircle, RefreshCw } from 'lucide-react';

interface BroadcastJob {
  id: number;
  subject: string;
  title: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  daily_limit: number;
  created_at: string;
}

interface EmailTemplate {
  id: number;
  event_type: string;
  name: string;
  subject: string;
  html_content: string;
  text_content?: string;
  is_active: boolean;
  description?: string;
  variables?: string;
  action_text?: string;
  action_url?: string;
  created_at: string;
  updated_at: string;
}

export default function EmailTemplatesPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<EmailTemplate | null>(null);
  const [broadcastingTemplate, setBroadcastingTemplate] = useState<EmailTemplate | null>(null);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [broadcastJobs, setBroadcastJobs] = useState<BroadcastJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const navItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
    ...item,
    icon: <Icon className="w-5 h-5" />
  }));

  useEffect(() => {
    if (user?.is_admin) {
      fetchTemplates();
      fetchBroadcastJobs();
    }
  }, [user]);

  useEffect(() => {
    if (!user?.is_admin) return;
    const hasActiveJob = broadcastJobs.some(j => j.status === 'in_progress');
    if (!hasActiveJob) return;
    const interval = setInterval(fetchBroadcastJobs, 30000);
    return () => clearInterval(interval);
  }, [user, broadcastJobs]);

  const fetchBroadcastJobs = async () => {
    setLoadingJobs(true);
    try {
      const response = await api.get('/admin/email/broadcast-jobs');
      setBroadcastJobs(response.data);
    } catch (error) {
      console.error('Failed to fetch broadcast jobs:', error);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleCancelJob = async (jobId: number) => {
    if (!confirm('Stop sending any further recipients for this broadcast?')) return;
    try {
      await api.post(`/admin/email/broadcast-jobs/${jobId}/cancel`);
      toast({ title: 'Broadcast cancelled', description: 'No further recipients will be sent.' });
      fetchBroadcastJobs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to cancel broadcast',
        variant: 'destructive'
      });
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/admin/email-templates/');
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email templates',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditing(template);
    setShowForm(true);
  };

  const handleDelete = async (templateId: number) => {
    if (!confirm('Delete this template? It will be deactivated.')) return;

    try {
      await api.delete(`/admin/email-templates/${templateId}`);
      toast({
        title: 'Success',
        description: 'Template deleted'
      });
      fetchTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive'
      });
    }
  };

  const handleSave = async (formData: any) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/email-templates/${editing.id}`, formData);
        toast({
          title: 'Success',
          description: 'Template updated'
        });
      } else {
        await api.post('/admin/email-templates/', formData);
        toast({
          title: 'Success',
          description: 'Template created'
        });
      }
      setShowForm(false);
      setEditing(null);
      fetchTemplates();
    } catch (error: any) {
      console.error('Failed to save template:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to save template',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const openBroadcastConfirm = async (template: EmailTemplate) => {
    setBroadcastingTemplate(template);
    setAudienceCount(null);
    try {
      const res = await api.get('/admin/stats');
      setAudienceCount(res.data?.total_users ?? null);
    } catch {
      setAudienceCount(null);
    }
  };

  const handleSendTest = async (template: EmailTemplate, testEmail: string) => {
    try {
      await api.post('/admin/email/send-manual', {
        email: testEmail,
        subject: template.subject,
        title: template.name,
        subtitle: template.description || undefined,
        content_html: template.html_content,
        action_text: template.action_text || undefined,
        action_url: template.action_url || undefined,
        campaign_id: `test_${template.event_type}`,
      });
      toast({ title: 'Sent', description: `Test email queued for ${testEmail}` });
      setSendingTemplate(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to send test email',
        variant: 'destructive'
      });
    }
  };

  const handleBroadcast = async (template: EmailTemplate, dailyLimit: number) => {
    try {
      const res = await api.post('/admin/email/broadcast', {
        subject: template.subject,
        title: template.name,
        subtitle: template.description || undefined,
        content_html: template.html_content,
        action_text: template.action_text || undefined,
        action_url: template.action_url || undefined,
        campaign_id: `broadcast_${template.event_type}_${Date.now()}`,
        daily_limit: dailyLimit,
      });
      toast({ title: 'Broadcast queued', description: res.data?.message || 'Sending to all active customers' });
      setBroadcastingTemplate(null);
      fetchBroadcastJobs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to send broadcast',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Email Templates" navItems={navItems} userRole="admin">
        <div className="p-6">Loading templates...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Email Templates" navItems={navItems} userRole="admin">
      <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Mail className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Email Templates</h1>
            </div>
            <p className="text-slate-600 dark:text-neutral-200">
              Create reusable templates, send a test to yourself, or broadcast to every active customer.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            New Template
          </button>
        </div>

        {/* Broadcast Jobs */}
        {broadcastJobs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-orange-600" />
                Broadcast Jobs
              </h2>
              <button
                onClick={fetchBroadcastJobs}
                disabled={loadingJobs}
                className="p-2 text-slate-500 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900 rounded disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loadingJobs ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="grid gap-3">
              {broadcastJobs.map(job => {
                const pct = job.total_recipients > 0
                  ? Math.round((job.sent_count / job.total_recipients) * 100)
                  : 0;
                const statusStyle = {
                  in_progress: 'bg-blue-50 dark:bg-blue-950/30 text-blue-800',
                  completed: 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800',
                  cancelled: 'bg-slate-100 dark:bg-neutral-900 text-gray-800',
                }[job.status];
                return (
                  <Card key={job.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{job.title}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${statusStyle}`}>
                            {job.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-neutral-400 mb-2">
                          {job.sent_count.toLocaleString()} / {job.total_recipients.toLocaleString()} sent
                          {job.failed_count > 0 && <span className="text-red-600"> &middot; {job.failed_count} failed</span>}
                          {' '}&middot; up to {job.daily_limit.toLocaleString()}/day
                        </p>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${job.status === 'cancelled' ? 'bg-slate-400' : 'bg-orange-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      {job.status === 'in_progress' && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded shrink-0"
                          title="Cancel broadcast"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Template List */}
        <div className="grid gap-4">
          {templates.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-slate-400">No templates found</p>
            </Card>
          ) : (
            templates.map(template => (
              <Card key={template.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{template.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        template.is_active
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800'
                          : 'bg-slate-100 dark:bg-neutral-900 text-gray-800'
                      }`}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-neutral-200 mb-2">
                      <strong>Event:</strong> {template.event_type}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-neutral-200 mb-2">
                      <strong>Subject:</strong> {template.subject}
                    </p>
                    {template.description && (
                      <p className="text-sm text-slate-600 dark:text-neutral-200 mb-2">{template.description}</p>
                    )}
                    {template.action_text && (
                      <p className="text-xs text-slate-400 mb-2">
                        CTA: <span className="font-semibold">{template.action_text}</span> &rarr; {template.action_url}
                      </p>
                    )}
                    {template.variables && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-neutral-200 mb-1">Variables:</p>
                        <div className="flex flex-wrap gap-1">
                          {JSON.parse(template.variables).map((v: string) => (
                            <span key={v} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono">
                              {'{{'}{v}{'}'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => setSendingTemplate(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Send test email"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => openBroadcastConfirm(template)}
                      className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                      title="Broadcast to all customers"
                    >
                      <Megaphone className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditing(template);
                        setShowPreview(true);
                      }}
                      className="p-2 text-slate-600 dark:text-neutral-200 hover:bg-slate-100 dark:bg-neutral-900 rounded"
                      title="Preview"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 text-slate-600 dark:text-neutral-200 hover:bg-slate-100 dark:bg-neutral-900 rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Edit/Create Form Modal */}
        {showForm && (
          <EmailTemplateForm
            template={editing}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            saving={saving}
          />
        )}

        {/* Preview Modal */}
        {showPreview && editing && (
          <TemplatePreviewModal
            template={editing}
            onClose={() => {
              setShowPreview(false);
              setEditing(null);
            }}
          />
        )}

        {/* Send Test Modal */}
        {sendingTemplate && (
          <SendTestModal
            template={sendingTemplate}
            onSend={(email) => handleSendTest(sendingTemplate, email)}
            onCancel={() => setSendingTemplate(null)}
          />
        )}

        {/* Broadcast Confirm Modal */}
        {broadcastingTemplate && (
          <BroadcastConfirmModal
            template={broadcastingTemplate}
            audienceCount={audienceCount}
            onConfirm={(dailyLimit) => handleBroadcast(broadcastingTemplate, dailyLimit)}
            onCancel={() => setBroadcastingTemplate(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function EmailTemplateForm({
  template,
  onSave,
  onCancel,
  saving
}: {
  template: EmailTemplate | null;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(template?.name || '');
  const [eventType, setEventType] = useState(template?.event_type || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [htmlContent, setHtmlContent] = useState(template?.html_content || '');
  const [textContent, setTextContent] = useState(template?.text_content || '');
  const [description, setDescription] = useState(template?.description || '');
  const [actionText, setActionText] = useState(template?.action_text || '');
  const [actionUrl, setActionUrl] = useState(template?.action_url || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      event_type: eventType,
      subject,
      html_content: htmlContent,
      text_content: textContent || undefined,
      description: description || undefined,
      action_text: actionText || undefined,
      action_url: actionUrl || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {template ? 'Edit Template' : 'Create Template'}
            </h2>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 hover:bg-slate-100 dark:bg-neutral-900 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Name (also used as the email's headline)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Black Friday Sale"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                disabled={!!template}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select event type</option>
                <option value="promotional">Promotional / Marketing Blast</option>
                <option value="signup">Signup</option>
                <option value="shop_created">Shop Created</option>
                <option value="listing_approved">Listing Approved</option>
                <option value="listing_rejected">Listing Rejected</option>
                <option value="price_dropped">Price Dropped</option>
                <option value="weekly_digest">Weekly Digest</option>
                <option value="saved_search_match">Saved Search Match</option>
                <option value="abandoned_listing">Abandoned Listing</option>
                <option value="inactive_seller">Inactive Seller</option>
                <option value="birthday">Birthday</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Subtitle (shown under the headline)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short supporting line"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Content</label>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="Email body — plain text or simple HTML (<p>, <strong>, <ul> etc.)"
              rows={6}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              This is wrapped automatically in the Suqafuran email design (logo, footer, social links). Use {'{{'} name {'}}'}, {'{{'} email {'}}'}, {'{{'} phone {'}}'}, {'{{'} location {'}}'}, {'{{'} date {'}}'} as placeholders — they're filled in per recipient.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">CTA Button Text (optional)</label>
              <input
                type="text"
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="Shop Now"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">CTA Button Link (optional)</label>
              <input
                type="text"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="https://suqafuran.so"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-slate-50 dark:bg-neutral-900/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function TemplatePreviewModal({
  template,
  onClose
}: {
  template: EmailTemplate;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Template Preview</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 dark:bg-neutral-900 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-neutral-900/40 p-4 rounded border">
            <p className="text-sm text-slate-600 dark:text-neutral-200 mb-3"><strong>Subject:</strong> {template.subject}</p>
            <div className="bg-white rounded border overflow-hidden">
              <div className="bg-white text-center px-6 pt-8 pb-6 border-b border-slate-100 dark:border-neutral-800">
                <img src="https://suqafuran.so/icon1.png" alt="Suqafuran" className="h-8 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-400">The Trusted Marketplace of Somalia</p>
              </div>
              <div className="px-8 py-8 text-left">
                <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">{template.name}</h2>
                {template.description && <p className="text-sm text-slate-600 dark:text-neutral-200 mb-4">{template.description}</p>}
                <div className="text-sm text-slate-700 dark:text-neutral-200" dangerouslySetInnerHTML={{ __html: template.html_content }} />
                {template.action_text && (
                  <div className="text-center mt-5">
                    <span className="inline-block bg-orange-600 text-white text-xs font-bold px-5 py-2.5 rounded-lg">
                      {template.action_text}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SendTestModal({
  template,
  onSend,
  onCancel,
}: {
  template: EmailTemplate;
  onSend: (email: string) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Send Test Email</h2>
            <button onClick={onCancel} className="p-1 hover:bg-slate-100 dark:bg-neutral-900 rounded"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-sm text-slate-600 dark:text-neutral-200">Sending "{template.name}" as a one-off test.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-slate-50 dark:bg-neutral-900/40">Cancel</button>
            <button
              onClick={async () => {
                if (!email.trim()) return;
                setSending(true);
                await onSend(email.trim());
                setSending(false);
              }}
              disabled={!email.trim() || sending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BroadcastConfirmModal({
  template,
  audienceCount,
  onConfirm,
  onCancel,
}: {
  template: EmailTemplate;
  audienceCount: number | null;
  onConfirm: (dailyLimit: number) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [dailyLimit, setDailyLimit] = useState(250);
  const [sending, setSending] = useState(false);
  const canSend = confirmText.trim().toUpperCase() === 'SEND' && dailyLimit > 0;
  const days = audienceCount && dailyLimit > 0 ? Math.ceil(audienceCount / dailyLimit) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Broadcast to All Customers</h2>
            <button onClick={onCancel} className="p-1 hover:bg-slate-100 dark:bg-neutral-900 rounded"><X className="w-5 h-5" /></button>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-900">
              This queues "<strong>{template.name}</strong>" for{' '}
              {audienceCount !== null ? (
                <strong>~{audienceCount.toLocaleString()} active customers</strong>
              ) : (
                'all active customers'
              )}
              , sending up to <strong>{dailyLimit.toLocaleString()}/day</strong>
              {days ? <> (~{days} day{days !== 1 ? 's' : ''} to finish)</> : null} to stay under your sending limits.
              You can cancel it anytime from the Broadcast Jobs list below.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
              Emails per day
            </label>
            <input
              type="number"
              min={1}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
              Type SEND to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="SEND"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              autoFocus
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-slate-50 dark:bg-neutral-900/40">Cancel</button>
            <button
              onClick={async () => {
                setSending(true);
                await onConfirm(dailyLimit);
                setSending(false);
              }}
              disabled={!canSend || sending}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <Megaphone className="w-4 h-4" />
              {sending ? 'Queuing...' : 'Queue Broadcast'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
