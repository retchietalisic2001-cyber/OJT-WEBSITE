import { useEffect, useRef } from 'react'
import L from 'leaflet'

function pinIcon(color, size = 34) {
  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="ojt-pin" style="--pin:${color}">
             <span class="pin-dot"></span>
           </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 2],
    popupAnchor: [0, -size + 6]
  })
}

export default function MapView({ markers = [], center, radiusKm = null, height = '380px', onSelect }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const centerRef = useRef(center)
  centerRef.current = center

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const start = centerRef.current || [14.5995, 120.9842]
    const map = L.map(containerRef.current, { zoomControl: true }).setView(start, 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    if (center && radiusKm != null && center[0] && center[1]) {
      L.circle(center, {
        radius: radiusKm * 1000,
        color: '#5B4BDB',
        weight: 2,
        fillColor: '#5B4BDB',
        fillOpacity: 0.08,
        dashArray: '6 6'
      }).addTo(layer)
      L.circleMarker(center, { radius: 6, color: '#fff', weight: 3, fillColor: '#5B4BDB', fillOpacity: 1 }).addTo(layer)
      map.setView(center, Math.max(map.getZoom(), 11))
    }

    for (const m of markers) {
      if (m.lat == null || m.lng == null) continue
      const marker = L.marker([m.lat, m.lng], { icon: pinIcon(m.color || '#5B4BDB') })
      marker.bindPopup(
        `<div class="map-pop">
           <strong>${escapeHtml(m.title || 'OJT Position')}</strong>
           <span>${escapeHtml(m.company_name || '')}</span>
           ${m.status ? `<em>${escapeHtml(m.status)}</em>` : ''}
           ${m.distance_km != null ? `<span>${m.distance_km.toFixed(1)} km from you</span>` : ''}
         </div>`,
        { closeButton: false }
      )
      if (onSelect) marker.on('click', () => onSelect(m))
      marker.addTo(layer)
    }
  }, [markers, center, radiusKm, onSelect])

  const c = center || [14.5995, 120.9842]
  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', borderRadius: 16, zIndex: 0 }}
    />
  )
}

function escapeHtml(s) {
  return String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export { escapeHtml }