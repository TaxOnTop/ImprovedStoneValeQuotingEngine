import { useEffect, useRef, useState } from "react";

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.geometry) {
      resolve();
      return;
    }

    const existingScript = document.getElementById("google-maps-script");

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () =>
        reject(new Error("Google Maps failed to load"))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${apiKey}` +
      `&libraries=geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));

    document.head.appendChild(script);
  });
}

type Point = {
  lat: number;
  lng: number;
};

type PolygonType = "driveway" | "frontPatio" | "backPatio";

type DrivewayMeasureMapProps = {
  lat: number;
  lng: number;
  activeType?: PolygonType;
  clearVersions?: Partial<Record<PolygonType, number>>;
  onAreaChangeDriveway?: (sqft: number) => void;
  onAreaChangeFrontPatio?: (sqft: number) => void;
  onAreaChangeBackPatio?: (sqft: number) => void;
};

export default function DrivewayMeasureMap({
  lat,
  lng,
  activeType = "driveway",
  clearVersions,
  onAreaChangeDriveway,
  onAreaChangeFrontPatio,
  onAreaChangeBackPatio,
}: DrivewayMeasureMapProps) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const activeTypeRef = useRef<PolygonType>(activeType);

  const polygonRefDriveway = useRef<google.maps.Polygon | null>(null);
  const polygonRefFront = useRef<google.maps.Polygon | null>(null);
  const polygonRefBack = useRef<google.maps.Polygon | null>(null);
  const markersRefDriveway = useRef<google.maps.Marker[]>([]);
  const markersRefFront = useRef<google.maps.Marker[]>([]);
  const markersRefBack = useRef<google.maps.Marker[]>([]);

  const [measuredDrivewayPoints, setMeasuredDrivewayPoints] = useState<Point[]>([]);
  const [measuredFrontPatioPoints, setMeasuredFrontPatioPoints] = useState<Point[]>([]);
  const [measuredBackPatioPoints, setMeasuredBackPatioPoints] = useState<Point[]>([]);
  const [drivewayArea, setDrivewayArea] = useState(0);
  const [frontPatioArea, setFrontPatioArea] = useState(0);
  const [backPatioArea, setBackPatioArea] = useState(0);
  const lastClearVersionsRef = useRef<Partial<Record<PolygonType, number>>>({});

  const activePoints =
    activeType === "driveway"
      ? measuredDrivewayPoints
      : activeType === "frontPatio"
      ? measuredFrontPatioPoints
      : measuredBackPatioPoints;

  const clearPolygonByType = (draw: PolygonType) => {
    if (draw === "driveway") {
      markersRefDriveway.current.forEach((m) => m.setMap(null));
      markersRefDriveway.current = [];
      if (polygonRefDriveway.current) {
        polygonRefDriveway.current.setMap(null);
        polygonRefDriveway.current = null;
      }
      setMeasuredDrivewayPoints([]);
      setDrivewayArea(0);
      if (onAreaChangeDriveway) onAreaChangeDriveway(0);
      return;
    }

    if (draw === "frontPatio") {
      markersRefFront.current.forEach((m) => m.setMap(null));
      markersRefFront.current = [];
      if (polygonRefFront.current) {
        polygonRefFront.current.setMap(null);
        polygonRefFront.current = null;
      }
      setMeasuredFrontPatioPoints([]);
      setFrontPatioArea(0);
      if (onAreaChangeFrontPatio) onAreaChangeFrontPatio(0);
      return;
    }

    // backPatio
    markersRefBack.current.forEach((m) => m.setMap(null));
    markersRefBack.current = [];
    if (polygonRefBack.current) {
      polygonRefBack.current.setMap(null);
      polygonRefBack.current = null;
    }
    setMeasuredBackPatioPoints([]);
    setBackPatioArea(0);
    if (onAreaChangeBackPatio) onAreaChangeBackPatio(0);
  };

  const clearPolygon = () => {
    clearPolygonByType(activeTypeRef.current);
  };

  useEffect(() => {
    activeTypeRef.current = activeType;
  }, [activeType]);

  useEffect(() => {
    if (!clearVersions) return;

    (["driveway", "frontPatio", "backPatio"] as PolygonType[]).forEach((type) => {
      const version = clearVersions[type] ?? 0;
      const previous = lastClearVersionsRef.current[type] ?? 0;
      if (version > previous) {
        clearPolygonByType(type);
      }
    });

    lastClearVersionsRef.current = { ...clearVersions };
  }, [clearVersions]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;

    if (!apiKey) {
      console.error("Missing VITE_GOOGLE_MAPS_BROWSER_KEY in .env");
      return;
    }

    let mapClickListener: google.maps.MapsEventListener | null = null;

    loadGoogleMaps(apiKey).then(() => {
      if (!mapDivRef.current) return;

      const center = { lat, lng };

      const map = new google.maps.Map(mapDivRef.current, {
        center,
        zoom: 20,
        mapTypeId: "satellite",
        tilt: 0,
        streetViewControl: false,
        fullscreenControl: true,
        mapTypeControl: true,
      });

      mapRef.current = map;

      new google.maps.Marker({
        position: center,
        map,
        title: "Property",
      });

      mapClickListener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (!event.latLng || !mapRef.current) return;

        const point: Point = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        };

        const drawTarget = activeTypeRef.current;

        if (drawTarget === "driveway") {
          const marker = new google.maps.Marker({
            position: point,
            map: mapRef.current,
            label: String(markersRefDriveway.current.length + 1),
          });
          markersRefDriveway.current.push(marker);

          setMeasuredDrivewayPoints((prev) => {
            const next = [...prev, point];
            if (!polygonRefDriveway.current) {
              polygonRefDriveway.current = new google.maps.Polygon({
                paths: next,
                map: mapRef.current!,
                strokeOpacity: 0.9,
                strokeWeight: 2,
                fillOpacity: 0.35,
                clickable: false,
              });
            } else {
              polygonRefDriveway.current.setPath(next);
            }
            return next;
          });

          return;
        }

        if (drawTarget === "frontPatio") {
          const marker = new google.maps.Marker({
            position: point,
            map: mapRef.current,
            label: String(markersRefFront.current.length + 1),
          });
          markersRefFront.current.push(marker);

          setMeasuredFrontPatioPoints((prev) => {
            const next = [...prev, point];
            if (!polygonRefFront.current) {
              polygonRefFront.current = new google.maps.Polygon({
                paths: next,
                map: mapRef.current!,
                strokeOpacity: 0.9,
                strokeWeight: 2,
                fillOpacity: 0.25,
                clickable: false,
                strokeColor: '#9FD1E5',
                fillColor: '#9FD1E5',
              });
            } else {
              polygonRefFront.current.setPath(next);
            }
            return next;
          });

          return;
        }

        // backPatio
        const marker = new google.maps.Marker({
          position: point,
          map: mapRef.current,
          label: String(markersRefBack.current.length + 1),
        });
        markersRefBack.current.push(marker);

        setMeasuredBackPatioPoints((prev) => {
          const next = [...prev, point];
          if (!polygonRefBack.current) {
            polygonRefBack.current = new google.maps.Polygon({
              paths: next,
              map: mapRef.current!,
              strokeOpacity: 0.9,
              strokeWeight: 2,
              fillOpacity: 0.25,
              clickable: false,
              strokeColor: '#F2CBA7',
              fillColor: '#F2CBA7',
            });
          } else {
            polygonRefBack.current.setPath(next);
          }
          return next;
        });
      });
    });

    return () => {
      if (mapClickListener) {
        google.maps.event.removeListener(mapClickListener);
      }
    };
  }, [lat, lng]);

  useEffect(() => {
    if (measuredDrivewayPoints.length >= 3 && window.google?.maps?.geometry) {
      const areaMeters = google.maps.geometry.spherical.computeArea(
        measuredDrivewayPoints as google.maps.LatLngLiteral[]
      );
      const sqft = Math.round(areaMeters * 10.7639);
      setDrivewayArea(sqft);
      if (onAreaChangeDriveway) onAreaChangeDriveway(sqft);
    } else {
      setDrivewayArea(0);
      if (onAreaChangeDriveway) onAreaChangeDriveway(0);
    }
  }, [measuredDrivewayPoints, onAreaChangeDriveway]);

  useEffect(() => {
    if (measuredFrontPatioPoints.length >= 3 && window.google?.maps?.geometry) {
      const areaMeters = google.maps.geometry.spherical.computeArea(
        measuredFrontPatioPoints as google.maps.LatLngLiteral[]
      );
      const sqft = Math.round(areaMeters * 10.7639);
      setFrontPatioArea(sqft);
      if (onAreaChangeFrontPatio) onAreaChangeFrontPatio(sqft);
    } else {
      setFrontPatioArea(0);
      if (onAreaChangeFrontPatio) onAreaChangeFrontPatio(0);
    }
  }, [measuredFrontPatioPoints, onAreaChangeFrontPatio]);

  useEffect(() => {
    if (measuredBackPatioPoints.length >= 3 && window.google?.maps?.geometry) {
      const areaMeters = google.maps.geometry.spherical.computeArea(
        measuredBackPatioPoints as google.maps.LatLngLiteral[]
      );
      const sqft = Math.round(areaMeters * 10.7639);
      setBackPatioArea(sqft);
      if (onAreaChangeBackPatio) onAreaChangeBackPatio(sqft);
    } else {
      setBackPatioArea(0);
      if (onAreaChangeBackPatio) onAreaChangeBackPatio(0);
    }
  }, [measuredBackPatioPoints, onAreaChangeBackPatio]);

  const totalPatio = frontPatioArea + backPatioArea;

  const activeLabel = activeType === "driveway" ? "Driveway" : activeType === "frontPatio" ? "Front Patio" : "Back Patio";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] text-white/60 font-mono uppercase tracking-wider">
            Active points for {activeLabel}
          </p>
          <p className="text-2xl font-bold text-[#C5A059] mt-1">{activePoints.length}</p>
        </div>
        <button
          type="button"
          onClick={clearPolygon}
          className="px-4 py-2 bg-[#0F1113] border border-white/10 text-white/60 hover:text-[#C5A059] hover:border-[#C5A059] text-[10px] uppercase tracking-wider font-mono transition-all"
        >
          Clear Polygon
        </button>
      </div>

      <div
        ref={mapDivRef}
        className="w-full h-[500px] border border-white/10 bg-[#0F1113] rounded-none"
      />

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-[#0F1113] border border-white/10 p-3">
          <span className="block text-white/40 font-mono text-[10px] uppercase">Driveway</span>
          <span className="block text-[#C5A059] font-serif text-xl mt-1">{drivewayArea.toLocaleString()} sqft</span>
          <span className="block text-white/60 text-xs mt-2">{measuredDrivewayPoints.length} polygon points</span>
        </div>

        <div className="bg-[#0F1113] border border-white/10 p-3">
          <span className="block text-white/40 font-mono text-[10px] uppercase">Front Patio</span>
          <span className="block text-[#C5A059] font-serif text-xl mt-1">{frontPatioArea.toLocaleString()} sqft</span>
          <span className="block text-white/60 text-xs mt-2">{measuredFrontPatioPoints.length} polygon points</span>
        </div>

        <div className="bg-[#0F1113] border border-white/10 p-3">
          <span className="block text-white/40 font-mono text-[10px] uppercase">Back Patio</span>
          <span className="block text-[#C5A059] font-serif text-xl mt-1">{backPatioArea.toLocaleString()} sqft</span>
          <span className="block text-white/60 text-xs mt-2">{measuredBackPatioPoints.length} polygon points</span>
        </div>
      </div>
    </div>
  );
}
