import { create } from 'zustand';
import { toast } from 'sonner';
import type {
  ReportItem,
  WorkerItem,
  WarehouseItem,
  VendorItem,
  CouponItem,
} from '../types';
import * as api from '../lib/api';

export type ServerHealthState = 'checking' | 'healthy' | 'waking_up' | 'unreachable';
export type AppTab = 'queue' | 'map' | 'staff' | 'warehouses' | 'vendors' | 'simulator';

interface AppState {
  // Data
  reports: ReportItem[];
  workers: WorkerItem[];
  warehouses: WarehouseItem[];
  vendors: VendorItem[];
  coupons: CouponItem[];
  
  // UI & Selection
  selectedReportId: string | null;
  activeTab: AppTab;
  filterStatus: string;
  searchQuery: string;

  // Server & Loading State
  serverHealth: ServerHealthState;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  healthRetryCount: number;

  // Actions
  checkServerHealth: () => Promise<boolean>;
  fetchData: (silent?: boolean) => Promise<void>;
  setSelectedReportId: (id: string | null) => void;
  setActiveTab: (tab: AppTab) => void;
  setFilterStatus: (status: string) => void;
  setSearchQuery: (query: string) => void;
  
  // Async Mutations
  approveReportAction: (reportId: string) => Promise<boolean>;
  rejectReportAction: (reportId: string) => Promise<boolean>;
  createWorkerAction: (worker: Omit<WorkerItem, 'worker_id' | 'created_at'> & { worker_id?: string }) => Promise<boolean>;
  deleteWorkerAction: (workerId: string) => Promise<boolean>;
  createVendorAction: (vendor: Omit<VendorItem, 'vendor_id' | 'created_at'> & { vendor_id?: string }) => Promise<boolean>;
}

export const useAppStore = create<AppState>((set, get) => ({
  reports: [],
  workers: [],
  warehouses: [],
  vendors: [],
  coupons: [],

  selectedReportId: null,
  activeTab: 'queue',
  filterStatus: 'all',
  searchQuery: '',

  serverHealth: 'checking',
  isInitialLoading: true,
  isRefreshing: false,
  lastUpdated: null,
  healthRetryCount: 0,

  checkServerHealth: async () => {
    try {
      set({ serverHealth: 'checking' });
      await api.checkHealth();
      set({ serverHealth: 'healthy', isInitialLoading: false });
      return true;
    } catch {
      const currentRetries = get().healthRetryCount;
      if (currentRetries < 2) {
        set({ serverHealth: 'waking_up', healthRetryCount: currentRetries + 1 });
      } else {
        set({ serverHealth: 'unreachable' });
      }
      return false;
    }
  },

  fetchData: async (silent = false) => {
    if (!silent) {
      set({ isRefreshing: true });
    }

    try {
      const [reportsData, workersData, warehousesData, vendorsData, couponsData] =
        await Promise.all([
          api.getReports().catch(() => get().reports),
          api.getWorkers().catch(() => get().workers),
          api.getWarehouses().catch(() => get().warehouses),
          api.getVendors().catch(() => get().vendors),
          api.getCoupons().catch(() => get().coupons),
        ]);

      set({
        reports: reportsData,
        workers: workersData,
        warehouses: warehousesData,
        vendors: vendorsData,
        coupons: couponsData,
        lastUpdated: new Date(),
        serverHealth: 'healthy',
        isInitialLoading: false,
        isRefreshing: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to synchronize data';
      if (!silent) {
        toast.error('Sync Error', { description: msg });
      }
      set({ isRefreshing: false, isInitialLoading: false });
    }
  },

  setSelectedReportId: (id) => set({ selectedReportId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  approveReportAction: async (reportId: string) => {
    const toastId = toast.loading('Approving and calculating priority...');
    try {
      // Optimistic update
      set((state) => ({
        reports: state.reports.map((r) =>
          r.report_id === reportId ? { ...r, status: 'pending' } : r
        ),
      }));

      const res = await api.approveReport(reportId);
      toast.success('Report Approved & Dispatched', {
        id: toastId,
        description: `Ticket ${reportId.slice(0, 8)} moved to active queue (Priority: ${res.priority_score ?? 'Auto'}).`,
      });

      // Refresh to get full worker assignment
      await get().fetchData(true);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      toast.error('Approval Failed', {
        id: toastId,
        description: msg,
      });
      await get().fetchData(true);
      return false;
    }
  },

  rejectReportAction: async (reportId: string) => {
    const toastId = toast.loading('Rejecting report and notifying citizen...');
    try {
      // Optimistic update
      set((state) => ({
        reports: state.reports.map((r) =>
          r.report_id === reportId ? { ...r, status: 'rejected' } : r
        ),
      }));

      await api.rejectReport(reportId);
      toast.success('Report Rejected', {
        id: toastId,
        description: `Report ${reportId.slice(0, 8)} rejected. WhatsApp rejection notice sent to citizen.`,
      });

      await get().fetchData(true);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rejection failed';
      toast.error('Rejection Failed', {
        id: toastId,
        description: msg,
      });
      await get().fetchData(true);
      return false;
    }
  },

  createWorkerAction: async (workerData) => {
    const toastId = toast.loading('Registering worker in Bhubaneswar fleet...');
    try {
      const newWorker = await api.createWorker(workerData);
      set((state) => ({
        workers: [newWorker, ...state.workers],
      }));
      toast.success('Worker Registered', {
        id: toastId,
        description: `${newWorker.name} (${newWorker.phone}) is now active in field dispatch.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register worker';
      toast.error('Registration Error', {
        id: toastId,
        description: msg,
      });
      return false;
    }
  },

  deleteWorkerAction: async (workerId: string) => {
    const toastId = toast.loading('Removing worker from roster...');
    try {
      await api.deleteWorker(workerId);
      set((state) => ({
        workers: state.workers.filter((w) => w.worker_id !== workerId),
      }));
      toast.success('Worker Removed', {
        id: toastId,
        description: `Worker ${workerId} removed successfully.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete worker';
      toast.error('Deletion Error', {
        id: toastId,
        description: msg,
      });
      return false;
    }
  },

  createVendorAction: async (vendorData) => {
    const toastId = toast.loading('Enrolling merchant partner...');
    try {
      const newVendor = await api.createVendor(vendorData);
      set((state) => ({
        vendors: [newVendor, ...state.vendors],
      }));
      toast.success('Merchant Enrolled', {
        id: toastId,
        description: `${newVendor.vendor_name} enrolled with ${newVendor.coupon_templates?.length || 0} reward templates.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to enroll merchant';
      toast.error('Enrollment Error', {
        id: toastId,
        description: msg,
      });
      return false;
    }
  },
}));
