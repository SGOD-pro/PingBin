import React, { useState, useEffect } from 'react';
import type { ReportItem, WarehouseItem } from '../types';
import { Warehouse, IndianRupee, Scale, Building2, PackageCheck, AlertTriangle, Sparkles } from 'lucide-react';
import { getApiUrl } from '../lib/api';

interface WarehouseSectionProps {
  reports: ReportItem[];
  onSelectReport?: (report: ReportItem) => void;
}

export const WarehouseSection: React.FC<WarehouseSectionProps> = ({
  reports,
  onSelectReport,
}) => {
  const API_URL = getApiUrl();
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/warehouses`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setWarehouses(data))
      .catch((err) => console.error('Failed to load warehouses:', err));
  }, [API_URL]);

  // Resolved reports that entered the warehouse recycling pipeline
  const resolvedReports = reports.filter((r) => r.status === 'resolved');

  // Fallback calculation helper for legacy records
  const getReportWeight = (r: ReportItem): number =>
    r.estimated_weight_kg !== undefined && r.estimated_weight_kg !== null
      ? Number(r.estimated_weight_kg)
      : r.fill_percent
      ? r.fill_percent * 0.5
      : 25;

  const getReportRevenue = (r: ReportItem): number => {
    if (r.estimated_revenue !== undefined && r.estimated_revenue !== null) {
      return Number(r.estimated_revenue);
    }
    const weight = getReportWeight(r);
    const cat = (r.recycling_category || r.waste_type || 'mixed').toLowerCase();
    const rateMap: Record<string, number> = {
      plastic: 8,
      metal: 15,
      paper: 5,
      glass: 4,
      e_waste: 25,
      organic: 2,
      mixed: 3,
      hazardous: 0,
    };
    const baseRate = rateMap[cat] ?? 3;
    const purity = r.purity_score ?? 85;
    return Number(((weight * baseRate * purity) / 100).toFixed(2));
  };

  // Compute live aggregates
  const totalRevenue = resolvedReports.reduce((sum, r) => sum + getReportRevenue(r), 0);
  const totalWeightKg = resolvedReports.reduce((sum, r) => sum + getReportWeight(r), 0);
  const activeWarehouseCount = warehouses.length > 0 ? warehouses.length : 4;

  return (
    <div className="space-y-6">
      {/* KPI Highlights */}
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
              Dynamic material purity &amp; ₹/kg valuation
            </p>
          </div>
        </div>

        {/* Total Diverted Biomass / Weight */}
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
              Patia, Rasulgarh, Chandaka &amp; Mancheswar
            </p>
          </div>
        </div>
      </div>

      {/* Main Resolved Shipments Table */}
      <div className="bg-[#faf5e8] rounded-3xl border border-[#e5e5e5] shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[#e5e5e5] bg-[#faf5e8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center shadow-xs">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-[#0a0a0a] text-sm tracking-tight">
                Recycling Logistics &amp; Warehouse Shipments
              </h3>
              <p className="text-xs text-[#6a6a6a]">
                Automated waste stream sorting, facility routing, and revenue accounting
              </p>
            </div>
          </div>
          <span className="bg-[#0a0a0a] text-white font-mono text-xs font-bold px-3 py-1 rounded-full shadow-xs">
            {resolvedReports.length} Shipments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f5f0e0] text-[#0a0a0a]/80 uppercase text-[10px] font-mono font-bold tracking-wider border-b border-[#e5e5e5]">
              <tr>
                <th className="py-3 px-5">Report ID</th>
                <th className="py-3 px-4">Waste Stream</th>
                <th className="py-3 px-4">Recycling Category &amp; Purity</th>
                <th className="py-3 px-4">Assigned Facility</th>
                <th className="py-3 px-4 text-right">Est. Weight</th>
                <th className="py-3 px-4 text-right">Est. Revenue</th>
                <th className="py-3 px-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5] bg-[#fffaf0]">
              {resolvedReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#6a6a6a]">
                    <PackageCheck className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#9a9a9a]" />
                    <p className="text-xs font-bold">No resolved cleanup reports yet.</p>
                    <p className="text-[11px] text-[#9a9a9a] mt-0.5">
                      Reports entering status "resolved" automatically route to warehouse logistics.
                    </p>
                  </td>
                </tr>
              ) : (
                resolvedReports.map((r, idx) => {
                  const isSpecial = r.warehouse_status === 'special_handling_required';
                  const purity = r.purity_score ?? 85;
                  const revenue = getReportRevenue(r);
                  const weight = getReportWeight(r);
                  const facilityName = r.assigned_warehouse_name || (isSpecial ? 'Special Handling Facility' : 'Patia Materials Recovery Facility');
                  const category = r.recycling_category || r.waste_type || 'mixed';

                  return (
                    <tr
                      key={r.report_id || idx}
                      onClick={() => onSelectReport && onSelectReport(r)}
                      className="hover:bg-[#faf5e8]/80 cursor-pointer transition-all"
                    >
                      <td className="py-3.5 px-5 font-mono font-bold text-[#0a0a0a]">
                        #{r.report_id.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#0a0a0a] capitalize">
                        {r.waste_type || 'General'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="capitalize font-bold text-[#0a0a0a]">{category}</span>
                          <span className="bg-[#ecfdf5] text-[#065f46] text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-[#a7f3d0]">
                            {purity}% purity
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#3a3a3a]">
                        {facilityName}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0a0a0a]">
                        {weight.toFixed(1)} kg
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-[#166534]">
                        ₹{revenue.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {isSpecial ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#fee2e2] text-[#991b1b] border border-[#f87171]">
                            <AlertTriangle className="w-3 h-3" /> Special Handling
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#dcfce7] text-[#166534] border border-[#86efac]">
                            <PackageCheck className="w-3 h-3" /> Pending Pickup
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Facilities Registry Grid */}
      <div className="bg-[#faf5e8] rounded-3xl border border-[#e5e5e5] p-5 shadow-sm">
        <h4 className="font-display font-bold text-[#0a0a0a] text-sm tracking-tight mb-3">
          Registered Materials Recovery Facilities (MRF)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              id: 'wh-patia-plastic',
              name: 'Patia MRF Depot',
              types: ['Plastic', 'E-Waste'],
              rate: '₹8 - ₹25 / kg',
            },
            {
              id: 'wh-rasulgarh-metal',
              name: 'Rasulgarh Metal Recovery',
              types: ['Metal', 'Mixed'],
              rate: '₹3 - ₹15 / kg',
            },
            {
              id: 'wh-chandaka-organic',
              name: 'Chandaka Organic & Paper',
              types: ['Organic', 'Paper', 'Glass'],
              rate: '₹2 - ₹5 / kg',
            },
            {
              id: 'wh-mancheswar-hazmat',
              name: 'Mancheswar Hazmat Unit',
              types: ['Hazardous', 'Chemical'],
              rate: 'Special Protocol',
            },
          ].map((f) => (
            <div
              key={f.id}
              className="bg-white rounded-2xl p-3.5 border border-[#e5e5e5] shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="font-bold text-xs text-[#0a0a0a]">{f.name}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {f.types.map((t) => (
                    <span
                      key={t}
                      className="bg-[#f5f0e0] text-[#5a5a5a] text-[10px] font-semibold px-2 py-0.5 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-[#f0f0f0] text-[11px] font-mono font-bold text-[#166534]">
                {f.rate}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
