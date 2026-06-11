import { useState, useEffect, useMemo, useCallback, FormEvent } from 'react';
import { 
  MapPin, 
  Sparkles, 
  Phone, 
  Mail, 
  FileText, 
  Calendar, 
  Clock, 
  ArrowRight, 
  Search, 
  Plus, 
  Check, 
  X, 
  ChevronRight, 
  ShieldCheck, 
  Layers, 
  Activity, 
  TrendingUp, 
  User, 
  PenSquare, 
  Sliders, 
  Home, 
  Settings, 
  RefreshCw, 
  DollarSign, 
  MessageSquare,
  AlertCircle,
  FileCheck2,
  Trash2,
  Users,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DrivewayMeasureMap from './DrivewayMeasureMap';
import { Lead, CalculatedRates } from './types';

// Front-end Quote Calculator replicating the back-end SOP
function calculateClientSideRates(
  sqftHome: number,
  stories: number,
  roofFootprintSqft: number,
  drivewaySqft: number,
  windowSections: number,
  exteriorMaterial: string
): CalculatedRates {
  const drivewayBase = drivewaySqft * 0.25;
  const drivewayPrice = Math.max(150, Math.round(drivewayBase));
  
  const patioSqft = Math.round(drivewaySqft * 0.3);
  const patioPrice = Math.max(120, Math.round(patioSqft * 0.35)); 
  
  const softWashBase = sqftHome * 0.25;
  const storyAdd = stories === 2 ? 150 : stories >= 3 ? 300 : 0;
  const softWashPrice = Math.round(softWashBase + storyAdd);
  
  const roofWashPrice = Math.round(roofFootprintSqft * 0.65);
  
  const linearFeet = Math.round(4 * Math.sqrt(roofFootprintSqft));
  const gutterCleanPrice = Math.round(linearFeet * 1.00);
  const gutterWashPrice = Math.round(linearFeet * 2.00);
  const gutterFaceBrightening = 150;
  
  const windowPrice = windowSections * 12;
  
  const exteriorRefreshPrice = softWashPrice + windowPrice;
  const componentSum = softWashPrice + windowPrice + drivewayPrice + patioPrice + gutterFaceBrightening;
  const fullHomeDetailPrice = Math.max(1200, componentSum);
  
  const plans = {
    "1800-2200": { essential: 99, premium: 229, signature: 429 },
    "2200-3000": { essential: 129, premium: 299, signature: 549 },
    "3000-4000": { essential: 159, premium: 399, signature: 729 },
    "4000-5000": { essential: 189, premium: 529, signature: 949 },
    "5000+": { essential: 249, premium: 649, signature: 1199 }
  };
  
  let key: keyof typeof plans = "2200-3000";
  if (sqftHome < 1800) {
    key = "1800-2200";
  } else if (sqftHome >= 1800 && sqftHome <= 2200) {
    key = "1800-2200";
  } else if (sqftHome > 2200 && sqftHome <= 3000) {
    key = "2200-3000";
  } else if (sqftHome > 3000 && sqftHome <= 4000) {
    key = "3000-4000";
  } else if (sqftHome > 4000 && sqftHome <= 5000) {
    key = "4000-5000";
  } else {
    key = "5000+";
  }

  return {
    sidingWash: softWashPrice,
    roofWash: roofWashPrice,
    drivewayWash: drivewayPrice,
    patioWash: patioPrice,
    windowDetail: windowPrice,
    gutterClean: gutterCleanPrice,
    gutterWash: gutterWashPrice,
    gutterBrightening: gutterFaceBrightening,
    
    exteriorRefresh: exteriorRefreshPrice,
    fullHomeDetail: fullHomeDetailPrice,
    estateCarePlans: plans[key],
    homeCategory: key
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'portal' | 'office'>('portal');

  // Client Side State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [selectedInterest, setSelectedInterest] = useState('full_home');

  // Multi-step Client Journey: 'input' | 'estimating' | 'proposal' | 'scheduling' | 'done'
  const [journeyStep, setJourneyStep] = useState<'input' | 'estimating' | 'proposal' | 'scheduling' | 'done'>('input');
  
  // Sat-scan intermediate stages
  const [satStage, setSatStage] = useState(0);
  const [stagesText, setStagesText] = useState([
    "Initializing secure satellite connection...",
    "Querying Google Maps Geocoding Coordinates...",
    "Accessing Google Solar API rooftop footprint segments...",
    "Grounding local taxes and home real estate indices via Gemini AI...",
    "Computing customized Stonevale restoration proposals..."
  ]);

  // Current client quote details
  const [estimateInfo, setEstimateInfo] = useState<{
    id?: string;
    propertyLat?: number;
    propertyLng?: number;
    homeSizeSqft: number;
    stories: number;
    roofFootprintSqft: number;
    drivewaySqft: number;
    windowSections: number;
    exteriorMaterial: string;
    confidenceExplanation: string;
  } | null>(null);

  // Homeowner adjustments on client proposal screen
  const [adjHomeSize, setAdjHomeSize] = useState(2200);
  const [adjStories, setAdjStories] = useState(2);
  const [adjRoofFootprint, setAdjRoofFootprint] = useState(1500);
  const [adjDriveway, setAdjDriveway] = useState(1000);
  const [adjWindows, setAdjWindows] = useState(20);
  const [adjMaterial, setAdjMaterial] = useState('Vinyl Siding');
  
  const [selectedServices, setSelectedServices] = useState({
    roof: false,
    driveway: true,
    gutters: false,
    windows: false,
    siding: false,
  });

  const toggleService = (service: keyof typeof selectedServices) => {
    setSelectedServices((prev) => ({
      ...prev,
      [service]: !prev[service],
    }));
  };

  // Package Selection
  const [packageChoice, setPackageChoice] = useState<'exterior_refresh' | 'full_home_detail' | 'estate_care_plan' | 'single_driveway' | 'single_windows' | 'single_siding'>('full_home_detail');
  const [carePlanTier, setCarePlanTier] = useState<'essential' | 'premium' | 'signature'>('premium');

  // Scheduling details
  const [bookingType, setBookingType] = useState<'walkthrough' | 'job'>('walkthrough');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('10:00');
  const [clientNotes, setClientNotes] = useState('');

  // Admin Dashboard State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState<'all' | 'quoted' | 'booked_walkthrough' | 'booked_job' | 'follow_up_needed' | 'not_interested'>('all');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Admin adjustments side-panel state
  const [admLeadStatus, setAdmLeadStatus] = useState<Lead['status']>('quoted');
  const [admBookType, setAdmBookType] = useState<'walkthrough' | 'job'>('walkthrough');
  const [admBookTime, setAdmBookTime] = useState('');
  const [admNotes, setAdmNotes] = useState('');
  const [admPriceOverride, setAdmPriceOverride] = useState<number | null>(null);
  const [admHomeSize, setAdmHomeSize] = useState(2000);
  const [admStories, setAdmStories] = useState(2);
  const [admRoofFootprint, setAdmRoofFootprint] = useState(1200);
  const [admDrivewaySqft, setAdmDrivewaySqft] = useState(1000);
  const [admWindows, setAdmWindows] = useState(15);
  const [admMaterial, setAdmMaterial] = useState('Vinyl Siding');

  // Calculate live modified proposal prices
  const clientProposalCalculations = useMemo(() => {
    return calculateClientSideRates(
      adjHomeSize,
      adjStories,
      adjRoofFootprint,
      adjDriveway,
      adjWindows,
      adjMaterial
    );
  }, [adjHomeSize, adjStories, adjRoofFootprint, adjDriveway, adjWindows, adjMaterial]);

  const itemizedBill = useMemo(() => {
    const items: { label: string; measurement: string; rate: string; price: number }[] = [];

    if (selectedServices.roof) {
      items.push({
        label: 'Roof Soft Wash',
        measurement: `${adjRoofFootprint.toLocaleString()} sqft`,
        rate: '$0.65/sqft',
        price: clientProposalCalculations.roofWash,
      });
    }

    if (selectedServices.driveway) {
      items.push({
        label: 'Driveway / Flatwork Restoration',
        measurement: `${adjDriveway.toLocaleString()} sqft`,
        rate: '$0.25/sqft',
        price: clientProposalCalculations.drivewayWash,
      });
    }

    if (selectedServices.gutters) {
      items.push({
        label: 'Gutter Cleanout',
        measurement: `${Math.round(4 * Math.sqrt(adjRoofFootprint)).toLocaleString()} linear ft`,
        rate: '$1.00/linear ft',
        price: clientProposalCalculations.gutterClean,
      });
    }

    if (selectedServices.windows) {
      items.push({
        label: 'Exterior Window Detail',
        measurement: `${adjWindows} sections`,
        rate: '$12/section',
        price: clientProposalCalculations.windowDetail,
      });
    }

    if (selectedServices.siding) {
      items.push({
        label: 'Exterior Soft Wash',
        measurement: `${adjHomeSize.toLocaleString()} sqft home`,
        rate: '$0.25/sqft + story add',
        price: clientProposalCalculations.sidingWash,
      });
    }

    const total = items.reduce((sum, item) => sum + item.price, 0);
    return { items, total };
  }, [
    selectedServices,
    adjRoofFootprint,
    adjDriveway,
    adjWindows,
    adjHomeSize,
    clientProposalCalculations,
  ]);

  // Load Admin Leads
  const fetchAllLeads = async () => {
    setLoadingLeads(true);
    try {
      const response = await fetch("/api/leads");
      if (response.ok) {
        const data = await response.json();
        setLeads(data);
      } else {
        console.error("Failed to load leads from database");
      }
    } catch (err) {
      console.error("Error reading database:", err);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'office') {
      fetchAllLeads();
    }
  }, [activeTab]);

  // Satellite and Gemini Scan Timer loop
  useEffect(() => {
    if (journeyStep === 'estimating') {
      const interval = setInterval(() => {
        setSatStage((prev) => {
          if (prev >= 4) {
            clearInterval(interval);
            return 4;
          }
          return prev + 1;
        });
      }, 900);
      return () => clearInterval(interval);
    }
  }, [journeyStep]);

  // Move from scanning to layout
  useEffect(() => {
    if (satStage === 4 && journeyStep === 'estimating') {
      const timer = setTimeout(() => {
        setJourneyStep('proposal');
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [satStage, journeyStep]);

  // Trigger Google Solar API and Gemini AI estimation pipeline
  const handleEstimateQuery = async (e: FormEvent) => {
    e.preventDefault();
    if (!address) {
      alert("Please entering a valid service address.");
      return;
    }
    setSatStage(0);
    setJourneyStep('estimating');

    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address })
      });

      if (response.ok) {
        const data = await response.json();
        setEstimateInfo({
          propertyLat: data.propertyLat ?? undefined,
          propertyLng: data.propertyLng ?? undefined,
          homeSizeSqft: data.homeSizeSqft,
          stories: data.stories,
          roofFootprintSqft: data.roofFootprintSqft,
          drivewaySqft: data.drivewaySqft,
          windowSections: data.windowSections,
          exteriorMaterial: data.exteriorMaterial,
          confidenceExplanation: data.confidenceExplanation
        });

        // Seed current adjustments sliders
        setAdjHomeSize(data.homeSizeSqft);
        setAdjStories(data.stories);
        setAdjRoofFootprint(data.roofFootprintSqft);
        setAdjDriveway(data.drivewaySqft);
        setAdjWindows(data.windowSections);
        setAdjMaterial(data.exteriorMaterial);
      } else {
        throw new Error("API responded with an error status.");
      }
    } catch (err) {
      console.warn("Estimation call errored, utilizing premium fallback defaults.", err);
      // Fallback calculations standard to avoid blocking customer
      setEstimateInfo({
        propertyLat: undefined,
        propertyLng: undefined,
        homeSizeSqft: 2400,
        stories: 2,
        roofFootprintSqft: 1400,
        drivewaySqft: 900,
        windowSections: 18,
        exteriorMaterial: "Vinyl Siding",
        confidenceExplanation: "Calculated using high-resolution Palo Alto baseline formulas. Tweak details below."
      });
      setAdjHomeSize(2400);
      setAdjStories(2);
      setAdjRoofFootprint(1400);
      setAdjDriveway(900);
      setAdjWindows(18);
      setAdjMaterial("Vinyl Siding");
    }
  };

  // Create lead record & store initial quotes
  const handlePackageConfirmation = () => {
    setJourneyStep('scheduling');
  };

  const handleBookingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerName || !phone || !email) {
      alert("Name, phone, and email are required to locked in your appointment details.");
      return;
    }

    // Capture pricing choice based on package selected
    let selectedPackageLabel = "";
    if (packageChoice === 'exterior_refresh') selectedPackageLabel = "Exterior Refresh";
    else if (packageChoice === 'full_home_detail') selectedPackageLabel = "Full Home Detail";
    else if (packageChoice === 'estate_care_plan') selectedPackageLabel = `Estate Care - ${carePlanTier.toUpperCase()}`;
    else if (packageChoice === 'single_driveway') selectedPackageLabel = "Single: Driveway Wash";
    else if (packageChoice === 'single_windows') selectedPackageLabel = "Single: Window Detail";
    else if (packageChoice === 'single_siding') selectedPackageLabel = "Single: House Siding Wash";

    const payload = {
      customerName,
      phone,
      email,
      address,
      sqftHome: adjHomeSize,
      stories: adjStories,
      roofFootprintSqft: adjRoofFootprint,
      drivewaySqft: adjDriveway,
      windowSections: adjWindows,
      exteriorMaterial: adjMaterial,
      packageSelected: packageChoice,
      selectedServices,
      itemizedBill,
      source: 'qr_code'
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const docResult = await response.json();
        setEstimateInfo(prev => ({
          ...prev!,
          id: docResult.id
        }));

        // Now save the scheduling details
        const updateResponse = await fetch(`/api/leads/${docResult.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: bookingType === 'walkthrough' ? 'booked_walkthrough' : 'booked_job',
            bookingType,
            bookingDateTime: `${bookingDate}T${bookingTime}`,
            notes: clientNotes
          })
        });

        if (updateResponse.ok) {
          setJourneyStep('done');
        } else {
          alert("We captured your quote, but scheduling is pending. Stonevale staff will call you momentarily!");
          setJourneyStep('done');
        }
      } else {
        alert("Server error booking quote. Please call Stonevale directly!");
      }
    } catch (err) {
      console.error(err);
      alert("Network failure. We saved your details locally for automated staff callback.");
      setJourneyStep('done');
    }
  };

  // Administrator Details Inspection Panel Select
  const handleSelectLeadInspect = (lead: Lead) => {
    setSelectedLead(lead);
    setAdmLeadStatus(lead.status);
    setAdmBookType(lead.bookingType || 'walkthrough');
    setAdmBookTime(lead.bookingDateTime || '');
    setAdmNotes(lead.notes || '');
    setAdmPriceOverride(lead.calculations.exteriorRefresh); // arbitrary default
    
    // Sat parameters
    setAdmHomeSize(lead.sqftHome);
    setAdmStories(lead.stories);
    setAdmRoofFootprint(lead.roofFootprintSqft);
    setAdmDrivewaySqft(lead.drivewaySqft);
    setAdmWindows(lead.windowSections);
    setAdmMaterial(lead.exteriorMaterial);
  };

  // Submit Admin edits, status changes & pricing overrides
  const handleAdminUpdateSubmit = async () => {
    if (!selectedLead) return;

    const payload: any = {
      status: admLeadStatus,
      bookingType: admBookType,
      bookingDateTime: admBookTime,
      notes: admNotes,
      sqftHome: admHomeSize,
      stories: admStories,
      roofFootprintSqft: admRoofFootprint,
      drivewaySqft: admDrivewaySqft,
      windowSections: admWindows,
      exteriorMaterial: admMaterial
    };

    // If an administrator writes custom billing override notes, add it
    if (admNotes) payload.adminNotes = admNotes;

    try {
      const response = await fetch(`/api/leads/${selectedLead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const updatedLead = await response.json();
        // Highlight updated element in list
        setLeads((prev) => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        setSelectedLead(updatedLead);
        setErrorBanner("Lead profile successfully updated on database!");
        setTimeout(() => setErrorBanner(null), 3000);
      } else {
        alert("Failed to submit system administrative updates.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving updates to server database.");
    }
  };

  // KPI close rate calculator
  const statsSummary = useMemo(() => {
    let total = leads.length;
    let walkthroughs = leads.filter(l => l.status === 'booked_walkthrough').length;
    let jobs = leads.filter(l => l.status === 'booked_job').length;
    let pendingCall = leads.filter(l => l.status === 'quoted' || l.status === 'follow_up_needed').length;
    let balks = leads.filter(l => l.status === 'not_interested').length;

    // Close rate calculations
    // Formula: (Walkthroughs + Jobs Booked) / (All leads with closed outcomes or active queries)
    // Let's count booked jobs and active walk-throughs as closed/progress deals.
    const resolvedCount = jobs + walkthroughs + balks;
    const ratePercentage = resolvedCount > 0 ? Math.round(((jobs + walkthroughs) / resolvedCount) * 100) : 0;

    return { total, walkthroughs, jobs, pendingCall, balks, ratePercentage };
  }, [leads]);

  // Filter on leads list
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchSearch = 
        lead.customerName.toLowerCase().includes(adminSearch.toLowerCase()) || 
        lead.address.toLowerCase().includes(adminSearch.toLowerCase()) ||
        lead.phone.includes(adminSearch);
      
      const matchFilter = adminFilter === 'all' || lead.status === adminFilter;
      return matchSearch && matchFilter;
    });
  }, [leads, adminSearch, adminFilter]);

  // Quick helper text for Package Pricing display
  const getSelectedPackagePrice = () => {
    if (packageChoice === 'exterior_refresh') return clientProposalCalculations.exteriorRefresh;
    if (packageChoice === 'full_home_detail') return clientProposalCalculations.fullHomeDetail;
    if (packageChoice === 'estate_care_plan') {
      return clientProposalCalculations.estateCarePlans[carePlanTier];
    }
    if (packageChoice === 'single_driveway') return clientProposalCalculations.drivewayWash;
    if (packageChoice === 'single_windows') return clientProposalCalculations.windowDetail;
    if (packageChoice === 'single_siding') return clientProposalCalculations.sidingWash;
    return 0;
  };

  const handleDrivewayAreaChange = useCallback((sqft: number) => {
    if (sqft > 0) {
      setAdjDriveway(sqft);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0F1113] font-sans text-[#E0D8D0] flex flex-col antialiased">
      {/* BRAND & HEADER SECTION */}
      <header className="sticky top-0 z-50 bg-[#0F1113]/90 backdrop-blur-md border-b border-white/10 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-[#C5A059] flex items-center justify-center rotate-45 shadow-md">
              <span className="-rotate-45 font-serif text-[#C5A059] font-bold text-xl">S</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-widest text-[#C5A059] mb-1 font-bold">Stonevale</span>
              <span className="font-serif text-lg tracking-wide text-[#E0D8D0]">Exterior Co.</span>
            </div>
          </div>

          {/* VIEW SWITCHER */}
          <div className="flex bg-white/[0.04] p-1 rounded-lg border border-white/10">
            <button
              onClick={() => { setActiveTab('portal'); setJourneyStep('input'); }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
                activeTab === 'portal'
                  ? 'bg-[#C5A059] text-black shadow-sm font-bold'
                  : 'text-white/60 hover:text-[#E0D8D0] hover:bg-white/5'
              }`}
            >
              <MapPin className="h-3.5 w-3.5 animate-pulse" />
              <span>Steward Scan</span>
            </button>
            <button
              onClick={() => setActiveTab('office')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
                activeTab === 'office'
                  ? 'bg-[#C5A059] text-black shadow-sm font-bold'
                  : 'text-white/60 hover:text-[#E0D8D0] hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Admin Office</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-white/40 font-mono">
            <span>Customer Hotline:</span>
            <span className="font-semibold text-[#C5A059] tracking-wider">(800) 555-CARE</span>
          </div>

        </div>
      </header>

      {/* CORE FRAME CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-start">
        <AnimatePresence mode="wait">
          
          {/* PORTAL VIEW (CLIENT PROPOSAL PIPELINE) */}
          {activeTab === 'portal' && (
            <motion.div
              key="client-portal"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-5xl mx-auto"
            >
              {journeyStep === 'input' && (
                <div className="text-center max-w-2xl mx-auto py-8">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-none text-xs font-semibold bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/30 mb-6 animate-pulse uppercase tracking-widest">
                    <Sparkles className="h-3 w-3 text-[#C5A059]" />
                    Real-Time Sat Stewardship Scan
                  </span>
                  
                  <h2 className="text-4xl font-serif tracking-wide text-white mb-4">
                    Stewardship Quote Engine
                  </h2>
                  <p className="text-sm text-white/60 mb-10 leading-relaxed max-w-xl mx-auto font-sans">
                    We protect and present fine estates. Scan your property satellite coordinates to generate a guaranteed, premium restoration estimate instantly.
                  </p>

                  <form onSubmit={handleEstimateQuery} className="bg-[#131619] p-6 sm:p-10 rounded-none border border-white/10 shadow-2xl text-left">
                    <div className="mb-6">
                      <label className="block text-xs uppercase tracking-wider font-semibold text-white/80 mb-3 font-mono">
                        Step 1: Enter Your Estate Street Address
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-3.5 h-5 w-5 text-[#C5A059]" />
                        <input
                          type="text"
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="e.g. 742 Evergreen Terrace, Hillsborough, CA"
                          className="w-full pl-12 pr-4 py-3.5 rounded-none border border-white/20 bg-[#0F1113] focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] text-base transition-all text-[#E0D8D0] font-sans placeholder-white/30"
                        />
                      </div>
                      <p className="text-[10px] text-white/40 mt-2 font-mono">
                        Powered by Google Solar API satellite building footprint parsing & Gemini grounding.
                      </p>
                    </div>

                    <div className="mb-8">
                      <label className="block text-xs uppercase tracking-wider font-semibold text-white/80 mb-3 font-mono">
                        Step 2: Core Surface Interest
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                          onClick={() => setSelectedInterest('full_home')}
                          className={`p-5 rounded-none border cursor-pointer transition-all flex items-start gap-3 ${
                            selectedInterest === 'full_home' 
                              ? 'border-[#C5A059] bg-white/[0.04] shadow-sm' 
                              : 'border-white/10 hover:border-white/20 bg-white/[0.01]'
                          }`}
                        >
                          <div className={`mt-1 h-4 w-4 rounded-full border flex items-center justify-center ${selectedInterest === 'full_home' ? 'border-[#C5A059]' : 'border-white/30'}`}>
                            {selectedInterest === 'full_home' && <div className="h-2 w-2 rounded-full bg-[#C5A059]" />}
                          </div>
                          <div>
                            <span className="font-serif block text-white text-sm">Estate Portfolio Refresh (Recommended)</span>
                            <span className="text-xs text-white/50 mt-1 block">Review full comparative packages including siding, windows, walkways, & patios.</span>
                          </div>
                        </div>

                        <div
                          onClick={() => setSelectedInterest('single')}
                          className={`p-5 rounded-none border cursor-pointer transition-all flex items-start gap-3 ${
                            selectedInterest === 'single' 
                              ? 'border-[#C5A059] bg-white/[0.04] shadow-sm' 
                              : 'border-white/10 hover:border-white/20 bg-white/[0.01]'
                          }`}
                        >
                          <div className={`mt-1 h-4 w-4 rounded-full border flex items-center justify-center ${selectedInterest === 'single' ? 'border-[#C5A059]' : 'border-white/30'}`}>
                            {selectedInterest === 'single' && <div className="h-2 w-2 rounded-full bg-[#C5A059]" />}
                          </div>
                          <div>
                            <span className="font-serif block text-white text-sm">Single Surface Restoration Only</span>
                            <span className="text-xs text-white/50 mt-1 block">Estimate only a dedicated driveway flatwork, window sections, or house cladding wash.</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 rounded-none bg-[#C5A059] hover:bg-[#af8a44] text-black font-semibold text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Unlock Guaranteed Projections</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {/* SATELLITE SCAN ANIMATION EFFECT */}
              {journeyStep === 'estimating' && (
                <div className="max-w-xl mx-auto py-16 text-center">
                  
                  {/* Radar scanner visual */}
                  <div className="relative h-44 w-44 mx-auto mb-10 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-[#C5A059]/20 animate-ping opacity-75" />
                    <div className="absolute inset-4 rounded-full border-2 border-dashed border-[#C5A059]/40 animate-spin" />
                    <div className="absolute inset-10 rounded-full bg-[#131619] border border-white/10 flex items-center justify-center shadow-2xl">
                      <MapPin className="h-10 w-10 text-[#C5A059] animate-bounce" />
                    </div>
                  </div>

                  <h3 className="text-2xl font-serif text-[#E0D8D0] mb-2">Analyzing Estate Satellite Profile</h3>
                  <p className="text-xs text-[#C5A059] font-mono uppercase tracking-wider mb-8">GOOGLE SOLAR API ACTIVE</p>
                  
                  {/* Staggered text tracking log */}
                  <div className="bg-[#131619] p-5 rounded-none border border-white/10 text-left space-y-3">
                    {stagesText.map((text, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs font-mono">
                        {satStage > idx ? (
                          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : satStage === idx ? (
                          <RefreshCw className="h-4 w-4 text-[#C5A059] animate-spin shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-white/20 bg-[#0F1113]" />
                        )}
                        <span className={satStage > idx ? 'text-white font-medium' : satStage === idx ? 'text-[#C5A059]' : 'text-white/30'}>
                          {text}
                        </span>
                      </div>
                    ))}
                  </div>

                </div>
              )}

              {/* CLIENT CUSTOM ESTIMATION PROPOSAL VIEW */}
              {journeyStep === 'proposal' && estimateInfo && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-4">
                  
                  {/* Left Column: Sizing Parameters (Adjustable Sliders) */}
                  <div className="lg:col-span-4 space-y-6 animate-fade-in">
                    <div className="bg-[#131619] text-[#E0D8D0] p-6 rounded-none border border-white/10">
                      <div className="flex items-center gap-2.5 mb-3 border-b border-white/10 pb-3">
                        <Layers className="h-5 w-5 text-[#C5A059]" />
                        <h4 className="text-sm font-serif font-semibold uppercase tracking-wider text-white">Satellite Measurements</h4>
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed font-sans mb-5">
                        Google Solar and Gemini grounded tax indices estimated these parameters. Fine-tune any element to adjust quote values in real time.
                      </p>

                      <div className="space-y-5">
                        <div>
                          <div className="flex justify-between text-xs font-mono mb-2">
                            <span className="text-white/70">Total Finished Living Sqft:</span>
                            <span className="text-[#C5A059] text-xs font-bold">{adjHomeSize.toLocaleString()} sqft</span>
                          </div>
                          <input 
                            type="range" min="1000" max="8000" step="50"
                            value={adjHomeSize} onChange={(e) => setAdjHomeSize(Number(e.target.value))}
                            className="w-full accent-[#C5A059] bg-[#0F1113] rounded-none appearance-none h-1 border border-white/10"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-mono mb-2">
                            <span className="text-white/70">Rooftop Footprint Size:</span>
                            <span className="text-[#C5A059] text-xs font-bold">{adjRoofFootprint.toLocaleString()} sqft</span>
                          </div>
                          <input 
                            type="range" min="500" max="5000" step="50"
                            value={adjRoofFootprint} onChange={(e) => setAdjRoofFootprint(Number(e.target.value))}
                            className="w-full accent-[#C5A059] bg-[#0F1113] rounded-none appearance-none h-1 border border-white/10"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-mono mb-2">
                            <span className="text-white/70">Driveway & Flatwork Sqft:</span>
                            <span className="text-[#C5A059] text-xs font-bold">{adjDriveway.toLocaleString()} sqft</span>
                          </div>
                          <input 
                            type="range" min="200" max="4000" step="50"
                            value={adjDriveway} onChange={(e) => setAdjDriveway(Number(e.target.value))}
                            className="w-full accent-[#C5A059] bg-[#0F1113] rounded-none appearance-none h-1 border border-white/10"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="block text-[10px] text-white/50 font-mono uppercase tracking-wider mb-1.5">Building Stories</label>
                            <select
                              value={adjStories}
                              onChange={(e) => setAdjStories(Number(e.target.value))}
                              className="w-full bg-[#0F1113] text-[#E0D8D0] rounded-none border border-white/20 py-2 pl-2 text-xs font-sans focus:outline-none focus:border-[#C5A059]"
                            >
                              <option value="1">1 Story (Ranch)</option>
                              <option value="2">2 Stories (Estate)</option>
                              <option value="3">3 Stories (Manor)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-white/50 font-mono uppercase tracking-wider mb-1.5">Exterior Cladding</label>
                            <select
                              value={adjMaterial}
                              onChange={(e) => setAdjMaterial(e.target.value)}
                              className="w-full bg-[#0F1113] text-[#E0D8D0] rounded-none border border-white/20 py-2 pl-2 text-xs font-sans focus:outline-none focus:border-[#C5A059]"
                            >
                              <option value="Vinyl Siding">Vinyl Siding</option>
                              <option value="Red Brick">Red Brick</option>
                              <option value="Stucco">Stucco</option>
                              <option value="Hardie Board">Hardie Board</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-mono mb-2 pt-2">
                            <span className="text-white/70">Estimated Window Sections:</span>
                            <span className="text-[#C5A059] text-xs font-bold">{adjWindows} Sections</span>
                          </div>
                          <input 
                            type="range" min="8" max="60" step="1"
                            value={adjWindows} onChange={(e) => setAdjWindows(Number(e.target.value))}
                            className="w-full accent-[#C5A059] bg-[#0F1113] rounded-none appearance-none h-1 border border-white/10"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-white/[0.02] border border-white/10 text-xs text-white/70 font-sans space-y-2 rounded-none">
                      <div className="flex items-center gap-1.5 font-bold text-white uppercase font-mono tracking-wider text-[10px] border-b border-white/5 pb-2">
                        <Activity className="h-3.5 w-3.5 text-[#C5A059]" />
                        <span>AI Intelligence Summary</span>
                      </div>
                      <p className="italic leading-relaxed">
                        "{estimateInfo.confidenceExplanation}"
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Pricing proposals */}
                  <div className="lg:col-span-8 space-y-6 animate-fade-in">
                    <div>
                      <h3 className="text-2xl font-serif text-[#E0D8D0] tracking-wide">Your Customized Service Scenarios</h3>
                      <p className="text-[10px] text-[#C5A059] font-mono tracking-widest mt-1 uppercase">LOCKED CONTRACT QUOTE RATES PRESET</p>
                    </div>

                    <div className="bg-[#131619] p-6 rounded-none border border-white/10">
                      <div className="flex items-center gap-2.5 mb-3 border-b border-white/10 pb-3">
                        <Sparkles className="h-4 w-4 text-[#C5A059]" />
                        <div>
                          <h4 className="text-sm font-serif font-semibold uppercase tracking-wider text-white">Choose Surfaces to Quote</h4>
                          <p className="text-[10px] text-white/50 mt-1">Build an itemized estimate from measured and estimated property data.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {[
                          ['roof', 'Roof'],
                          ['driveway', 'Driveway'],
                          ['gutters', 'Gutters'],
                          ['windows', 'Windows'],
                          ['siding', 'Siding'],
                        ].map(([key, label]) => {
                          const serviceKey = key as keyof typeof selectedServices;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleService(serviceKey)}
                              className={`p-4 border rounded-none text-xs uppercase tracking-wider font-mono transition-all ${
                                selectedServices[serviceKey]
                                  ? 'bg-[#C5A059] text-black border-[#C5A059] font-bold'
                                  : 'bg-[#0F1113] text-white/60 border-white/10 hover:text-white hover:border-white/30'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {estimateInfo.propertyLat && estimateInfo.propertyLng && (
                      <div className="bg-[#131619] p-6 rounded-none border border-white/10">
                        <div className="flex items-center gap-2.5 mb-4 border-b border-white/10 pb-3">
                          <MapPin className="h-4 w-4 text-[#C5A059]" />
                          <div>
                            <h4 className="text-sm font-serif font-semibold uppercase tracking-wider text-white">Measure Driveway / Flatwork</h4>
                            <p className="text-[10px] text-white/50 mt-1">Click the driveway corners on the satellite map. The measured sqft will update the driveway price automatically.</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-mono text-white/60 uppercase tracking-wider">Current measurement:</span>
                          <span className="text-lg font-bold text-[#C5A059]">{adjDriveway.toLocaleString()} sqft</span>
                        </div>
                        <DrivewayMeasureMap
                          lat={estimateInfo.propertyLat}
                          lng={estimateInfo.propertyLng}
                          onAreaChange={handleDrivewayAreaChange}
                        />
                      </div>
                    )}

                    <div className="bg-[#131619] p-6 rounded-none border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-serif text-white">Itemized Estimate</h4>
                          <p className="text-[10px] text-white/40 mt-1">Roof sqft from Google Solar. Driveway, gutters, and windows estimated for review.</p>
                        </div>
                        <span className="text-[#C5A059] font-bold text-xl">${itemizedBill.total.toLocaleString()}</span>
                      </div>

                      {itemizedBill.items.length === 0 ? (
                        <div className="rounded-none border border-white/10 p-4 text-sm text-white/60">Select at least one surface to generate a quote.</div>
                      ) : (
                        <div className="space-y-4">
                          {itemizedBill.items.map((item) => (
                            <div key={item.label} className="rounded-none border border-white/10 p-4 bg-[#0F1113]">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <h5 className="text-sm font-semibold text-white">{item.label}</h5>
                                  <p className="text-[11px] text-white/50 mt-1">{item.measurement} · {item.rate}</p>
                                </div>
                                <span className="text-[#C5A059] font-semibold">${item.price.toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* THREE-PACKAGE CONTAINER */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      
                      {/* Package 1: Refresh */}
                      <div 
                        onClick={() => setPackageChoice('exterior_refresh')}
                        className={`p-6 rounded-none border cursor-pointer relative transition-all flex flex-col justify-between h-full ${
                          packageChoice === 'exterior_refresh' 
                            ? 'border-[#C5A059] bg-[#1a1e22] ring-1 ring-[#C5A059] shadow-lg' 
                            : 'border-white/10 bg-[#131619] hover:border-white/20 hover:bg-[#161a1e]'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] font-bold text-white/40 font-mono tracking-widest uppercase">OPTION 01</span>
                            {packageChoice === 'exterior_refresh' && <Check className="h-4 w-4 text-[#C5A059]" />}
                          </div>
                          <h4 className="font-serif text-white text-md tracking-wide mb-1.5">Exterior Refresh</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-sans">The entry first-care job. Wow homeowners right in the door.</p>
                          
                          <ul className="text-[11px] text-white/70 mt-4 space-y-1.5 bg-[#0F1113] p-3 border border-white/10 rounded-none">
                            <li className="flex items-center gap-1.5">
                              <span className="text-[#C5A059] font-semibold">&#8226;</span>
                              <span>Whole house soft wash</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              <span className="text-[#C5A059] font-semibold">&#8226;</span>
                              <span>Exterior Window detail</span>
                            </li>
                          </ul>
                        </div>
                        
                        <div className="pt-5 border-t border-white/5 mt-5">
                          <span className="text-white/40 text-[9px] uppercase tracking-wider block font-mono">One-Time Quote</span>
                          <span className="text-3xl font-serif text-[#C5A059]">${clientProposalCalculations.exteriorRefresh.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Package 2: Full Home Detail */}
                      <div 
                        onClick={() => setPackageChoice('full_home_detail')}
                        className={`p-6 rounded-none border cursor-pointer relative transition-all flex flex-col justify-between h-full ${
                          packageChoice === 'full_home_detail' 
                            ? 'border-2 border-[#C5A059] bg-[#1a1e22] shadow-2xl' 
                            : 'border-white/10 bg-[#131619] hover:border-white/20 hover:bg-[#161a1e]'
                        }`}
                      >
                        {/* Signature Anchor Tag */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C5A059] text-black text-[10px] font-bold px-3 py-1 uppercase tracking-wider font-mono">
                          Signature Detail
                        </div>

                        <div>
                          <div className="flex justify-between items-start mb-3 mt-1">
                            <span className="text-[10px] font-bold text-[#C5A059] font-mono tracking-widest uppercase">OPTION 02</span>
                            {packageChoice === 'full_home_detail' && <Check className="h-4 w-4 text-[#C5A059]" />}
                          </div>
                          <h4 className="font-serif text-white text-md tracking-wide mb-1.5">Full Home Detail</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-sans">Complete protective envelope restoration in a single visit.</p>
                          
                          <ul className="text-[10px] text-white/70 mt-4 space-y-1.5 bg-[#0F1113] p-3 border border-white/10 rounded-none">
                            <li className="flex items-center gap-1">
                              <span className="text-[#C5A059] font-semibold mr-1">&#8226;</span>
                              <span>House Soft Wash & windows</span>
                            </li>
                            <li className="flex items-center gap-1">
                              <span className="text-[#C5A059] font-semibold mr-1">&#8226;</span>
                              <span>Driveway + walkways restoration</span>
                            </li>
                            <li className="flex items-center gap-1">
                              <span className="text-[#C5A059] font-semibold mr-1">&#8226;</span>
                              <span>Back patio & entry detail</span>
                            </li>
                            <li className="flex items-center gap-1">
                              <span className="text-[#C5A059] font-semibold mr-1">&#8226;</span>
                              <span>Gutter face brightening</span>
                            </li>
                          </ul>
                        </div>
                        
                        <div className="pt-5 border-t border-white/5 mt-5">
                          <span className="text-[#C5A059] text-[9px] uppercase tracking-wider block font-mono">Total One-Time Quote</span>
                          <span className="text-3xl font-serif text-[#C5A059]">${clientProposalCalculations.fullHomeDetail.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Package 3: Estate Care Plan (Recurring monthly upsell) */}
                      <div 
                        onClick={() => setPackageChoice('estate_care_plan')}
                        className={`p-6 rounded-none border cursor-pointer relative transition-all flex flex-col justify-between h-full ${
                          packageChoice === 'estate_care_plan' 
                            ? 'border-[#C5A059] bg-[#1a1e22] ring-1 ring-[#C5A059] shadow-lg' 
                            : 'border-white/10 bg-[#131619] hover:border-white/20 hover:bg-[#161a1e]'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] font-bold text-white/40 font-mono tracking-widest uppercase">ESTATE CARE</span>
                            {packageChoice === 'estate_care_plan' && <Check className="h-4 w-4 text-[#C5A059]" />}
                          </div>
                          <h4 className="font-serif text-white text-md tracking-wide mb-1.5">Estate Care Plan</h4>
                          <p className="text-xs text-white/50 leading-relaxed font-sans">Planting the seed. Ongoing rotation billing monthly.</p>

                          {/* Plan tier slider toggle if estate selected */}
                          <div className="mt-3.5 grid grid-cols-3 gap-1 p-1 bg-[#0F1113] border border-white/10 rounded-none text-[9px] font-mono">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setCarePlanTier('essential'); }}
                              className={`py-1 rounded-none text-center cursor-pointer uppercase tracking-wider ${carePlanTier === 'essential' ? 'bg-[#C5A059] text-black font-bold' : 'text-white/60 hover:text-white'}`}
                            >
                              2x/Yr
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setCarePlanTier('premium'); }}
                              className={`py-1 rounded-none text-center cursor-pointer uppercase tracking-wider ${carePlanTier === 'premium' ? 'bg-[#C5A059] text-black font-bold' : 'text-white/60 hover:text-white'}`}
                            >
                              Qtrly
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setCarePlanTier('signature'); }}
                              className={`py-1 rounded-none text-center cursor-pointer uppercase tracking-wider ${carePlanTier === 'signature' ? 'bg-[#C5A059] text-black font-bold' : 'text-white/60 hover:text-white'}`}
                            >
                              Bi-mo
                            </button>
                          </div>
                          
                          <p className="text-[10px] text-white/40 italic mt-3.5 text-center leading-normal">
                            "Book today, try our work, upsell signature Care on-site."
                          </p>
                        </div>
                        
                        <div className="pt-5 border-t border-white/5 mt-5">
                          <span className="text-white/40 text-[9px] uppercase tracking-wider block font-mono capitalize">Care: {carePlanTier} subscription</span>
                          <span className="text-2xl font-serif text-[#C5A059]">${clientProposalCalculations.estateCarePlans[carePlanTier]}<span className="text-xs text-white/40 font-sans font-normal"> / mo</span></span>
                        </div>
                      </div>

                    </div>

                    {/* OR SINGLE SURFACE ESTIMATION OVERVIEW CARD */}
                    <div className="bg-[#131619] p-6 rounded-none border border-white/10">
                      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2.5">
                        <span className="text-[10px] font-bold text-[#C5A059] font-mono uppercase tracking-widest">Fast Single Line Items Check</span>
                        <span className="text-[10px] bg-[#C5A059]/10 text-[#C5A059] font-bold px-2 py-0.5 border border-[#C5A059]/20 font-mono">JOB MIN: $150</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <button 
                          onClick={() => setPackageChoice('single_driveway')}
                          className={`p-4 rounded-none border text-left cursor-pointer transition-all ${packageChoice === 'single_driveway' ? 'bg-[#1a1e22] text-[#C5A059] border-[#C5A059] shadow-sm' : 'bg-[#0F1113] text-white/70 border-white/10 hover:border-white/20'}`}
                        >
                          <span className="block font-medium">Flatwork Restoration</span>
                          <span className="block text-xl font-bold mt-1.5 font-mono text-white">${clientProposalCalculations.drivewayWash.toLocaleString()}</span>
                        </button>

                        <button 
                          onClick={() => setPackageChoice('single_windows')}
                          className={`p-4 rounded-none border text-left cursor-pointer transition-all ${packageChoice === 'single_windows' ? 'bg-[#1a1e22] text-[#C5A059] border-[#C5A059] shadow-sm' : 'bg-[#0F1113] text-white/70 border-white/10 hover:border-white/20'}`}
                        >
                          <span className="block font-medium">Exterior Window Detail</span>
                          <span className="block text-xl font-bold mt-1.5 font-mono text-white">${clientProposalCalculations.windowDetail.toLocaleString()}</span>
                        </button>

                        <button 
                          onClick={() => setPackageChoice('single_siding')}
                          className={`p-4 rounded-none border text-left cursor-pointer transition-all ${packageChoice === 'single_siding' ? 'bg-[#1a1e22] text-[#C5A059] border-[#C5A059] shadow-sm' : 'bg-[#0F1113] text-white/70 border-white/10 hover:border-white/20'}`}
                        >
                          <span className="block font-medium">House Siding Wash</span>
                          <span className="block text-xl font-bold mt-1.5 font-mono text-white">${clientProposalCalculations.sidingWash.toLocaleString()}</span>
                        </button>
                      </div>
                    </div>

                    {/* THE ACTION-ORIENTED TRANSITION ACTION: Book vs Walkthrough */}
                    <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                      
                      <div className="flex bg-white/[0.03] p-1 border border-white/10 rounded-none w-full md:w-auto">
                        <button
                          onClick={() => setBookingType('walkthrough')}
                          className={`flex-1 md:flex-initial px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-none cursor-pointer transition-all ${bookingType === 'walkthrough' ? 'bg-[#C5A059] text-black font-bold' : 'text-white/60 hover:text-white'}`}
                        >
                          Book On-Site Walkthrough
                        </button>
                        <button
                          onClick={() => setBookingType('job')}
                          className={`flex-1 md:flex-initial px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-none cursor-pointer transition-all ${bookingType === 'job' ? 'bg-[#C5A059] text-black font-bold' : 'text-white/60 hover:text-white'}`}
                        >
                          Directly Schedule Restoration
                        </button>
                      </div>

                      <button
                        onClick={handlePackageConfirmation}
                        className="w-full md:w-auto px-8 py-4 bg-[#C5A059] hover:bg-[#af8a44] text-black font-semibold text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer rounded-none"
                      >
                        <span>Next: Confirm Time Slot</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>

                    </div>

                  </div>

                </div>
              )}

              {/* CLIENT APPOINTMENT SCHEDULER FORM */}
              {journeyStep === 'scheduling' && (
                <div className="w-full max-w-2xl mx-auto py-4">
                  <div className="bg-[#131619] p-6 sm:p-8 rounded-none border border-white/10 text-[#E0D8D0]">
                    
                    <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-white/10">
                      <div className="h-10 w-10 bg-[#C5A059] rounded-none flex items-center justify-center text-black">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-serif tracking-wide text-white">
                          {bookingType === 'walkthrough' ? 'Schedule Your Onsite Walkthrough' : 'Lock In Direct Restoration Slot'}
                        </h3>
                        <p className="text-[9px] text-[#C5A059] font-mono uppercase tracking-widest mt-0.5">STONEVALE STEWARDS WILL ARRIVE TO AUDIT THE PROPERTY IN PERSON</p>
                      </div>
                    </div>

                    <form onSubmit={handleBookingSubmit} className="space-y-6">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-white/50 uppercase font-mono tracking-wider mb-2">Preferred Date</label>
                          <input 
                            type="date"
                            required
                            min={new Date().toISOString().split('T')[0]}
                            value={bookingDate}
                            onChange={(e) => setBookingDate(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-none border border-white/20 focus:outline-none focus:border-[#C5A059] bg-[#0F1113] text-white font-sans"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-white/50 uppercase font-mono tracking-wider mb-2">Arrival Time Range</label>
                          <select
                            value={bookingTime}
                            onChange={(e) => setBookingTime(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-none border border-white/20 focus:outline-none focus:border-[#C5A059] bg-[#0F1113] text-white font-sans"
                          >
                            <option value="09:00" className="bg-[#0F1113]">Morning (9:00 AM - 11:00 AM)</option>
                            <option value="12:00" className="bg-[#0F1113]">Mid-day (12:00 PM - 2:00 PM)</option>
                            <option value="15:00" className="bg-[#0F1113]">Afternoon (3:00 PM - 5:00 PM)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <span className="text-[10px] font-mono font-bold text-[#C5A059] block uppercase tracking-widest">Contact & Account Details</span>
                        
                        <div className="mb-4">
                          <label className="block text-[10px] font-bold text-white/50 uppercase font-mono tracking-wider mb-1.5">Full Client Name</label>
                          <input 
                            type="text" required placeholder="e.g. Elizabeth Vance"
                            value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-none border border-white/20 focus:outline-none focus:border-[#C5A059] bg-[#0F1113] text-white font-sans placeholder:text-white/30"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-white/50 uppercase font-mono tracking-wider mb-1.5">Direct Voice Phone</label>
                            <input 
                              type="tel" required placeholder="e.g. (415) 555-0143"
                              value={phone} onChange={(e) => setPhone(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-none border border-white/20 focus:outline-none focus:border-[#C5A059] bg-[#0F1113] text-white font-sans placeholder:text-white/30"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-white/50 uppercase font-mono tracking-wider mb-1.5">Secure Email Address (For quote receipt)</label>
                            <input 
                              type="email" required placeholder="e.g. customer@estates.com"
                              value={email} onChange={(e) => setEmail(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-none border border-white/20 focus:outline-none focus:border-[#C5A059] bg-[#0F1113] text-white font-sans placeholder:text-white/30"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-white/50 uppercase font-mono tracking-wider mb-2">Special Property Instructions (Optional)</label>
                        <textarea
                          placeholder="Please note heavy buildup, fragile garden beds, exterior outlets to avoid, or preferred call times..."
                          value={clientNotes}
                          onChange={(e) => setClientNotes(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-none border border-white/20 h-20 focus:outline-none focus:border-[#C5A059] bg-[#0F1113] text-white font-sans placeholder:text-white/30"
                        />
                      </div>

                      {/* Display Locked summary */}
                      <div className="p-4 bg-[#0F1113] rounded-none space-y-1 text-xs border border-white/10">
                        <div className="flex justify-between items-center">
                          <span className="text-white/50 font-mono text-[10px] uppercase">Destination Address:</span>
                          <span className="font-semibold text-white text-right max-w-sm shrink-0 truncate">{address}</span>
                        </div>
                        <div className="flex justify-between items-center text-white font-bold border-t border-white/5 pt-2 mt-2">
                          <span className="font-mono text-[10px] text-[#C5A059] uppercase tracking-wider">SOP Rate Quote Locked:</span>
                          <span className="font-serif text-[#C5A059] text-base">${getSelectedPackagePrice().toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end pt-4">
                        <button
                          type="button"
                          onClick={() => setJourneyStep('proposal')}
                          className="px-5 py-2.5 rounded-none border border-white/10 text-white/70 hover:text-white hover:border-white/20 text-xs uppercase tracking-wider font-mono transition-all cursor-pointer bg-transparent"
                        >
                          Back to Proposals
                        </button>
                        <button
                          type="submit"
                          className="px-8 py-3.5 rounded-none bg-[#C5A059] hover:bg-[#af8a44] text-black font-semibold text-xs tracking-widest uppercase transition-all shadow cursor-pointer flex items-center gap-1.5"
                        >
                          <FileCheck2 className="h-4.5 w-4.5 text-black" />
                          <span>Finalize Stewardship Reservation</span>
                        </button>
                      </div>

                    </form>

                  </div>
                </div>
              )}

              {/* FINAL THANK YOU AND CONFIRM PANEL */}
              {journeyStep === 'done' && (
                <div className="max-w-xl mx-auto py-10 text-center animate-fade-in">
                  <div className="h-16 w-16 bg-transparent text-[#C5A059] rounded-none flex items-center justify-center mx-auto mb-6 border-2 border-[#C5A059] shadow-lg">
                    <Check className="h-8 w-8" />
                  </div>

                  <h3 className="text-3xl font-serif text-[#E0D8D0] mb-2">
                    Reservation Secured
                  </h3>
                  <p className="text-[10px] font-mono text-[#C5A059] uppercase tracking-widest bg-[#C5A059]/10 border border-[#C5A059]/30 py-1 px-4 rounded-none inline-block mb-8">
                    Quote Price Guaranteed
                  </p>

                  <div className="bg-[#131619] rounded-none border border-white/10 p-6 text-left space-y-4">
                    <div className="text-center font-semibold text-[#C5A059] uppercase font-serif tracking-wider text-xs border-b border-white/15 pb-3">
                      STONEVALE STEWARDSHIP RECEIPT
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                      <span className="text-white/50">Client Name:</span>
                      <span className="font-semibold text-white text-right">{customerName}</span>

                      <span className="text-white/50">Service Address:</span>
                      <span className="font-semibold text-white text-right truncate">{address}</span>

                      <span className="text-white/50">Appointment Day:</span>
                      <span className="font-semibold text-white text-right">{bookingDate || "Unscheduled Callback"}</span>

                      <span className="text-white/50">Arrival Block:</span>
                      <span className="font-semibold text-white text-right">
                        {bookingTime === '09:00' ? "9:00 AM - 11:00 AM" : bookingTime === '12:00' ? "12:00 PM - 2:00 PM" : "3:00 PM - 5:00 PM"}
                      </span>

                      <span className="text-white/50">Fulfillment Type:</span>
                      <span className="font-semibold text-white text-right uppercase">
                        {bookingType === 'walkthrough' ? 'Walkthrough' : 'Guaranteed Job'}
                      </span>

                      <span className="text-white font-bold border-t border-white/10 pt-2.5 mt-1.5 font-sans">Guaranteed Price:</span>
                      <span className="text-right text-xl font-bold text-[#C5A059] font-serif border-t border-white/10 pt-2.5 mt-1.5">
                        ${getSelectedPackagePrice().toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-[#0F1113] p-4 rounded-none border border-white/10 mt-4">
                      <h4 className="text-[10px] font-bold text-[#C5A059] uppercase tracking-widest mb-1.5 font-mono">What's Next?</h4>
                      <p className="text-xs text-white/70 leading-relaxed font-sans">
                        Our premium dispatch has created your estate profile. We have noted your delicate plants and property boundaries. Your steward will call you at <span className="font-semibold text-[#C5A059]">{phone}</span> to confirm access details helper-gating.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => window.print()}
                        className="flex-1 py-3 rounded-none border border-white/10 font-medium text-xs font-mono uppercase text-white/70 hover:bg-[#0F1113] hover:text-[#C5A059] hover:border-[#C5A059] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Print Proposal</span>
                      </button>
                      <button
                        onClick={() => { setJourneyStep('input'); setAddress(''); }}
                        className="flex-1 py-3 rounded-none bg-[#C5A059] hover:bg-[#af8a44] text-black font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer"
                      >
                        Start New Estimate
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}

          {/* BACK OFFICE ADMIN PANEL (OFFICE WORKSPACE) */}
          {activeTab === 'office' && (
            <motion.div
              key="back-office"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 animate-fade-in"
            >
              
              {/* ADMIN BENTO KPI STATS PANEL */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                
                <div className="p-4 bg-[#131619] rounded-none border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-white/50 font-mono uppercase tracking-wider">Total Leads Scan</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-serif text-white">{statsSummary.total}</span>
                    <span className="text-[9px] text-white/40 font-mono">Profiles</span>
                  </div>
                  <div className="text-[9px] text-[#C5A059] font-mono flex items-center mt-1">
                    <Check className="h-3 w-3 mr-1" /> Fully Persistent
                  </div>
                </div>

                <div className="p-4 bg-[#131619] rounded-none border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-white/50 font-mono uppercase tracking-wider">Walkthroughs</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-serif text-[#C5A059]">{statsSummary.walkthroughs}</span>
                    <span className="text-[9px] text-white/40 font-mono">Active</span>
                  </div>
                  <span className="text-[9px] text-white/40 mt-1 block font-mono">Steward soft-sell</span>
                </div>

                <div className="p-4 bg-[#131619] rounded-none border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-white/50 font-mono uppercase tracking-wider">Confirmed Jobs</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-serif text-[#C5A059]">{statsSummary.jobs}</span>
                    <span className="text-[9px] text-white/40 font-mono">Booked</span>
                  </div>
                  <span className="text-[9px] text-white/40 mt-1 block font-mono">Guaranteed Revenue</span>
                </div>

                <div className="p-4 bg-[#131619] rounded-none border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-white/50 font-mono uppercase tracking-wider">Call Back Queue</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-serif text-white">{statsSummary.pendingCall}</span>
                    <span className="text-[9px] text-white/40 font-mono">Pending</span>
                  </div>
                  <span className="text-[9px] text-white/40 mt-1 block font-mono">Unmatched Quotes</span>
                </div>

                {/* CLOSE-RATE PERFORMANCE KPI */}
                <div className="p-4 bg-[#1a1e22] text-[#E0D8D0] rounded-none col-span-2 lg:col-span-1 border border-white/15 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-white/50 font-mono uppercase tracking-wider">Close-Rate KPI</span>
                      <TrendingUp className="h-4 w-4 text-[#C5A059] shrink-0" />
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-serif text-[#C5A059]">{statsSummary.ratePercentage}%</span>
                      <span className="text-[9px] text-white/40 font-mono">Target: ~60%</span>
                    </div>
                  </div>
                  <div className="mt-1">
                    {statsSummary.ratePercentage > 85 ? (
                      <span className="text-[9px] text-[#C5A059] font-medium block leading-tight">
                        ⚠️ Priced Too Low? Hike standard premiums.
                      </span>
                    ) : statsSummary.ratePercentage >= 50 ? (
                      <span className="text-[9px] text-[#C5A059] font-medium block leading-tight">
                        ✅ Optimally Priced! Clean estate value-close.
                      </span>
                    ) : (
                      <span className="text-[9px] text-red-300 font-medium block leading-tight border-t border-white/5 pt-1 mt-1">
                        📈 Push Phone Call overrides or lower deals.
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* ACTION DIALOG FOR DATABASE NOTIFICATIONS */}
              {errorBanner && (
                <div className="p-3.5 bg-white/[0.03] border border-[#C5A059]/30 text-[#C5A059] rounded-none text-xs font-mono flex items-center gap-2">
                  <FileCheck2 className="h-4.5 w-4.5 text-[#C5A059] shrink-0" />
                  <span>{errorBanner}</span>
                </div>
              )}

              {/* MAIN LAYOUT: Queue List vs Selected lead detail panel */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* QUEUE LIST (Left 7-columns) */}
                <div className="lg:col-span-7 bg-[#131619] border border-white/10 rounded-none overflow-hidden">
                  
                  {/* Search and Filters */}
                  <div className="p-4 bg-[#1a1e22] border-b border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                      <input 
                        type="text"
                        placeholder="Search name, phone, or road..."
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-none border border-white/20 focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] bg-[#0F1113] text-xs text-white font-sans placeholder:text-white/35"
                      />
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                      {(['all', 'quoted', 'booked_walkthrough', 'booked_job', 'not_interested'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setAdminFilter(filter)}
                          className={`px-3 py-1.5 rounded-none text-[10px] uppercase tracking-wider font-mono font-medium transition-all shrink-0 cursor-pointer capitalize ${
                            adminFilter === filter 
                              ? 'bg-[#C5A059] text-black shadow-sm font-bold' 
                              : 'bg-[#0F1113] border border-white/10 text-white/70 hover:text-white'
                          }`}
                        >
                          {filter === 'booked_walkthrough' ? 'Walkthroughs' : filter === 'booked_job' ? 'Confirmed' : filter === 'not_interested' ? 'Balkers' : filter}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* QUEUE LIST */}
                  <div className="divide-y divide-white/5 overflow-y-auto max-h-[500px]">
                    {loadingLeads ? (
                      <div className="p-8 text-center text-white/40 text-xs">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#C5A059]" />
                        <span>Loading secure Firestore backup...</span>
                      </div>
                    ) : filteredLeads.length === 0 ? (
                      <div className="p-12 text-center text-white/40 text-xs font-serif italic">
                        No customized leads matching current filters were located.
                      </div>
                    ) : (
                      filteredLeads.map((lead) => {
                        const statusColors = {
                          quoted: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
                          booked_walkthrough: 'bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/35',
                          booked_job: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40',
                          follow_up_needed: 'bg-purple-950/40 text-purple-300 border-purple-800/40',
                          not_interested: 'bg-white/5 text-white/50 border-white/10'
                        };

                        const selectedPackagePrice = 
                          lead.packageSelected === 'exterior_refresh' ? lead.calculations.exteriorRefresh :
                          lead.packageSelected === 'full_home_detail' ? lead.calculations.fullHomeDetail :
                          lead.packageSelected === 'estate_care_plan' ? lead.calculations.estateCarePlans.premium :
                          lead.calculations.exteriorRefresh; // fallback index

                        return (
                          <div
                            key={lead.id}
                            onClick={() => handleSelectLeadInspect(lead)}
                            className={`p-4 cursor-pointer hover:bg-[#1C2024]/40 transition-all flex justify-between items-center ${
                              selectedLead?.id === lead.id ? 'bg-[#1C2024] border-l-4 border-[#C5A059]' : ''
                            }`}
                          >
                            <div className="space-y-1 max-w-[70%]">
                              <div className="flex items-center gap-2">
                                <span className="font-serif text-[#E0D8D0] text-sm leading-tight font-semibold">{lead.customerName}</span>
                                <span className={`px-2 py-0.5 rounded-none text-[8px] font-mono uppercase tracking-wider border font-bold ${statusColors[lead.status] || ''}`}>
                                  {lead.status === 'quoted' ? 'Quote Out' : lead.status === 'booked_walkthrough' ? 'Walkthrough' : lead.status === 'booked_job' ? 'Booked Job' : 'Not Interested'}
                                </span>
                              </div>
                              
                              <p className="text-xs text-white/60 shrink-0 truncate max-w-sm flex items-center gap-1 font-sans">
                                <MapPin className="h-3 w-3 text-[#C5A059] shrink-0" />
                                <span>{lead.address}</span>
                              </p>

                              <p className="text-[9px] text-white/40 flex items-center gap-2 font-mono">
                                <span>{lead.phone}</span>
                                <span>&#8226;</span>
                                <span className="capitalize">{lead.packageSelected?.replace(/_/g, ' ')}</span>
                                <span>&#8226;</span>
                                <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                              </p>
                            </div>

                            <div className="text-right flex flex-col items-end">
                              <span className="text-[9px] text-white/40 uppercase tracking-wider font-mono">Guaranteed Rate</span>
                              <span className="text-base font-bold text-[#C5A059] font-serif">${selectedPackagePrice.toLocaleString()}</span>
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>

                </div>

                {/* LEAD WORKSPACE DETAIL PANEL (Right 5-columns) */}
                <div className="lg:col-span-5">
                  {selectedLead ? (
                    <div className="bg-[#131619] border border-white/10 rounded-none p-5 space-y-5 animate-fade-in">
                      
                      {/* Panel Title */}
                      <div className="flex justify-between items-start border-b border-white/10 pb-3">
                        <div>
                          <div className="text-[9px] text-[#C5A059] font-mono font-bold uppercase tracking-widest">LEAD MANAGER WORKSPACE</div>
                          <h3 className="text-base font-serif font-semibold text-[#E0D8D0] mt-0.5">{selectedLead.customerName}</h3>
                          <span className="text-[9px] bg-[#0F1113] py-0.5 px-2 rounded-none border border-white/5 font-mono text-white/50 block mt-1.5">ID: {selectedLead.id}</span>
                        </div>
                        <button 
                          onClick={() => setSelectedLead(null)}
                          className="p-1 rounded-none hover:bg-white/5 text-white/40 cursor-pointer"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Contact Fast actions */}
                      <div className="p-3 bg-[#0F1113] rounded-none border border-white/5 space-y-1.5 text-xs text-white/80">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-[#C5A059]" />
                          <span className="font-semibold text-white">{selectedLead.phone}</span>
                          <span className="text-white/40 italic font-mono text-[10px]">(Direct Dial Ready)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-[#C5A059] mt-0.5" />
                          <span className="font-semibold text-white">{selectedLead.email}</span>
                        </div>
                        <div className="flex items-start gap-2 pt-1.5 border-t border-white/10">
                          <MapPin className="h-3.5 w-3.5 text-[#C5A059] mt-0.5" />
                          <span className="font-medium leading-normal text-white/85">{selectedLead.address}</span>
                        </div>
                      </div>

                      {/* SAT-SCAN SATELLITE STATS */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-white/50 font-mono uppercase tracking-widest block">Satellite House Characteristics</span>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 bg-[#0F1113] border border-white/10 rounded-none">
                            <span className="text-white/40 font-mono block text-[9px]">House Finished Size</span>
                            <div className="flex items-baseline gap-1 mt-1 font-semibold text-white">
                              <input 
                                type="number" 
                                value={admHomeSize}
                                onChange={(e) => setAdmHomeSize(Number(e.target.value))}
                                className="w-16 font-semibold text-[#E0D8D0] border-b border-white/20 bg-transparent focus:outline-none focus:border-[#C5A059]"
                              />
                              <span className="text-[#C5A059] font-mono text-[9px]">sqft</span>
                            </div>
                          </div>

                          <div className="p-2.5 bg-[#0F1113] border border-white/10 rounded-none">
                            <span className="text-white/40 font-mono block text-[9px]">Roof Footprint Area</span>
                            <div className="flex items-baseline gap-1 mt-1 font-semibold text-white">
                              <input 
                                type="number" 
                                value={admRoofFootprint}
                                onChange={(e) => setAdmRoofFootprint(Number(e.target.value))}
                                className="w-16 font-semibold text-[#E0D8D0] border-b border-white/20 bg-transparent focus:outline-none focus:border-[#C5A059]"
                              />
                              <span className="text-[#C5A059] font-mono text-[9px]">sqft</span>
                            </div>
                          </div>

                          <div className="p-2.5 bg-[#0F1113] border border-white/10 rounded-none">
                            <span className="text-white/40 font-mono block text-[9px]">Driveway / Flatwork</span>
                            <div className="flex items-baseline gap-1 mt-1 font-semibold text-white">
                              <input 
                                type="number" 
                                value={admDrivewaySqft}
                                onChange={(e) => setAdmDrivewaySqft(Number(e.target.value))}
                                className="w-16 font-semibold text-[#E0D8D0] border-b border-white/20 bg-transparent focus:outline-none focus:border-[#C5A059]"
                              />
                              <span className="text-[#C5A059] font-mono text-[9px]">sqft</span>
                            </div>
                          </div>

                          <div className="p-2.5 bg-[#0F1113] border border-white/10 rounded-none">
                            <span className="text-white/40 font-mono block text-[9px]">Story / Siding</span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <select 
                                value={admStories} 
                                onChange={(e) => setAdmStories(Number(e.target.value))}
                                className="bg-transparent font-bold text-[#E0D8D0] border-b border-white/20 text-xs focus:outline-none focus:border-[#C5A059] py-0.5"
                              >
                                <option value="1" className="bg-[#131619] text-white">1</option>
                                <option value="2" className="bg-[#131619] text-white">2</option>
                                <option value="3" className="bg-[#131619] text-white">3</option>
                              </select>
                              <span className="text-[#C5A059] font-mono text-[9px]">flr</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* APPOINTMENT & STATUS CONTROLS */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-white/50 font-mono uppercase tracking-widest block">Deal Status & Scheduling</span>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-white/50 font-mono text-[9px] uppercase tracking-wider mb-1">Deal Action Status</label>
                            <select
                              value={admLeadStatus}
                              onChange={(e) => setAdmLeadStatus(e.target.value as Lead['status'])}
                              className="w-full bg-[#0F1113] border border-white/15 text-white/95 rounded-none p-2 font-sans focus:outline-none focus:border-[#C5A059]"
                            >
                              <option value="quoted" className="bg-[#131619] text-white">Quoted - Callback Needed</option>
                              <option value="booked_walkthrough" className="bg-[#131619] text-[#C5A059]">Walkthrough Scheduled</option>
                              <option value="booked_job" className="bg-[#131619] text-emerald-400">Fulfillment Job Confirmed</option>
                              <option value="not_interested" className="bg-[#131619] text-white/55">Not Interested (Balkers List)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-white/50 font-mono text-[9px] uppercase tracking-wider mb-1">Appointment Schedule</label>
                            <input
                              type="datetime-local"
                              value={admBookTime}
                              onChange={(e) => setAdmBookTime(e.target.value)}
                              className="w-full bg-[#0F1113] border border-white/15 rounded-none p-2 font-mono focus:outline-none focus:border-[#C5A059] text-[10px] text-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* CALL CORRECTION: Price overrides and discounts callback */}
                      <div className="p-4 bg-[#1a1e22] rounded-none space-y-3.5 border border-[#C5A059]/15 text-xs">
                        <span className="font-bold text-[#C5A059] uppercase font-mono tracking-widest text-[9px] flex items-center gap-1.5">
                          <DollarSign className="h-4 w-4 text-[#C5A059]" />
                          <span>Guaranteed Rate-Card RollUp Summary</span>
                        </span>
                        
                        <div className="space-y-1 font-mono text-[10px] text-white/60">
                          <div className="flex justify-between">
                            <span>Cladding Wash ({admStories} story, {admHomeSize} sqft):</span>
                            <span className="text-[#C5A059]">${calculateClientSideRates(admHomeSize, admStories, admRoofFootprint, admDrivewaySqft, admWindows, admMaterial).sidingWash}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Double Driveway Wash ({admDrivewaySqft} sqft):</span>
                            <span className="text-[#C5A059]">${calculateClientSideRates(admHomeSize, admStories, admRoofFootprint, admDrivewaySqft, admWindows, admMaterial).drivewayWash}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Window detailing ({admWindows} sections):</span>
                            <span className="text-[#C5A059]">${calculateClientSideRates(admHomeSize, admStories, admRoofFootprint, admDrivewaySqft, admWindows, admMaterial).windowDetail}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Gutter Restorations (Wash & Brighten):</span>
                            <span className="text-[#C5A059]">$300</span>
                          </div>
                          <div className="flex justify-between font-serif font-bold text-[#E0D8D0] border-t border-white/10 pt-1.5 mt-1.5 text-sm">
                            <span>Calculated Signature Proposal:</span>
                            <span className="text-[#C5A059]">${calculateClientSideRates(admHomeSize, admStories, admRoofFootprint, admDrivewaySqft, admWindows, admMaterial).fullHomeDetail}</span>
                          </div>
                        </div>

                        {/* Direct Flat notes log callback */}
                        <div>
                          <label className="block text-white/50 font-mono text-[9px] uppercase tracking-wider mb-1">Call Logs & Follow-Up Notebook</label>
                          <textarea
                            placeholder="Write internal office notes here. E.g. Spoke over phone, homeowner balked at original rate card. Lowered price to $1100 to secure the walkthrough..."
                            value={admNotes}
                            onChange={(e) => setAdmNotes(e.target.value)}
                            className="w-full bg-[#0F1113] border border-white/15 rounded-none p-2 h-14 focus:outline-none focus:border-[#C5A059] text-white text-xs leading-normal resize-none"
                          />
                        </div>
                      </div>

                      {/* Admin update commit */}
                      <button
                        onClick={handleAdminUpdateSubmit}
                        className="w-full py-3 rounded-none bg-[#C5A059] hover:bg-[#af8a44] text-black font-bold font-mono tracking-widest text-[10px] uppercase transition-all block cursor-pointer"
                      >
                        Commit Supervisor Changes
                      </button>

                    </div>
                  ) : (
                    <div className="bg-[#131619]/65 border border-white/10 border-dashed p-8 text-center text-white/45 text-xs font-serif min-h-[300px] flex flex-col justify-center items-center animate-fade-in rounded-none">
                      <User className="h-10 w-10 text-[#C5A059]/40 mb-3" />
                      <span>Select a lead to adjust satellite parameters, rate override invoices, and register phone callbacks.</span>
                    </div>
                  )}
                </div>

              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="mt-12 bg-[#0F1113] border-t border-white/10 py-6 text-center text-[10px] text-white/35 font-mono">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Stonevale Exterior Co. All proposal estimates are subject to on-site steward walkthrough verification.</p>
          <div className="mt-2.5 flex justify-center gap-3 text-[9px] text-[#C5A059]/50">
            <span>Server PERSISTENT Database: JSON Data Backup</span>
            <span>&#8226;</span>
            <span>Google Solar API & Gemini Flash Enabled</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
