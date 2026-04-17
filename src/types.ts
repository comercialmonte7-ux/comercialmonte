export interface Worker {
  id: string;
  uid?: string;
  email?: string;
  name: string;
  role: 'owner' | 'supervisor' | 'crew_lead' | 'worker';
}

export interface HarvestRecord {
  id: string;
  date: string;
  extractedVolume: number; // m3
  stackedVolume: number;   // m3
  reportedBy: string;      // worker id
  notes?: string;
}

export type SupplyCategory = 
  | 'fuel_vehicle'      // Combustible Vehículos
  | 'fuel_chainsaw'     // Combustible Motosierras
  | 'oil_motor'         // Aceite Motor
  | 'oil_premix'        // Aceite Mezcla
  | 'oil_chain'         // Aceite Cadena
  | 'other';            // Otros

export interface SupplyRecord {
  id: string;
  date: string;
  category: SupplyCategory;
  quantity: number; // in Liters mostly
  unit: string;     // 'L', 'Unit', etc.
  description: string; // e.g., "Camión Volvo", "Motosierra Stihl MS 361"
  reportedBy: string; // worker id
}

export interface Machine {
  id: string;
  name: string;
  type: 'truck' | 'chainsaw' | 'tractor' | 'other';
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  hoursWorked: number;
}

export interface MaintenanceRecord {
  id: string;
  machineId: string;
  date: string;
  description: string;
  performedBy: string;
  cost?: number;
}

export interface StockLevel {
  category: SupplyCategory;
  current: number;
  minAlert: number;
  unit: string;
}
