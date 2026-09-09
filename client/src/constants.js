export const COURSES = [
  'Information Technology',
  'Computer Science',
  'Civil Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Electronics Engineering',
  'Industrial Engineering',
  'Chemical Engineering',
  'Business Administration',
  'Accountancy',
  'Marketing Management',
  'Human Resource Management',
  'Office Administration',
  'Multimedia Arts',
  'Architecture',
  'Nursing',
  'Pharmacy',
  'Education',
  'Elementary Education',
  'Secondary Education',
  'Tourism Management',
  'Hospitality Management',
  'Criminology',
  'Psychology',
  'Political Science',
  'Sociology',
  'Biology',
  'Chemistry',
  'Physics',
  'Mathematics',
  'Communication Arts',
  'Journalism',
  'Public Administration',
  'Economics',
  'International Studies'
]

export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']

export const PH_UNIVERSITIES = [
  'University of the Philippines',
  'Ateneo de Manila University',
  'De La Salle University',
  'University of Santo Tomas',
  'Adamson University',
  'University of the East',
  'Far Eastern University',
  'National University',
  'Mapúa University',
  'University of Manila',
  'Manuel L. Quezon University',
  'New Era University',
  'Polytechnic University of the Philippines',
  'Technological Institute of the Philippines',
  'Centro Escolar University',
  'San Beda University',
  'San Sebastian College – Recoletos Manila',
  'Colegio de San Juan de Letran',
  'University of San Agustin',
  'University of the City of Manila',
  'Philippine Normal University',
  'Arellano University',
  'Lyceum of the Philippines University',
  'Saint Louis University',
  'University of the Cordilleras',
  'Baguio Central University',
  'University of Baguio',
  'University of Northern Philippines',
  'Isabela State University',
  'Cagayan State University',
  'Bicol University',
  'University of Nueva Caceres',
  'Ateneo de Naga University',
  'Central Bicol State University of Agriculture',
  'West Visayas State University',
  'University of San Carlos',
  'University of San Jose–Recoletos',
  'University of the Visayas',
  'University of Cebu',
  'Cebu Institute of Technology – University',
  'Silliman University',
  'Ateneo de Zamboanga University',
  'University of Negros Occidental – Recoletos',
  'Central Philippine University',
  'De La Salle University – Dasmariñas',
  'De La Salle Araneta University',
  'University of Perpetual Help System Dalta',
  'Manuel S. Enverga University Foundation',
  'University of Batangas',
  'Batangas State University',
  'Mindanao State University',
  'University of Mindanao',
  'University of the Philippines Mindanao',
  'Ateneo de Davao University',
  'University of Santo Tomas – Legazpi',
  'Xavier University – Ateneo de Cagayan',
  'University of Science and Technology of Southern Philippines',
  'Central Mindanao University',
  'Mindanao State University – Iligan Institute of Technology',
  'Notre Dame University',
  'University of San Carlos – North Campus',
  'STI Colleges',
  'AMA Computer University',
  'Our Lady of Fatima University'
]

export const STATUSES = [
  'submitted',
  'under_review',
  'interview',
  'accepted',
  'rejected',
  'withdrawn'
]

export const REGION_CITIES = {
  Luzon: [
    'Manila',
    'Makati',
    'Quezon City',
    'Pasig',
    'Taguig',
    'Mandaluyong',
    'Pasay',
    'Paranaque',
    'Marikina',
    'Caloocan',
    'Las Pinas',
    'Muntinlupa',
    'Antipolo',
    'Valenzuela',
    'Malabon',
    'Navotas',
    'Cavite City',
    'Bacoor',
    'Imus',
    'Dasmariñas',
    'General Trias',
    'Santa Rosa',
    'Calamba',
    'Batangas City',
    'Lipa',
    'Tanauan',
    'Tagaytay',
    'San Pablo',
    'Los Baños',
    'Malolos',
    'Meycauayan',
    'San Jose del Monte',
    'Olongapo',
    'Baguio',
    'Dagupan',
    'San Fernando',
    'Tarlac City',
    'Cabanatuan',
    'Lucena',
    'Naga City',
    'Legazpi',
    'Tuguegarao',
    'Laoag',
    'Vigan'
  ],
  Visayas: [
    'Cebu City',
    'Lapu-Lapu',
    'Mandaue',
    'Iloilo City',
    'Bacolod',
    'Dumaguete',
    'Tacloban',
    'Ormoc',
    'Kalibo',
    'Roxas City',
    'Tagbilaran',
    'Catbalogan',
    'Borongan',
    'Siquijor'
  ],
  Mindanao: [
    'Davao City',
    'Cagayan de Oro',
    'Zamboanga City',
    'General Santos',
    'Iligan',
    'Butuan',
    'Surigao City',
    'Pagadian',
    'Dipolog',
    'Cotabato City',
    'Marawi',
    'Koronadal',
    'Tagum',
    'Digos',
    'Malaybalay',
    'Kidapawan',
    'Ozamiz',
    'Valencia'
  ]
}

export const CITIES = Object.values(REGION_CITIES).flat()

export const REGION_CENTROIDS = {
  Luzon: [15.2, 121.0],
  Visayas: [10.7, 123.0],
  Mindanao: [8.0, 125.0]
}

export function cityRegion(city) {
  for (const [region, cities] of Object.entries(REGION_CITIES)) {
    if (cities.includes(city)) return region
  }
  return null
}

export function regionForLocation(lat, lng) {
  if (lat == null || lng == null) return null
  let best = null
  let bestDist = Infinity
  for (const [region, c] of Object.entries(REGION_CENTROIDS)) {
    const d = haversineKm(lat, lng, c[0], c[1])
    if (d < bestDist) {
      bestDist = d
      best = region
    }
  }
  return best
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export const CITY_COORDS = {
  Manila: [14.5995, 120.9842],
  Makati: [14.5547, 121.0244],
  'Quezon City': [14.676, 121.0437],
  Pasig: [14.5864, 121.0619],
  Taguig: [14.5176, 121.0509],
  Mandaluyong: [14.5794, 121.0352],
  Pasay: [14.5378, 120.9908],
  Paranaque: [14.4797, 121.0198],
  Marikina: [14.6346, 121.0993],
  Caloocan: [14.7566, 121.0451],
  'Las Pinas': [14.4506, 120.9827],
  Muntinlupa: [14.3894, 121.0609],
  Antipolo: [14.585, 121.173],
  Valenzuela: [14.7042, 120.9842],
  Malabon: [14.666, 120.97],
  Navotas: [14.7167, 120.95],
  'Cavite City': [14.4797, 120.897],
  Bacoor: [14.457, 120.943],
  Imus: [14.4297, 120.936],
  Dasmariñas: [14.3293, 120.936],
  'General Trias': [14.386, 120.881],
  'Santa Rosa': [14.3127, 121.111],
  Calamba: [14.2127, 121.165],
  'Batangas City': [13.7569, 121.058],
  Lipa: [13.941, 121.162],
  Tanauan: [14.0833, 121.15],
  Tagaytay: [14.115, 120.962],
  'San Pablo': [14.068, 121.325],
  'Los Baños': [14.174, 121.243],
  Malolos: [14.845, 120.812],
  Meycauayan: [14.75, 120.956],
  'San Jose del Monte': [14.814, 121.05],
  Olongapo: [14.829, 120.283],
  Baguio: [16.4023, 120.596],
  Dagupan: [16.043, 120.333],
  'San Fernando': [15.028, 120.692],
  'Tarlac City': [15.476, 120.598],
  Cabanatuan: [15.487, 120.97],
  Lucena: [13.935, 121.617],
  'Naga City': [13.621, 123.17],
  Legazpi: [13.139, 123.744],
  Tuguegarao: [17.613, 121.727],
  Laoag: [18.197, 120.593],
  Vigan: [17.57, 120.387],
  'Cebu City': [10.3157, 123.885],
  'Lapu-Lapu': [10.31, 123.949],
  Mandaue: [10.329, 123.931],
  'Iloilo City': [10.7202, 122.5621],
  Bacolod: [10.676, 122.956],
  Dumaguete: [9.307, 123.307],
  Tacloban: [11.243, 125.005],
  Ormoc: [11.006, 124.607],
  Kalibo: [11.708, 122.365],
  'Roxas City': [11.585, 122.751],
  Tagbilaran: [9.656, 123.852],
  Catbalogan: [11.775, 124.883],
  Borongan: [11.608, 125.432],
  Siquijor: [9.215, 123.517],
  'Davao City': [7.1907, 125.4553],
  'Cagayan de Oro': [8.4542, 124.6319],
  'Zamboanga City': [6.9214, 122.079],
  'General Santos': [6.1164, 125.1716],
  Iligan: [8.228, 124.245],
  Butuan: [8.947, 125.544],
  'Surigao City': [9.789, 125.495],
  Pagadian: [7.827, 123.437],
  Dipolog: [8.587, 123.341],
  'Cotabato City': [7.216, 124.246],
  Marawi: [8.003, 124.284],
  Koronadal: [6.503, 124.847],
  Tagum: [7.447, 125.808],
  Digos: [6.749, 125.357],
  Malaybalay: [8.157, 125.128],
  Kidapawan: [7.008, 125.089],
  Ozamiz: [8.146, 123.844],
  Valencia: [7.906, 125.094]
}