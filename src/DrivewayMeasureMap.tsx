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

type DrivewayMeasureMapProps = {
  lat: number;
  lng: number;
  onAreaChange: (sqft: number) => void;
};

export default function DrivewayMeasureMap({
  lat,
  lng,
  onAreaChange,
}: DrivewayMeasureMapProps) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const pointsRef = useRef<google.maps.LatLngLiteral[]>([]);

  const [areaSqft, setAreaSqft] = useState(0);
  const [pointCount, setPointCount] = useState(0);

  const clearPolygon = () => {
    pointsRef.current = [];
    setPointCount(0);
    setAreaSqft(0);
    onAreaChange(0);

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
  };

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

      new google.maps.Marker({
        position: center,
        map,
        title: "Property",
      });

      mapClickListener = map.addListener(
        "click",
        (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;

          const point = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };

          pointsRef.current.push(point);
          setPointCount(pointsRef.current.length);

          const marker = new google.maps.Marker({
            position: point,
            map,
            label: String(pointsRef.current.length),
          });

          markersRef.current.push(marker);

          if (!polygonRef.current) {
            polygonRef.current = new google.maps.Polygon({
              paths: pointsRef.current,
              map,
              strokeOpacity: 0.9,
              strokeWeight: 2,
              fillOpacity: 0.35,
              clickable: false,
            });
          } else {
            polygonRef.current.setPath(pointsRef.current);
          }

          if (pointsRef.current.length >= 3) {
            const areaMeters =
              google.maps.geometry.spherical.computeArea(pointsRef.current);

            const sqft = Math.round(areaMeters * 10.7639);
            setAreaSqft(sqft);
            onAreaChange(sqft);
          }
        }
      );
    });

    return () => {
      if (mapClickListener) {
        google.maps.event.removeListener(mapClickListener);
      }
    };
  }, [lat, lng, onAreaChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] text-white/60 font-mono uppercase tracking-wider">Points clicked</p>
          <p className="text-2xl font-bold text-[#C5A059] mt-1">{pointCount}</p>
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
          <span className="block text-white/40 font-mono text-[10px] uppercase">
            Polygon Points
          </span>
          <span className="block text-white font-serif text-xl mt-1">
            {pointCount}
          </span>
        </div>

        <div className="bg-[#0F1113] border border-white/10 p-3">
          <span className="block text-white/40 font-mono text-[10px] uppercase">
            Measured Driveway
          </span>
          <span className="block text-[#C5A059] font-serif text-xl mt-1">
            {areaSqft.toLocaleString()} sqft
          </span>
        </div>
      </div>
    </div>
  );
}