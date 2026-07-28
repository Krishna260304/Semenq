/**
 * PharmacyMap — Leaflet-based interactive map for showing nearby pharmacies.
 *
 * Uses 100% open-source stack:
 *   - react-leaflet for React bindings
 *   - OpenStreetMap tiles (no API key required)
 *   - Nominatim geocoding on the backend
 */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon path issue with bundlers
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface PharmacyMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  distance_km?: number;
  medicines?: { medicine_name: string; quantity: number; price: number }[];
}

interface PharmacyMapProps {
  center?: [number, number]; // [lat, lon]
  zoom?: number;
  pharmacies?: PharmacyMarker[];
  userLocation?: [number, number];
  onPharmacyClick?: (pharmacy: PharmacyMarker) => void;
  className?: string;
  style?: React.CSSProperties;
}

const USER_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:20px;height:20px;border-radius:50%;
    background:radial-gradient(circle at 40% 40%,#60a5fa,#2563eb);
    border:3px solid white;
    box-shadow:0 0 0 4px rgba(37,99,235,0.25), 0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const PHARMACY_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:34px;height:34px;border-radius:50% 50% 50% 0;
    background:linear-gradient(135deg,#10b981,#059669);
    border:3px solid white;
    box-shadow:0 2px 12px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
    transform:rotate(-45deg);
  ">
    <span style="transform:rotate(45deg);font-size:14px;line-height:1;">💊</span>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -36],
});

export function PharmacyMap({
  center = [20.5937, 78.9629], // India center as default
  zoom = 13,
  pharmacies = [],
  userLocation,
  onPharmacyClick,
  className = "",
  style,
}: PharmacyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const mapCenter: [number, number] = userLocation ?? center;

    const map = L.map(mapRef.current, {
      center: mapCenter,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    // OpenStreetMap tiles — completely free, no API key
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // User location marker
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !userLocation) return;
    const marker = L.marker(userLocation, { icon: USER_ICON })
      .addTo(map)
      .bindPopup("<b>📍 Your Location</b>");
    map.setView(userLocation, zoom);
    return () => { marker.remove(); };
  }, [userLocation]);

  // Pharmacy markers
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    const markers: L.Marker[] = pharmacies.map((pharmacy) => {
      const popup = `
        <div style="min-width:200px;font-family:system-ui,sans-serif;">
          <h3 style="margin:0 0 6px;font-size:15px;font-weight:700;color:#059669;">
            💊 ${pharmacy.name}
          </h3>
          ${pharmacy.address ? `<p style="margin:0 0 4px;font-size:12px;color:#6b7280;">${pharmacy.address}</p>` : ""}
          ${
            pharmacy.distance_km != null
              ? `<p style="margin:0 0 8px;font-size:12px;color:#374151;">📏 <b>${pharmacy.distance_km.toFixed(1)} km</b> away</p>`
              : ""
          }
          ${
            pharmacy.medicines?.length
              ? `<div style="border-top:1px solid #e5e7eb;padding-top:6px;margin-top:4px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#374151;">Available Medicines:</p>
                  ${pharmacy.medicines
                    .map(
                      (m) =>
                        `<p style="margin:1px 0;font-size:11px;color:#6b7280;">• ${m.medicine_name} — ₹${m.price}</p>`
                    )
                    .join("")}
                </div>`
              : ""
          }
        </div>
      `;

      const marker = L.marker([pharmacy.latitude, pharmacy.longitude], {
        icon: PHARMACY_ICON,
      })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 260 });

      marker.on("click", () => {
        onPharmacyClick?.(pharmacy);
      });

      return marker;
    });

    // Auto-fit bounds if there are pharmacies
    if (pharmacies.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2));
    }

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [pharmacies, onPharmacyClick]);

  return (
    <div
      ref={mapRef}
      className={className}
      style={{
        width: "100%",
        height: "400px",
        borderRadius: "12px",
        overflow: "hidden",
        ...style,
      }}
    />
  );
}

export default PharmacyMap;
