import React, { useState } from 'react';
import type { ReportItem } from '../types';
import { Flame, UserCheck, Search, Filter } from 'lucide-react';

interface PriorityQueueProps {
  reports: ReportItem[];
  selectedReport: ReportItem | null;
  onSelectReport: (report: ReportItem) => void;
}

export const PriorityQueue: React.FC<PriorityQueueProps> = ({
  reports,
  selectedReport,
  onSelectReport,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active tickets (pending, assigned, in_progress)
  const queueReports = reports.filter((r) =>
    ['pending', 'assigned', 'in_progress'].includes(r.status)
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
              Ranked by Bedrock Nova Lite 5-line inline scoring
            </p>
          </div>
        </div>

        {/* Filter / Search mini toolbar */}
        <div className="flex items-center gap-2.5">
          {/* Quick status filter pills */}
          <div className="flex items-center bg-white rounded-xl p-1 border border-[#e5e5e5] text-xs shadow-xs">
            {['all', 'pending', 'assigned', 'in_progress'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterType(st)}
                className={`px-3 py-1 rounded-lg font-bold transition-all capitalize whitespace-nowrap cursor-pointer ${
                  filterType === st
                    ? 'bg-[#0a0a0a] text-white shadow-xs'
                    : 'text-[#6a6a6a] hover:text-[#0a0a0a]'
                }`}
              >
                {st === 'all' ? 'All' : st === 'in_progress' ? 'Active' : st}
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
              <th className="py-3 px-5">Score</th>
              <th className="py-3 px-4">Type &amp; Urgency</th>
              <th className="py-3 px-4">Fill Level</th>
              <th className="py-3 px-4">Status</th>
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
                        : 'hover:bg-[#faf5e8]/80'
                    }`}
                  >
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-mono text-xs shadow-xs ${scoreBadge}`}
                      >
                        {r.priority_score ? Number(r.priority_score).toFixed(1) : '0.0'}
                      </span>
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
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs ${statusBadge}`}
                      >
                        {r.status === 'in_progress' ? 'In Progress' : r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#3a3a3a]">
                      {r.worker_phone ? (
                        <div className="flex items-center gap-1.5 text-xs text-[#0a0a0a] font-bold">
                          <UserCheck className="w-4 h-4 text-[#1a3a3a]" />
                          <span className="font-mono">{r.worker_phone}</span>
                        </div>
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
