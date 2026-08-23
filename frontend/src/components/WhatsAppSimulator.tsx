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
  AlertTriangle,
  ShieldAlert,
  Layers,
  Clock,
} from 'lucide-react';
import * as api from '../lib/api';

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

export type DemoScenario =
  | 'happy_path'
  | 'fake_work_gate'
  | 'safety_gate_suspicious'
  | 'order_agnostic_loc_first'
  | 'session_timeout_expired';

export function WhatsAppSimulator() {
  const [scenario, setScenario] = useState<DemoScenario>('happy_path');
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

  // Helper to trigger background backend sync (bypassing Twilio SMS network)
  const syncBackend = (payload: Record<string, any>) => {
    api.simulateMessage(payload).catch((err) => console.warn('Backend sync notice:', err));
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

    // =========================================================================
    // SCENARIO 1: HAPPY PATH — Standard High-Confidence Resolution & Reward
    // =========================================================================
    if (scenario === 'happy_path') {
      const citizenPhone = '+919084686979';

      // Step 1: Citizen sends photo + GPS location
      scheduleStep(() => {
        setCurrentStep(1);
        setCitizenMessages([
          {
            id: 'c1',
            sender: 'user',
            type: 'image',
            imageUrl: 'http://localhost:8000/images/dustbins-india-T5BHA9.jpg',
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
        syncBackend({
          sender_phone: citizenPhone,
          message_type: 'photo',
          media_url: 'http://localhost:8000/images/dustbins-india-T5BHA9.jpg',
          latitude: 20.3533,
          longitude: 85.8197,
        });
      }, 400);

      // Step 2: System acknowledges in Citizen chat
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
      }, 2000);

      // Step 3: Dispatch to Worker & Notify Citizen
      scheduleStep(() => {
        setCurrentStep(3);
        setCitizenMessages((prev) => [
          ...prev,
          {
            id: 'c4',
            sender: 'system',
            type: 'text',
            text: '✅ Triage Complete (Priority: 89/100 • Mixed Waste • 85% Fill). Worker 1 (+91 93821 22857) dispatched. Estimated cleanup: 35 mins.',
            time: formatTime(4),
          },
        ]);

        setWorkerMessages([
          {
            id: 'w1',
            sender: 'system',
            type: 'text',
            text: '🚨 PINGBIN DISPATCH ALERT 🚨\n\nIncident: #rep-patia-01\nType: MIXED Waste | Fill: 85% (High Urgency)\nPriority Score: 89/100\nEst. Time: 35 min\nLocation: KIIT Square, Patia\n\nSend a PHOTO + LOCATION when you arrive to start timer.',
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
      }, 4200);

      // Step 4: Worker Arrives at Site (Arrival GPS <= 50m)
      scheduleStep(() => {
        setCurrentStep(4);
        setWorkerMessages((prev) => [
          ...prev,
          {
            id: 'w3',
            sender: 'user',
            type: 'image',
            imageUrl: 'http://localhost:8000/images/dustbins-india-T5BHA9.jpg',
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
            text: '👷 Worker 1 has arrived on-site and initiated cleanup operations.',
            time: formatTime(8),
          },
        ]);
      }, 7000);

      // Step 5: Worker Completes Work (After Photo + Finish GPS)
      scheduleStep(() => {
        setCurrentStep(5);
        setWorkerMessages((prev) => [
          ...prev,
          {
            id: 'w6',
            sender: 'user',
            type: 'image',
            imageUrl: 'http://localhost:8000/images/new-delhi-india-may-8-260nw-1974738929.webp',
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
      }, 10500);

      // Step 6: Two-Gate Verification Passed & Citizen Reward Issued
      scheduleStep(() => {
        setIsVerifying(false);
        setCurrentStep(6);

        setWorkerMessages((prev) => [
          ...prev,
          {
            id: 'w8',
            sender: 'system',
            type: 'text',
            text: '✅ TWO-GATE AUDIT PASSED!\n• Gate A (GPS): 8.2m <= 50m limit\n• Gate B (Truth Score): 92% >= 50% threshold\n\nJob resolved! 35kg biomass routed to Patia MRF (Valuation: ₹252.00). You are now FREE for new assignments.',
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
      }, 13800);
    }

    // =========================================================================
    // SCENARIO 2: TRUTH ENGINE — Worker Fake-Work & Time Anomaly Gating
    // =========================================================================
    else if (scenario === 'fake_work_gate') {
      scheduleStep(() => {
        setCurrentStep(1);
        setCitizenMessages([
          {
            id: 'c1',
            sender: 'user',
            type: 'image',
            imageUrl: 'http://localhost:8000/images/dustbins-india-T5BHA9.jpg',
            text: 'Massive garbage pile near Infocity gate!',
            time: formatTime(0),
            status: 'read',
          },
          {
            id: 'c2',
            sender: 'user',
            type: 'location',
            location: {
              name: 'Infocity Ave, Patia, Bhubaneswar',
              lat: 20.358,
              lng: 85.815,
            },
            time: formatTime(1),
            status: 'read',
          },
        ]);
      }, 400);

      scheduleStep(() => {
        setCurrentStep(2);
        setCitizenMessages((prev) => [
          ...prev,
          {
            id: 'c3',
            sender: 'system',
            type: 'text',
            text: '✅ Triage Complete (Priority: 91/100 • Estimated Cleanup: 45 mins). Worker 2 dispatched.',
            time: formatTime(2),
          },
        ]);

        setWorkerMessages([
          {
            id: 'w1',
            sender: 'system',
            type: 'text',
            text: '🚨 PINGBIN DISPATCH ALERT 🚨\n\nIncident: #rep-infocity-02\nEstimated Cleanup: 45 min\nLocation: Infocity Ave, Patia\n\nSend PHOTO + LOCATION when you arrive.',
            time: formatTime(2),
          },
        ]);
      }, 2500);

      // Worker attempts fake completion in 12 seconds from 450 meters away!
      scheduleStep(() => {
        setCurrentStep(4);
        setWorkerMessages((prev) => [
          ...prev,
          {
            id: 'w2',
            sender: 'user',
            type: 'image',
            imageUrl: 'http://localhost:8000/images/new-delhi-india-may-8-260nw-1974738929.webp',
            text: 'Done cleanup already! Send coupon.',
            time: formatTime(5),
            status: 'read',
          },
          {
            id: 'w3',
            sender: 'user',
            type: 'location',
            location: {
              name: 'Worker Device GPS (450m Distance Anomaly)',
              lat: 20.354,
              lng: 85.811,
            },
            time: formatTime(5),
            status: 'read',
          },
        ]);
        setIsVerifying(true);
      }, 5500);

      // Audit Engine catches fake work!
      scheduleStep(() => {
        setIsVerifying(false);
        setCurrentStep(6);

        setWorkerMessages((prev) => [
          ...prev,
          {
            id: 'w4',
            sender: 'system',
            type: 'text',
            text: '⚠️ TWO-GATE VERIFICATION FAILED!\n❌ Gate A: Distance 450m > 50m radius limit\n❌ Gate B: Actual duration 0.2m vs 45.0m estimated (Truth Score: 0% < 50%)\n\nAudit flagged! Report routed to Supervisor Review Queue. Citizen reward withheld.',
            time: formatTime(8),
          },
        ]);

        setCitizenMessages((prev) => [
          ...prev,
          {
            id: 'c4',
            sender: 'system',
            type: 'text',
            text: '🛡️ Quality Assurance Notice: Worker proof is undergoing supervisor audit verification to guarantee clean streets.',
            time: formatTime(8),
          },
        ]);
        setIsSimulating(false);
      }, 8500);
    }

    // =========================================================================
    // SCENARIO 3: SAFETY GATE — Suspicious / Synthetic Photo & Admin Reject
    // =========================================================================
    else if (scenario === 'safety_gate_suspicious') {
      scheduleStep(() => {
        setCurrentStep(1);
        setCitizenMessages([
          {
            id: 'c1',
            sender: 'user',
            type: 'image',
            imageUrl: 'http://localhost:8000/images/dustbins-india-T5BHA9.jpg',
            text: 'Here is a photo of the waste.',
            time: formatTime(0),
            status: 'read',
          },
        ]);
      }, 400);

      scheduleStep(() => {
        setCurrentStep(2);
        setCitizenMessages((prev) => [
          ...prev,
          {
            id: 'c2',
            sender: 'system',
            type: 'text',
            text: '🤖 PingBin AI: Thanks for reporting! We\'ve received your report. It is currently being processed.',
            time: formatTime(2),
          },
        ]);
      }, 2200);

      // Safety Gate halts dispatch in Command Center
      scheduleStep(() => {
        setCurrentStep(3);
        setWorkerMessages([
          {
            id: 'w1',
            sender: 'system',
            type: 'text',
            text: '🛡️ DISPATCH HOLD: Ticket #rep-suspicious-001 gated by Bedrock Nova Lite safety gate (Confidence: 14% < 25% • Suspicious Flag: True). Awaiting admin determination.',
            time: formatTime(4),
          },
        ]);
      }, 4500);

      // Admin rejects fake report -> Warning sent to citizen
      scheduleStep(() => {
        setCurrentStep(6);
        setCitizenMessages((prev) => [
          ...prev,
          {
            id: 'c3',
            sender: 'system',
            type: 'text',
            text: '⚠️ Our admin team reviewed your report and determined it was not a valid waste complaint. Please ensure accurate reporting to help us keep the city clean. Misuse of the reporting system may lead to blocked access.',
            time: formatTime(7),
          },
        ]);
        setIsSimulating(false);
      }, 7500);
    }

    // =========================================================================
    // SCENARIO 4: ORDER-AGNOSTIC — Location Sent First, Photo Sent Second
    // =========================================================================
    else if (scenario === 'order_agnostic_loc_first') {
      // Step 1: Citizen sends location PIN first
      scheduleStep(() => {
        setCurrentStep(1);
        setCitizenMessages([
          {
            id: 'c1',
            sender: 'user',
            type: 'location',
            location: {
              name: 'Chandaka Industrial Area, Bhubaneswar',
              lat: 20.37,
              lng: 85.805,
            },
            time: formatTime(0),
            status: 'read',
          },
          {
            id: 'c2',
            sender: 'system',
            type: 'text',
            text: '📍 Location received! Please send a clear photo of the waste or overflowing dustbin to complete your report.',
            time: formatTime(1),
          },
        ]);
      }, 400);

      // Step 2: Citizen sends photo 3 seconds later
      scheduleStep(() => {
        setCurrentStep(2);
        setCitizenMessages((prev) => [
          ...prev,
          {
            id: 'c3',
            sender: 'user',
            type: 'image',
            imageUrl: 'http://localhost:8000/images/dustbins-india-T5BHA9.jpg',
            text: 'Here is the photo of the industrial dump.',
            time: formatTime(3),
            status: 'read',
          },
        ]);
      }, 3000);

      // Step 3: Both present -> Nova Lite triages & triggers worker dispatch
      scheduleStep(() => {
        setCurrentStep(3);
        setCitizenMessages((prev) => [
          ...prev,
          {
            id: 'c4',
            sender: 'system',
            type: 'text',
            text: '✅ Correlation Complete! Bedrock Nova Lite triaged report (Priority: 78.5/100 • Organic/Cardboard). Worker 3 dispatched to Chandaka.',
            time: formatTime(5),
          },
        ]);

        setWorkerMessages([
          {
            id: 'w1',
            sender: 'system',
            type: 'text',
            text: '🚨 PINGBIN DISPATCH ALERT 🚨\n\nIncident: #rep-chandaka-03\nType: Organic & Paper (80% Full)\nLocation: Chandaka Industrial Area\n\nSend PHOTO + LOCATION on arrival.',
            time: formatTime(5),
          },
        ]);
        setIsSimulating(false);
      }, 5500);
    }

    // =========================================================================
    // SCENARIO 5: INTAKE SESSION EXPIRED (>2.5 min)
    // =========================================================================
    else if (scenario === 'session_timeout_expired') {
      // Step 1: Citizen sends photo
      scheduleStep(() => {
        setCurrentStep(1);
        setCitizenMessages([
          {
            id: 'c1',
            sender: 'user',
            type: 'image',
            imageUrl: 'http://localhost:8000/images/dustbins-india-T5BHA9.jpg',
            text: 'Garbage dump near Patia square',
            time: '14:00',
            status: 'read',
          },
          {
            id: 'c2',
            sender: 'system',
            type: 'text',
            text: '📸 Photo received! Please share your live GPS location within 2.5 minutes to dispatch a cleaning team.',
            time: '14:00',
          },
        ]);
      }, 400);

      // Step 2: System clock advances past 150s (2.5 min session timeout)
      scheduleStep(() => {
        setCurrentStep(2);
        setCitizenMessages((prev) => [
          ...prev,
          {
            id: 'c3',
            sender: 'system',
            type: 'text',
            text: '⏱️ Session Expired: More than 2.5 minutes passed without receiving your location. This pending ticket has been auto-closed.',
            time: '14:03',
          },
        ]);
      }, 3000);

      // Step 3: Citizen tries sending location late
      scheduleStep(() => {
        setCurrentStep(3);
        setCitizenMessages((prev) => [
          ...prev,
          {
            id: 'c4',
            sender: 'user',
            type: 'location',
            location: {
              name: 'Patia Square, Bhubaneswar',
              lat: 20.3533,
              lng: 85.8197,
            },
            time: '14:04',
            status: 'read',
          },
          {
            id: 'c5',
            sender: 'system',
            type: 'text',
            text: '⚠️ Your previous intake session timed out (>2.5 min). We have started a fresh report for you with this location! Please send a new photo of the waste.',
            time: '14:04',
          },
        ]);
        setIsSimulating(false);
      }, 5500);
    }
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
                PITCH SCENARIO ORCHESTRATOR
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#0a0a0a] tracking-tight">
              Real-Time WhatsApp Citizen &amp; Worker Orchestrator
            </h1>
            <p className="text-sm text-[#4a4a4a] leading-relaxed">
              Experience the live dual-device WhatsApp workflow: citizen photo intake, Bedrock Nova Lite triage, Haversine dispatch, 2-gate anti-fake-work verification, and instant hyperlocal reward delivery.
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
                  <span>Executing ({currentStep}/6)...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current text-[#a4d4c5] shrink-0" />
                  <span>Run Selected Scenario</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Scenario Selection Cards (Judge Pitch Demos) ────────────────── */}
        <div className="mt-6 pt-5 border-t border-[#e5e5e5]/80">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6a6a6a] block mb-3">
            Select Pitch Demonstration Test Case:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              {
                id: 'happy_path' as DemoScenario,
                title: '1. Standard Resolution & Reward',
                desc: 'Photo + GPS ➔ Nova Lite Triage ➔ Dispatch ➔ 92% Truth Score ➔ Coupon issued + MRF revenue.',
                icon: Award,
                tag: 'Happy Path',
                color: 'border-[#22c55e] text-[#166534]',
              },
              {
                id: 'fake_work_gate' as DemoScenario,
                title: '2. Truth Engine: Fake-Work Gate',
                desc: 'Worker claims 12s cleanup from 450m away ➔ Gate A & B fail ➔ Routed to Audit Queue.',
                icon: AlertTriangle,
                tag: 'Anti-Fake Work',
                color: 'border-[#ef4444] text-[#991b1b]',
              },
              {
                id: 'safety_gate_suspicious' as DemoScenario,
                title: '3. Safety Gate: Fake/Low-Conf Photo',
                desc: 'Ambiguous image < 25% conf ➔ Held in Admin Review ➔ Admin Rejects ➔ Citizen warned.',
                icon: ShieldAlert,
                tag: 'Safety Gate',
                color: 'border-[#f59e0b] text-[#92400e]',
              },
              {
                id: 'order_agnostic_loc_first' as DemoScenario,
                title: '4. Order-Agnostic: Location First',
                desc: 'Citizen sends GPS pin first ➔ System waits ➔ Photo sent second ➔ Correlation & dispatch.',
                icon: Layers,
                tag: 'Edge Case',
                color: 'border-[#0a3a40] text-[#0a3a40]',
              },
              {
                id: 'session_timeout_expired' as DemoScenario,
                title: '5. Intake Session Expired (>2.5 min)',
                desc: 'Citizen sends photo but delays GPS > 2.5 min ➔ Session auto-expires ➔ Restart prompt.',
                icon: Clock,
                tag: 'Timeout Gate',
                color: 'border-[#6b7280] text-[#374151]',
              },
            ].map((sc) => {
              const isSelected = scenario === sc.id;
              const Icon = sc.icon;
              return (
                <button
                  key={sc.id}
                  onClick={() => {
                    if (!isSimulating) {
                      setScenario(sc.id);
                      resetSimulation();
                    }
                  }}
                  disabled={isSimulating}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-2 border-[#0a3a40] shadow-md ring-2 ring-[#0a3a40]/20'
                      : 'bg-white/70 hover:bg-white border-[#e5e5e5] hover:border-[#cbd5e1]'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-gray-100 ${sc.color}`}>
                      {sc.tag}
                    </span>
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-[#0a3a40]' : 'text-gray-400'}`} />
                  </div>
                  <h4 className="font-display font-bold text-xs text-[#0a0a0a] leading-tight mb-1">
                    {sc.title}
                  </h4>
                  <p className="text-[11px] text-[#6a6a6a] leading-snug">
                    {sc.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Step Progress Indicator */}
        <div className="mt-5 pt-4 border-t border-[#e5e5e5]/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { step: 1, label: '1. Citizen Intake', sub: 'Photo / Location' },
            { step: 2, label: '2. Bedrock Triage', sub: 'Vision Multimodal' },
            { step: 3, label: '3. Gate Check / Dispatch', sub: 'Safety Gate & Haversine' },
            { step: 4, label: '4. Field Worker Ops', sub: 'On-Site Tracking' },
            { step: 5, label: '5. Proof Upload', sub: 'Completion Telemetry' },
            { step: 6, label: '6. 2-Gate Determination', sub: 'Audit / Rewards / MRF' },
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
