export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export type ReportStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'pending_verification'
  | 'resolved'
  | 'needs_review'
  | 'pending_admin_review'
  | 'rejected';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'unknown';

export type WasteType =
  | 'plastic'
  | 'organic'
  | 'paper'
  | 'glass'
  | 'metal'
  | 'e_waste'
  | 'hazardous'
  | 'mixed'
  | 'unknown';

export interface ReportItem {
  report_id: string;
  citizen_phone: string;
  worker_phone: string | null;
  worker_phones?: string[];
  assigned_workers_count?: number;
  photo_before_url: string;
  photo_after_url?: string | null;
  start_photo_url?: string | null;
  finish_photo_url?: string | null;
  location_before: LocationCoordinates;
  location_after?: LocationCoordinates | null;
  start_location?: LocationCoordinates | null;
  finish_location?: LocationCoordinates | null;
  arrival_location?: LocationCoordinates | null;
  waste_type: WasteType;
  fill_percent: number;
  urgency: UrgencyLevel;
  priority_score: number;
  estimated_workers_needed: number;
  estimated_minutes_to_clean: number;
  original_estimated_minutes?: number | null;
  adjusted_estimated_minutes?: number | null;
  recalculated_estimated_time?: number | null;
  arrival_time?: string | null;
  start_time?: string | null;
  finish_time?: string | null;
  actual_duration?: number | null;
  truth_percentage?: number | null;
  /** Which gate(s) failed and the actual numbers, e.g. "GPS distance 120m > 50m limit" */
  review_reason?: string | null;
  reward_coupon_code?: string | null;
  reward_coupon_id?: string | null;
  confidence?: number | null;
  suspicious_flag?: boolean | null;
  segregation_quality?: string | null;
  recycling_category?: string | null;
  purity_score?: number | null;
  assigned_warehouse_id?: string | null;
  assigned_warehouse_name?: string | null;
  warehouse_status?: 'pending_pickup' | 'special_handling_required' | 'received' | string | null;
  estimated_weight_kg?: number | null;
  estimated_revenue?: number | null;
  rejected_at?: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface WarehouseItem {
  warehouse_id: string;
  name: string;
  location: LocationCoordinates;
  accepted_categories: string[];
  city?: string;
  area?: string;
}

export interface WorkerItem {
  worker_id: string;
  name: string;
  phone: string;
  photo_url?: string;
  last_known_location: LocationCoordinates;
  status: 'free' | 'busy';
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Vendor + Coupon types
// ---------------------------------------------------------------------------

export type OfferType = 'flat_off' | 'percent_off' | 'min_spend_gift';

export interface CouponTemplate {
  template_id?: string;
  offer_type: OfferType;
  /** Numeric discount amount, or a gift description string for min_spend_gift */
  value: number | string;
  min_spend?: number | null;
  description: string;
  validation: string;
}

export interface VendorItem {
  vendor_id: string;
  vendor_name: string;
  category: string;
  description?: string;
  city?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  location?: LocationCoordinates;
  coupon_templates: CouponTemplate[];
  created_at?: string;
}

export interface CouponItem {
  coupon_id: string;
  code: string;
  report_id: string;
  citizen_phone?: string;
  vendor_name: string;
  vendor_category?: string;
  vendor_city?: string;
  vendor_area?: string;
  offer_type: OfferType;
  offer_description: string;
  validation_text?: string;
  status: 'issued' | 'redeemed';
  issued_at: string;
  valid_until?: string;
}

