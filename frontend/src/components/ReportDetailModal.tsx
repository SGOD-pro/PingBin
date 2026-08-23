import React, { useState } from 'react';
import type { ReportItem } from '../types';
import {
  X,
  MapPin,
  Sparkles,
  Clock,
  ExternalLink,
  Activity,
  CheckCircle2,
  ShieldAlert,
  XCircle,
  Loader2,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import * as api from '../lib/api';

interface ReportDetailModalProps {
  report: ReportItem | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  report,
  onClose,
  onRefresh,
}) => {
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  if (!report) return null;

  const isPendingReview = report.status === 'pending_admin_review';
  const score = Math.round(report.priority_score || 0);
  let scoreBadgeBg = 'bg-[#a4d4c5] text-[#0a3a2a]';
  if (score >= 75) scoreBadgeBg = 'bg-[#ff4d8b] text-white';
  else if (score >= 50) scoreBadgeBg = 'bg-[#e8b94a] text-[#735100]';

  const handleReject = async () => {
    try {
      setActionLoading(true);
      await api.rejectReport(report.report_id);
      toast.success('Report Rejected', {
        description: `Incident #${report.report_id.slice(0, 8)} rejected. Rejection notice dispatched to citizen.`,
      });
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject report';
      toast.error('Rejection Error', { description: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      const res = await api.approveReport(report.report_id);
      toast.success('Approved & Dispatched', {
        description: `Incident #${report.report_id.slice(0, 8)} approved (Score: ${res.priority_score ?? 'Auto'}).`,
      });
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve report';
      toast.error('Approval Error', { description: msg });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#fffaf0] rounded-3xl max-w-xl w-full shadow-2xl border-2 border-[#e5e5e5] overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-[#e5e5e5] flex items-center justify-between bg-[#faf5e8]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0a0a0a] text-white flex items-center justify-center font-bold text-xs font-mono shadow-sm">
              #{report.report_id.slice(0, 4)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-[#0a0a0a] text-base tracking-tight">
                  Incident Audit #{report.report_id.slice(0, 8)}
                </h3>
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    isPendingReview
                      ? 'bg-[#fef3c7] text-[#92400e] border border-[#f59e0b]'
                      : 'bg-[#f5f0e0] text-[#0a0a0a] border border-[#e5e5e5]'
                  }`}
                >
                  {isPendingReview ? 'Pending Admin Review' : report.status}
                </span>
              </div>
              <p className="text-[11px] text-[#6a6a6a]">
                Municipal Logistics Dispatch Dossier
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6a6a6a] hover:text-[#0a0a0a] hover:bg-[#f5f0e0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-[#fffaf0]">
          {/* Safety Gate Alert for Suspicious / Low-Confidence Reports */}
          {isPendingReview && (
            <div className="bg-[#fffbeb] border-2 border-[#f59e0b] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-[#d97706] shrink-0" />
                <span className="font-display font-bold text-xs text-[#92400e] uppercase tracking-tight">
                  Safety Gate Triggered — Awaiting Admin Determination
                </span>
              </div>
              <p className="text-xs text-[#78350f] mt-1.5 leading-relaxed">
                {report.suspicious_flag
                  ? '⚠️ AI Model flagged this photo as SUSPICIOUS or synthetic. Worker dispatch has been halted to protect field crews.'
                  : `⚠️ AI Vision confidence (${report.confidence ?? 0}%) is below the automated 25% dispatch threshold. Review photo proof below.`}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] font-mono font-bold">
                <div className="bg-white/80 p-2 rounded-lg border border-[#f59e0b]/30">
                  <span className="text-[#92400e] block font-semibold text-[10px]">Model Confidence:</span>
                  <span className="text-[#0a0a0a]">{report.confidence ?? 0}%</span>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-[#f59e0b]/30">
                  <span className="text-[#92400e] block font-semibold text-[10px]">Segregation Quality:</span>
                  <span className="text-[#0a0a0a] capitalize">{report.segregation_quality || 'mixed'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Photos Comparison */}
          <div>
            <span className="text-[11px] font-mono font-bold text-[#6a6a6a] uppercase tracking-wider block mb-2">
              Visual Verification Artifacts
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-[#faf5e8] rounded-2xl p-3 border border-[#e5e5e5] shadow-sm">
                <span className="text-[11px] font-bold text-[#0a0a0a] block mb-1.5">
                  Citizen Intake (Before)
                </span>
                {report.photo_before_url ? (
                  <img
                    src={report.photo_before_url}
                    alt="Citizen Intake"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'http://localhost:8000/images/dustbins-india-T5BHA9.jpg';
                    }}
                    className="w-full h-40 object-cover rounded-xl border border-[#e5e5e5] shadow-inner bg-white"
                  />
                ) : (
                  <div className="w-full h-40 bg-white rounded-xl border border-[#e5e5e5] flex items-center justify-center text-xs text-[#9a9a9a]">
                    No photo uploaded
                  </div>
                )}
              </div>

              <div className="bg-[#faf5e8] rounded-2xl p-3 border border-[#e5e5e5] shadow-sm">
                <span className="text-[11px] font-bold text-[#0a0a0a] block mb-1.5">
                  Field Worker Proof (After)
                </span>
                {report.photo_after_url || report.finish_photo_url ? (
                  <img
                    src={report.photo_after_url || report.finish_photo_url || ''}
                    alt="Worker Proof"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'http://localhost:8000/images/new-delhi-india-may-8-260nw-1974738929.webp';
                    }}
                    className="w-full h-40 object-cover rounded-xl border border-[#e5e5e5] shadow-inner bg-white"
                  />
                ) : (
                  <div className="w-full h-40 bg-white rounded-xl border border-[#e5e5e5] flex flex-col items-center justify-center text-xs text-[#9a9a9a] p-4 text-center">
                    <Clock className="w-7 h-7 mb-1.5 text-[#9a9a9a] opacity-70" />
                    <span className="font-medium text-[#6a6a6a]">
                      Awaiting worker completion upload
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Signals & Score */}
          <div className="p-4.5 rounded-2xl bg-[#faf5e8] border border-[#e5e5e5] space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-bold text-[#0a0a0a] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#ff4d8b]" />
                Bedrock Nova Lite Multimodal Classifier
              </span>
              <span
                className={`text-xs font-mono font-extrabold px-3 py-1 rounded-full shadow-xs ${
                  isPendingReview ? 'bg-[#fef3c7] text-[#92400e]' : scoreBadgeBg
                }`}
              >
                {isPendingReview ? 'Score: Gated' : `Score: ${Number(report.priority_score || 0).toFixed(1)} / 100`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="bg-white p-3 rounded-xl border border-[#e5e5e5] shadow-xs">
                <span className="text-[10px] font-mono text-[#6a6a6a] block uppercase font-semibold">
                  Waste Type
                </span>
                <strong className="text-xs font-bold text-[#0a0a0a] capitalize block mt-1 truncate">
                  {report.waste_type}
                </strong>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#e5e5e5] shadow-xs">
                <span className="text-[10px] font-mono text-[#6a6a6a] block uppercase font-semibold">
                  Fill Level
                </span>
                <strong className="text-xs font-bold text-[#0a0a0a] block mt-1">
                  {report.fill_percent}%
                </strong>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#e5e5e5] shadow-xs">
                <span className="text-[10px] font-mono text-[#6a6a6a] block uppercase font-semibold">
                  Urgency
                </span>
                <strong className="text-xs font-bold text-[#0a0a0a] capitalize block mt-1">
                  {report.urgency}
                </strong>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#e5e5e5] shadow-xs">
                <span className="text-[10px] font-mono text-[#6a6a6a] block uppercase font-semibold">
                  Est Cleanup
                </span>
                <strong className="text-xs font-bold text-[#0a0a0a] block mt-1">
                  {report.estimated_minutes_to_clean} min
                </strong>
              </div>
            </div>
          </div>

          {/* Telemetry & Dispatch Metadata */}
          <div className="bg-[#f5f0e0] p-4.5 rounded-2xl border border-[#e5e5e5] space-y-3 text-xs shadow-sm">
            <span className="text-[10px] font-mono font-bold text-[#6a6a6a] uppercase tracking-wider block">
              Operational Telemetry
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-xl border border-[#e5e5e5]">
              <div>
                <span className="text-[#6a6a6a] block text-[11px] font-medium">Citizen WhatsApp:</span>
                <span className="font-mono font-bold text-[#0a0a0a] text-xs">
                  {report.citizen_phone || 'WhatsApp Sender'}
                </span>
              </div>
              <div>
                <span className="text-[#6a6a6a] block text-[11px] font-medium">Assigned Worker:</span>
                <span className="font-mono font-bold text-[#0a0a0a] text-xs">
                  {isPendingReview ? 'Gated (Admin Review)' : report.worker_phone || 'Awaiting Dispatch'}
                </span>
              </div>
            </div>

            {report.location_before && (
              <div className="bg-white px-3.5 py-2.5 rounded-xl border border-[#e5e5e5] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#3a3a3a]">
                  <MapPin className="w-4 h-4 text-[#ff4d8b] shrink-0" />
                  <span className="font-mono text-xs font-semibold">
                    {report.location_before.lat.toFixed(5)}, {report.location_before.lng.toFixed(5)}
                  </span>
                </div>
                <a
                  href={`https://maps.google.com/?q=${report.location_before.lat},${report.location_before.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-[#1a3a3a] hover:text-[#0a0a0a] flex items-center gap-1 hover:underline"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {report.review_reason && (
              <div className="bg-[#ffe9f1] p-3.5 rounded-xl border border-[#ff4d8b]/40 text-[#0a0a0a]">
                <span className="font-bold text-xs block text-[#b30043]">
                  Audit Flag Details:
                </span>
                <p className="text-xs text-[#1a1a1a] mt-1 leading-snug font-medium">
                  {report.review_reason}
                </p>
              </div>
            )}

            {report.reward_coupon_code && (
              <div className="bg-[#edf7f4] p-3.5 rounded-xl border border-[#a4d4c5] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#0a3a2a] uppercase font-bold block">
                    Citizen Reward Issued
                  </span>
                  <span className="font-mono font-bold text-sm text-[#0a0a0a]">
                    {report.reward_coupon_code}
                  </span>
                </div>
                <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
              </div>
            )}

            <div className="text-[11px] text-[#6a6a6a] flex items-center gap-1.5 pt-1">
              <Clock className="w-3.5 h-3.5 text-[#9a9a9a]" />
              <span>Created: {new Date(report.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#faf5e8] border-t border-[#e5e5e5] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#6a6a6a]">
            <Activity className="w-4 h-4 text-[#22c55e]" />
            <span className="font-medium">PingBin Immutable Audit Log</span>
          </div>

          <div className="flex items-center gap-2">
            {isPendingReview ? (
              <>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[#fee2e2] text-[#991b1b] hover:bg-[#fecaca] border border-[#f87171] transition-all cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Report
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0] border border-[#4ade80] transition-all cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  Approve &amp; Dispatch
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-bold rounded-xl bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] transition-all active:scale-[0.98] shadow-md cursor-pointer"
              >
                Close Dossier
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

