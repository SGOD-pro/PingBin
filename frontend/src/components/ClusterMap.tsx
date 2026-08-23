import React, { useEffect, useRef } from 'react';
import type { ReportItem, WorkerItem } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation } from 'lucide-react';

interface ClusterMapProps {
  reports: ReportItem[];
  workers?: WorkerItem[];
  selectedReport: ReportItem | null;
  onSelectReport: (report: ReportItem) => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#ff4d8b', text: '#ffffff', label: 'Pending' },
  assigned: { bg: '#e8b94a', text: '#0a0a0a', label: 'Assigned' },
  in_progress: { bg: '#1a3a3a', text: '#ffffff', label: 'In Progress' },
  needs_review: { bg: '#b8a4ed', text: '#0a0a0a', label: 'Needs Review' },
  resolved: { bg: '#a4d4c5', text: '#0a0a0a', label: 'Resolved' },
};

export const ClusterMap: React.FC<ClusterMapProps> = ({
  reports,
  workers = [],
  selectedReport,
  onSelectReport,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center around Bhubaneswar coordinates
      const map = L.map(mapContainerRef.current, {
        center: [20.2961, 85.8245],
        zoom: 13,
        zoomControl: false,
      });

      // Add Zoom control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const hasInitialFitRef = useRef(false);
  const prevSelectedReportIdRef = useRef<string | null>(null);

  // ResizeObserver to handle container size changes smoothly without map glitch
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const validReports = reports.filter(
      (r) => r.location_before && typeof r.location_before.lat === 'number'
    );
    const allPoints: L.LatLngTuple[] = [
      ...validReports.map(
        (r) => [r.location_before.lat, r.location_before.lng] as L.LatLngTuple
      ),
      ...workers
        .filter((w) => w.last_known_location)
        .map(
          (w) =>
            [
              Number(w.last_known_location!.lat),
              Number(w.last_known_location!.lng),
            ] as L.LatLngTuple
        ),
    ];
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      map.setView([20.2961, 85.8245], 13);
    }
  };

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // 1. Render Report Markers
    const validReports = reports.filter(
      (r) =>
        r.location_before &&
        typeof r.location_before.lat === 'number' &&
        typeof r.location_before.lng === 'number'
    );

    validReports.forEach((report) => {
      const lat = report.location_before.lat;
      const lng = report.location_before.lng;
      const statusConfig = STATUS_COLORS[report.status] || {
        bg: '#6a6a6a',
        text: '#ffffff',
        label: report.status,
      };
      const isSelected = selectedReport?.report_id === report.report_id;

      const customIcon = L.divIcon({
        className: 'pingbin-map-pin',
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${isSelected ? '36px' : '28px'};
            height: ${isSelected ? '36px' : '28px'};
            border-radius: 50%;
            background: ${statusConfig.bg};
            color: ${statusConfig.text};
            font-weight: 800;
            font-size: ${isSelected ? '12px' : '10px'};
            font-family: monospace;
            border: 2px solid #ffffff;
            box-shadow: 0 4px 14px rgba(0,0,0,0.35);
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
          ">
            ${report.priority_score ? Math.round(report.priority_score) : '—'}
            ${
              isSelected
                ? '<div style="position: absolute; inset: -4px; border-radius: 50%; border: 2px solid #0a0a0a; animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>'
                : ''
            }
          </div>
        `,
        iconSize: isSelected ? [36, 36] : [28, 28],
        iconAnchor: isSelected ? [18, 18] : [14, 14],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      marker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; font-size: 12px; width: 220px; padding: 4px;">
          <div style="font-weight: 800; color: #0a0a0a; font-size: 13px; margin-bottom: 2px; text-transform: capitalize;">
            ${report.waste_type || 'Waste Report'}
          </div>
          <div style="color: #6a6a6a; font-size: 11px; margin-bottom: 8px;">
            Score: <strong style="color: #0a0a0a; font-family: monospace;">${report.priority_score?.toFixed(1) || '0.0'}</strong> • Fill: <strong style="color: #0a0a0a; font-family: monospace;">${report.fill_percent || 0}%</strong>
          </div>
          <div style="display: flex; gap: 4px; align-items: center;">
            <span style="background: ${statusConfig.bg}; color: ${statusConfig.text}; padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; text-transform: uppercase;">
              ${statusConfig.label}
            </span>
            <span style="color: #6a6a6a; font-size: 10px; margin-left: auto;">
              ${report.worker_phone ? 'Assigned' : 'Unassigned'}
            </span>
          </div>
        </div>
      `);
      marker.on('click', () => {
        onSelectReport(report);
      });

      markersGroup.addLayer(marker);
    });

    // 2. Render Worker Markers
    workers.forEach((worker) => {
      if (!worker.last_known_location) return;
      const lat = Number(worker.last_known_location.lat);
      const lng = Number(worker.last_known_location.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      const isFree = worker.status === 'free';
      const workerBg = isFree ? '#a4d4c5' : '#ffb084'; // mint vs peach

      const workerIcon = L.divIcon({
        className: 'worker-map-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            border-radius: 12px;
            background: #0a0a0a;
            border: 2px solid ${workerBg};
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            color: #ffffff;
            font-size: 13px;
          ">
            👷
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const workerMarker = L.marker([lat, lng], { icon: workerIcon });
      workerMarker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; font-size: 12px; width: 190px; padding: 4px;">
          <div style="font-weight: 700; color: #0a0a0a; margin-bottom: 2px;">${worker.name || 'Sanitation Worker'}</div>
          <div style="font-size: 11px; font-family: monospace; color: #6a6a6a; margin-bottom: 6px;">${worker.phone}</div>
          <span style="background: ${workerBg}; color: #0a0a0a; padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; text-transform: uppercase;">
            ${isFree ? 'Available' : 'On Dispatch'}
          </span>
        </div>
      `);
      markersGroup.addLayer(workerMarker);
    });

    // Auto center ONLY if selected report changed
    if (selectedReport?.location_before?.lat && selectedReport?.location_before?.lng) {
      if (prevSelectedReportIdRef.current !== selectedReport.report_id) {
        map.setView(
          [selectedReport.location_before.lat, selectedReport.location_before.lng],
          15,
          { animate: true }
        );
        prevSelectedReportIdRef.current = selectedReport.report_id;
      }
    } else {
      prevSelectedReportIdRef.current = null;
      // Initial fit once
      if (!hasInitialFitRef.current && (validReports.length > 0 || workers.length > 0)) {
        const allPoints: L.LatLngTuple[] = [
          ...validReports.map(
            (r) => [r.location_before.lat, r.location_before.lng] as L.LatLngTuple
          ),
          ...workers
            .filter((w) => w.last_known_location)
            .map(
              (w) =>
                [
                  Number(w.last_known_location!.lat),
                  Number(w.last_known_location!.lng),
                ] as L.LatLngTuple
            ),
        ];
        if (allPoints.length > 0) {
          const bounds = L.latLngBounds(allPoints);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          hasInitialFitRef.current = true;
        }
      }
    }
  }, [reports, workers, selectedReport, onSelectReport]);

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-3xl overflow-hidden border border-[#e5e5e5] shadow-sm bg-[#faf5e8] flex flex-col">
      {/* Map Header Overlay */}
      <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-[#e5e5e5] shadow-sm flex items-center gap-3 text-xs font-bold text-[#0a0a0a]">
        <div className="w-6 h-6 rounded-lg bg-[#0a0a0a] text-white flex items-center justify-center shadow-xs">
          <MapPin className="w-3.5 h-3.5 text-[#a4d4c5]" />
        </div>
        <div>
          <span className="font-display font-bold block">Live Geospatial Network</span>
          <span className="text-[10px] text-[#6a6a6a] font-mono">
            {reports.length} Incidents • {workers.length} Field Units
          </span>
        </div>
      </div>

      {/* Recenter Action Button */}
      <button
        onClick={handleRecenter}
        className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-[#e5e5e5] shadow-xs text-xs font-bold text-[#0a0a0a] hover:bg-[#faf5e8] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
        title="Recenter view on active fleet & incidents"
      >
        <Navigation className="w-3.5 h-3.5 text-[#1a3a3a]" />
        <span className="hidden sm:inline">Recenter</span>
      </button>

      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-[#e5e5e5] shadow-sm text-xs flex flex-wrap items-center gap-3.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff4d8b]"></span>
          <span className="text-[11px] font-bold text-[#3a3a3a]">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e8b94a]"></span>
          <span className="text-[11px] font-bold text-[#3a3a3a]">Assigned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1a3a3a]"></span>
          <span className="text-[11px] font-bold text-[#3a3a3a]">In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#b8a4ed]"></span>
          <span className="text-[11px] font-bold text-[#3a3a3a]">Review</span>
        </div>
        <div className="flex items-center gap-1.5 pl-2 border-l border-[#e5e5e5]">
          <span className="text-sm">👷</span>
          <span className="text-[11px] font-bold text-[#0a0a0a]">Field Staff</span>
        </div>
      </div>

      {/* The Leaflet Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[460px] flex-1" />
    </div>
  );
};
