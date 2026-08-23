import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Trash2, Server, Radio, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

export const BackendHealthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { serverHealth, isInitialLoading, checkServerHealth, fetchData } = useAppStore();
  const [secondsWaiting, setSecondsWaiting] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsWaiting((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isInitialLoading]);

  useEffect(() => {
    // Initial health probe
    const init = async () => {
      await checkServerHealth();
      await fetchData(true);
    };
    init();
  }, [checkServerHealth, fetchData]);

  if (!isInitialLoading && serverHealth === 'healthy') {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#080d1a] flex flex-col items-center justify-center p-6 text-white overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative w-full max-w-md bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
        
        {/* Animated Brand Radar */}
        <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 animate-pulse" />
          <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 border border-emerald-400/30">
            <Trash2 className="w-8 h-8 text-white animate-bounce" />
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-black tracking-tight text-white">PingBin Cloud</h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-widest">
            V2 Live
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          Autonomous Municipal Waste Operations • AWS Lambda & Nova AI
        </p>

        {/* State Banner */}
        <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Backend Gateway</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">{secondsWaiting}s elapsed</span>
          </div>

          {serverHealth === 'checking' && (
            <div className="flex items-center gap-2.5 text-xs text-amber-300/90 font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Probing AWS API Gateway & Lambda...</span>
            </div>
          )}

          {serverHealth === 'waking_up' && (
            <div className="flex items-start gap-2.5 text-xs text-amber-300/90 font-medium">
              <Sparkles className="w-3.5 h-3.5 mt-0.5 text-amber-400 animate-pulse shrink-0" />
              <div>
                <p>AWS Lambda Cold Start Detected</p>
                <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                  Waking up serverless runtime & establishing DynamoDB connections (~5-10s)...
                </p>
              </div>
            </div>
          )}

          {serverHealth === 'unreachable' && (
            <div className="flex items-start gap-2.5 text-xs text-rose-300 font-medium">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-rose-400 shrink-0" />
              <div>
                <p>Unable to connect to backend</p>
                <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                  Verify network or ensure the backend API server is running on AWS.
                </p>
              </div>
            </div>
          )}

          {serverHealth === 'healthy' && (
            <div className="flex items-center gap-2.5 text-xs text-emerald-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Connected! Loading dashboard telemetry...</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        {serverHealth === 'unreachable' ? (
          <button
            onClick={async () => {
              await checkServerHealth();
              await fetchData();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Server className="w-3.5 h-3.5" />
            <span>Region: <strong className="text-slate-300 font-mono">ap-south-1</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};
