import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Lazy-initialize Gemini SDK
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("GEMINI_API_KEY is not defined. AI features will fallback to defaults.");
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Interface definition for DB storage
interface Lead {
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
  calculations: any;
  confidenceExplanation?: string;
  createdAt: string;
  updatedAt: string;
}

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const mockLeads: Lead[] = [
      {
        id: "st_vance742",
        customerName: "Elizabeth Vance",
        phone: "(415) 555-0143",
        email: "e.vance@vanceestates.com",
        address: "742 Evergreen Terrace, Hillsborough, CA",
        sqftHome: 3200,
        stories: 2,
        roofFootprintSqft: 1800,
        drivewaySqft: 1200,
        windowSections: 24,
        exteriorMaterial: "Stucco",
        packageSelected: "full_home_detail",
        status: "booked_walkthrough",
        bookingType: "walkthrough",
        bookingDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + "T14:00",
        notes: "Requested a structured walkthrough to review fine details on lead-glass frames and patio restoration.",
        adminNotes: "Spoke on phone. Very pleasant homeowner who values property care. Walkthrough scheduled.",
        source: "qr_code",
        calculations: calculateQuotes(3200, 2, 1800, 1200, 24, "Stucco"),
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
      },
      {
        id: "st_arthur110",
        customerName: "Arthur Pendelton",
        phone: "(650) 555-8821",
        email: "arthur.pendelton@gmail.com",
        address: "1104 Stonegate Lane, Woodside, CA",
        sqftHome: 4600,
        stories: 3,
        roofFootprintSqft: 2400,
        drivewaySqft: 1800,
        windowSections: 32,
        exteriorMaterial: "Red Brick & Wood Accent",
        packageSelected: "full_home_detail",
        status: "quoted",
        notes: "Automated quote system generated from local flyer scan. Front driveway is heavily soiled.",
        adminNotes: "Left voicemail following up on their pricing. He viewed the Full Home Detail quote ($1,625). Call back Thursday.",
        source: "qr_code",
        calculations: calculateQuotes(4600, 3, 2400, 1800, 32, "Brick"),
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
      },
      {
        id: "st_victoria405",
        customerName: "Victoria Sterling",
        phone: "(415) 555-9002",
        email: "sterling.v@luxuryhomes.net",
        address: "405 Highpoint Ridge, Atherton, CA",
        sqftHome: 5200,
        stories: 2,
        roofFootprintSqft: 3100,
        drivewaySqft: 2200,
        windowSections: 40,
        exteriorMaterial: "Stone & Hardie Board",
        packageSelected: "estate_care_plan",
        status: "booked_job",
        bookingType: "job",
        bookingDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0] + "T09:00",
        notes: "Booking signature cleaning package to prep for seasonal family gathering.",
        adminNotes: "Approved immediately at $1,970 components price. Team scheduled, pre-job walk complete.",
        source: "qr_code",
        calculations: calculateQuotes(5200, 2, 3100, 2200, 40, "Hardie"),
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      },
      {
        id: "st_geoff88",
        customerName: "Geoffrey Miller",
        phone: "(650) 555-5231",
        email: "gmiller@stanford.edu",
        address: "88 Pinecrest Lane, Palo Alto, CA",
        sqftHome: 1900,
        stories: 1,
        roofFootprintSqft: 1900,
        drivewaySqft: 600,
        windowSections: 14,
        exteriorMaterial: "Vinyl Siding",
        packageSelected: "exterior_refresh",
        status: "not_interested",
        notes: "Just wanted window cleaning estimate. Thought full package was more than he wanted to spend.",
        adminNotes: "Quote rejected. Save in balker list. Autumn promotion candidate.",
        source: "manual_entry",
        calculations: calculateQuotes(1900, 1, 1900, 600, 14, "Vinyl"),
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
      }
    ];

    fs.writeFileSync(DB_FILE, JSON.stringify({ leads: mockLeads }, null, 2));
  }
}

function readDb(): { leads: Lead[] } {
  ensureDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return { leads: [] };
  }
}

function writeDb(data: { leads: Lead[] }) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Pricing SOP Formula Engine
function calculateQuotes(
  sqftHome: number,
  stories: number,
  roofFootprintSqft: number,
  drivewaySqft: number,
  windowSections: number,
  exteriorMaterial: string
) {
  // A. Flatwork Restoration
  // Standard driveway/flatwork: $0.25/sqft (minimum $150)
  const drivewayBase = drivewaySqft * 0.25;
  const drivewayPrice = Math.max(150, Math.round(drivewayBase));
  
  // Back patio / heavy buildup / entry detail (assume roughly 30% of driveway size for signature patio wash)
  const patioSqft = Math.round(drivewaySqft * 0.3);
  const patioPrice = Math.max(120, Math.round(patioSqft * 0.35)); // $0.35 heavier buildup rate
  
  // B. Exterior Soft Wash (house)
  // Base: $0.25/sqft of home finished living area
  const softWashBase = sqftHome * 0.25;
  const storyAdd = stories === 2 ? 150 : stories >= 3 ? 300 : 0;
  const softWashPrice = Math.round(softWashBase + storyAdd);
  
  // C. Roof Soft Wash: $0.65/sqft of roof footprint (not house sqft)
  const roofWashPrice = Math.round(roofFootprintSqft * 0.65);
  
  // D. Gutter Service
  // Perimeter matches 4 * sqrt(roof footprint)
  const linearFeet = Math.round(4 * Math.sqrt(roofFootprintSqft));
  const gutterCleanPrice = Math.round(linearFeet * 1.00); // Cleanout only $1.00/ft
  const gutterWashPrice = Math.round(linearFeet * 2.00);  // Full wash + rinse $2.00/ft
  const gutterFaceBrightening = 150; // standard face detail flat rate
  
  // E. Windows Detail
  // $12/section
  const windowPrice = windowSections * 12;
  
  // 1. Package 1 - The Exterior Refresh (entry)
  // Whole-home exterior soft wash + Exterior window detail
  const exteriorRefreshPrice = softWashPrice + windowPrice;
  
  // 2. Package 2 - The Full Home Detail (signature one-time)
  // Whole-home soft wash + window detail + driveway/walkways + patio/entry + gutter brightening
  const componentSum = softWashPrice + windowPrice + drivewayPrice + patioPrice + gutterFaceBrightening;
  // Professional reference anchor "from $1200". We use component sum, carrying a min of $1200 for premium estates.
  const fullHomeDetailPrice = Math.max(1200, componentSum);
  
  // 3. Package 3 - The Estate Care Plan (recurring - show but don't hard-sell)
  // Use the full measured roof sqft for the plan band.
  const plans = {
    "1800-2200": { essential: 99, premium: 229, signature: 429 },
    "2200-3000": { essential: 129, premium: 299, signature: 549 },
    "3000-4000": { essential: 159, premium: 399, signature: 729 },
    "4000-5000": { essential: 189, premium: 529, signature: 949 },
    "5000+": { essential: 249, premium: 649, signature: 1199 }
  };

  const carePlanSqft = Math.round(roofFootprintSqft);
  let key: keyof typeof plans = "2200-3000";
  if (carePlanSqft < 1800) {
    key = "1800-2200";
  } else if (carePlanSqft <= 2200) {
    key = "1800-2200";
  } else if (carePlanSqft <= 3000) {
    key = "2200-3000";
  } else if (carePlanSqft <= 4000) {
    key = "3000-4000";
  } else if (carePlanSqft <= 5000) {
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  console.log("Current folder:", process.cwd());
  console.log("Google Maps key loaded:", !!process.env.GOOGLE_MAPS_API_KEY);
  console.log("Gemini key loaded:", !!process.env.GEMINI_API_KEY);
  app.use(express.json());

  // API HEALTH CHECK
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ESTIMATE API: Google Solar + Geocoding API + Gemini Search Grounding Fallback
  app.post("/api/estimate", async (req, res) => {
    const { address, batchMode = false } = req.body;
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return res.status(400).json({ error: "Property address is required." });
    }

    const trimmedAddress = address.trim();
    console.log(`Starting estimation process for address: "${trimmedAddress}"`);

    // Standard baseline defaults (used if all APIs fail or key is not provided)
    let finalDetails = {
      roofFootprintSqft: 1500,
      drivewaySqft: 1000,
      stories: 2,
      windowSections: 18,
      exteriorMaterial: "Vinyl Siding",
      homeSizeSqft: 2400,
      confidenceExplanation: "Using generic neighborhood estimations as a starting reference. Please confirm or adjust details."
    };

    let directSolarSuccess = false;
    let propertyLat: number | null = null;
    let propertyLng: number | null = null;
    const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;

    // 1. ATTEMPT DIRECT GOOGLE MAPS GEOCODING + SOLAR API
    if (googleMapsKey) {
      try {
        console.log(`Attempting geocoding for: "${trimmedAddress}"`);
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmedAddress)}&key=${googleMapsKey}`;
        const geoResponse = await fetch(geocodeUrl);
        const geoData = await geoResponse.json();

        if (geoData.status === "OK" && geoData.results?.[0]?.geometry?.location) {
          const { lat, lng } = geoData.results[0].geometry.location;
          console.log(`Geocoded success! Lat: ${lat}, Lng: ${lng}`);
          propertyLat = lat;
          propertyLng = lng;

          // Try Google Solar API
          const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${googleMapsKey}`;
          const solarResponse = await fetch(solarUrl);
          
          if (solarResponse.ok) {
            const solarData = await solarResponse.json();
            if (solarData.solarPotential?.wholeRoofStats) {
              const roofAreaM2 = solarData.solarPotential.wholeRoofStats.areaMeters2;
              const roofSqft = Math.round(roofAreaM2 * 10.7639);
              console.log(`Solar API direct roof area match: ${roofSqft} sqft`);

              finalDetails.roofFootprintSqft = roofSqft;
              // Driveways are flatwork, not explicitly segmentated in Solar API. 
              // We calculate standard driveway ratio of 60% of building footprint
              finalDetails.drivewaySqft = Math.max(400, Math.round(roofSqft * 0.6));
              finalDetails.confidenceExplanation = `Verified with Google Solar API building footprint segments. Calculated rooftop footprint is exactly ${roofSqft} sqft.`;
              directSolarSuccess = true;
            }
          } else {
            console.warn(`Solar API replied with status: ${solarResponse.status}. Proceeding to Gemini Grounding solver.`);
          }
        } else {
          console.warn(`Geocoding status: ${geoData.status}. Moving to Gemini Grounding solver.`);
        }
      } catch (err) {
        console.error("Direct API attempt failed, moving to Gemini Grounding solver:", err);
      }
    }

    if (!directSolarSuccess) {
      return res.json({
        address: trimmedAddress,
        propertyLat,
        propertyLng,
        solarFound: false,
        reviewFlag: "NOT ON GOOGLE MAPS",
      });
    }

    // 2. ATTEMPT GEMINI SEARCH GROUNDING & STRUCTURAL SOLVER (HIGHLY POWERFUL FOR REAL-ESTATE INVENTORIES)
    const ai = getGeminiClient();
    if (ai) {
      try {
        console.log("Triggering Gemini 3.5 Flash Solver with Search Grounding...");
        const prompt = `You are a professional real estate data and satellite analyst for Stonevale Exterior Co.
        Analyze and search the web for the absolute most accurate and current real-estate records, building footprint records, Zillow indices, or satellite imagery coordinates for this home address: "${trimmedAddress}".
        
        Retrieve or estimate the following parameters as accurately as possible:
        1. Home finished living area ("homeSizeSqft") in square feet (e.g. 2400)
        2. Foundation / roof footprint area ("roofFootprintSqft") in square feet (typically 1000 to 4000)
        3. Driveway flatwork area ("drivewaySqft") in square feet (approx 400 for single, 800 for double, 1200+ for large estate driveways)
        4. Number of floors/stories ("stories") - must be either 1, 2, or 3
        5. Approximate number of exterior window sections ("windowSections") (usually 1.5x the number of rooms, generally between 12-30)
        6. Exterior siding material ("exteriorMaterial") (typically Vinyl Siding, Red Brick, Stucco, Stone, Hardie Board, etc.)
        
        Respond with raw JSON conforming to this logic. Make sure every single key exists and is non-null. Do not write text other than json.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                homeSizeSqft: { type: Type.INTEGER, description: "Total finished living square footage of home" },
                roofFootprintSqft: { type: Type.INTEGER, description: "Roof footprint/foundation square footage" },
                drivewaySqft: { type: Type.INTEGER, description: "Driveway and walkway square footage" },
                stories: { type: Type.INTEGER, description: "Exterior stories (1, 2, or 3)" },
                windowSections: { type: Type.INTEGER, description: "Approximate window panes or panels" },
                exteriorMaterial: { type: Type.STRING, description: "Main siding material (Vinyl Siding, Brick, Stucco, Wood)" },
                confidenceExplanation: { type: Type.STRING, description: "What records or real estate facts were found to backup or calculate these values" }
              },
              required: ["homeSizeSqft", "roofFootprintSqft", "drivewaySqft", "stories", "windowSections", "exteriorMaterial", "confidenceExplanation"]
            }
          }
        });

        const textOutput = response.text;
        if (textOutput) {
          const geminiResult = JSON.parse(textOutput.trim());
          console.log("Gemini solver successfully returned values:", geminiResult);
          
          // If we had direct solar successes, keep the high-fidelity roof footprint from Google,
          // but inherit home size, stories, siding, and details from Gemini Search.
          if (directSolarSuccess) {
            finalDetails = {
              ...geminiResult,
              roofFootprintSqft: finalDetails.roofFootprintSqft,
              confidenceExplanation: `${finalDetails.confidenceExplanation} Combined with real-estate analysis: ${geminiResult.confidenceExplanation}`
            };
          } else {
            finalDetails = geminiResult;
          }
        }
      } catch (err) {
        console.error("Gemini grounding estimation failed, using baseline model fallback.", err);
      }
    }

    // Run pricing calculations based on the rate card SOP
    const calculatedRates = calculateQuotes(
      finalDetails.homeSizeSqft,
      finalDetails.stories,
      finalDetails.roofFootprintSqft,
      finalDetails.drivewaySqft,
      finalDetails.windowSections,
      finalDetails.exteriorMaterial
    );

    res.json({
      address: trimmedAddress,
      propertyLat,
      propertyLng,
      solarFound: directSolarSuccess,
      ...finalDetails,
      calculations: calculatedRates
    });
  });

  // GET ALL LEADS FOR ADMINISTRATORS (CALL LIST & FOLLOW-UP)
  app.get("/api/leads", (req, res) => {
    const db = readDb();
    res.json(db.leads);
  });

  // GET LEAD BY ID
  app.get("/api/leads/:id", (req, res) => {
    const db = readDb();
    const lead = db.leads.find(l => l.id === req.params.id);
    if (!lead) {
      return res.status(404).json({ error: "Lead profile not found." });
    }
    res.json(lead);
  });

  // CREATE LEAD & AUTO-QUOTE INSTANT PROFILE
  app.post("/api/leads", (req, res) => {
    const {
      customerName,
      phone,
      email,
      address,
      sqftHome,
      stories,
      roofFootprintSqft,
      drivewaySqft,
      windowSections,
      exteriorMaterial,
      packageSelected,
      selectedServices,
      itemizedBill,
      source
    } = req.body;

    if (!customerName || !phone || !email || !address) {
      return res.status(400).json({ error: "Missing identity requirements. Name, Phone, Email, and Address are required." });
    }

    const db = readDb();
    const id = "st_" + Math.random().toString(36).substring(2, 11);

    // Dynamic calculations based on rates SOP
    const calcs = calculateQuotes(
      Number(sqftHome) || 2000,
      Number(stories) || 2,
      Number(roofFootprintSqft) || 1200,
      Number(drivewaySqft) || 1000,
      Number(windowSections) || 15,
      exteriorMaterial || "Vinyl Siding"
    );

    const newLead: Lead = {
      id,
      customerName,
      phone,
      email,
      address,
      sqftHome: Number(sqftHome) || 2000,
      stories: Number(stories) || 2,
      roofFootprintSqft: Number(roofFootprintSqft) || 1200,
      drivewaySqft: Number(drivewaySqft) || 1000,
      windowSections: Number(windowSections) || 15,
      exteriorMaterial: exteriorMaterial || "Vinyl",
      packageSelected: packageSelected || "full_home_detail",
      selectedServices: selectedServices || undefined,
      itemizedBill: itemizedBill || undefined,
      status: 'quoted',
      source: source || 'qr_code',
      calculations: calcs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.leads.push(newLead);
    writeDb(db);

    console.log(`Instant lead created: ${newLead.id} for ${newLead.customerName} @ ${newLead.address}`);
    res.json(newLead);
  });

  // UPDATE LEAD STATUS, SCHEDULES, BOOKINGS, ADUSTMENTS
  app.put("/api/leads/:id", (req, res) => {
    const db = readDb();
    const index = db.leads.findIndex(l => l.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Lead profile not found." });
    }

    const currentLead = db.leads[index];
    const {
      customerName,
      phone,
      email,
      address,
      sqftHome,
      stories,
      roofFootprintSqft,
      drivewaySqft,
      windowSections,
      exteriorMaterial,
      packageSelected,
      status,
      bookingType,
      bookingDateTime,
      notes,
      adminNotes
    } = req.body;

    // Apply basic info if requested
    if (customerName) currentLead.customerName = customerName;
    if (phone) currentLead.phone = phone;
    if (email) currentLead.email = email;
    if (address) currentLead.address = address;
    
    // Recalculate quotes if sizes change
    let sizeChanged = false;
    if (sqftHome && Number(sqftHome) !== currentLead.sqftHome) {
      currentLead.sqftHome = Number(sqftHome);
      sizeChanged = true;
    }
    if (stories && Number(stories) !== currentLead.stories) {
      currentLead.stories = Number(stories);
      sizeChanged = true;
    }
    if (roofFootprintSqft && Number(roofFootprintSqft) !== currentLead.roofFootprintSqft) {
      currentLead.roofFootprintSqft = Number(roofFootprintSqft);
      sizeChanged = true;
    }
    if (drivewaySqft && Number(drivewaySqft) !== currentLead.drivewaySqft) {
      currentLead.drivewaySqft = Number(drivewaySqft);
      sizeChanged = true;
    }
    if (windowSections && Number(windowSections) !== currentLead.windowSections) {
      currentLead.windowSections = Number(windowSections);
      sizeChanged = true;
    }
    if (exteriorMaterial && exteriorMaterial !== currentLead.exteriorMaterial) {
      currentLead.exteriorMaterial = exteriorMaterial;
      sizeChanged = true;
    }

    if (sizeChanged) {
      currentLead.calculations = calculateQuotes(
        currentLead.sqftHome,
        currentLead.stories,
        currentLead.roofFootprintSqft,
        currentLead.drivewaySqft,
        currentLead.windowSections,
        currentLead.exteriorMaterial
      );
    }

    // Save statuses
    if (packageSelected) currentLead.packageSelected = packageSelected;
    if (status) currentLead.status = status;
    if (bookingType !== undefined) currentLead.bookingType = bookingType;
    if (bookingDateTime !== undefined) currentLead.bookingDateTime = bookingDateTime;
    if (notes !== undefined) currentLead.notes = notes;
    if (adminNotes !== undefined) currentLead.adminNotes = adminNotes;

    currentLead.updatedAt = new Date().toISOString();
    db.leads[index] = currentLead;
    writeDb(db);

    console.log(`Lead updated: ${currentLead.id} status modified to: ${currentLead.status}`);
    res.json(currentLead);
  });

  // VITE DEV SERVER OR STATIC SERVING MIDDLEWARE
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Stonevale full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
