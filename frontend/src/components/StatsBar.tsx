import React from 'react';
import type { ReportItem } from '../types';
import { AlertCircle, Clock, ShieldAlert, Zap, Activity } from 'lucide-react';

interface StatsBarProps {
  reports: ReportItem[];
}

export const StatsBar: React.FC<StatsBarProps> = ({ reports }) => {
  const pendingCount = reports.filter((r) => r.status === 'pending').length;
  const assignedCount = reports.filter((r) => r.status === 'assigned').length;
  const inProgressCount = reports.filter((r) => r.status === 'in_progress').length;
  const needsReviewCount = reports.filter((r) => r.status === 'needs_review').length;

  const avgScore =
    reports.length > 0
      ? (
          reports.reduce((acc, r) => acc + (r.priority_score || 0), 0) /
          reports.length
        ).toFixed(1)
      : '0.0';

  const stats = [
    {
      title: 'Active Reports',
      value: reports.length,
      subtitle: `${pendingCount + assignedCount} unserviced in queue`,
      icon: Activity,
      tag: 'LIVE FEED',
      gradientCard: 'from-white via-[#faf5e8] to-[#a4d4c5]/25',
      borderColor: 'border-[#a4d4c5]/40 hover:border-[#a4d4c5]',
      glowColor: 'hover:shadow-[0_8px_24px_-4px_rgba(164,212,197,0.35)]',
      iconGradient: 'from-[#a4d4c5] to-[#60bba3]',
      iconTextColor: 'text-[#0a2e22]',
      iconShadow: 'shadow-[0_4px_14px_rgba(164,212,197,0.45)]',
      badgeStyle: 'bg-[#a4d4c5]/25 text-[#0a3a2a] border border-[#a4d4c5]/40',
    },
    {
      title: 'Pending Triage',
      value: pendingCount,
      subtitle: 'Awaiting dispatch',
      icon: AlertCircle,
      tag: 'CRITICAL',
      gradientCard: 'from-white via-[#faf5e8] to-[#ff4d8b]/15',
      borderColor: 'border-[#ff4d8b]/35 hover:border-[#ff4d8b]',
      glowColor: 'hover:shadow-[0_8px_24px_-4px_rgba(255,77,139,0.25)]',
      iconGradient: 'from-[#ff4d8b] to-[#d91d63]',
      iconTextColor: 'text-white',
      iconShadow: 'shadow-[0_4px_14px_rgba(255,77,139,0.35)]',
      badgeStyle: 'bg-[#ff4d8b]/15 text-[#b30043] border border-[#ff4d8b]/30',
    },
    {
      title: 'Active Cleanup',
      value: inProgressCount + assignedCount,
      subtitle: `${inProgressCount} active · ${assignedCount} assigned`,
      icon: Clock,
      tag: 'FIELD OPS',
      gradientCard: 'from-white via-[#faf5e8] to-[#ffb084]/25',
      borderColor: 'border-[#ffb084]/40 hover:border-[#ffb084]',
      glowColor: 'hover:shadow-[0_8px_24px_-4px_rgba(255,176,132,0.35)]',
      iconGradient: 'from-[#ffb084] to-[#f0854d]',
      iconTextColor: 'text-[#421702]',
      iconShadow: 'shadow-[0_4px_14px_rgba(255,176,132,0.45)]',
      badgeStyle: 'bg-[#ffb084]/25 text-[#8f3e09] border border-[#ffb084]/40',
    },
    {
      title: 'Audit Queue',
      value: needsReviewCount,
      subtitle: 'GPS / Time anomalies',
      icon: ShieldAlert,
      tag: 'VERIFY',
      gradientCard: 'from-white via-[#faf5e8] to-[#b8a4ed]/25',
      borderColor: 'border-[#b8a4ed]/40 hover:border-[#b8a4ed]',
      glowColor: 'hover:shadow-[0_8px_24px_-4px_rgba(184,164,237,0.35)]',
      iconGradient: 'from-[#b8a4ed] to-[#8c67e8]',
      iconTextColor: 'text-[#241154]',
      iconShadow: 'shadow-[0_4px_14px_rgba(184,164,237,0.45)]',
      badgeStyle: 'bg-[#b8a4ed]/25 text-[#4a2e80] border border-[#b8a4ed]/40',
    },
    {
      title: 'Avg Priority',
      value: avgScore,
      subtitle: 'Nova Lite index (0-100)',
      icon: Zap,
      tag: '0–100',
      gradientCard: 'from-white via-[#faf5e8] to-[#e8b94a]/25',
      borderColor: 'border-[#e8b94a]/40 hover:border-[#e8b94a]',
      glowColor: 'hover:shadow-[0_8px_24px_-4px_rgba(232,185,74,0.35)]',
      iconGradient: 'from-[#e8b94a] to-[#c98e14]',
      iconTextColor: 'text-[#3d2700]',
      iconShadow: 'shadow-[0_4px_14px_rgba(232,185,74,0.45)]',
      badgeStyle: 'bg-[#e8b94a]/25 text-[#735100] border border-[#e8b94a]/40',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {stats.map((stat, idx) => {
        const IconComponent = stat.icon;
        return (
          <div
            key={idx}
            className={`relative px-4 py-3.5 rounded-2xl bg-gradient-to-br ${stat.gradientCard} border ${stat.borderColor} shadow-sm ${stat.glowColor} hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between gap-3 overflow-hidden group`}
          >
            {/* Ambient subtle top glass shimmer */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-80" />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6a6a6a] truncate">
                  {stat.title}
                </span>
                <span
                  className={`text-[8px] font-mono font-extrabold px-1.5 py-0.5 rounded-full uppercase shrink-0 ${stat.badgeStyle}`}
                >
                  {stat.tag}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-[#0a0a0a] tracking-tight leading-none">
                  {stat.value}
                </h3>
              </div>

              <p className="text-[11px] font-medium text-[#3a3a3a] leading-tight truncate mt-1">
                {stat.subtitle}
              </p>
            </div>

            {/* 3D-styled Gradient Icon Container */}
            <div
              className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${stat.iconGradient} flex items-center justify-center shrink-0 ${stat.iconShadow} ${stat.iconTextColor} border border-white/40 group-hover:scale-105 transition-transform duration-200`}
            >
              <IconComponent className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
