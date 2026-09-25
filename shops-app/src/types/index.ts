export interface User {
    id: number;
    full_name: string;
    email: string;
    phone?: string | null;
    is_active: boolean;
    is_verified: boolean;
    is_admin: boolean;
    is_agent: boolean;
    is_seller?: boolean;
    seller_verified?: boolean;
    verified_level: 'guest' | 'phone' | 'id' | 'tier1' | 'tier2' | 'tier3' | 'premium' | 'trusted';
    trust_score?: number;
    trust_level?: string;
    avatar_url?: string | null;
    created_at?: string;
    profile_views?: number;
    business_name?: string | null;
    shop_description?: string | null;
    shop_page_banner?: string | null;
    shop_detail_banner?: string | null;
    is_featured?: boolean;
    free_delivery?: boolean;
}

export interface Listing {
    id: number;
    title_en: string;
    title_so?: string;
    description_en: string;
    description_so?: string;
    price: number;
    compare_at_price?: number | null;
    currency: string;
    location: string;
    condition: string;
    category_id: number;
    subcategory_id?: number;
    subsubcategory_id?: number;
    owner_id: number;
    seller_id?: number;
    status: string;
    images: string[];
    created_at: string;
    updated_at: string;
    owner?: User;
    is_negotiable?: boolean;
    views?: number;
    is_sold?: boolean;
}

export interface Category {
    id: number;
    name_en: string;
    name_so?: string;
    slug: string;
    icon_name: string;
    image_url?: string;
    attributes_schema?: Record<string, unknown>;
    subcategories?: SubCategory[];
}

export interface SubCategory {
    id: number;
    name_en: string;
    name_so?: string;
    slug: string;
    category_id: number;
    image_url?: string;
    attributes_schema?: Record<string, unknown>;
    subsubcategories?: SubSubCategory[];
}

export interface SubSubCategory {
    id: number;
    name_en: string;
    name_so?: string;
    slug: string;
    subcategory_id: number;
    image_url?: string;
}

export interface Business {
    id: string;
    owner_id: number;
    name: string;
    slug: string;
    logo_url?: string;
    banner_url?: string;
    description?: string;
    category: string;
    location_lat?: number;
    location_lng?: number;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    is_verified: boolean;
    show_in_nearby?: boolean;
    is_approved?: boolean;
    rating: number;
    trust_score: number;
    is_active: boolean;
    brand_color?: string;
    tagline?: string;
}

export interface BusinessProduct {
    id: number;
    business_id: string;
    name_en: string;
    description_en?: string;
    price: number;
    stock_level: number;
    low_stock_threshold?: number;
    images: string[];
    is_active: boolean;
    views?: number;
    clicks?: number;
    sales?: number;
}

export interface BusinessAnalytics {
    revenue: number;
    completed_orders: number;
    product_count: number;
    customer_count: number;
    low_stock_count: number;
    sales_trends_7d: { date: string; revenue: number }[];
}

export interface Order {
    id: number;
    business_id: string;
    customer_id: number;
    status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
    total_amount: number;
    payment_status: string;
    payment_method: string;
    items: any[];
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface Favorite {
    user_id: number;
    listing_id: number;
    created_at: string;
}

export interface Follow {
    id: number;
    follower_id: number;
    followed_id: number;
    created_at: string;
}

export interface FollowStats {
    followers_count: number;
    following_count: number;
    is_following: boolean;
}

export interface Feedback {
    id: number;
    author_id: number;
    target_user_id: number;
    listing_id?: number | null;
    rating: number;
    comment?: string | null;
    created_at: string;
}

export interface VerificationRequest {
    id: number;
    user_id: number;
    document_type: string;
    id_number?: string | null;
    status: 'pending' | 'approved' | 'rejected';
    tier: string;
    notes?: string | null;
    document_urls: string[];
    selfie_url?: string | null;
    proof_of_address_url?: string | null;
    video_selfie_url?: string | null;
    facial_match_score?: number | null;
    auto_verification_status?: string | null;
    created_at: string;
    user?: {
        full_name: string;
        phone?: string | null;
        email: string;
        is_verified: boolean;
        avatar_url?: string | null;
    };
}

export interface SupportTicket {
    id: number;
    user_id?: number | null;
    subject: string;
    status: 'open' | 'pending' | 'resolved';
    priority: 'low' | 'medium' | 'high';
    category: string;
    chat_history: { role: string; content: string; timestamp: string }[];
    last_agent_response?: string | null;
    admin_notes?: string | null;
    resolved_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface SupportStats {
    total: number;
    open: number;
    resolved: number;
}

export interface SiteContent {
    id: number;
    key: string;
    value_en: string;
    value_so?: string | null;
    page_group: string;
}

export interface FraudEvent {
    id: number;
    target_type: 'user' | 'listing' | 'message' | 'device';
    target_id: string;
    rule_name: string;
    risk_score: number;
    confidence: number;
    event_data?: Record<string, unknown>;
    status: 'pending' | 'investigated' | 'dismissed' | 'actioned';
    created_at: string;
}

export interface Report {
    id: number;
    listing_id?: number | null;
    reported_user_id?: number | null;
    reporter_id: number;
    reason: string;
    description?: string | null;
    status: 'pending' | 'warned' | 'suspended' | 'removed' | 'dismissed';
    admin_note?: string | null;
    admin_action?: 'warn' | 'suspend' | 'remove_listing' | 'dismiss' | null;
    risk_score: number;
    resolved_at?: string | null;
    created_at: string;
}

export interface RiskHistory {
    id: number;
    user_id: number;
    previous_score: number;
    new_score: number;
    reason: string;
    created_at: string;
}

export interface Device {
    id: number;
    fingerprint_hash: string;
    device_metadata?: Record<string, unknown>;
    is_banned: boolean;
    created_at: string;
    last_seen_at: string;
}

export interface UserRiskProfile {
    user_trust_score: number;
    trust_level: string;
    is_flagged: boolean;
    devices: Device[];
    linked_users: User[];
    risk_history: RiskHistory[];
}

export interface Voucher {
    id: number;
    code: string;
    amount: number;
    is_redeemed: boolean;
    redeemed_by_id?: number | null;
    redeemed_at?: string | null;
    created_at: string;
}

export interface MobileTransaction {
    id: number;
    phone: string;
    amount: number;
    currency: string;
    reference: string;
    timestamp: string;
    is_linked: boolean;
    is_rejected: boolean;
    linked_promotion_id?: number | null;
    created_at: string;
}

export interface PromotionRead {
    id: number;
    listing_id: number;
    plan_id: number;
    status: 'waiting_for_payment' | 'pending' | 'paid' | 'submitted' | 'approved' | 'rejected' | 'expired';
    payment_phone?: string | null;
    amount: number;
    payment_proof?: string | null;
    admin_notes?: string | null;
    promotion_code?: string | null;
    created_at: string;
    updated_at: string;
    expires_at?: string | null;
    listing_title_en?: string;
    listing_title_so?: string;
    plan_name_en?: string;
    plan_name_so?: string;
}

export interface AgentSignup {
    id: number;
    full_name: string;
    email: string;
    phone?: string | null;
    created_at: string;
    is_active: boolean;
    ad_count: number;
    has_posted: boolean;
}

export interface AgentListingRow {
    id: number;
    title: string;
    title_so?: string;
    is_active: boolean;
    status: string;
    created_at: string;
    updated_at: string;
    owner_id: number;
    owner_name?: string;
    owner_email?: string;
    owner_phone?: string | null;
    price: number;
    location: string;
    boost_level?: number;
    views?: number;
}

export interface AgentConversions {
    total_users: number;
    users_with_ads: number;
    conversion_rate: number;
    signups_today: number;
    signups_week: number;
    ads_today: number;
    ads_week: number;
    active_listings: number;
}

export interface MarketingCode {
    id: number;
    code: string;
    description: string;
    created_by: string;
    max_uses?: number | null;
    uses_count: number;
    ads_posted_count: number;
    is_active: boolean;
    expires_at?: string | null;
    created_at: string;
    conversion_rate: number;
    is_expired: boolean;
}

export interface AuditLogEntry {
    id: number;
    user_id?: number | null;
    action: string;
    resource_type: string;
    resource_id?: string | null;
    details?: string | null;
    timestamp: string;
    user_email?: string | null;
    user_name?: string | null;
}

export interface SavedAddress {
    id: number;
    user_id: number;
    label: string;
    formatted_address: string;
    lat?: number | null;
    lng?: number | null;
    is_default: boolean;
    created_at: string;
}

export interface OtpLookupResult {
    found: boolean;
    channel?: 'sms' | 'email';
    identifier?: string;
    code?: string;
    expires_in_seconds?: number;
    message: string;
}

export interface OtpLogEntry {
    id: number;
    identifier: string;
    channel: string;
    event_type: string;
    status: string;
    attempt_count: number;
    expires_at?: string | null;
    created_at: string;
    meta?: unknown;
}

export interface VerificationAttemptsResult {
    user: { id: number; full_name: string; email: string; phone?: string | null; is_verified: boolean } | null;
    attempts: { id: number; document_type: string; status: string; created_at: string; auto_verification_status?: string | null }[];
}

export interface EmailCampaignStats {
    sent: number;
    opened: number;
    clicked: number;
    failed: number;
    total: number;
    open_rate: string;
    click_rate: string;
    ctr: string;
}

export interface EmailAnalytics {
    campaigns: Record<string, EmailCampaignStats>;
    onboarding_funnel: {
        welcome_sent: number;
        welcome_opened: number;
        profile_sent: number;
        first_action_sent: number;
        welcome_to_open_ratio: string;
        profile_completion_ratio: string;
        activation_conversion_ratio: string;
    };
    regional_engagement: {
        total_tracked_hits: number;
        top_regions: { region_cluster: string; hits: number }[];
    };
}

export interface ChatMessage {
    id: number;
    sender_id: number;
    receiver_id?: number;
    recipient_id?: number;
    business_id?: string;
    content: string;
    is_read?: boolean;
    created_at?: string;
    timestamp?: string;
    listing_id?: number | null;
    product_shared?: Listing;
}
