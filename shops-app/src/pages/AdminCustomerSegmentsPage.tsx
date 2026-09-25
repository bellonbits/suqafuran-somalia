'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/navigation';
import { useAuthStore } from '@/store/useAuth';
import { Users, Plus, Edit2, Trash2, Send, Eye, Save, X } from 'lucide-react';

interface CustomerSegment {
  id: number;
  name: string;
  description?: string;
  criteria: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

interface SegmentTemplate {
  name: string;
  description: string;
  criteria: any;
}

export default function CustomerSegmentsPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [templates, setTemplates] = useState<SegmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomerSegment | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegment | null>(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  const navItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
    ...item,
    icon: <Icon className="w-5 h-5" />
  }));

  useEffect(() => {
    if (user?.is_admin) {
      fetchSegments();
      fetchTemplates();
    }
  }, [user]);

  const fetchSegments = async () => {
    try {
      const response = await api.get('/admin/segments/');
      setSegments(response.data);
    } catch (error) {
      console.error('Failed to fetch segments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load customer segments',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/admin/segments/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleSave = async (formData: any) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/segments/${editing.id}`, formData);
        toast({
          title: 'Success',
          description: 'Segment updated'
        });
      } else {
        await api.post('/admin/segments/', formData);
        toast({
          title: 'Success',
          description: 'Segment created'
        });
      }
      setShowForm(false);
      setEditing(null);
      fetchSegments();
    } catch (error: any) {
      console.error('Failed to save segment:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to save segment',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (segmentId: number) => {
    if (!confirm('Delete this segment?')) return;

    try {
      await api.delete(`/admin/segments/${segmentId}`);
      toast({
        title: 'Success',
        description: 'Segment deleted'
      });
      fetchSegments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to delete segment',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Customer Segments" navItems={navItems} userRole="admin">
        <div className="p-6">Loading segments...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Customer Segments" navItems={navItems} userRole="admin">
      <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Customer Segments</h1>
            </div>
            <p className="text-slate-600 dark:text-neutral-200">Create and manage audience segments for targeted campaigns</p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            New Segment
          </button>
        </div>

        {/* Segment List */}
        <div className="grid gap-4">
          {segments.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-slate-400 mb-4">No segments found</p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Create Your First Segment
              </button>
            </Card>
          ) : (
            segments.map(segment => (
              <Card key={segment.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{segment.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        segment.is_active
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800'
                          : 'bg-slate-100 dark:bg-neutral-900 text-gray-800'
                      }`}>
                        {segment.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {segment.description && (
                      <p className="text-sm text-slate-600 dark:text-neutral-200 mb-3">{segment.description}</p>
                    )}
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">
                        {segment.member_count} members
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedSegment(segment);
                        setShowCampaignModal(true);
                      }}
                      className="p-2 text-slate-600 dark:text-neutral-200 hover:bg-slate-100 dark:bg-neutral-900 rounded"
                      title="Send Campaign"
                      disabled={segment.member_count === 0}
                    >
                      <Send className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditing(segment);
                        setShowForm(true);
                      }}
                      className="p-2 text-slate-600 dark:text-neutral-200 hover:bg-slate-100 dark:bg-neutral-900 rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(segment.id)}
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

        {/* Form Modal */}
        {showForm && (
          <SegmentFormModal
            segment={editing}
            templates={templates}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            saving={saving}
          />
        )}

        {/* Campaign Modal */}
        {showCampaignModal && selectedSegment && (
          <CampaignModal
            segment={selectedSegment}
            onClose={() => {
              setShowCampaignModal(false);
              setSelectedSegment(null);
            }}
            onSent={() => {
              fetchSegments();
              setShowCampaignModal(false);
              setSelectedSegment(null);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function SegmentFormModal({
  segment,
  templates,
  onSave,
  onCancel,
  saving
}: {
  segment: CustomerSegment | null;
  templates: SegmentTemplate[];
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(segment?.name || '');
  const [description, setDescription] = useState(segment?.description || '');
  const [criteria, setCriteria] = useState(
    segment ? JSON.stringify(JSON.parse(segment.criteria), null, 2) : '{"operator":"and","rules":[]}'
  );
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const handleTemplateSelect = (template: SegmentTemplate) => {
    setName(template.name);
    setDescription(template.description);
    setCriteria(JSON.stringify(template.criteria, null, 2));
    setUseTemplate(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      JSON.parse(criteria); // Validate JSON
      onSave({
        name,
        description: description || undefined,
        criteria
      });
    } catch (error) {
      alert('Invalid JSON in criteria');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-96 overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {segment ? 'Edit Segment' : 'Create Segment'}
            </h2>
            <button type="button" onClick={onCancel} className="p-1 hover:bg-slate-100 dark:bg-neutral-900 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {!segment && (
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Use Template</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {templates.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleTemplateSelect(t)}
                    className="p-3 border border-gray-300 rounded-lg hover:bg-blue-50 text-left text-sm"
                  >
                    <p className="font-semibold text-slate-900 dark:text-white">{t.name}</p>
                    <p className="text-xs text-slate-600 dark:text-neutral-200">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Criteria (JSON)</label>
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Define rules with fields like is_seller, verified_level, etc.</p>
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
              {saving ? 'Saving...' : 'Save Segment'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function CampaignModal({
  segment,
  onClose,
  onSent
}: {
  segment: CustomerSegment;
  onClose: () => void;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('general');
  const [sending, setSending] = useState(false);
  const [dryRun, setDryRun] = useState(true);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const response = await api.post(`/admin/segments/${segment.id}/send-campaign`, {
        message,
        message_type: messageType,
        dry_run: dryRun
      });

      toast({
        title: 'Success',
        description: dryRun
          ? `Would send to ${response.data.total_count} users`
          : `Sent to ${response.data.success} users`
      });

      if (!dryRun) {
        onSent();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to send campaign',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <form onSubmit={handleSend} className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Send Campaign</h2>
            <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 dark:bg-neutral-900 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Segment:</strong> {segment.name} ({segment.member_count} members)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Message Type</label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="general">General</option>
              <option value="promotional">Promotional</option>
              <option value="announcement">Announcement</option>
              <option value="support">Support</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message content..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-amber-50 rounded border border-amber-200">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              id="dry-run"
              className="w-4 h-4 rounded"
            />
            <label htmlFor="dry-run" className="text-sm text-amber-900">
              Dry run (preview without sending)
            </label>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-slate-50 dark:bg-neutral-900/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : dryRun ? 'Preview' : 'Send'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
