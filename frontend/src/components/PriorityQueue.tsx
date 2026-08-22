import React, { useState } from 'react';
import type { ReportItem } from '../types';
import { Flame, UserCheck, Search, Filter, ShieldAlert, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getApiUrl } from '../lib/api';

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
  const API_URL = getApiUrl();
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Active tickets (pending, assigned, in_progress, pending_admin_review)
  const queueReports = reports.filter((r) =>
    ['pending', 'assigned', 'in_progress', 'pending_admin_review'].includes(r.status)
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
    if (!confirm('Are you sure you want to reject this low-confidence report?')) return;
    try {
      setActionLoadingId(reportId);
      const res = await fetch(`${API_URL}/reports/${reportId}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('Reject failed');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Failed to reject report: ${err}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApprove = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    try {
      setActionLoadingId(reportId);
      const res = await fetch(`${API_URL}/reports/${reportId}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Approve failed');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Failed to approve & dispatch report: ${err}`);
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
                {queueReports.length} Active
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
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-[#e5e5e5] text-[#0a0a0a] text-xs pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] w-32 sm:w-36 placeholder:text-[#9a9a9a] shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto flex-1 max-h-[460px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f5f0e0] text-[#0a0a0a]/80 uppercase text-[10px] font-mono font-bold tracking-wider sticky top-0 z-10 border-b border-[#e5e5e5]">
            <tr>
              <th className="py-3 px-5">Score / Gate</th>
              <th className="py-3 px-4">Type &amp; Urgency</th>
              <th className="py-3 px-4">Fill Level</th>
              <th className="py-3 px-4">Status &amp; Actions</th>
              <th className="py-3 px-4">Assigned Worker</th>
              <th className="py-3 px-5 text-right">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e5e5] bg-[#fffaf0]">
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#6a6a6a]">
                  <Filter className="w-7 h-7 mx-auto mb-2 opacity-40 text-[#9a9a9a]" />
                  <p className="text-xs font-semibold">No active tickets matching filter.</p>
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleReject(e, r.report_id)}
                            disabled={actionLoadingId === r.report_id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#fee2e2] text-[#991b1b] hover:bg-[#fecaca] border border-[#f87171] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                            title="Reject and drop report permanently"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                          <button
                            onClick={(e) => handleApprove(e, r.report_id)}
                            disabled={actionLoadingId === r.report_id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0] border border-[#4ade80] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                            title="Approve and proceed to priority dispatch"
                          >
                            {actionLoadingId === r.report_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Approve &amp; Dispatch
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

