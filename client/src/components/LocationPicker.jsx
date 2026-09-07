import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

export default function LocationPicker({ value, onChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [coords, setCoords] = useState(value || [14.5547, 121.0244])
  const onSelect = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const start = value || [14.5547, 121.0244]
    const map = L.map(containerRef.current, { zoomControl: false }).setView(start, 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map)
    const marker = L.marker(start, { draggable: true }).addTo(map)
    markerRef.current = marker
    mapRef.current = map

    const update = (latlng) => {
      const lat = +latlng.lat.toFixed(6)
      const lng = +latlng.lng.toFixed(6)
      setCoords([lat, lng])
      onSelect.current?.({ lat, lng })
    }
    marker.on('dragend', (e) => update(e.target.getLatLng()))
    map.on('click', (e) => {
      marker.setLatLng(e.latlng)
      update(e.latlng)
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    onSelect.current = onChange
  }, [onChange])

  useEffect(() => {
    if (value && mapRef.current && markerRef.current) {
      mapRef.current.setView(value, Math.max(mapRef.current.getZoom(), 13))
      markerRef.current.setLatLng(value)
    }
  }, [value])

  return (
    <div className="picker-wrap">
      <div ref={containerRef} style={{ height: 280, width: '100%', borderRadius: 14, zIndex: 0 }} />
      <div className="picker-note">
        Click the map or drag the pin to set the office location
        {coords && <strong> {coords[0].toFixed(4)}, {coords[1].toFixed(4)}</strong>}
      </div>
    </div>
  )
}