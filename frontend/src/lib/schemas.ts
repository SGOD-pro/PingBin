import { z } from 'zod';

export const WorkerFormSchema = z.object({
  fullname: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name must be less than 60 characters')
    .trim(),
  phone: z
    .string()
    .trim()
    .refine((val) => {
      const clean = val.replace(/[\s-]/g, '');
      return /^\+?[1-9]\d{9,14}$/.test(clean);
    }, 'Phone number must be a valid format with country code (e.g. +919876543210)'),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  photo_url: z.string().url('Invalid photo URL').optional(),
});

export type WorkerFormData = z.infer<typeof WorkerFormSchema>;

export const VendorFormSchema = z.object({
  vendor_name: z
    .string()
    .min(2, 'Merchant name must be at least 2 characters')
    .max(80, 'Merchant name must be less than 80 characters')
    .trim(),
  category: z.string().min(1, 'Category is required'),
  city: z.string().default('Bhubaneswar'),
  area: z.string().min(2, 'Area / Sector is required'),
  offer_type: z.enum(['flat_off', 'percent_off', 'min_spend_gift']),
  offer_value: z.string().min(1, 'Offer value is required'),
  min_spend: z.number().nonnegative().optional(),
  description: z.string().min(5, 'Offer description must be at least 5 characters'),
  validation_text: z.string().default('Valid once per citizen per verified report.'),
});

export type VendorFormData = z.infer<typeof VendorFormSchema>;

export const WarehouseFormSchema = z.object({
  name: z
    .string()
    .min(3, 'Facility name must be at least 3 characters')
    .max(80, 'Facility name must be less than 80 characters')
    .trim(),
  category: z.enum(['plastic', 'metal', 'paper_cardboard', 'organic', 'hazardous_medical', 'mixed']),
  rate_per_kg: z.number().positive('Buying rate must be greater than ₹0/kg'),
  capacity_kg: z.number().positive('Capacity must be greater than 0 kg'),
  address: z.string().min(3, 'Address or location area is required').trim(),
  latitude: z.number().min(-90).max(90).default(20.3533),
  longitude: z.number().min(-180).max(180).default(85.8197),
});

export type WarehouseFormData = z.infer<typeof WarehouseFormSchema>;
