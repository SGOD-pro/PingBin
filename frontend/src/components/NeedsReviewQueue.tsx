import React from 'react';
import type { ReportItem } from '../types';
import { ShieldAlert, AlertTriangle, CheckCircle, MapPin, Clock, Eye } from 'lucide-react';

interface NeedsReviewQueueProps {
  reports: ReportItem[];
  selectedReport: ReportItem | null;
  onSelectReport: (report: ReportItem) => void;
}

export const NeedsReviewQueue: React.FC<NeedsReviewQueueProps> = ({
  reports,
  selectedReport,
  onSelectReport,
}) => {
  const reviewReports = reports.filter((r) => r.status === 'needs_review');

  /** Determine which gates failed from the review_reason string for badge display. */
  const parseGates = (reason?: string | null) => {
    const gateA = reason?.toLowerCase().includes('gps') ?? false;
    const gateB = reason?.toLowerCase().includes('truth') ?? false;
    const classErr = reason?.toLowerCase().includes('classification') ?? false;
    return { gateA, gateB, classErr };
  };

  return (
    <div className="bg-[#faf5e8] rounded-3xl border border-[#e5e5e5] shadow-sm overflow-hidden flex flex-col transition-all">
      {/* Header */}
      <div className="px-6 py-4.5 border-b border-[#e5e5e5] bg-[#faf5e8] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#ffe9f1] flex items-center justify-center text-[#ff4d8b] shadow-xs shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-[#0a0a0a] text-sm tracking-tight">
                Needs Review / Audit Queue
              </h3>
              <span className="bg-[#ff4d8b] text-white font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                {reviewReports.length} Flagged
              </span>
            </div>
            <p className="text-xs text-[#6a6a6a]">
              Two-Gate Anti-Fake-Work Telemetry &amp; GPS verification
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-white border border-[#e5e5e5] px-3 py-1 rounded-full text-[#0a0a0a] shadow-xs">
          Gate A (GPS) + Gate B (Time)
        </span>
      </div>

      {/* Content */}
      <div className="p-5 space-y-3.5 max-h-[420px] overflow-y-auto bg-[#fffaf0]">
        {reviewReports.length === 0 ? (
          <div className="text-center py-12 text-[#6a6a6a] text-xs">
            <div className="w-12 h-12 rounded-full bg-[#edf7f4] text-[#0a3a2a] flex items-center justify-center mx-auto mb-3 shadow-xs">
              <CheckCircle className="w-6 h-6 text-[#22c55e]" />
            </div>
            <p className="font-bold text-[#0a0a0a] text-sm">No anomalies detected.</p>
            <p className="text-xs text-[#6a6a6a] mt-1">
              All field cleanup jobs verified by Haversine GPS &amp; Truth-Score benchmark.
            </p>
          </div>
        ) : (
          reviewReports.map((report) => {
            const isSelected = selectedReport?.report_id === report.report_id;

            // Prefer adjusted_estimated_minutes if available, then recalculated, then base
            const estTime =
              report.adjusted_estimated_minutes ??
              report.recalculated_estimated_time ??
              report.estimated_minutes_to_clean ??
              30;
            const actualTime = report.actual_duration ?? 0;
            const truthPct = report.truth_percentage ?? 0;

            const { gateA, gateB, classErr } = parseGates(report.review_reason);

            return (
              <div
                key={report.report_id}
                onClick={() => onSelectReport(report)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#0a0a0a] bg-[#faf5e8] shadow-sm ring-1 ring-black/10'
                    : 'border-[#e5e5e5] hover:border-[#0a0a0a]/50 bg-white hover:bg-[#faf5e8]/50 shadow-xs'
                }`}
              >
                {/* Row 1: type + reason badges + truth score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-bold text-[#0a0a0a] text-xs uppercase tracking-tight font-display">
                        {report.waste_type} Waste
                      </span>
                      {classErr && (
                        <span className="text-[10px] font-bold bg-[#b8a4ed] text-[#4a2e80] px-2.5 py-0.5 rounded-full shadow-xs">
                          Classification Error
                        </span>
                      )}
                      {gateA && (
                        <span className="text-[10px] font-bold bg-[#ffe9f1] text-[#b30043] border border-[#ff4d8b]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                          <MapPin className="w-3 h-3" /> Gate A: GPS Mismatch
                        </span>
                      )}
                      {gateB && (
                        <span className="text-[10px] font-bold bg-[#fff2eb] text-[#8f3e09] border border-[#ffb084]/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                          <Clock className="w-3 h-3" /> Gate B: Time Anomaly
                        </span>
                      )}
                      {!classErr && !gateA && !gateB && (
                        <span className="text-[10px] font-bold bg-[#faf5e8] text-[#0a0a0a] border border-[#e5e5e5] px-2.5 py-0.5 rounded-full">
                          Suspicious
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6a6a6a] mt-1.5 flex items-center gap-2">
                      <span>Worker: <strong className="font-mono text-[#0a0a0a]">{report.worker_phone || 'Unassigned'}</strong></span>
                      <span>•</span>
                      <span>Citizen: <span className="font-mono text-[#3a3a3a]">{report.citizen_phone || 'WhatsApp'}</span></span>
                    </p>
                  </div>

                  {/* Truth score + duration */}
                  {!classErr && (
                    <div className="text-right shrink-0 bg-[#faf5e8] px-3.5 py-2 rounded-xl border border-[#e5e5e5] shadow-xs">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[#6a6a6a] font-bold block">
                        Truth Score
                      </span>
                      <span
                        className={`text-sm font-display font-extrabold ${
                          truthPct >= 50 ? 'text-[#0a3a2a]' : 'text-[#ff4d8b]'
                        }`}
                      >
                        {truthPct}%
                      </span>
                      <span className="text-[10px] font-mono text-[#6a6a6a] block mt-0.5 font-semibold">
                        {typeof actualTime === 'number' ? actualTime.toFixed(1) : actualTime}m /{' '}
                        {typeof estTime === 'number' ? estTime.toFixed(0) : estTime}m est
                      </span>
                    </div>
                  )}
                </div>

                {/* Review reason detail banner */}
                {report.review_reason && (
                  <div className="mt-3 px-3.5 py-2.5 bg-[#ffe9f1] rounded-xl border border-[#ff4d8b]/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#ff4d8b] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#1a1a1a] font-medium leading-snug">
                        {report.review_reason}
                      </p>
                    </div>
                  </div>
                )}

                {/* Proof Thumbnails Comparison */}
                {(report.photo_before_url || report.photo_after_url || report.finish_photo_url) && (
                  <div className="mt-3 pt-3 border-t border-[#e5e5e5] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {report.photo_before_url && (
                        <div className="text-xs text-[#6a6a6a]">
                          <span className="block font-bold text-[10px] mb-1 uppercase">Citizen Proof:</span>
                          <img
                            src={report.photo_before_url}
                            alt="Before"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'http://localhost:8000/images/dustbins-india-T5BHA9.jpg';
                            }}
                            className="w-16 h-12 object-cover rounded-xl border border-[#e5e5e5] shadow-xs bg-white"
                          />
                        </div>
                      )}
                      {(report.photo_after_url || report.finish_photo_url) && (
                        <div className="text-xs text-[#6a6a6a]">
                          <span className="block font-bold text-[10px] mb-1 uppercase">Worker Proof:</span>
                          <img
                            src={report.photo_after_url || report.finish_photo_url || ''}
                            alt="After"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'http://localhost:8000/images/new-delhi-india-may-8-260nw-1974738929.webp';
                            }}
                            className="w-16 h-12 object-cover rounded-xl border border-[#e5e5e5] shadow-xs bg-white"
                          />
                        </div>
                      )}
                    </div>

                    <span className="text-xs font-bold text-[#1a3a3a] flex items-center gap-1 hover:underline">
                      <Eye className="w-3.5 h-3.5" /> Inspect Dossier
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
