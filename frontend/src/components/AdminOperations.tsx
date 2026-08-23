import React, { useState } from 'react';
import { useVendors } from '../hooks/useVendors';
import type { VendorItem, CouponTemplate, OfferType } from '../types';
import {
  Store,
  Plus,
  X,
  Tag,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Gift,
  Percent,
  Banknote,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { lookupPincode, QUICK_AREAS } from '../utils/pincode';

interface Toast {
  message: string;
  type: 'success' | 'error';
}

interface AdminOperationsProps {
  onToast?: (msg: string, type: 'success' | 'error') => void;
}

// ─── Offer type badge config ────────────────────────────────────────────────
const OFFER_CONFIG: Record<OfferType, { label: string; icon: React.ReactNode; color: string }> = {
  flat_off: {
    label: 'Flat OFF',
    icon: <Banknote className="w-3 h-3" />,
    color: 'bg-[#a4d4c5] text-[#0a3a2a]',
  },
  percent_off: {
    label: '% OFF',
    icon: <Percent className="w-3 h-3" />,
    color: 'bg-[#b8a4ed] text-[#4a2e80]',
  },
  min_spend_gift: {
    label: 'Gift Item',
    icon: <Gift className="w-3 h-3" />,
    color: 'bg-[#ffb084] text-[#8f3e09]',
  },
};

// ─── AddVendorDialog ────────────────────────────────────────────────────────
interface AddVendorDialogProps {
  onClose: () => void;
  onSave: (v: {
    vendor_name: string;
    category: string;
    description: string;
    city?: string;
    area?: string;
    latitude?: number;
    longitude?: number;
    coupon_templates: CouponTemplate[];
  }) => Promise<void>;
}

const BLANK_TEMPLATE: CouponTemplate = {
  offer_type: 'flat_off',
  value: 30,
  min_spend: 199,
  description: 'Flat ₹30 off on orders above ₹199',
  validation: 'Valid once per user, expires 30 days from issue',
};

function AddVendorDialog({ onClose, onSave }: AddVendorDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Grocery');
  const [desc, setDesc] = useState('');
  const [city, setCity] = useState('Bangalore');
  const [area, setArea] = useState('Central');
  const [latitude, setLatitude] = useState<string>('12.9716');
  const [longitude, setLongitude] = useState<string>('77.5946');
  const [templates, setTemplates] = useState<CouponTemplate[]>([{ ...BLANK_TEMPLATE }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateTemplate = (idx: number, key: keyof CouponTemplate, val: string | number | null) => {
    setTemplates((prev) => prev.map((t, i) => (i === idx ? { ...t, [key]: val } : t)));
  };

  const addTemplate = () => setTemplates((prev) => [...prev, { ...BLANK_TEMPLATE }]);
  const removeTemplate = (idx: number) =>
    setTemplates((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Vendor name is required');
    setSaving(true);
    setError('');
    try {
      await onSave({
        vendor_name: name.trim(),
        category,
        description: desc,
        city: city.trim(),
        area: area.trim(),
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        coupon_templates: templates,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-white text-[#0a0a0a] rounded-xl px-4 py-2.5 text-xs font-medium placeholder:text-[#9a9a9a] border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] transition-all shadow-xs';
  const labelCls = 'block text-[10px] font-mono font-bold uppercase tracking-wider text-[#6a6a6a] mb-1.5';

  return (
    <div
      className="fixed inset-0 z-[3000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#fffaf0] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border-2 border-[#e5e5e5] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog header */}
        <div className="px-7 py-5 flex items-center justify-between border-b border-[#e5e5e5] bg-[#faf5e8]">
          <div>
            <h2 className="text-base font-display font-bold tracking-tight text-[#0a0a0a] leading-none">
              Enroll Reward Vendor Partner
            </h2>
            <p className="text-xs text-[#6a6a6a] mt-1">
              Configure hyperlocal merchant targeting &amp; WhatsApp coupon rules.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6a6a6a] hover:text-[#0a0a0a] hover:bg-[#f5f0e0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4 overflow-y-auto flex-1 bg-[#fffaf0]">
          {/* Vendor Name */}
          <div>
            <label className={labelCls}>Merchant / Brand Name</label>
            <input
              className={inputCls}
              placeholder="e.g. BigBasket, Blue Tokai, Blinkit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Category + Description */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Category</label>
              <select
                className={inputCls}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {['Grocery', 'Electronics', 'Cafe', 'Restaurant', 'Pharmacy', 'Fashion', 'General'].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tagline / Description</label>
              <input
                className={inputCls}
                placeholder="e.g. 10-minute grocery delivery"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
          </div>

          {/* Pincode & Area Preset Selector */}
          <div className="p-3.5 bg-[#faf5e8] rounded-2xl border border-[#e5e5e5] space-y-3 shadow-xs">
            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1">
                  <Compass className="w-3 h-3 text-[#ff4d8b]" />
                  Quick Area Preset (Bhubaneswar / Metro)
                </span>
              </label>
              <select
                onChange={(e) => {
                  const code = e.target.value;
                  const info = lookupPincode(code);
                  if (info) {
                    setCity(info.city);
                    setArea(info.area);
                    setLatitude(info.lat.toString());
                    setLongitude(info.lng.toString());
                  }
                }}
                defaultValue="751024"
                className="w-full bg-white text-[#0a0a0a] border border-[#e5e5e5] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] cursor-pointer"
              >
                {QUICK_AREAS.map((a) => (
                  <option key={a.pincode} value={a.pincode}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            {/* City + Area */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={labelCls}>City</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Bhubaneswar"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Neighborhood / Area</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Patia / KIIT"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
              </div>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={labelCls}>Latitude</label>
                <input
                  className={inputCls}
                  type="number"
                  step="any"
                  placeholder="20.3533"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Longitude</label>
                <input
                  className={inputCls}
                  type="number"
                  step="any"
                  placeholder="85.8197"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Coupon Templates */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className={labelCls + ' mb-0'}>Coupon Templates</label>
              <button
                type="button"
                onClick={addTemplate}
                className="flex items-center gap-1 text-xs font-bold text-[#0a0a0a] hover:text-[#ff4d8b] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Tier
              </button>
            </div>
            <div className="space-y-3">
              {templates.map((tpl, idx) => (
                <div
                  key={idx}
                  className="bg-[#faf5e8] rounded-2xl p-4 space-y-3 relative border border-[#e5e5e5] shadow-sm"
                >
                  {templates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTemplate(idx)}
                      className="absolute top-3 right-3 p-1 rounded-lg text-[#6a6a6a] hover:text-[#ef4444] hover:bg-white/80 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Offer Type</label>
                      <select
                        className={inputCls}
                        value={tpl.offer_type}
                        onChange={(e) => updateTemplate(idx, 'offer_type', e.target.value)}
                      >
                        <option value="flat_off">Flat ₹ OFF</option>
                        <option value="percent_off">% OFF</option>
                        <option value="min_spend_gift">Gift on Min Spend</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Value</label>
                      <input
                        className={inputCls}
                        placeholder={tpl.offer_type === 'min_spend_gift' ? 'Gift Hamper' : '30'}
                        value={String(tpl.value)}
                        onChange={(e) =>
                          updateTemplate(idx, 'value', e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Min Spend (₹)</label>
                      <input
                        className={inputCls}
                        type="number"
                        placeholder="0 = no minimum"
                        value={tpl.min_spend ?? ''}
                        onChange={(e) =>
                          updateTemplate(idx, 'min_spend', e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Display Description</label>
                      <input
                        className={inputCls}
                        placeholder="e.g. Flat ₹30 off on orders"
                        value={tpl.description}
                        onChange={(e) => updateTemplate(idx, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Validation Rule</label>
                    <input
                      className={inputCls}
                      placeholder="Valid once per user, expires 30 days from issue"
                      value={tpl.validation}
                      onChange={(e) => updateTemplate(idx, 'validation', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 text-xs text-[#ef4444] font-bold bg-[#ffe9f1] p-3 rounded-xl border border-[#ff4d8b]/40">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-[#e5e5e5] text-xs font-semibold text-[#3a3a3a] bg-white hover:bg-[#faf5e8] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-11 rounded-xl bg-[#0a0a0a] text-white text-xs font-bold hover:bg-[#1f1f1f] disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Registering Vendor...' : 'Save Vendor Partner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── VendorCard ──────────────────────────────────────────────────────────────
function VendorCard({ vendor }: { vendor: VendorItem }) {
  const [expanded, setExpanded] = useState(false);
  const templates = vendor.coupon_templates || [];

  return (
    <div className="border border-white/12 rounded-2xl overflow-hidden bg-surface-dark-elevated/80 transition-all hover:border-white/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/10 shadow-xs">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-display font-semibold text-white leading-none">
              {vendor.vendor_name}
            </p>
            <p className="text-[11px] text-[#a0a0a0] mt-1 font-mono">
              {vendor.category}
              {vendor.city ? ` · ${vendor.city}${vendor.area ? ` (${vendor.area})` : ''}` : ''}
              {templates.length > 0 ? ` · ${templates.length} reward template${templates.length > 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-[#a0a0a0] transition-transform duration-200 ${expanded ? 'rotate-90 text-white' : ''}`}
        />
      </button>

      {expanded && templates.length > 0 && (
        <div className="px-5 pb-4 space-y-2 border-t border-white/10 pt-3.5 bg-black/20">
          {templates.map((t, i) => {
            const cfg = OFFER_CONFIG[t.offer_type] || OFFER_CONFIG.flat_off;
            return (
              <div key={i} className="bg-white/5 rounded-xl px-3.5 py-3 flex items-start gap-3 border border-white/5">
                <span className={`mt-0.5 flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${cfg.color} shrink-0`}>
                  {cfg.icon} {cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white font-medium leading-snug">{t.description}</p>
                  <p className="text-[10px] text-[#a0a0a0] mt-0.5 truncate font-mono">{t.validation}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && templates.length === 0 && (
        <div className="px-5 pb-4 border-t border-white/10 pt-3 bg-black/20">
          <p className="text-[12px] text-[#a0a0a0]">No coupon templates defined.</p>
        </div>
      )}
    </div>
  );
}

// ─── AdminOperations (main export) ──────────────────────────────────────────
export const AdminOperations: React.FC<AdminOperationsProps> = ({ onToast }) => {
  const { vendors, loading: vendorsLoading, addVendor, fetchVendors } = useVendors();
  const [showDialog, setShowDialog] = useState(false);
  const [localToast, setLocalToast] = useState<Toast | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setLocalToast({ message, type });
    onToast?.(message, type);
    setTimeout(() => setLocalToast(null), 3500);
  };

  const handleSaveVendor = async (payload: Parameters<typeof addVendor>[0]) => {
    await addVendor(payload);
    showToast(`✅ ${payload.vendor_name} added to reward partner network.`, 'success');
    fetchVendors();
  };

  return (
    <>
      {/* Local Toast */}
      {localToast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[4000] flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-semibold transition-all ${
            localToast.type === 'success'
              ? 'bg-ink text-white border border-white/20'
              : 'bg-destructive text-white'
          }`}
        >
          {localToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-brand-mint shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {localToast.message}
        </div>
      )}

      {/* Add Vendor Dialog */}
      {showDialog && (
        <AddVendorDialog onClose={() => setShowDialog(false)} onSave={handleSaveVendor} />
      )}

      {/* Page Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page header */}
        <div className="border-b border-hairline pb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-surface-card border border-hairline text-ink">
              MUNICIPAL GOVERNANCE &amp; PARTNER NETWORK
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-ink leading-tight tracking-tight-md">
            Operations &amp; Citizen Rewards Orchestration
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-3xl leading-relaxed">
            Manage local commercial partners and automated incentive mechanics. When field sanitation cleanups pass the two-gate audit, PingBin automatically issues targeted vendor vouchers directly to the citizen via WhatsApp.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ─── Left: Pipeline Explainer ─────────────────────────────────── */}
          <div className="lg:col-span-5 space-y-5">
            {/* How it works card */}
            <div className="bg-surface-card rounded-2xl p-6 border border-hairline shadow-clay-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl bg-ink flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4 text-brand-mint" />
                </div>
                <div>
                  <h2 className="text-base font-display font-semibold text-ink tracking-tight-xs">
                    Autonomous Dispatch Pipeline
                  </h2>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">
                    Zero-App Friction Architecture
                  </p>
                </div>
              </div>

              <div className="space-y-4 mt-5">
                {[
                  {
                    step: '01',
                    title: 'Citizen WhatsApp Intake',
                    desc: 'Citizen sends photo + live location pin. AWS SQS queue buffers intake. Bedrock Nova Lite classifies waste type, fill level, and urgency.',
                    color: '#a4d4c5', // brand-mint
                  },
                  {
                    step: '02',
                    title: '5-Line Scoring & Auto-Dispatch',
                    desc: 'Inline formula computes 0–100 priority index (40% fill + 20% waste type + 15% urgency + 15% SLA decay + 10% density). Nearest free worker dispatched.',
                    color: '#b8a4ed', // brand-lavender
                  },
                  {
                    step: '03',
                    title: 'Two-Gate Verification Engine',
                    desc: 'Worker submits arrival & completion proofs. Strict Gate A (GPS Haversine ≤ 50m) and Gate B (Truth Score ≥ 50%) validation. Zero AI hallucination.',
                    color: '#ffb084', // brand-peach
                  },
                  {
                    step: '04',
                    title: 'Hyperlocal Citizen Reward',
                    desc: 'On verified pass, unique coupon code is minted from registered vendors (BigBasket, Swiggy, local cafes) and pushed to citizen WhatsApp instantly.',
                    color: '#e8b94a', // brand-ochre
                  },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3.5">
                    <div
                      className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-mono text-[11px] font-extrabold text-ink shadow-xs"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.step}
                    </div>
                    <div>
                      <p className="text-xs font-display font-semibold text-ink leading-none">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-body mt-1 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification gates breakdown */}
            <div className="bg-surface-card rounded-2xl p-5 border border-hairline shadow-clay-sm space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-teal" />
                <h3 className="text-xs font-display font-semibold text-ink uppercase tracking-tight-xs">
                  Two-Gate Anti-Fake-Work Safeguard
                </h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-canvas rounded-xl border border-hairline">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-ink font-semibold text-xs">Gate A — GPS Radius</strong>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#a4d4c5] text-[#0a3a2a]">
                      ≤ 50 Meters
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Haversine distance between worker arrival coordinates and incident location must not exceed 50 meters.
                  </p>
                </div>

                <div className="p-3 bg-canvas rounded-xl border border-hairline">
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-ink font-semibold text-xs">Gate B — Truth Score</strong>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e8b94a] text-[#735100]">
                      ≥ 50% Time Ratio
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Truth Score = <code className="font-mono text-ink">min(100, round(actual_duration / adjusted_est × 100))</code>. Prevents instant fake completions.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Right: Vendor Management (dark teal surface) ─────────────── */}
          <div className="lg:col-span-7 rounded-2xl overflow-hidden bg-surface-dark shadow-clay-dark border border-white/10">
            {/* Panel header */}
            <div className="px-7 py-6 border-b border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-mint">
                      Hyperlocal Partner Directory
                    </span>
                  </div>
                  <h2 className="text-2xl font-display font-semibold text-white leading-tight tracking-tight-xs">
                    Reward Vendor Partners
                  </h2>
                  <p className="text-xs text-[#a0a0a0] mt-1">
                    Registered merchants providing redeemable citizen coupons.
                  </p>
                </div>

                {/* Add Vendor button */}
                <button
                  onClick={() => setShowDialog(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-canvas text-ink hover:bg-surface-soft active:scale-[0.98] transition-all shadow-clay-sm shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Vendor</span>
                </button>
              </div>
            </div>

            {/* Vendor list */}
            <div className="px-7 py-5 space-y-3 min-h-[340px] max-h-[500px] overflow-y-auto pr-4 scrollbar-thin">
              {vendorsLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-[#a0a0a0]">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-xs font-mono">Syncing Partner Directory...</span>
                </div>
              ) : vendors.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center p-6 bg-white/5 rounded-2xl border border-white/5">
                  <Store className="w-10 h-10 text-[#a0a0a0] mb-3 opacity-40" />
                  <p className="text-sm font-semibold text-white">No custom vendors registered.</p>
                  <p className="text-xs text-[#a0a0a0] mt-1 max-w-sm">
                    System automatically falls back to integrated municipal sponsors (BigBasket, Swiggy, Blinkit, Starbucks).
                  </p>
                </div>
              ) : (
                vendors.map((v) => <VendorCard key={v.vendor_id} vendor={v} />)
              )}
            </div>

            {/* Footer hint */}
            <div className="px-7 py-4 border-t border-white/10 bg-black/20 flex items-center justify-between text-xs text-[#a0a0a0]">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-brand-mint" />
                <span>
                  Format: <code className="font-mono text-brand-mint">CL-[VND]-[CODE]-[TYPE]</code>
                </span>
              </div>
              <span className="font-mono text-[10px] text-white/60">
                Auto-assigned on verified cleanup
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
