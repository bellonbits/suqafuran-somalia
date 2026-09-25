"use client";

import React, { useEffect, useState } from 'react';
import {
    Plus, Edit2, Trash2, Loader, X, Image as ImageIcon,
    PlayCircle, PauseCircle, Eye, MousePointerClick, RotateCcw,
} from 'lucide-react';
import api from '@/services/api';
import { advertisingService, HomepageBannerDetail, CreateBannerPayload } from '@/services/advertising';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';

interface ShopOption {
    id: number;
    business_name: string;
    full_name: string;
}

const CTA_PRESETS = [
    { label: 'Shop', placeholder: '/shop/rahmoshop' },
    { label: 'Category', placeholder: '/electronics' },
    { label: 'Search', placeholder: '/search?q=phones' },
    { label: 'Promotion Page', placeholder: '/safe-trading-tips' },
    { label: 'External URL', placeholder: 'https://example.com' },
    { label: 'Custom', placeholder: '/' },
];

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-slate-100 dark:bg-neutral-900 text-gray-700',
    scheduled: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700',
    active: 'bg-emerald-50 dark:bg-emerald-950/30 text-green-700',
    expired: 'bg-rose-50 dark:bg-rose-950/30 text-red-700',
    paused: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700',
};

function toDatetimeLocal(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = {
    seller_id: '',
    title: '',
    subtitle: '',
    image_url: '',
    mobile_image_url: '',
    button_text: 'Shop Now',
    button_link: '',
    priority: 50,
    start_date: '',
    end_date: '',
};

export default function AdminHomepageBannersPage() {
    const [banners, setBanners] = useState<HomepageBannerDetail[]>([]);
    const [shops, setShops] = useState<ShopOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [ctaType, setCtaType] = useState(CTA_PRESETS[0].label);
    const [uploadingDesktop, setUploadingDesktop] = useState(false);
    const [uploadingMobile, setUploadingMobile] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const navItems = ADMIN_NAV_ITEMS.map(item => ({
        ...item,
        icon: <item.icon className="w-5 h-5" />
    }));

    useEffect(() => {
        loadBanners();
        loadShops();
    }, []);

    const loadBanners = async () => {
        try {
            setLoading(true);
            const data = await advertisingService.listBanners();
            setBanners(data);
        } catch (err) {
            console.error('Failed to load banners:', err);
            setError('Failed to load banners');
        } finally {
            setLoading(false);
        }
    };

    const loadShops = async () => {
        try {
            const response = await api.get('/admin/shops', { params: { limit: 500 } });
            const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
            setShops(data);
        } catch (err) {
            console.error('Failed to load shops:', err);
        }
    };

    const openCreateModal = () => {
        setEditingId(null);
        setForm(emptyForm);
        setCtaType(CTA_PRESETS[0].label);
        setFormError('');
        setModalOpen(true);
    };

    const openEditModal = (banner: HomepageBannerDetail) => {
        setEditingId(banner.id);
        setForm({
            seller_id: String(banner.seller_id),
            title: banner.title,
            subtitle: banner.subtitle || '',
            image_url: banner.image_url,
            mobile_image_url: banner.mobile_image_url || '',
            button_text: banner.button_text,
            button_link: banner.button_link,
            priority: banner.priority,
            start_date: toDatetimeLocal(banner.start_date),
            end_date: toDatetimeLocal(banner.end_date),
        });
        setCtaType(CTA_PRESETS[0].label);
        setFormError('');
        setModalOpen(true);
    };

    const handleUpload = async (file: File, target: 'image_url' | 'mobile_image_url') => {
        const setUploading = target === 'image_url' ? setUploadingDesktop : setUploadingMobile;
        setUploading(true);
        try {
            const url = await advertisingService.uploadBannerImage(file);
            setForm((f) => ({ ...f, [target]: url }));
        } catch (err) {
            console.error('Upload failed:', err);
            setFormError('Image upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setFormError('');

        if (!form.seller_id || !form.title || !form.image_url || !form.button_link || !form.start_date || !form.end_date) {
            setFormError('Please fill in shop, title, desktop image, CTA link, and both dates.');
            return;
        }

        setSaving(true);
        try {
            if (editingId) {
                await advertisingService.updateBanner(editingId, {
                    title: form.title,
                    subtitle: form.subtitle || null,
                    image_url: form.image_url,
                    mobile_image_url: form.mobile_image_url || null,
                    button_text: form.button_text,
                    button_link: form.button_link,
                    priority: Number(form.priority),
                    start_date: new Date(form.start_date).toISOString(),
                    end_date: new Date(form.end_date).toISOString(),
                });
            } else {
                const payload: CreateBannerPayload = {
                    seller_id: Number(form.seller_id),
                    title: form.title,
                    subtitle: form.subtitle || null,
                    image_url: form.image_url,
                    mobile_image_url: form.mobile_image_url || null,
                    button_text: form.button_text,
                    button_link: form.button_link,
                    priority: Number(form.priority),
                    start_date: new Date(form.start_date).toISOString(),
                    end_date: new Date(form.end_date).toISOString(),
                };
                await advertisingService.createBanner(payload);
            }
            setModalOpen(false);
            await loadBanners();
        } catch (err: any) {
            setFormError(err?.response?.data?.detail || 'Failed to save banner');
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async (banner: HomepageBannerDetail) => {
        try {
            await advertisingService.publishBanner(banner.id);
            await loadBanners();
        } catch (err: any) {
            alert(err?.response?.data?.detail || 'Failed to publish banner');
        }
    };

    const handlePause = async (banner: HomepageBannerDetail) => {
        try {
            await advertisingService.pauseBanner(banner.id);
            await loadBanners();
        } catch (err: any) {
            alert(err?.response?.data?.detail || 'Failed to pause banner');
        }
    };

    const handleDelete = async (banner: HomepageBannerDetail) => {
        if (!confirm(`Delete banner "${banner.title}"?`)) return;
        try {
            await advertisingService.deleteBanner(banner.id);
            await loadBanners();
        } catch (err: any) {
            alert(err?.response?.data?.detail || 'Failed to delete banner');
        }
    };

    const handleResetStats = async (banner: HomepageBannerDetail) => {
        if (!confirm(`Reset impressions/clicks for "${banner.title}" back to zero?`)) return;
        try {
            await advertisingService.resetBannerStats(banner.id);
            await loadBanners();
        } catch (err: any) {
            alert(err?.response?.data?.detail || 'Failed to reset stats');
        }
    };

    if (loading) {
        return (
            <DashboardLayout title="Homepage Banners" navItems={navItems} userRole="admin">
                <div className="flex items-center justify-center h-64">
                    <Loader className="w-8 h-8 animate-spin text-orange-600" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Homepage Banners" navItems={navItems} userRole="admin">
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">Homepage Banners</h1>
                    <p className="text-sm text-slate-400 mt-1">Manage the promotional carousel shown at the top of the homepage.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    New Banner
                </button>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 text-red-600 text-sm font-semibold p-3 rounded-xl border border-red-100">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-100 dark:bg-neutral-900 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Banner</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Schedule</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Priority</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Performance</th>
                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {banners.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                        No banners yet — click "New Banner" to create one.
                                    </td>
                                </tr>
                            ) : (
                                banners.map((banner) => (
                                    <tr key={banner.id} className="hover:bg-slate-50 dark:bg-neutral-900/40">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-20 h-12 rounded-lg bg-slate-100 dark:bg-neutral-900 overflow-hidden flex items-center justify-center shrink-0">
                                                    {banner.image_url ? (
                                                        <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <ImageIcon className="w-5 h-5 text-slate-400" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900 dark:text-white">{banner.title}</p>
                                                    <p className="text-xs text-slate-400">{banner.button_link}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[banner.status] || 'bg-slate-100 dark:bg-neutral-900 text-gray-700'}`}>
                                                {banner.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-neutral-200">
                                            <div>{new Date(banner.start_date).toLocaleDateString()}</div>
                                            <div>→ {new Date(banner.end_date).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-neutral-200">{banner.priority}</td>
                                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-neutral-200">
                                            <div className="flex items-center gap-1.5">
                                                <Eye className="w-3.5 h-3.5" /> {banner.stats?.impressions ?? 0}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <MousePointerClick className="w-3.5 h-3.5" /> {banner.stats?.clicks ?? 0}
                                                {banner.stats && banner.stats.impressions > 0 && (
                                                    <span className="text-slate-400">({banner.stats.ctr.toFixed(1)}% CTR)</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1.5">
                                                {banner.status !== 'active' && banner.status !== 'expired' && (
                                                    <button
                                                        onClick={() => openEditModal(banner)}
                                                        className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                )}
                                                {(banner.status === 'draft' || banner.status === 'scheduled' || banner.status === 'paused') && (
                                                    <button
                                                        onClick={() => handlePublish(banner)}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded"
                                                        title="Publish"
                                                    >
                                                        <PlayCircle size={16} />
                                                    </button>
                                                )}
                                                {banner.status === 'active' && (
                                                    <button
                                                        onClick={() => handlePause(banner)}
                                                        className="p-2 text-amber-600 hover:bg-amber-50 rounded"
                                                        title="Pause"
                                                    >
                                                        <PauseCircle size={16} />
                                                    </button>
                                                )}
                                                {banner.status !== 'active' && (
                                                    <button
                                                        onClick={() => handleDelete(banner)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                                {((banner.stats?.impressions ?? 0) > 0 || (banner.stats?.clicks ?? 0) > 0) && (
                                                    <button
                                                        onClick={() => handleResetStats(banner)}
                                                        className="p-2 text-slate-400 hover:bg-slate-100 dark:bg-neutral-900 rounded"
                                                        title="Reset impressions/clicks to zero (e.g. after test traffic)"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setModalOpen(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6 space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                {editingId ? 'Edit Banner' : 'New Banner'}
                            </h2>
                            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:text-neutral-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {formError && (
                            <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-lg">{formError}</div>
                        )}

                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-neutral-200 block mb-1">Shop</label>
                            <select
                                value={form.seller_id}
                                onChange={(e) => setForm((f) => ({ ...f, seller_id: e.target.value }))}
                                disabled={!!editingId}
                                className="w-full rounded-xl border border-slate-200 dark:border-neutral-800 px-3 py-2.5 text-sm disabled:bg-slate-50 dark:bg-neutral-900/40 disabled:text-slate-400"
                            >
                                <option value="">Select a shop...</option>
                                {shops.map((shop) => (
                                    <option key={shop.id} value={shop.id}>
                                        {shop.business_name} ({shop.full_name})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-neutral-200 block mb-1">Title</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                    placeholder="Back to School Sale"
                                    className="w-full rounded-xl border border-slate-200 dark:border-neutral-800 px-3 py-2.5 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-neutral-200 block mb-1">Subtitle</label>
                                <input
                                    type="text"
                                    value={form.subtitle}
                                    onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                                    placeholder="Up to 50% off electronics"
                                    className="w-full rounded-xl border border-slate-200 dark:border-neutral-800 px-3 py-2.5 text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-neutral-200 block mb-1">Desktop Image (21:9)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'image_url')}
                                    className="w-full text-xs"
                                />
                                {uploadingDesktop && <p className="text-xs text-slate-400 mt-1">Uploading...</p>}
                                {form.image_url && (
                                    <img src={form.image_url} alt="" className="mt-2 w-full h-20 object-cover rounded-lg" />
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-neutral-200 block mb-1">Mobile Image (optional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'mobile_image_url')}
                                    className="w-full text-xs"
                                />
                                {uploadingMobile && <p className="text-xs text-slate-400 mt-1">Uploading...</p>}
                                {form.mobile_image_url && (
                                    <img src={form.mobile_image_url} alt="" className="mt-2 w-full h-20 object-cover rounded-lg" />
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-neutral-200 block mb-1">CTA Link Type</label>
                            <select
                                value={ctaType}
                                onChange={(e) => setCtaType(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-neutral-800 px-3 py-2.5 text-sm mb-2"
                            >
                                {CTA_PRESETS.map((preset) => (
                                    <option key={preset.label} value={preset.label}>{preset.label}</option>
                                ))}
                            </select>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    value={form.button_link}
                                    onChange={(e) => setForm((f) => ({ ...f, button_link: e.target.value }))}
                                    placeholder={CTA_PRESETS.find((p) => p.label === ctaType)?.placeholder}
                                    className="w-full rounded-xl border border-slate-200 dark:border-neutral-800 px-3 py-2.5 text-sm"
                                />
                                <input
                                    type="text"
                                    value={form.button_text}
                                    onChange={(e) => setForm((f) => ({ ...f, button_text: e.target.value }))}
                                    placeholder="Shop Now"
                                    className="w-full rounded-xl border border-slate-200 dark:border-neutral-800 px-3 py-2.5 text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-neutral-200 block mb-1">Priority</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={form.priority}
                                    onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                                    className="w-full rounded-xl border border-slate-200 dark:border-neutral-800 px-3 py-2.5 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-neutral-200 block mb-1">Start Date</label>
                                <input
                                    type="datetime-local"
                                    value={form.start_date}
                                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 dark:border-neutral-800 px-3 py-2.5 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-neutral-200 block mb-1">End Date</label>
                                <input
                                    type="datetime-local"
                                    value={form.end_date}
                                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                                    className="w-full rounded-xl border border-slate-200 dark:border-neutral-800 px-3 py-2.5 text-sm"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving || uploadingDesktop || uploadingMobile}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg mt-2"
                        >
                            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Banner (Draft)'}
                        </button>
                        {!editingId && (
                            <p className="text-xs text-slate-400 text-center">
                                Banners are created as drafts — publish from the list once ready.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
        </DashboardLayout>
    );
}
