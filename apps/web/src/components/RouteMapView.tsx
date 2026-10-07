'use client';

import { useEffect, useRef } from 'react';

interface PickupPerson {
  name: string;
  phone?: string;
  relation?: string;
  idNumber?: string;
  isDefault?: boolean;
}

interface StudentPin {
  id: string;
  fullName: string;
  avatarUrl?: string;
  serviceMode: string;
  pickupTime?: string;
  dropoffTime?: string;
  homeAddress?: string;
  homeLat: number;
  homeLng: number;
  pickupPersons?: PickupPerson[];
  routeName?: string;
  stopName?: string;
}

interface RouteStop {
  lat: number;
  lng: number;
  name: string;
  order: number;
  pickupTime?: string;
  dropoffTime?: string;
}

interface Props {
  students: StudentPin[];
  stops: RouteStop[];
  routeName: string;
}

const MODE_LABEL: Record<string, string> = {
  both: 'Παραλαβή + Αποστολή',
  pickup: 'Μόνο Παραλαβή',
  dropoff: 'Μόνο Αποστολή',
};

export default function RouteMapView({ students, stops, routeName }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      link.setAttribute('data-leaflet', '1');
      document.head.appendChild(link);
    }

    import('leaflet').then((Lm) => {
      const L = Lm.default;

      const IconDefault = L.Icon.Default as any;
      delete IconDefault.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Determine center: prefer stops, then students, then Athens
      const allLats = [
        ...stops.map(s => s.lat),
        ...students.map(s => s.homeLat),
      ];
      const allLngs = [
        ...stops.map(s => s.lng),
        ...students.map(s => s.homeLng),
      ];
      const centerLat = allLats.length ? allLats.reduce((a, b) => a + b) / allLats.length : 38.0;
      const centerLng = allLngs.length ? allLngs.reduce((a, b) => a + b) / allLngs.length : 23.7;

      const map = L.map(divRef.current!).setView([centerLat, centerLng], 13);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Route stops as numbered purple markers
      const sortedStops = [...stops].sort((a, b) => a.order - b.order);
      sortedStops.forEach((stop) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:#6366f1;color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)">${stop.order}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const popupLines = [
          `<b>${stop.order}. ${stop.name}</b>`,
          stop.pickupTime ? `↑ Παραλαβή: ${stop.pickupTime}` : '',
          stop.dropoffTime ? `↓ Αποστολή: ${stop.dropoffTime}` : '',
        ].filter(Boolean);
        L.marker([stop.lat, stop.lng], { icon })
          .bindPopup(popupLines.join('<br>'))
          .addTo(map);
      });

      // Polyline connecting stops
      if (sortedStops.length >= 2) {
        L.polyline(sortedStops.map(s => [s.lat, s.lng] as [number, number]), {
          color: '#6366f1', weight: 3, opacity: 0.7, dashArray: '8,5',
        }).addTo(map);
      }

      // Student home markers (house icon)
      students.forEach((student) => {
        const initials = student.fullName.slice(0, 2).toUpperCase();
        const modeColor = student.serviceMode === 'pickup'
          ? '#16a34a'
          : student.serviceMode === 'dropoff'
            ? '#2563eb'
            : '#7c3aed';
        const photo = student.avatarUrl
          ? `<img src="${student.avatarUrl.replace(/"/g, '')}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px" />`
          : initials;

        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${modeColor};color:white;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);overflow:hidden">${photo}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        // Build popup HTML
        const personsHtml = (student.pickupPersons ?? []).length > 0
          ? `<div style="margin-top:6px;border-top:1px solid #e5e7eb;padding-top:6px"><b style="font-size:11px">Εξουσιοδοτημένα Άτομα:</b>${(student.pickupPersons ?? []).map(p =>
            `<div style="font-size:11px;margin-top:3px">• ${p.name}${p.relation ? ` (${p.relation})` : ''}${p.phone ? `<br>&nbsp;&nbsp;📞 ${p.phone}` : ''}${p.idNumber ? `<br>&nbsp;&nbsp;🪪 ΑΔΤ: ${p.idNumber}` : ''}${p.isDefault ? ' ⭐' : ''}</div>`
          ).join('')}</div>`
          : '';

        const timeHtml = [
          student.pickupTime ? `↑ ${student.pickupTime}` : '',
          student.dropoffTime ? `↓ ${student.dropoffTime}` : '',
        ].filter(Boolean).join('  ');

        const popup = `<div style="min-width:180px;max-width:260px">
          <b style="font-size:13px">${student.fullName}</b>
          <div style="margin-top:3px;font-size:12px;color:#6b7280">${MODE_LABEL[student.serviceMode] ?? student.serviceMode}</div>
          ${timeHtml ? `<div style="font-size:12px;color:#374151;margin-top:2px">${timeHtml}</div>` : ''}
          ${student.homeAddress ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">📍 ${student.homeAddress}</div>` : ''}
          ${personsHtml}
        </div>`;

        L.marker([student.homeLat, student.homeLng], { icon })
          .bindPopup(popup, { maxWidth: 280 })
          .addTo(map);
      });

      // Fit bounds to all markers
      const bounds: [number, number][] = [
        ...sortedStops.map(s => [s.lat, s.lng] as [number, number]),
        ...students.map(s => [s.homeLat, s.homeLng] as [number, number]),
      ];
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={divRef}
      style={{ height: 480, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}
    />
  );
}
