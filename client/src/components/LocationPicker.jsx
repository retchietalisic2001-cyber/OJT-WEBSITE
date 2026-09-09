import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { toast } from '../toast.jsx'

export default function LocationPicker({ value, onChange, radiusKm = null }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)
  const [coords, setCoords] = useState(value || [14.5547, 121.0244])
  const [search, setSearch] = useState('')
  const [locating, setLocating] = useState(false)
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
      setCoords([Number(value[0]), Number(value[1])])
    }
  }, [value])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (circleRef.current) {
      circleRef.current.remove()
      circleRef.current = null
    }
    if (radiusKm == null || coords[0] == null || coords[1] == null) return
    circleRef.current = L.circle(coords, {
      radius: radiusKm * 1000,
      color: '#5B4BDB',
      weight: 2,
      fillColor: '#5B4BDB',
      fillOpacity: 0.08,
      dashArray: '6 6',
      interactive: false
    }).addTo(map)
  }, [coords, radiusKm])

  const setLocation = (lat, lng, zoom = 15) => {
    setCoords([lat, lng])
    mapRef.current?.setView([lat, lng], zoom)
    markerRef.current?.setLatLng([lat, lng])
    onSelect.current?.({ lat, lng })
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error('Location is not supported on this device')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setLocation(+pos.coords.latitude.toFixed(6), +pos.coords.longitude.toFixed(6), 15)
        toast.success('Location set from your device')
      },
      () => {
        setLocating(false)
        toast.error('Could not get your location — allow location access and try again')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const searchPlace = async (e) => {
    e.preventDefault()
    const q = search.trim()
    if (!q) return
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`)
      const rows = await r.json()
      if (!rows.length) return toast.error('No matching place found — try a city or street name')
      setLocation(+rows[0].lat, +rows[0].lon, 15)
      toast.success('Location set from search')
    } catch {
      toast.error('Location search failed — try again')
    }
  }

  return (
    <div className="picker-wrap">
      <div className="picker-tools">
        <form onSubmit={searchPlace} className="picker-search">
          <input
            className="input"
            placeholder="Search a city, street or landmark…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        </form>
        <button className="btn btn-ghost btn-sm" type="button" onClick={useMyLocation} disabled={locating}>
          {locating ? 'Locating…' : '📍 Use my location'}
        </button>
      </div>
      <div ref={containerRef} style={{ height: 280, width: '100%', borderRadius: 14, zIndex: 0 }} />
      <div className="picker-note">
        Click the map, drag the pin, search, or use your location
        {coords && <strong> {coords[0].toFixed(4)}, {coords[1].toFixed(4)}</strong>}
      </div>
    </div>
  )
}