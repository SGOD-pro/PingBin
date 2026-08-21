import React, { useState } from 'react';
import type { WorkerItem } from '../types';
import {
  X,
  UserPlus,
  Users,
  MapPin,
  CheckCircle,
  Clock,
  Phone,
  ArrowLeft,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import { lookupPincode, QUICK_AREAS } from '../utils/pincode';

const WORKER_AVATARS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
];

function getWorkerAvatar(worker: WorkerItem, idx: number): string {
  if (worker.photo_url && !worker.photo_url.includes('1535713875002-d1d0cf377fde')) {
    return worker.photo_url;
  }
  return WORKER_AVATARS[idx % WORKER_AVATARS.length];
}

interface WorkersModalProps {
  workers: WorkerItem[];
  isOpen: boolean;
  onClose: () => void;
  onAddWorker: (data: {
    fullname: string;
    phone: string;
    latitude: number;
    longitude: number;
    photo_url?: string;
  }) => Promise<boolean>;
}

export function WorkersModal({
  workers,
  isOpen,
  onClose,
  onAddWorker,
}: WorkersModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [fullname, setFullname] = useState('');
  const [phone, setPhone] = useState('');
  const [pincode, setPincode] = useState('751024');
  const [areaName, setAreaName] = useState('Patia / KIIT / Infocity (Bhubaneswar)');
  const [lat, setLat] = useState('20.3533');
  const [lng, setLng] = useState('85.8197');
  const [photoUrl, setPhotoUrl] = useState(
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handlePincodeChange = (code: string) => {
    setPincode(code);
    const info = lookupPincode(code);
    if (info) {
      setLat(info.lat.toString());
      setLng(info.lng.toString());
      setAreaName(`${info.area}, ${info.city}`);
    }
  };

  const handleAreaSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    if (code) {
      handlePincodeChange(code);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullname || !phone) return;
    setIsSubmitting(true);
    const success = await onAddWorker({
      fullname,
      phone,
      latitude: parseFloat(lat) || 20.3533,
      longitude: parseFloat(lng) || 85.8197,
      photo_url: photoUrl,
    });
    setIsSubmitting(false);
    if (success) {
      setFullname('');
      setPhone('');
      setShowAddForm(false);
    }
  };

  const inputCls =
    'w-full bg-white text-[#0a0a0a] border border-[#e5e5e5] rounded-xl px-4 py-2.5 text-xs font-medium placeholder:text-[#9a9a9a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] transition-all shadow-xs';
  const labelCls = 'block text-[10px] font-mono font-bold uppercase tracking-wider text-[#6a6a6a] mb-1.5';

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#fffaf0] rounded-3xl max-w-2xl w-full shadow-2xl border-2 border-[#e5e5e5] overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#e5e5e5] flex items-center justify-between bg-[#faf5e8]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0a0a0a] text-white flex items-center justify-center font-bold shadow-sm">
              <Users className="w-4.5 h-4.5 text-[#a4d4c5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-[#0a0a0a] text-base tracking-tight">
                  Sanitation Worker Fleet
                </h3>
                <span className="bg-[#0a0a0a] text-white font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  {workers.length} Registered
                </span>
              </div>
              <p className="text-[11px] text-[#6a6a6a]">
                WhatsApp Dispatch &amp; Live GPS Field Roster
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] transition-all active:scale-[0.98] shadow-md cursor-pointer"
            >
              {showAddForm ? (
                <>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>View Fleet</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5 text-[#a4d4c5]" />
                  <span>Add Worker</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#6a6a6a] hover:text-[#0a0a0a] hover:bg-[#f5f0e0] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#fffaf0]">
          {showAddForm ? (
            /* Add Worker Form */
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto bg-[#faf5e8] p-6 rounded-3xl border border-[#e5e5e5] shadow-sm">
              <div className="border-b border-[#e5e5e5] pb-3 mb-2">
                <h4 className="font-display font-bold text-sm text-[#0a0a0a]">
                  Enroll New Sanitation Worker
                </h4>
                <p className="text-xs text-[#6a6a6a]">
                  Add worker to automated WhatsApp dispatch routing.
                </p>
              </div>

              <div>
                <label className={labelCls}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>WhatsApp Phone (+CountryCode)</label>
                <input
                  type="text"
                  required
                  placeholder="+919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Pincode & Area Selector */}
              <div className="p-3 bg-white rounded-2xl border border-[#e5e5e5] space-y-3 shadow-xs">
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Compass className="w-3 h-3 text-[#ff4d8b]" />
                      Quick Area Preset (Bhubaneswar / Metro)
                    </span>
                  </label>
                  <select
                    onChange={handleAreaSelect}
                    value={pincode}
                    className="w-full bg-[#faf5e8] text-[#0a0a0a] border border-[#e5e5e5] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0a0a0a] cursor-pointer"
                  >
                    {QUICK_AREAS.map((a) => (
                      <option key={a.pincode} value={a.pincode}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2.5 items-end">
                  <div>
                    <label className={labelCls}>PIN Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 751024"
                      value={pincode}
                      onChange={(e) => handlePincodeChange(e.target.value)}
                      className="w-full bg-[#faf5e8] text-[#0a0a0a] border border-[#e5e5e5] rounded-xl px-3 py-2 text-xs font-mono font-bold placeholder:text-[#9a9a9a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]"
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-mono text-[#6a6a6a] uppercase font-bold block mb-1">
                      Resolved Zone
                    </span>
                    <div className="px-3 py-2 bg-[#faf5e8] rounded-xl border border-[#e5e5e5] text-xs font-semibold text-[#0a0a0a] truncate">
                      {areaName || 'Custom GPS Zone'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#6a6a6a] mb-1">
                      GPS Lat
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="w-full bg-[#faf5e8] text-[#0a0a0a] border border-[#e5e5e5] rounded-xl px-3 py-1.5 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[#6a6a6a] mb-1">
                      GPS Lng
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      className="w-full bg-[#faf5e8] text-[#0a0a0a] border border-[#e5e5e5] rounded-xl px-3 py-1.5 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Photo URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl border border-[#e5e5e5] bg-white text-[#3a3a3a] hover:bg-[#f5f0e0] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] transition-all shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    'Registering...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#a4d4c5]" />
                      <span>Register Field Worker</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Workers List */
            <div className="space-y-3">
              {workers.length === 0 ? (
                <div className="text-center py-12 text-[#6a6a6a] text-xs bg-[#faf5e8] rounded-2xl border border-[#e5e5e5] p-6 shadow-sm">
                  <Users className="w-10 h-10 mx-auto mb-2 text-[#9a9a9a] opacity-70" />
                  <p className="font-bold text-[#0a0a0a] text-sm">No workers registered yet.</p>
                  <p className="text-[11px] text-[#6a6a6a] mt-1">
                    Click &quot;Add Worker&quot; to enroll field personnel into the dispatch pool.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {workers.map((worker, idx) => (
                    <div
                      key={worker.worker_id}
                      className="p-4 bg-white border border-[#e5e5e5] rounded-2xl flex items-start gap-3.5 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="w-12 h-12 rounded-2xl overflow-hidden border border-[#e5e5e5] shadow-xs shrink-0 bg-[#0a0a0a] text-white flex items-center justify-center font-display font-bold text-sm">
                        {worker.photo_url ? (
                          <img
                            src={getWorkerAvatar(worker, idx)}
                            alt={worker.name || 'Worker'}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[#a4d4c5]">
                            {worker.name ? worker.name.replace('Worker ', '').slice(0, 2).toUpperCase() : 'W'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-display font-bold text-[#0a0a0a] truncate">
                            {worker.name || 'Sanitation Worker'}
                          </h4>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 shadow-xs ${
                              worker.status === 'free'
                                ? 'bg-[#a4d4c5] text-[#0a3a2a]'
                                : 'bg-[#ffb084] text-[#8f3e09]'
                            }`}
                          >
                            {worker.status === 'free' ? 'Available' : 'Busy'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#3a3a3a]">
                          <Phone className="w-3.5 h-3.5 text-[#9a9a9a]" />
                          <span className="font-mono font-semibold">{worker.phone}</span>
                        </div>
                        {worker.last_known_location && (
                          <div className="flex items-center gap-1 text-[10px] text-[#6a6a6a] font-mono">
                            <MapPin className="w-3 h-3 text-[#ff4d8b]" />
                            <span>
                              {Number(worker.last_known_location.lat).toFixed(4)},{' '}
                              {Number(worker.last_known_location.lng).toFixed(4)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#faf5e8] border-t border-[#e5e5e5] flex items-center justify-between text-xs text-[#3a3a3a]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[#0a0a0a] font-bold">
              <CheckCircle className="w-4 h-4 text-[#22c55e]" />
              {workers.filter((w) => w.status === 'free').length} Available
            </span>
            <span className="flex items-center gap-1.5 text-[#6a6a6a] font-semibold">
              <Clock className="w-4 h-4 text-[#ffb084]" />
              {workers.filter((w) => w.status === 'busy').length} On Dispatch
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-bold rounded-xl bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] transition-all active:scale-[0.98] shadow-md cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
