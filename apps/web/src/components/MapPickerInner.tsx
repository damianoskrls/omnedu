'use client';

import { useEffect, useRef } from 'react';

interface StopPin {
  lat: number;
  lng: number;
  name: string;
  order: number;
}

interface Props {
  lat?: number;
  lng?: number;
  stops?: StopPin[];
  onSelect: (lat: number, lng: number, address?: string) => void;
}

export default function MapPickerInner({ lat, lng, stops = [], onSelect }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  const LRef = useRef<any>(null);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // Initialize map once
  useEffect(() => {
    if (!divRef.current) return;

    let mounted = true;

    // Inject Leaflet CSS once
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      link.setAttribute('data-leaflet', '1');
      document.head.appendChild(link);
    }

    import('leaflet').then((Lm) => {
      if (!mounted || !divRef.current) return;
      // Already initialized (e.g. React Strict Mode second call after cleanup didn't run yet)
      if ((divRef.current as any)._leaflet_id) return;

      const L = Lm.default;
      LRef.current = L;

      // Fix default icon paths broken by webpack
      const IconDefault = L.Icon.Default as any;
      delete IconDefault.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const center: [number, number] = lat && lng ? [lat, lng] : [38.0, 23.7];
      const zoom = lat && lng ? 15 : 7;
      const map = L.map(divRef.current!).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // Numbered markers for existing stops
      stops.forEach((stop) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:#6366f1;color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)">${stop.order}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([stop.lat, stop.lng], { icon }).bindPopup(`<b>${stop.order}.</b> ${stop.name}`).addTo(map);
      });

      // Polyline connecting stops in order
      if (stops.length >= 2) {
        const sorted = [...stops].sort((a, b) => a.order - b.order);
        L.polyline(sorted.map(s => [s.lat, s.lng] as [number, number]), {
          color: '#6366f1', weight: 2, opacity: 0.6, dashArray: '6,4',
        }).addTo(map);
      }

      // Selected marker pin
      if (lat && lng) {
        markerRef.current = L.marker([lat, lng], { icon: pinIcon(L) }).addTo(map);
      }

      map.on('click', async (e: any) => {
        const { lat: newLat, lng: newLng } = e.latlng;

        if (markerRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
        } else {
          markerRef.current = L.marker([newLat, newLng], { icon: pinIcon(L, true) }).addTo(map);
        }

        onSelectRef.current(newLat, newLng, undefined);

        // Reverse geocode
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${newLat}&lon=${newLng}&format=json&accept-language=el`,
            { headers: { 'Accept': 'application/json' } }
          );
          const data = await res.json();
          const { road, house_number, suburb, neighbourhood, quarter, city, town, village } = data.address ?? {};
          const parts = [
            road && house_number ? `${road} ${house_number}` : road,
            suburb || neighbourhood || quarter,
            city || town || village,
          ].filter(Boolean);
          const address = parts.join(', ') || data.display_name;
          if (address) onSelectRef.current(newLat, newLng, address);
        } catch {
          // No address available
        }
      });
    });

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // intentionally once

  // React to lat/lng prop changes → pan map + update/create marker
  useEffect(() => {
    if (!mapRef.current || !LRef.current || !lat || !lng) return;
    const L = LRef.current;
    const map = mapRef.current;

    map.flyTo([lat, lng], 15, { animate: true, duration: 0.8 });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon(L) }).addTo(map);
    }
  }, [lat, lng]);

  return (
    <div
      ref={divRef}
      style={{ height: 260, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}
    />
  );
}

function pinIcon(L: any, pulse = false) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;position:relative">${pulse ? `<div style="position:absolute;inset:0;border-radius:50%;background:#ef4444;opacity:0.25;animation:leaflet-pulse 1.5s ease-out infinite"></div>` : ''}<div style="position:absolute;inset:4px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
