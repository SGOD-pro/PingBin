import { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCcw,
  Sparkles,
  MapPin,
  CheckCheck,
  MoreVertical,
  Camera,
  Paperclip,
  Smile,
  Mic,
  ShieldCheck,
  Cpu,
  Navigation,
  Award,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'system';
  type: 'text' | 'image' | 'location' | 'reward';
  text?: string;
  imageUrl?: string;
  location?: { name: string; lat: number; lng: number };
  reward?: {
    code: string;
    vendor: string;
    offer: string;
    category: string;
    howToUse: string;
  };
  time: string;
  status?: 'sent' | 'delivered' | 'read';
}

export function WhatsAppSimulator() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isVerifying, setIsVerifying] = useState(false);

  const [citizenMessages, setCitizenMessages] = useState<ChatMessage[]>([]);
  const [workerMessages, setWorkerMessages] = useState<ChatMessage[]>([]);

  const citizenContainerRef = useRef<HTMLDivElement>(null);
  const workerContainerRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<any[]>([]);

  // Auto-scroll chats inside their containers only (prevents page jump)
  useEffect(() => {
    if (citizenContainerRef.current) {
      citizenContainerRef.current.scrollTo({
        top: citizenContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [citizenMessages]);

  useEffect(() => {
    if (workerContainerRef.current) {
      workerContainerRef.current.scrollTo({
        top: workerContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [workerMessages]);

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const resetSimulation = () => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
    setIsSimulating(false);
    setCurrentStep(0);
    setIsVerifying(false);
    setCitizenMessages([]);
    setWorkerMessages([]);
  };

  const scheduleStep = (fn: () => void, delayMs: number) => {
    const adjustedDelay = delayMs / playbackSpeed;
    const timer = setTimeout(fn, adjustedDelay);
    timeoutsRef.current.push(timer);
  };

  const runSimulation = () => {
    resetSimulation();
    setIsSimulating(true);
    setCurrentStep(1);

    const now = new Date();
    const formatTime = (offsetSec = 0) => {
      const d = new Date(now.getTime() + offsetSec * 1000);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // ── STEP 1 (0s): Citizen reports overflowing bin photo + GPS pin ────────
    scheduleStep(() => {
      setCurrentStep(1);
      setCitizenMessages([
        {
          id: 'c1',
          sender: 'user',
          type: 'image',
          imageUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80',
          text: 'Severely overflowing dumpster blocking the road near KIIT Square!',
          time: formatTime(0),
          status: 'read',
        },
        {
          id: 'c2',
          sender: 'user',
          type: 'location',
          location: {
            name: 'KIIT Square, Patia, Bhubaneswar',
            lat: 20.3533,
            lng: 85.8197,
          },
          time: formatTime(1),
          status: 'read',
        },
      ]);
    }, 400);

    // ── STEP 2 (2s): System acknowledges in Citizen chat ───────────────────
    scheduleStep(() => {
      setCurrentStep(2);
      setCitizenMessages((prev) => [
        ...prev,
        {
          id: 'c3',
          sender: 'system',
          type: 'text',
          text: '🤖 PingBin AI: Report received. Analyzing image with AWS Bedrock Nova Lite multimodal vision triage...',
          time: formatTime(2),
        },
      ]);
    }, 2200);

    // ── STEP 3 (4s): Dispatch to Worker A & Notify Citizen ─────────────────
    scheduleStep(() => {
      setCurrentStep(3);
      setCitizenMessages((prev) => [
        ...prev,
        {
          id: 'c4',
          sender: 'system',
          type: 'text',
          text: '✅ Triage Complete (Priority: 89/100 • Mixed Waste • 85% Fill). Worker A (+91 92634 05367) has been dispatched to your location. Estimated cleanup: 30 mins.',
          time: formatTime(4),
        },
      ]);

      setWorkerMessages([
        {
          id: 'w1',
          sender: 'system',
          type: 'text',
          text: '🚨 PINGBIN DISPATCH ALERT 🚨\n\nIncident: #rep-patia-01\nType: MIXED Waste | Fill: 85% (High Urgency)\nPriority Score: 89/100\nEst. Time: 30 min\nLocation: KIIT Square, Patia\n\nSend a PHOTO + LOCATION when you arrive to start timer.',
          time: formatTime(4),
        },
        {
          id: 'w2',
          sender: 'system',
          type: 'location',
          location: {
            name: 'Incident Site: KIIT Square, Patia',
            lat: 20.3533,
            lng: 85.8197,
          },
          time: formatTime(4),
        },
      ]);
    }, 4500);

    // ── STEP 4 (7s): Worker Arrives at Site ─────────────────────────────────
    scheduleStep(() => {
      setCurrentStep(4);
      setWorkerMessages((prev) => [
        ...prev,
        {
          id: 'w3',
          sender: 'user',
          type: 'image',
          imageUrl: 'https://images.unsplash.com/photo-1528323273322-d81458248d40?auto=format&fit=crop&w=600&q=80',
          text: 'On-site at KIIT Square. Beginning clearance now.',
          time: formatTime(7),
          status: 'read',
        },
        {
          id: 'w4',
          sender: 'user',
          type: 'location',
          location: {
            name: 'Worker Arrival GPS (Distance: 12m from site)',
            lat: 20.3534,
            lng: 85.8198,
          },
          time: formatTime(7),
          status: 'read',
        },
        {
          id: 'w5',
          sender: 'system',
          type: 'text',
          text: '📍 Arrival verified (GPS <= 50m). Clean-up timer started. When finished, send cleanup photo + location.',
          time: formatTime(8),
        },
      ]);

      setCitizenMessages((prev) => [
        ...prev,
        {
          id: 'c5',
          sender: 'system',
          type: 'text',
          text: '👷 Worker A has arrived on-site and initiated cleanup operations.',
          time: formatTime(8),
        },
      ]);
    }, 7200);

    // ── STEP 5 (10.5s): Worker Completes Work (After Photo + DONE) ─────────
    scheduleStep(() => {
      setCurrentStep(5);
      setWorkerMessages((prev) => [
        ...prev,
        {
          id: 'w6',
          sender: 'user',
          type: 'image',
          imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=600&q=80',
          text: 'Cleaned up and sanitized entire zone. DONE.',
          time: formatTime(11),
          status: 'read',
        },
        {
          id: 'w7',
          sender: 'user',
          type: 'location',
          location: {
            name: 'Worker Finish GPS (Distance: 8m)',
            lat: 20.3533,
            lng: 85.8197,
          },
          time: formatTime(11),
          status: 'read',
        },
      ]);
      setIsVerifying(true);
    }, 10800);

    // ── STEP 6 (13.5s): Two-Gate Verification Passed & Citizen Reward ──────
    scheduleStep(() => {
      setIsVerifying(false);
      setCurrentStep(6);

      setWorkerMessages((prev) => [
        ...prev,
        {
          id: 'w8',
          sender: 'system',
          type: 'text',
          text: '✅ TWO-GATE AUDIT PASSED!\n• Gate A (GPS): 8.2m <= 50m limit\n• Gate B (Truth Score): 92% >= 50% threshold\n\nJob resolved! You are now AVAILABLE for new assignments.',
          time: formatTime(14),
        },
      ]);

      setCitizenMessages((prev) => [
        ...prev,
        {
          id: 'c6',
          sender: 'system',
          type: 'reward',
          reward: {
            code: 'CL-PUR-8X4P-50',
            vendor: 'Puri Sweets & Bakery (Patia / KIIT)',
            category: 'Bakery & Cafe',
            offer: 'Flat ₹50 OFF on orders above ₹199',
            howToUse: 'Valid for 30 days. Present WhatsApp coupon code at billing counter.',
          },
          time: formatTime(14),
        },
      ]);
      setIsSimulating(false);
    }, 14000);
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-200">
      {/* ── Top Hero & Control Bar ────────────────────────────────────────── */}
      <div className="bg-[#faf5e8] rounded-3xl p-6 sm:p-8 border border-[#e5e5e5] shadow-sm relative overflow-hidden">
        {/* Background decorative glow */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#0a3a40]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[#22c55e]/15 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#0a3a40] text-white shadow-xs">
                LIVE DEMO SIMULATOR
              </span>
              <span className="text-[10px] font-mono text-[#0a3a40] font-bold uppercase tracking-wider hidden sm:inline">
                GUARANTEED DEMO: WATCH THE FULLY AUTOMATED PINGBIN PIPELINE EXECUTE END-TO-END
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#0a0a0a] tracking-tight">
              Real-Time WhatsApp Citizen &amp; Worker Orchestrator
            </h1>
            <p className="text-sm text-[#4a4a4a] leading-relaxed">
              Experience the dual-sided real-time telemetry workflow: Citizen WhatsApp intake ➔ Bedrock Nova Lite AI triage ➔ Haversine automated dispatch ➔ Two-Gate anti-fake-work verification ➔ Hyperlocal reward delivery.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Speed Toggle */}
            <div className="flex items-center bg-white border border-[#e5e5e5] rounded-xl p-1 shadow-xs text-xs font-mono font-bold text-[#0a0a0a]">
              <button
                onClick={() => setPlaybackSpeed(1)}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  playbackSpeed === 1 ? 'bg-[#0a3a40] text-white shadow-xs' : 'text-[#6a6a6a] hover:text-[#0a0a0a]'
                }`}
              >
                1x Realtime
              </button>
              <button
                onClick={() => setPlaybackSpeed(2)}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  playbackSpeed === 2 ? 'bg-[#0a3a40] text-white shadow-xs' : 'text-[#6a6a6a] hover:text-[#0a0a0a]'
                }`}
              >
                2x Fast
              </button>
            </div>

            {/* Reset Button */}
            <button
              onClick={resetSimulation}
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white text-[#0a0a0a] hover:bg-[#f5f0e0] border border-[#e5e5e5] text-xs font-bold transition-all active:scale-95 shadow-xs disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            {/* Launch Button */}
            <button
              onClick={runSimulation}
              disabled={isSimulating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0a3a40] text-white hover:bg-[#082c30] border border-[#0a3a40] text-xs font-bold transition-all active:scale-95 shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isSimulating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Executing Pipeline ({currentStep}/6)...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current text-[#a4d4c5] shrink-0" />
                  <span>Start Live Demo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Step Progress Indicator */}
        <div className="mt-6 pt-5 border-t border-[#e5e5e5]/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { step: 1, label: '1. Citizen Intake', sub: 'Photo + GPS' },
            { step: 2, label: '2. Bedrock Triage', sub: 'Vision Multimodal' },
            { step: 3, label: '3. Auto-Dispatch', sub: 'Haversine Nearest' },
            { step: 4, label: '4. Worker Arrival', sub: 'GPS <= 50m' },
            { step: 5, label: '5. Cleanup Finish', sub: 'Proof Upload' },
            { step: 6, label: '6. 2-Gate Audit', sub: 'Coupon Reward' },
          ].map((item) => {
            const isCompleted = currentStep > item.step;
            const isCurrent = currentStep === item.step;
            return (
              <div
                key={item.step}
                className={`p-2.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-[#0a3a40] text-white border-[#0a3a40] shadow-sm scale-[1.02]'
                    : isCompleted
                    ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#0a0a0a]'
                    : 'bg-white/60 border-[#e5e5e5] text-[#8a8a8a]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold">{item.label}</span>
                  {isCompleted && <CheckCheck className="w-3.5 h-3.5 text-[#22c55e]" />}
                  {isCurrent && <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />}
                </div>
                <div className={`text-[10px] font-mono mt-0.5 ${isCurrent ? 'text-[#a4d4c5]' : 'text-[#6a6a6a]'}`}>
                  {item.sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Two-Column Dual WhatsApp Screen Simulator ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left Column: Citizen WhatsApp View ────────────────────────────── */}
        <div className="bg-[#f0f2f5] rounded-3xl border border-[#d1d7db] shadow-md flex flex-col overflow-hidden h-[620px]">
          {/* WhatsApp Header */}
          <div className="bg-[#008069] text-white px-4 py-3 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#0a3a40] border-2 border-white flex items-center justify-center text-white font-bold text-sm shadow-xs">
                  PB
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#25d366] rounded-full border-2 border-[#008069]" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  <span>PingBin Municipal Bot</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8ef2a2]" />
                </div>
                <div className="text-[11px] text-[#e0f2fe] font-mono">
                  +1 415 523 8886 • Official Verified
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold">
                CITIZEN APP
              </span>
              <MoreVertical className="w-4 h-4" />
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div
            ref={citizenContainerRef}
            className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#efeae2] bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px]"
          >
            {citizenMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#667781] space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#d1d7db] flex items-center justify-center shadow-xs text-[#008069]">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="font-bold text-sm text-[#111b21]">Citizen Reporting Simulator</div>
                <p className="text-xs max-w-xs text-[#667781]">
                  Click <strong>&quot;Start Live Demo&quot;</strong> above to simulate citizen photo upload, AI triage, automated dispatch, and instant reward generation.
                </p>
              </div>
            ) : (
              citizenMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-150`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3 shadow-xs relative ${
                      msg.sender === 'user'
                        ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-xs'
                        : 'bg-white text-[#111b21] rounded-tl-xs border border-[#e9edef]'
                    }`}
                  >
                    {/* Media Image Card */}
                    {msg.type === 'image' && (
                      <div className="space-y-2 mb-1.5">
                        <div className="rounded-xl overflow-hidden border border-black/10 bg-black/5 aspect-4/3 relative">
                          <img
                            src={msg.imageUrl}
                            alt="Report Waste"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {msg.text && <p className="text-xs leading-relaxed font-medium">{msg.text}</p>}
                      </div>
                    )}

                    {/* Location Pin Card */}
                    {msg.type === 'location' && msg.location && (
                      <div className="space-y-2 mb-1">
                        <div className="bg-[#f0f2f5] rounded-xl p-2.5 border border-[#d1d7db] flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#ef4444] flex items-center justify-center text-white shrink-0 shadow-xs">
                            <MapPin className="w-4 h-4 fill-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-[#111b21] truncate">{msg.location.name}</div>
                            <div className="text-[10px] font-mono text-[#667781]">
                              {msg.location.lat.toFixed(4)}, {msg.location.lng.toFixed(4)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Regular Text Message */}
                    {msg.type === 'text' && (
                      <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {/* Rich Reward Card */}
                    {msg.type === 'reward' && msg.reward && (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-[#008069] font-bold text-xs">
                          <Award className="w-4 h-4" />
                          <span>🎉 CLEANING COMPLETED &amp; VERIFIED!</span>
                        </div>
                        <div className="bg-[#faf5e8] border border-[#d4af37]/40 rounded-xl p-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0a0a0a]">{msg.reward.vendor}</span>
                            <span className="px-2 py-0.5 rounded-full bg-[#d4af37]/20 text-[#8a6d1b] font-mono text-[10px] font-bold">
                              {msg.reward.category}
                            </span>
                          </div>
                          <div className="text-sm font-extrabold text-[#0a3a40]">
                            {msg.reward.offer}
                          </div>
                          <div className="bg-white px-3 py-2 rounded-lg border border-dashed border-[#0a3a40]/30 font-mono font-bold text-center text-[#0a3a40] text-sm tracking-wider select-all shadow-2xs">
                            {msg.reward.code}
                          </div>
                          <div className="text-[10px] text-[#667781] leading-tight">
                            {msg.reward.howToUse}
                          </div>
                        </div>
                        <div className="text-[11px] text-[#4a4a4a] font-medium">
                          Thank you for keeping Bhubaneswar clean and green! 🌿
                        </div>
                      </div>
                    )}

                    {/* Timestamp & Ticks */}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#667781]">
                      <span>{msg.time}</span>
                      {msg.sender === 'user' && (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Fake Input Bar */}
          <div className="bg-[#f0f2f5] px-4 py-2.5 border-t border-[#d1d7db] flex items-center gap-3">
            <Smile className="w-5 h-5 text-[#54656f]" />
            <Paperclip className="w-5 h-5 text-[#54656f]" />
            <div className="flex-1 bg-white rounded-lg px-3.5 py-2 text-xs text-[#8696a0] border border-[#e9edef]">
              Type a message or share location...
            </div>
            <Mic className="w-5 h-5 text-[#54656f]" />
          </div>
        </div>

        {/* ── Right Column: Worker WhatsApp View ────────────────────────────── */}
        <div className="bg-[#f0f2f5] rounded-3xl border border-[#d1d7db] shadow-md flex flex-col overflow-hidden h-[620px]">
          {/* WhatsApp Header */}
          <div className="bg-[#0a3a40] text-white px-4 py-3 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#115e59] border-2 border-white flex items-center justify-center text-white font-bold text-sm shadow-xs">
                  WA
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#25d366] rounded-full border-2 border-[#0a3a40]" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  <span>Worker 1 (Field Unit - Patia)</span>
                </div>
                <div className="text-[11px] text-[#a4d4c5] font-mono">
                  +91 93821 22857 • Field Sanitation Crew
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold">
                WORKER APP
              </span>
              <MoreVertical className="w-4 h-4" />
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div
            ref={workerContainerRef}
            className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#efeae2] bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px]"
          >
            {workerMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#667781] space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#d1d7db] flex items-center justify-center shadow-xs text-[#0a3a40]">
                  <Navigation className="w-6 h-6" />
                </div>
                <div className="font-bold text-sm text-[#111b21]">Worker Dispatch Channel</div>
                <p className="text-xs max-w-xs text-[#667781]">
                  When a report is triaged, the nearest available field worker receives an automated WhatsApp alert with GPS directions and work timer logs.
                </p>
              </div>
            ) : (
              workerMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-150`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3 shadow-xs relative ${
                      msg.sender === 'user'
                        ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-xs'
                        : 'bg-white text-[#111b21] rounded-tl-xs border border-[#e9edef]'
                    }`}
                  >
                    {/* Media Image Card */}
                    {msg.type === 'image' && (
                      <div className="space-y-2 mb-1.5">
                        <div className="rounded-xl overflow-hidden border border-black/10 bg-black/5 aspect-4/3 relative">
                          <img
                            src={msg.imageUrl}
                            alt="Cleanup Photo"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {msg.text && <p className="text-xs leading-relaxed font-medium">{msg.text}</p>}
                      </div>
                    )}

                    {/* Location Pin Card */}
                    {msg.type === 'location' && msg.location && (
                      <div className="space-y-2 mb-1">
                        <div className="bg-[#f0f2f5] rounded-xl p-2.5 border border-[#d1d7db] flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#0a3a40] flex items-center justify-center text-white shrink-0 shadow-xs">
                            <Navigation className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-[#111b21] truncate">{msg.location.name}</div>
                            <div className="text-[10px] font-mono text-[#667781]">
                              {msg.location.lat.toFixed(4)}, {msg.location.lng.toFixed(4)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Regular Text Message */}
                    {msg.type === 'text' && (
                      <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {/* Timestamp & Ticks */}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#667781]">
                      <span>{msg.time}</span>
                      {msg.sender === 'user' && (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Verification Loading Spinner overlay */}
            {isVerifying && (
              <div className="bg-[#0a3a40] text-white p-3 rounded-2xl flex items-center gap-3 shadow-md animate-pulse">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <div className="text-xs font-mono">
                  Running Two-Gate Verification (GPS Proximity &amp; Truth Score Calculation)...
                </div>
              </div>
            )}
          </div>

          {/* Fake Input Bar */}
          <div className="bg-[#f0f2f5] px-4 py-2.5 border-t border-[#d1d7db] flex items-center gap-3">
            <Smile className="w-5 h-5 text-[#54656f]" />
            <Camera className="w-5 h-5 text-[#54656f]" />
            <div className="flex-1 bg-white rounded-lg px-3.5 py-2 text-xs text-[#8696a0] border border-[#e9edef]">
              Send after-photo + location...
            </div>
            <Mic className="w-5 h-5 text-[#54656f]" />
          </div>
        </div>
      </div>

      {/* ── Bottom Explanatory Architecture HUD ────────────────────────────── */}
      <div className="bg-[#faf5e8] rounded-3xl p-6 border border-[#e5e5e5] shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-[#0a3a40]" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0a0a0a]">
            UNDER THE HOOD: LIVE TELEMETRY LOGS &amp; ALGORITHMIC GATES
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#e5e5e5] space-y-1.5 shadow-2xs">
            <div className="text-[10px] font-mono text-[#6a6a6a] uppercase font-bold">1. Bedrock Nova Lite Triage</div>
            <div className="text-sm font-bold text-[#0a0a0a]">Mixed Waste • 85% Fill</div>
            <div className="text-[11px] text-[#4a4a4a]">High Urgency • Est 30 min</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e5e5e5] space-y-1.5 shadow-2xs">
            <div className="text-[10px] font-mono text-[#6a6a6a] uppercase font-bold">2. Priority Score Math</div>
            <div className="text-sm font-bold text-[#0a0a0a]">89.0 / 100</div>
            <div className="text-[11px] text-[#4a4a4a]">(85×0.40) + (50×0.20) + (50×0.10)</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e5e5e5] space-y-1.5 shadow-2xs">
            <div className="text-[10px] font-mono text-[#6a6a6a] uppercase font-bold">3. Haversine Distance Gate</div>
            <div className="text-sm font-bold text-[#0a0a0a]">8.2m Arrival Drift</div>
            <div className="text-[11px] text-[#22c55e] font-semibold">Gate A Passed (&le; 50m limit)</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#e5e5e5] space-y-1.5 shadow-2xs">
            <div className="text-[10px] font-mono text-[#6a6a6a] uppercase font-bold">4. Truth Score Ratio</div>
            <div className="text-sm font-bold text-[#0a0a0a]">92% Truth Ratio</div>
            <div className="text-[11px] text-[#22c55e] font-semibold">Gate B Passed (&ge; 50% threshold)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
