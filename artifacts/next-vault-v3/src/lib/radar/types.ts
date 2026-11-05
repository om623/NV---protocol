export type RadarRegion =
  | 'North America' | 'South America' | 'Europe' | 'Asia'
  | 'Africa' | 'Oceania' | 'Middle East';

export type RadarSector =
  | 'Artificial intelligence' | 'Technology' | 'Semiconductors' | 'Energy' | 'Oil and gas'
  | 'Mining' | 'Agribusiness' | 'Automotive' | 'Aerospace' | 'Defense'
  | 'Health' | 'Biotechnology' | 'Pharmaceuticals' | 'Construction' | 'Infrastructure'
  | 'Telecommunications' | 'Financial services' | 'Insurance' | 'Real estate' | 'Logistics'
  | 'Commerce and consumer' | 'Food and beverage' | 'Tourism' | 'Water and sanitation'
  | 'Renewable energy' | 'Heavy industry' | 'Education' | 'Transportation'
  | 'Business services' | 'Other';

export type RadarDataStatus = 'available' | 'not_disclosed' | 'outdated' | 'updating';

export interface RadarSource {
  name: string;
  url: string;
  kind: 'official' | 'exchange' | 'public';
  reliability: 'high' | 'medium';
  publishedAt?: string;
  updatedAt: string;
}

export interface RadarCompany {
  id: string;
  name: string;
  ticker?: string;
  country: string;
  city: string;
  region: RadarRegion;
  latitude: number;
  longitude: number;
  founded?: number;
  sector: RadarSector;
  description: string;
  listed: boolean;
  international: boolean;
  marketCapUsd?: number;
  employees?: number;
  dataStatus: RadarDataStatus;
  source: RadarSource;
}
