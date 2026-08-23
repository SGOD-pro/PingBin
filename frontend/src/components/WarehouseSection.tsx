import React, { useState, useEffect } from 'react';
import type { ReportItem, WarehouseItem } from '../types';
import {
  Warehouse,
  IndianRupee,
  Scale,
  Building2,
  Sparkles,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  PackagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import * as api from '../lib/api';
import { WarehouseFormSchema, type WarehouseFormData } from '../lib/schemas';

interface WarehouseSectionProps {
  reports: ReportItem[];
  onSelectReport?: (report: ReportItem) => void;
}

export const WarehouseSection: React.FC<WarehouseSectionProps> = ({
  reports,
  onSelectReport,
}) => {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);

  // Modal States
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);
  const [assigningReport, setAssigningReport] = useState<ReportItem | null>(null);

  // Add Warehouse Form State
  const [whForm, setWhForm] = useState<WarehouseFormData>({
    name: '',
    category: 'mixed',
    rate_per_kg: 8,
    capacity_kg: 5000,
    address: '',
    latitude: 20.3533,
    longitude: 85.8197,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submittingWh, setSubmittingWh] = useState(false);

  // Assign Form State
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [measuredWeightKg, setMeasuredWeightKg] = useState<number>(25);
  const [submittingAssign, setSubmittingAssign] = useState(false);

  const getWarehouseRate = (wh?: WarehouseItem | null): number => {
    if (!wh) return 8.0;
    const raw = (wh as any).rate_per_kg ?? (wh as any).price_per_kg;
    const val = typeof raw === 'number' ? raw : parseFloat(raw);
    return isNaN(val) || val <= 0 ? 8.0 : val;
  };

  const getWarehouseCategory = (wh?: WarehouseItem | null): string => {
    if (!wh) return 'Mixed';
    if (wh.category && wh.category.trim()) return wh.category;
    if (wh.accepted_categories && wh.accepted_categories.length > 0) return wh.accepted_categories[0];
    return 'Mixed';
  };

  const fetchWarehouses = React.useCallback(async () => {
    try {
      const data = await api.getWarehouses();
      setWarehouses(data);
      if (data.length > 0) {
        setSelectedWarehouseId((prev) => prev || data[0].warehouse_id);
      }
    } catch (err) {
      console.error('Failed to load warehouses:', err);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  // Resolved reports that entered the warehouse recycling pipeline
  const resolvedReports = reports.filter((r) => r.status === 'resolved');

  // Calculation helpers
  const getReportWeight = (r: ReportItem): number =>
    r.estimated_weight_kg !== undefined && r.estimated_weight_kg !== null && !isNaN(Number(r.estimated_weight_kg))
      ? Number(r.estimated_weight_kg)
      : r.fill_percent
      ? Number(r.fill_percent) * 0.5
      : 25;

  const getReportRevenue = (r: ReportItem): number => {
    if (r.estimated_revenue !== undefined && r.estimated_revenue !== null && !isNaN(Number(r.estimated_revenue))) {
      return Number(r.estimated_revenue);
    }
    const weight = getReportWeight(r);
    const cat = (r.recycling_category || r.waste_type || 'mixed').toLowerCase();
    const rateMap: Record<string, number> = {
      plastic: 12,
      metal: 16,
      paper_cardboard: 6,
      glass: 5,
      hazardous_medical: 8,
      organic: 6,
      mixed: 8,
    };
    const baseRate = rateMap[cat] ?? 8;
    const purity = typeof r.purity_score === 'number' && !isNaN(r.purity_score) ? r.purity_score : 85;
    return Number(((weight * baseRate * purity) / 100).toFixed(2));
  };

  // Compute dynamic aggregates
  const totalRevenue = resolvedReports.reduce((sum, r) => sum + getReportRevenue(r), 0);
  const totalWeightKg = resolvedReports.reduce((sum, r) => sum + getReportWeight(r), 0);
  const activeWarehouseCount = warehouses.length > 0 ? warehouses.length : 4;

  // Handle Add Warehouse
  const handleAddWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const result = WarehouseFormSchema.safeParse(whForm);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errors[issue.path[0].toString()] = issue.message;
      });
      setFormErrors(errors);
      toast.error('Validation Error', {
        description: 'Please correct the invalid warehouse fields.',
      });
      return;
    }

    setSubmittingWh(true);
    const toastId = toast.loading('Registering MRF facility in logistics ledger...');

    try {
      await api.createWarehouse({
        name: result.data.name,
        category: result.data.category,
        rate_per_kg: result.data.rate_per_kg,
        capacity_kg: result.data.capacity_kg,
        address: result.data.address,
        latitude: result.data.latitude,
        longitude: result.data.longitude,
        accepted_categories: [result.data.category],
      });

      toast.success('MRF Facility Registered', {
        id: toastId,
        description: `${result.data.name} is now accepting ${result.data.category} shipments at ₹${result.data.rate_per_kg}/kg.`,
      });

      setIsAddWarehouseOpen(false);
      setWhForm({
        name: '',
        category: 'mixed',
        rate_per_kg: 8,
        capacity_kg: 5000,
        address: '',
        latitude: 20.3533,
        longitude: 85.8197,
      });
      fetchWarehouses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create warehouse';
      toast.error('Creation Failed', {
        id: toastId,
        description: msg,
      });
    } finally {
      setSubmittingWh(false);
    }
  };

  // Open Assign Modal
  const openAssignModal = (report: ReportItem) => {
    setAssigningReport(report);
    setMeasuredWeightKg(getReportWeight(report));
    if (warehouses.length > 0) {
      // Find matching category warehouse or default to first
      const cat = (report.recycling_category || report.waste_type || '').toLowerCase();
      const match = warehouses.find((w) => w.category === cat || (w.accepted_categories || []).includes(cat));
      setSelectedWarehouseId(match ? match.warehouse_id : warehouses[0].warehouse_id);
    }
  };

  // Handle Assign Submit
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningReport || !selectedWarehouseId) return;

    setSubmittingAssign(true);
    const toastId = toast.loading('Assigning waste shipment to recycling depot...');

    try {
      const res = await api.assignReportToWarehouse(
        assigningReport.report_id,
        selectedWarehouseId,
        measuredWeightKg
      );

      toast.success('Shipment Assigned to Facility', {
        id: toastId,
        description: `Dispatched to ${res.result?.assigned_warehouse_name} • Valuation: ₹${res.result?.actual_revenue}.`,
      });

      setAssigningReport(null);
      await fetchWarehouses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign warehouse';
      toast.error('Assignment Failed', {
        id: toastId,
        description: msg,
      });
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Selected warehouse rate for live calculation
  const currentSelectedWh = warehouses.find((w) => w.warehouse_id === selectedWarehouseId) || warehouses[0];
  const currentRate = getWarehouseRate(currentSelectedWh);
  const currentPurity = typeof assigningReport?.purity_score === 'number' && !isNaN(assigningReport.purity_score) ? assigningReport.purity_score : 85;
  const safeWeight = typeof measuredWeightKg === 'number' && !isNaN(measuredWeightKg) ? measuredWeightKg : 25;
  const liveCalculatedRevenue = ((safeWeight * currentRate * currentPurity) / 100).toFixed(2);

  return (
    <div className="space-y-6">
      {/* ── Dynamic Top 3 KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Recycling Revenue */}
        <div className="bg-[#faf5e8] border border-[#e5e5e5] rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6a6a6a]">
              Estimated Recycling Revenue
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#dcfce7] text-[#166534] flex items-center justify-center shadow-xs">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl lg:text-[44px] font-display font-black text-[#0a0a0a] tracking-tight leading-none">
              ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-[#166534] mt-2 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Dynamic material purity &amp; ₹/kg facility valuation
            </p>
          </div>
        </div>

        {/* Total Recovered Biomass / Weight */}
        <div className="bg-[#faf5e8] border border-[#e5e5e5] rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6a6a6a]">
              Total Recovered Weight
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center shadow-xs">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-display font-extrabold text-[#0a0a0a] tracking-tight">
              {totalWeightKg.toFixed(1)} <span className="text-lg font-normal text-[#6a6a6a]">kg</span>
            </div>
            <p className="text-xs text-[#0369a1] mt-1 font-semibold">
              Diverted across {resolvedReports.length} resolved cleanup missions
            </p>
          </div>
        </div>

        {/* Active Warehouses */}
        <div className="bg-[#faf5e8] border border-[#e5e5e5] rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6a6a6a]">
              Active MRF Facilities
            </span>
            <div className="w-9 h-9 rounded-2xl bg-[#fef3c7] text-[#92400e] flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-display font-extrabold text-[#0a0a0a] tracking-tight">
              {activeWarehouseCount}{' '}
              <span className="text-lg font-normal text-[#6a6a6a]">Hubs</span>
            </div>
            <p className="text-xs text-[#92400e] mt-1 font-semibold">
              Bhubaneswar Materials Recovery Network
            </p>
          </div>
        </div>
      </div>

      {/* ── Shipments Table & Facility Assignment Section ────────────────── */}
      <div className="bg-[#faf5e8] border border-[#e5e5e5] rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5e5e5] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#0a0a0a] text-white flex items-center justify-center shadow-xs">
                <Warehouse className="w-4 h-4 text-[#a4d4c5]" />
              </div>
              <h3 className="font-display font-bold text-lg text-[#0a0a0a]">
                Recycling Logistics &amp; Warehouse Shipments
              </h3>
            </div>
            <p className="text-xs text-[#6a6a6a] mt-1">
              Select resolved waste tickets to assign to designated Material Recovery Facilities (MRFs) with measured weight.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddWarehouseOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <Plus className="w-3.5 h-3.5 text-[#a4d4c5]" />
              <span>Add Facility</span>
            </button>
            <span className="text-xs font-mono font-bold px-3 py-1 bg-white rounded-full border border-[#e5e5e5] text-[#0a0a0a]">
              {resolvedReports.length} Shipments
            </span>
          </div>
        </div>

        {/* Shipments Table */}
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#faf5e8]/95 backdrop-blur-xs z-10">
              <tr className="border-b border-[#e5e5e5] text-[10px] font-mono uppercase tracking-wider text-[#6a6a6a]">
                <th className="py-2.5 px-4 font-bold">Report ID</th>
                <th className="py-2.5 px-4 font-bold">Waste Stream</th>
                <th className="py-2.5 px-4 font-bold">Purity %</th>
                <th className="py-2.5 px-4 font-bold">Assigned Facility</th>
                <th className="py-2.5 px-4 font-bold">Est. Weight</th>
                <th className="py-2.5 px-4 font-bold">Est. Revenue</th>
                <th className="py-2.5 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]/60 text-xs">
              {resolvedReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#9a9a9a]">
                    No resolved waste reports ready for warehouse assignment.
                  </td>
                </tr>
              ) : (
                resolvedReports.map((r, idx) => {
                  const weight = getReportWeight(r);
                  const revenue = getReportRevenue(r);
                  const purity = r.purity_score ?? 85;
                  const isAssigned = Boolean(r.assigned_warehouse_name || r.assigned_warehouse_id);

                  return (
                    <tr
                      key={r.report_id || idx}
                      className="hover:bg-white/60 transition-all cursor-pointer"
                      onClick={() => onSelectReport?.(r)}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#0a0a0a]">
                        #{r.report_id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 capitalize font-semibold text-[#0a0a0a]">
                        {r.recycling_category || r.waste_type || 'Mixed Waste'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#166534]">
                        <span className="px-2 py-0.5 rounded-full bg-[#dcfce7] border border-[#86efac]">
                          {purity}%
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#0a0a0a]">
                        {isAssigned ? (
                          <div className="flex items-center gap-1.5 font-bold text-xs text-[#0a0a0a]">
                            <Building2 className="w-3.5 h-3.5 text-[#0369a1]" />
                            <span>{r.assigned_warehouse_name || 'Assigned MRF'}</span>
                          </div>
                        ) : (
                          <span className="text-[#9a9a9a] italic text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#3a3a3a] font-bold">
                        {weight.toFixed(1)} kg
                      </td>
                      <td className="py-3 px-4 font-mono font-extrabold text-[#166534]">
                        ₹{revenue.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openAssignModal(r)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                          title="Assign or reassign facility"
                        >
                          <PackagePlus className="w-3.5 h-3.5 text-[#a4d4c5]" />
                          <span>{isAssigned ? 'Reassign' : 'Assign Facility'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Registered Facilities Grid ───────────────────────────────────── */}
      <div className="bg-[#faf5e8] border border-[#e5e5e5] rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
          <h4 className="font-display font-bold text-base text-[#0a0a0a]">
            Registered Materials Recovery Facilities (MRF)
          </h4>
          <span className="text-xs font-mono text-[#6a6a6a]">
            {warehouses.length} Active Hubs
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {warehouses.map((wh) => (
            <div
              key={wh.warehouse_id}
              className="bg-white rounded-2xl p-4 border border-[#e5e5e5] shadow-xs flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#faf5e8] text-[#0a0a0a] border border-[#e5e5e5]">
                    {wh.category || 'Recycling'}
                  </span>
                  <span className="text-xs font-mono font-extrabold text-[#166534]">
                    ₹{Number(wh.rate_per_kg || 8).toFixed(1)}/kg
                  </span>
                </div>
                <h5 className="font-bold text-sm text-[#0a0a0a] mt-2 leading-tight">
                  {wh.name}
                </h5>
                <p className="text-xs text-[#6a6a6a] mt-1 line-clamp-2">
                  {wh.address || `${wh.area || 'Bhubaneswar'}, ${wh.city || 'Odisha'}`}
                </p>
              </div>

              <div className="pt-2 border-t border-[#e5e5e5] flex items-center justify-between text-xs text-[#6a6a6a]">
                <span>Capacity: <strong className="text-[#0a0a0a] font-mono">{Number(wh.capacity_kg || 5000).toLocaleString()} kg</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MODAL 1: Add New Warehouse Facility ──────────────────────────── */}
      {isAddWarehouseOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#fffaf0] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[#e5e5e5] shadow-2xl relative">
            <button
              onClick={() => setIsAddWarehouseOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-[#faf5e8] text-[#6a6a6a] hover:text-[#0a0a0a] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#e5e5e5] pb-4 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#0a0a0a] text-[#a4d4c5] flex items-center justify-center shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-[#0a0a0a]">
                  Register New MRF Facility
                </h3>
                <p className="text-xs text-[#6a6a6a]">
                  Add a recycling depot or composting plant to the municipal network.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddWarehouseSubmit} className="space-y-4">
              {/* Facility Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3a3a3a] mb-1.5">
                  Facility Name
                </label>
                <input
                  type="text"
                  value={whForm.name}
                  onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                  placeholder="e.g. Khandagiri Plastic Reclamation Depot"
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] ${
                    formErrors.name ? 'border-rose-500' : 'border-[#e5e5e5]'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.name}</p>
                )}
              </div>

              {/* Category & Buying Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3a3a3a] mb-1.5">
                    Waste Stream
                  </label>
                  <select
                    value={whForm.category}
                    onChange={(e) => setWhForm({ ...whForm, category: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5e5] bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]"
                  >
                    <option value="mixed">Mixed Materials (Default)</option>
                    <option value="plastic">Plastic (PET / HDPE)</option>
                    <option value="metal">Metal &amp; Aluminium</option>
                    <option value="paper_cardboard">Paper &amp; Cardboard</option>
                    <option value="organic">Organic Compost</option>
                    <option value="hazardous_medical">Hazardous &amp; Medical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3a3a3a] mb-1.5">
                    Buying Rate (₹/kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={whForm.rate_per_kg}
                    onChange={(e) => setWhForm({ ...whForm, rate_per_kg: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] ${
                      formErrors.rate_per_kg ? 'border-rose-500' : 'border-[#e5e5e5]'
                    }`}
                  />
                  {formErrors.rate_per_kg && (
                    <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.rate_per_kg}</p>
                  )}
                </div>
              </div>

              {/* Capacity & Address */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3a3a3a] mb-1.5">
                    Capacity (kg)
                  </label>
                  <input
                    type="number"
                    step="500"
                    value={whForm.capacity_kg}
                    onChange={(e) => setWhForm({ ...whForm, capacity_kg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5e5] bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3a3a3a] mb-1.5">
                    Zone / Area
                  </label>
                  <input
                    type="text"
                    value={whForm.address}
                    onChange={(e) => setWhForm({ ...whForm, address: e.target.value })}
                    placeholder="e.g. Khandagiri IE, Bhubaneswar"
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] ${
                      formErrors.address ? 'border-rose-500' : 'border-[#e5e5e5]'
                    }`}
                  />
                  {formErrors.address && (
                    <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.address}</p>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[#e5e5e5] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddWarehouseOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-[#6a6a6a] hover:text-[#0a0a0a] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWh}
                  className="px-5 py-2.5 rounded-xl bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingWh ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4 text-[#a4d4c5]" />}
                  <span>Enroll MRF Facility</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Assign Report to Facility ──────────────────────────── */}
      {assigningReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#fffaf0] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[#e5e5e5] shadow-2xl relative">
            <button
              onClick={() => setAssigningReport(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-[#faf5e8] text-[#6a6a6a] hover:text-[#0a0a0a] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#e5e5e5] pb-4 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#0a0a0a] text-[#a4d4c5] flex items-center justify-center shadow-xs">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-[#0a0a0a]">
                  Assign Waste to Recycling Facility
                </h3>
                <p className="text-xs text-[#6a6a6a]">
                  Report #{assigningReport.report_id.slice(0, 8)} • Purity {currentPurity}%
                </p>
              </div>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {/* Warehouse Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3a3a3a] mb-1.5">
                  Select MRF Warehouse Facility
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5e5] bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]"
                >
                  {warehouses.map((wh) => {
                    const rate = getWarehouseRate(wh);
                    const cat = getWarehouseCategory(wh);
                    return (
                      <option key={wh.warehouse_id} value={wh.warehouse_id}>
                        {wh.name} — ({cat.toUpperCase()}) @ ₹{rate.toFixed(1)}/kg
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Measured Weight */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3a3a3a] mb-1.5">
                  Measured Weight (kg)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={measuredWeightKg}
                    onChange={(e) => setMeasuredWeightKg(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e5e5e5] bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-[#6a6a6a] font-bold">kg</span>
                </div>
              </div>

              {/* Live Revenue Valuation Banner */}
              <div className="p-4 bg-[#faf5e8] rounded-2xl border border-[#e5e5e5] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#6a6a6a] font-bold block">
                    Calculated Revenue
                  </span>
                  <div className="text-xs text-[#3a3a3a] mt-0.5">
                    {safeWeight} kg × ₹{currentRate.toFixed(1)}/kg × {currentPurity}% purity
                  </div>
                </div>
                <div className="text-xl font-display font-black text-[#166534]">
                  ₹{liveCalculatedRevenue}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[#e5e5e5] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssigningReport(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-[#6a6a6a] hover:text-[#0a0a0a] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="px-5 py-2.5 rounded-xl bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingAssign ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-[#a4d4c5]" />}
                  <span>Confirm Facility Dispatch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

