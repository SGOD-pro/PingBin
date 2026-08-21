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
            border-radius: 9999px;
            background: ${statusConfig.bg};
            color: ${statusConfig.text};
            border: 2px solid #ffffff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: 'JetBrains Mono', monospace;
            font-size: ${isSelected ? '12px' : '11px'};
            font-weight: 800;
          ">
            ${Math.round(report.priority_score || 0)}
          </div>
        `,
        iconSize: [isSelected ? 36 : 28, isSelected ? 36 : 28],
        iconAnchor: [isSelected ? 18 : 14, isSelected ? 18 : 14],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; font-size: 12px; width: 230px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 700; text-transform: uppercase; color: #0a0a0a; font-size: 11px; letter-spacing: -0.2px;">
              ${report.waste_type} Waste
            </span>
            <span style="background: ${statusConfig.bg}; color: ${statusConfig.text}; padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; text-transform: uppercase;">
              ${statusConfig.label}
            </span>
          </div>
          <div style="margin-bottom: 8px; font-size: 11px; line-height: 1.5; color: #3a3a3a;">
            <div>Fill Level: <strong>${report.fill_percent}%</strong></div>
            <div>Score: <strong>${Number(report.priority_score || 0).toFixed(1)} / 100</strong></div>
            <div>Citizen: <span style="font-family: monospace;">${report.citizen_phone || 'WhatsApp'}</span></div>
          </div>
          ${
            report.photo_before_url
              ? `<img src="${report.photo_before_url}" style="width: 100%; height: 96px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e5e5; margin-bottom: 6px;" alt="Waste Before" />`
              : ''
          }
        </div>
      `;

      marker.bindPopup(popupContent);
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

    // Auto center if report selected
    if (selectedReport?.location_before?.lat && selectedReport?.location_before?.lng) {
      map.setView(
        [selectedReport.location_before.lat, selectedReport.location_before.lng],
        15,
        { animate: true }
      );
    } else {
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
          <span className="text-[10px] text-[#6a6a6a] font-mono block">
            {reports.length} Incidents · {workers.length} Field Crew
          </span>
        </div>
      </div>

      {/* Center on active report button */}
      {selectedReport?.location_before && (
        <button
          onClick={() => {
            if (mapInstanceRef.current && selectedReport.location_before) {
              mapInstanceRef.current.setView(
                [selectedReport.location_before.lat, selectedReport.location_before.lng],
                16,
                { animate: true }
              );
            }
          }}
          className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-[#e5e5e5] shadow-sm flex items-center gap-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#faf5e8] transition-all cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5 text-[#ff4d8b]" />
          <span className="hidden sm:inline text-xs">Track Selected</span>
        </button>
      )}

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
