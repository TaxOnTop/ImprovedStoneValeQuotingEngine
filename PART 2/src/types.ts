export interface CalculatedRates {
  sidingWash: number;
  roofWash: number;
  drivewayWash: number;
  patioWash: number;
  windowDetail: number;
  gutterClean: number;
  gutterWash: number;
  gutterBrightening: number;
  
  exteriorRefresh: number;
  fullHomeDetail: number;
  pricingReviewRequired?: boolean;
  estateCarePlans: {
    essential: number;
    premium: number;
    signature: number;
  };
  homeCategory: string;
}

export interface Lead {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  sqftHome: number;
  stories: number;
  roofFootprintSqft: number;
  drivewaySqft: number;
  windowSections: number;
  exteriorMaterial: string;
  packageSelected: string;
  selectedServices?: any;
  itemizedBill?: any;
  status: 'quoted' | 'booked_walkthrough' | 'booked_job' | 'follow_up_needed' | 'not_interested';
  bookingType?: 'job' | 'walkthrough';
  bookingDateTime?: string;
  notes?: string;
  adminNotes?: string;
  source: 'qr_code' | 'manual_entry';
  calculations: CalculatedRates;
  confidenceExplanation?: string;
  createdAt: string;
  updatedAt: string;
}
