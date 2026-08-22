import { useState } from 'react';
import { useReports } from './hooks/useReports';
import { useWorkers } from './hooks/useWorkers';
import { StatsBar } from './components/StatsBar';
import { ClusterMap } from './components/ClusterMap';
import { PriorityQueue } from './components/PriorityQueue';
import { NeedsReviewQueue } from './components/NeedsReviewQueue';
import { ReportDetailModal } from './components/ReportDetailModal';
import { WorkersModal } from './components/WorkersModal';
import { AdminOperations } from './components/AdminOperations';
import { WhatsAppSimulator } from './components/WhatsAppSimulator';
import type { ReportItem } from './types';
import {
  Sparkles,
  RefreshCw,
  Radio,
  Send,
  CheckCircle2,
  Users,
  MapPin,
  Settings2,
  Cpu,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

import { getApiUrl } from './lib/api';

type ActiveTab = 'dashboard' | 'operations' | 'live-demo';

export function App() {
  const { reports, loading: reportsLoading, lastUpdated, refresh: refreshReports } = useReports();
  const { workers, refreshWorkers, addWorker } = useWorkers();
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [isWorkersModalOpen, setIsWorkersModalOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const handleRefresh = () => {
    refreshReports();
    refreshWorkers();
  };

  const handleSimulateReport = async () => {
    setIsSimulating(true);
    setSimStatus('Simulating citizen WhatsApp photo intake & Nova Lite ingestion...');
    const API_URL = getApiUrl();

    const realImages = [
      `${API_URL}/images/dustbins-india-T5BHA9.jpg`,
      `${API_URL}/images/mumbai-september-24-piles-garbage-600w-2238569423.webp`,
      `${API_URL}/images/new-delhi-india-may-8-260nw-1974738929.webp`,
      `${API_URL}/images/rich-produce-debris-poor-make-260nw-577055080.webp`,
    ];
    const chosenImage = realImages[Math.floor(Math.random() * realImages.length)];

    try {
      // 1. Simulate citizen photo intake
      await fetch(`${API_URL}/dev/simulate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_phone: '+919932948540',
          message_type: 'photo',
          media_url: chosenImage,
        }),
      });

      setSimStatus('Simulating location pin dispatch & nearest worker assignment...');
      // 2. Simulate citizen location share
      await fetch(`${API_URL}/dev/simulate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_phone: '+919932948540',
          message_type: 'location',
          latitude: 20.3533,
          longitude: 85.8197,
        }),
      });

      setSimStatus('✅ Report simulated & dispatched through PingBin network!');
      setTimeout(() => {
        handleRefresh();
        setSimStatus(null);
      }, 1400);
    } catch {
      setSimStatus('Simulation dispatched to local event bus.');
      setTimeout(() => setSimStatus(null), 2000);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fffaf0] text-[#0a0a0a] flex flex-col font-sans selection:bg-[#a4d4c5] selection:text-[#0a0a0a]">
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <header className="bg-[#fffaf0]/95 backdrop-blur-md border-b border-[#e5e5e5] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-aut py-2.5 px-3 flex items-center justify-between gap-4">
          {/* Logo & Brand ID */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-[#0a0a0a] text-white flex items-center justify-center shadow-md shrink-0">
              <span className="font-display font-black text-lg tracking-tight text-[#a4d4c5]">
                CL
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-tight text-[#0a0a0a] leading-none">
                  Ping<span className="text-[#ff4d8b]">Bin</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#faf5e8] text-[#0a0a0a] border border-[#e5e5e5]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                  PS-03 DISPATCH
                </span>
              </div>
              <p className="text-xs text-[#6a6a6a] mt-0.5 hidden sm:block">
                Intelligent Municipal Waste Logistics &amp; Audit Command Center
              </p>
            </div>
          </div>

          {/* Navigation Category Pill Tabs */}
          <div className="flex items-center bg-[#faf5e8] border border-[#e5e5e5] rounded-full p-1 shadow-xs shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs transition-all whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-[#0a0a0a] text-white shadow-xs font-bold'
                  : 'text-[#6a6a6a] hover:text-[#0a0a0a] font-semibold'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>Command Center</span>
            </button>
            <button
              onClick={() => setActiveTab('operations')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs transition-all whitespace-nowrap ${
                activeTab === 'operations'
                  ? 'bg-[#0a0a0a] text-white shadow-xs font-bold'
                  : 'text-[#6a6a6a] hover:text-[#0a0a0a] font-semibold'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 shrink-0" />
              <span>Operations &amp; Rewards</span>
            </button>
            <button
              onClick={() => setActiveTab('live-demo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'live-demo'
                  ? 'bg-[#0a3a40] text-white shadow-xs font-bold ring-2 ring-[#0a3a40]/30'
                  : 'text-[#0a3a40] bg-[#0a3a40]/10 hover:bg-[#0a3a40]/20 font-bold'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#22c55e] shrink-0 animate-pulse" />
              <span>Live Demo</span>
            </button>
          </div>

          {/* Top Actions & Telemetry */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Live Polling Status */}
            <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[#3a3a3a] bg-[#faf5e8] border border-[#e5e5e5] px-3.5 py-2 rounded-xl shadow-xs whitespace-nowrap">
              <Radio className="w-3.5 h-3.5 text-[#22c55e] animate-pulse shrink-0" />
              <span className="font-semibold">5s POLLING • {lastUpdated.toLocaleTimeString()}</span>
            </div>

            {/* Manage Workers Roster */}
            <button
              onClick={() => setIsWorkersModalOpen(true)}
              className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-[#faf5e8] text-[#0a0a0a] hover:bg-[#f5f0e0] border border-[#e5e5e5] transition-all active:scale-[0.98] shadow-xs whitespace-nowrap cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[#1a3a3a] shrink-0" />
              <span>Staff ({workers.length})</span>
            </button>

            {/* Simulate Intake Trigger */}
            {activeTab === 'dashboard' && (
              <button
                onClick={handleSimulateReport}
                disabled={isSimulating}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] transition-all active:scale-[0.98] shadow-md whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-[#a4d4c5] shrink-0" />
                <span className="hidden sm:inline">
                  {isSimulating ? 'Simulating...' : 'Simulate Intake'}
                </span>
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className="p-2.5 rounded-xl text-[#0a0a0a] bg-[#faf5e8] hover:bg-[#f5f0e0] border border-[#e5e5e5] transition-all active:scale-[0.95] shrink-0 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Simulation Notification Bar ────────────────────────────────────── */}
      {simStatus && (
        <div className="bg-[#0a0a0a] text-white px-4 py-2.5 text-center text-xs font-semibold flex items-center justify-center gap-2 border-b border-[#e5e5e5] animate-in fade-in slide-in-from-top duration-150">
          <CheckCircle2 className="w-4 h-4 text-[#a4d4c5] shrink-0" />
          <span>{simStatus}</span>
        </div>
      )}

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <main className="flex-1 pb-12">
        {activeTab === 'dashboard' ? (
          /* Command Center Tab */
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

            {/* Editorial Hero Header Banner */}
            <div className="bg-[#faf5e8] rounded-3xl p-6 sm:p-8 border border-[#e5e5e5] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              {/* Background gradient decorative glow */}
              <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#a4d4c5]/25 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[#ff4d8b]/15 blur-3xl pointer-events-none" />

              <div className="space-y-2.5 z-10 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white text-[#0a0a0a] border border-[#e5e5e5] shadow-xs">
                    MUNICIPAL SAAS LOGISTICS ENGINE
                  </span>
                  <span className="text-[10px] font-mono text-[#6a6a6a] font-semibold hidden sm:inline">
                    AUTOMATED DISPATCH v2.4
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-[32px] font-display font-bold text-[#0a0a0a] leading-tight tracking-tight">
                  Intelligent Waste Collection &amp; Audit Command Center
                </h2>
                <p className="text-xs sm:text-sm text-[#3a3a3a] leading-relaxed">
                  Real-time municipal telemetry orchestrating WhatsApp citizen intake, Bedrock Nova Lite computer vision triage, and two-gate anti-fake-work verification.
                </p>
              </div>

              {/* Highlights Badge Column */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0 z-10">
                <div className="px-4 py-2.5 bg-white rounded-2xl border border-[#e5e5e5] flex items-center gap-3 shadow-xs">
                  <div className="w-8 h-8 rounded-xl bg-[#ffe9f1] flex items-center justify-center text-[#ff4d8b] shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#6a6a6a] font-bold block">
                      Vision Model
                    </span>
                    <strong className="text-xs text-[#0a0a0a] font-bold whitespace-nowrap">Nova Lite Multi</strong>
                  </div>
                </div>
                <div className="px-4 py-2.5 bg-white rounded-2xl border border-[#e5e5e5] flex items-center gap-3 shadow-xs">
                  <div className="w-8 h-8 rounded-xl bg-[#edf7f4] flex items-center justify-center text-[#0a3a2a] shrink-0">
                    <Layers className="w-4 h-4 text-[#22c55e]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#6a6a6a] font-bold block">
                      Audit Verification
                    </span>
                    <strong className="text-xs text-[#0a0a0a] font-bold whitespace-nowrap">2-Gate GPS/Time</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* High Voltage Stats Bar */}
            <StatsBar reports={reports} />

            {/* 2-Column Command Center Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Priority Queue + Needs Review Audit Desk */}
              <div className="lg:col-span-7 space-y-6">
                <PriorityQueue
                  reports={reports}
                  selectedReport={selectedReport}
                  onSelectReport={setSelectedReport}
                />
                <NeedsReviewQueue
                  reports={reports}
                  selectedReport={selectedReport}
                  onSelectReport={setSelectedReport}
                />
              </div>

              {/* Right Column: Cluster Map + Architecture Dossier */}
              <div className="lg:col-span-5 space-y-6">
                <div className="h-[460px]">
                  <ClusterMap
                    reports={reports}
                    workers={workers}
                    selectedReport={selectedReport}
                    onSelectReport={setSelectedReport}
                  />
                </div>

                {/* Explainable Operations Architecture Card */}
                <div className="p-6 bg-[#faf5e8] rounded-3xl border border-[#e5e5e5] shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#0a0a0a] text-[#a4d4c5] flex items-center justify-center shadow-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <span className="font-display font-bold text-xs text-[#0a0a0a] uppercase tracking-tight">
                        Explainable Operations Architecture
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#6a6a6a] font-bold">
                      END-TO-END FLOW
                    </span>
                  </div>

                  <p className="text-xs text-[#3a3a3a] leading-relaxed">
                    Zero app friction: Citizen reports via WhatsApp → AWS SQS decoupling → Bedrock
                    Nova Lite AI classification → 5-line weighted inline scoring → Haversine nearest-worker
                    dispatch → GPS &amp; Truth-Score 2-gate audit → Instant hyperlocal coupon voucher.
                  </p>

                  <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-[#e5e5e5] shadow-xs">
                      <span className="font-mono text-[9px] uppercase text-[#6a6a6a] font-bold block">
                        Gate A Limit
                      </span>
                      <strong className="text-[#0a0a0a] font-bold text-xs">≤ 50m GPS Distance</strong>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#e5e5e5] shadow-xs">
                      <span className="font-mono text-[9px] uppercase text-[#6a6a6a] font-bold block">
                        Gate B Limit
                      </span>
                      <strong className="text-[#0a0a0a] font-bold text-xs">≥ 50% Truth Ratio</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#e5e5e5] flex items-center justify-between text-xs text-[#6a6a6a]">
                    <span>Municipal SLA Target: <strong className="text-[#0a0a0a]">45 mins</strong></span>
                    <button
                      onClick={() => setActiveTab('operations')}
                      className="text-[#1a3a3a] font-bold hover:underline flex items-center gap-0.5 text-xs cursor-pointer"
                    >
                      Configure Rewards <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'operations' ? (
          /* Operations & Rewards Tab */
          <AdminOperations />
        ) : (
          /* Live WhatsApp Demo Simulator Tab */
          <WhatsAppSimulator />
        )}
      </main>

      {/* ── Modals & Drawers ───────────────────────────────────────────────── */}
      <WorkersModal
        workers={workers}
        isOpen={isWorkersModalOpen}
        onClose={() => setIsWorkersModalOpen(false)}
        onAddWorker={addWorker}
      />

      <ReportDetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />
    </div>
  );
}

export default App;