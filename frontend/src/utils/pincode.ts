export interface PincodeInfo {
  pincode: string;
  area: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export const PINCODE_DATABASE: Record<string, PincodeInfo> = {
  // Bhubaneswar (Odisha)
  '751024': {
    pincode: '751024',
    area: 'Patia / KIIT / Infocity',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.3533,
    lng: 85.8197,
  },
  '751001': {
    pincode: '751001',
    area: 'Master Canteen / Railway Station',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.2646,
    lng: 85.8394,
  },
  '751003': {
    pincode: '751003',
    area: 'Kharavela Nagar / Unit 3',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.2740,
    lng: 85.8450,
  },
  '751007': {
    pincode: '751007',
    area: 'Nayapalli / IRC Village',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.3005,
    lng: 85.8160,
  },
  '751010': {
    pincode: '751010',
    area: 'Saheed Nagar',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.2910,
    lng: 85.8500,
  },
  '751012': {
    pincode: '751012',
    area: 'Rasulgarh / Cuttack Road',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.3000,
    lng: 85.8650,
  },
  '751013': {
    pincode: '751013',
    area: 'Chandrasekharpur / Damana',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.3250,
    lng: 85.8150,
  },
  '751030': {
    pincode: '751030',
    area: 'Khandagiri / ITER / Jagamara',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.2550,
    lng: 85.7850,
  },
  '751019': {
    pincode: '751019',
    area: 'Bhubaneswar Airport / Old Town',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.2444,
    lng: 85.8178,
  },
  '751006': {
    pincode: '751006',
    area: 'Samantarapur / Lingaraj Temple',
    city: 'Bhubaneswar',
    state: 'Odisha',
    lat: 20.2350,
    lng: 85.8320,
  },
  // Cuttack (Twin City)
  '753001': {
    pincode: '753001',
    area: 'Badambadi / College Square',
    city: 'Cuttack',
    state: 'Odisha',
    lat: 20.4625,
    lng: 85.8830,
  },
  // Bengaluru
  '560001': {
    pincode: '560001',
    area: 'MG Road / Central',
    city: 'Bengaluru',
    state: 'Karnataka',
    lat: 12.9716,
    lng: 77.5946,
  },
  '560034': {
    pincode: '560034',
    area: 'Koramangala',
    city: 'Bengaluru',
    state: 'Karnataka',
    lat: 12.9352,
    lng: 77.6245,
  },
  '560066': {
    pincode: '560066',
    area: 'Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    lat: 12.9698,
    lng: 77.7499,
  },
  // Delhi
  '110001': {
    pincode: '110001',
    area: 'Connaught Place',
    city: 'New Delhi',
    state: 'Delhi',
    lat: 28.6315,
    lng: 77.2167,
  },
  // Mumbai
  '400001': {
    pincode: '400001',
    area: 'Fort / South Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    lat: 18.9322,
    lng: 72.8347,
  },
};

export const QUICK_AREAS = [
  { pincode: '751024', label: '📍 Bhubaneswar — Patia / KIIT / Infocity (751024)' },
  { pincode: '751001', label: '📍 Bhubaneswar — Master Canteen / Stn (751001)' },
  { pincode: '751010', label: '📍 Bhubaneswar — Saheed Nagar (751010)' },
  { pincode: '751013', label: '📍 Bhubaneswar — CS Pur / Damana (751013)' },
  { pincode: '751030', label: '📍 Bhubaneswar — Khandagiri / ITER (751030)' },
  { pincode: '751003', label: '📍 Bhubaneswar — Kharavela Nagar / Unit 3 (751003)' },
  { pincode: '751012', label: '📍 Bhubaneswar — Rasulgarh (751012)' },
  { pincode: '560001', label: '📍 Bengaluru — Central / MG Road (560001)' },
  { pincode: '110001', label: '📍 New Delhi — Connaught Place (110001)' },
  { pincode: '400001', label: '📍 Mumbai — Fort (400001)' },
];

export function lookupPincode(code: string): PincodeInfo | null {
  const clean = code.replace(/\D/g, '').slice(0, 6);
  if (PINCODE_DATABASE[clean]) {
    return PINCODE_DATABASE[clean];
  }
  return null;
}
