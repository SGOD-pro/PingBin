import React, { useState } from 'react';
import type { ReportItem } from '../types';
import { Flame, UserCheck, Search, ShieldAlert, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '../lib/api';

interface PriorityQueueProps {
  reports: ReportItem[];
  selectedReport: ReportItem | null;
  onSelectReport: (report: ReportItem) => void;
  onRefresh?: () => void;
}

export const PriorityQueue: React.FC<PriorityQueueProps> = ({
  reports,
  selectedReport,
  onSelectReport,
  onRefresh,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Active tickets (pending, assigned, in_progress, pending_admin_review, rejected)
  const queueReports = reports.filter((r) =>
    ['pending', 'assigned', 'in_progress', 'pending_admin_review', 'rejected'].includes(r.status)
  );

  const filteredReports = queueReports.filter((r) => {
    if (filterType !== 'all' && r.status !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchType = r.waste_type?.toLowerCase().includes(q);
      const matchPhone = r.citizen_phone?.toLowerCase().includes(q);
      const matchWorker = r.worker_phone?.toLowerCase().includes(q);
      return matchType || matchPhone || matchWorker;
    }
    return true;
  });

  const handleReject = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    try {
      setActionLoadingId(reportId);
      await api.rejectReport(reportId);
      toast.success('Report Rejected', {
        description: `Report ${reportId.slice(0, 8)} rejected. WhatsApp notice sent to citizen.`,
      });
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reject failed';
      toast.error('Rejection Error', { description: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApprove = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    try {
      setActionLoadingId(reportId);
      const res = await api.approveReport(reportId);
      toast.success('Approved & Dispatched', {
        description: `Ticket ${reportId.slice(0, 8)} approved (Priority Score: ${res.priority_score ?? 'Auto'}).`,
      });
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approve failed';
      toast.error('Approval Error', { description: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="bg-[#faf5e8] rounded-3xl border border-[#e5e5e5] shadow-sm overflow-hidden flex flex-col transition-all">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#e5e5e5] bg-[#faf5e8] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#ffe9f1] flex items-center justify-center text-[#ff4d8b] shadow-xs shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-[#0a0a0a] text-sm tracking-tight">
                Live Priority Queue
              </h3>
              <span className="bg-[#0a0a0a] text-white font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                {queueReports.length} Total
              </span>
            </div>
            <p className="text-xs text-[#6a6a6a]">
              Ranked by Bedrock Nova Lite scoring &amp; safety gate audit
            </p>
          </div>
        </div>

        {/* Filter / Search mini toolbar */}
        <div className="flex items-center gap-2.5">
          {/* Quick status filter pills */}
          <div className="flex items-center bg-white rounded-xl p-1 border border-[#e5e5e5] text-xs shadow-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending_admin_review', label: 'Safety Gate' },
              { id: 'pending', label: 'Pending' },
              { id: 'assigned', label: 'Assigned' },
              { id: 'in_progress', label: 'Active' },
              { id: 'rejected', label: 'Rejected' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFilterType(st.id)}
                className={`px-3 py-1 rounded-lg font-bold transition-all capitalize whitespace-nowrap cursor-pointer ${
                  filterType === st.id
                    ? 'bg-[#0a0a0a] text-white shadow-xs'
                    : 'text-[#6a6a6a] hover:text-[#0a0a0a]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#9a9a9a] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-white rounded-xl border border-[#e5e5e5] text-xs text-[#0a0a0a] placeholder-[#9a9a9a] focus:outline-hidden focus:border-[#0a0a0a] w-36 sm:w-44 transition-all shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Table with fixed height and auto overflow */}
      <div className="overflow-x-auto overflow-y-auto max-h-[520px] flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-[#f5f0e0]/95 backdrop-blur-xs">
            <tr className="border-b border-[#e5e5e5] text-[10px] font-mono uppercase tracking-wider text-[#6a6a6a]">
              <th className="py-2.5 px-5 font-bold">Priority Score / Safety Gate</th>
              <th className="py-2.5 px-4 font-bold">Waste Type &amp; Urgency</th>
              <th className="py-2.5 px-4 font-bold">Fill %</th>
              <th className="py-2.5 px-4 font-bold">Status / Action</th>
              <th className="py-2.5 px-4 font-bold">Assigned Worker</th>
              <th className="py-2.5 px-5 font-bold text-right">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e5e5]/60 text-xs">
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#9a9a9a] font-medium">
                  No incident reports matching filter.
                </td>
              </tr>
            ) : (
              filteredReports.map((r, idx) => {
                const isSelected = selectedReport?.report_id === r.report_id;
                const isPendingReview = r.status === 'pending_admin_review';
                const score = Math.round(r.priority_score || 0);

                let scoreBadge = 'bg-[#a4d4c5] text-[#0a3a2a] font-bold'; // brand-mint
                if (score >= 75) {
                  scoreBadge = 'bg-[#ff4d8b] text-white font-extrabold shadow-xs'; // brand-pink
                } else if (score >= 50) {
                  scoreBadge = 'bg-[#e8b94a] text-[#735100] font-bold'; // brand-ochre
                }

                let statusBadge = 'bg-white text-[#0a0a0a] border border-[#e5e5e5]';
                if (r.status === 'pending')
                  statusBadge = 'bg-[#ffe9f1] text-[#b30043] border border-[#ff4d8b]/40';
                if (r.status === 'assigned')
                  statusBadge = 'bg-[#fff2eb] text-[#8f3e09] border border-[#ffb084]/50';
                if (r.status === 'in_progress')
                  statusBadge = 'bg-[#edf7f4] text-[#0a3a2a] border border-[#a4d4c5]';
                if (r.status === 'pending_admin_review')
                  statusBadge = 'bg-[#fffbeb] text-[#b45309] border border-[#f59e0b]/50';
                if (r.status === 'rejected')
                  statusBadge = 'bg-[#fee2e2] text-[#991b1b] border border-[#f87171]';

                // Age calculation
                let ageStr = 'recent';
                if (r.created_at) {
                  const diffMins = Math.round(
                    (new Date().getTime() - new Date(r.created_at).getTime()) / 60000
                  );
                  ageStr = diffMins > 60 ? `${Math.round(diffMins / 60)}h ago` : `${diffMins}m ago`;
                }

                return (
                  <tr
                    key={r.report_id || idx}
                    onClick={() => onSelectReport(r)}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#faf5e8] border-l-4 border-l-[#0a0a0a] shadow-inner font-medium'
                        : isPendingReview
                        ? 'bg-[#fffdf7] hover:bg-[#fff9ea]'
                        : 'hover:bg-[#faf5e8]/80'
                    }`}
                  >
                    <td className="py-3.5 px-5">
                      {isPendingReview ? (
                        r.suspicious_flag ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold bg-[#fee2e2] text-[#991b1b] border border-[#f87171] shadow-xs">
                            <ShieldAlert className="w-3.5 h-3.5 text-[#dc2626]" />
                            Suspicious ({r.confidence ?? 0}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold bg-[#fef3c7] text-[#92400e] border border-[#f59e0b]/40 shadow-xs">
                            <ShieldAlert className="w-3.5 h-3.5 text-[#d97706]" />
                            Low Conf ({r.confidence ?? 0}%)
                          </span>
                        )
                      ) : (
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-mono text-xs shadow-xs ${scoreBadge}`}
                        >
                          {r.priority_score ? Number(r.priority_score).toFixed(1) : '0.0'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#0a0a0a] capitalize text-xs tracking-tight">
                        {r.waste_type || 'Unknown'}
                      </div>
                      <div className="text-[11px] text-[#6a6a6a] capitalize flex items-center gap-1.5 mt-0.5 font-medium">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            r.urgency === 'high'
                              ? 'bg-[#ff4d8b]'
                              : r.urgency === 'medium'
                              ? 'bg-[#e8b94a]'
                              : 'bg-[#a4d4c5]'
                          }`}
                        />
                        {r.urgency || 'medium'} urgency
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-16 bg-[#ebe6d6] rounded-full h-2 overflow-hidden shadow-inner">
                          <div
                            className={`h-full transition-all rounded-full ${
                              r.fill_percent > 80
                                ? 'bg-[#ff4d8b]'
                                : r.fill_percent > 50
                                ? 'bg-[#e8b94a]'
                                : 'bg-[#22c55e]'
                            }`}
                            style={{ width: `${Math.min(100, r.fill_percent || 0)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-[#3a3a3a]">
                          {r.fill_percent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {isPendingReview ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleReject(e, r.report_id)}
                            disabled={actionLoadingId === r.report_id}
                            className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#fee2e2] text-[#dc2626] hover:bg-[#fecaca] hover:scale-105 border border-[#f87171] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                            title="Reject Report"
                            aria-label="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleApprove(e, r.report_id)}
                            disabled={actionLoadingId === r.report_id}
                            className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#dcfce7] text-[#16a34a] hover:bg-[#bbf7d0] hover:scale-105 border border-[#4ade80] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                            title="Approve & Dispatch"
                            aria-label="Approve & Dispatch"
                          >
                            {actionLoadingId === r.report_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs ${statusBadge}`}
                        >
                          {r.status === 'in_progress' ? 'In Progress' : r.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#3a3a3a]">
                      {r.worker_phone ? (
                        <div className="flex items-center gap-1.5 text-xs text-[#0a0a0a] font-bold">
                          <UserCheck className="w-4 h-4 text-[#1a3a3a]" />
                          <span className="font-mono">{r.worker_phone}</span>
                        </div>
                      ) : isPendingReview ? (
                        <span className="text-[#b45309] font-medium text-xs">Gated (Admin Review)</span>
                      ) : (
                        <span className="text-[#9a9a9a] italic text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-xs text-[#6a6a6a] font-medium">
                      {ageStr}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

