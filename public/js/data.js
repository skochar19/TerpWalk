// UMD Campus bounds
const UMD_BOUNDS = {
  north: 39.0020,
  south: 38.9790,
  east: -76.9290,
  west: -76.9600
};

const UMD_CENTER = [38.9869, -76.9426];

// Emergency Blue Light Phone locations across UMD campus
const BLUE_LIGHTS = [
  // Academic core / Mall area
  { id: 'bl-01', lat: 38.9862, lng: -76.9452, name: 'McKeldin Library (East)' },
  { id: 'bl-02', lat: 38.9857, lng: -76.9462, name: 'McKeldin Library (West)' },
  { id: 'bl-03', lat: 38.9876, lng: -76.9444, name: 'Memorial Chapel' },
  { id: 'bl-04', lat: 38.9878, lng: -76.9432, name: 'Main Mall (Center)' },
  { id: 'bl-05', lat: 38.9866, lng: -76.9435, name: 'Main Mall (South)' },
  { id: 'bl-06', lat: 38.9892, lng: -76.9424, name: 'Main Mall (North)' },

  // Stamp Student Union area
  { id: 'bl-07', lat: 38.9895, lng: -76.9445, name: 'Stamp Student Union (Front)' },
  { id: 'bl-08', lat: 38.9887, lng: -76.9456, name: 'Stamp South Walkway' },
  { id: 'bl-09', lat: 38.9901, lng: -76.9458, name: 'Stamp West Lot' },

  // Engineering / CS buildings
  { id: 'bl-10', lat: 38.9900, lng: -76.9393, name: 'A.V. Williams Building' },
  { id: 'bl-11', lat: 38.9908, lng: -76.9380, name: 'Iribe Center' },
  { id: 'bl-12', lat: 38.9895, lng: -76.9368, name: 'Regents Drive (East)' },
  { id: 'bl-13', lat: 38.9882, lng: -76.9372, name: 'Paint Branch Trail (N)' },
  { id: 'bl-14', lat: 38.9870, lng: -76.9362, name: 'Paint Branch Trail (S)' },

  // North Campus dorms
  { id: 'bl-15', lat: 38.9942, lng: -76.9420, name: 'Comcast Center' },
  { id: 'bl-16', lat: 38.9958, lng: -76.9453, name: 'Cole Field House' },
  { id: 'bl-17', lat: 38.9965, lng: -76.9436, name: 'North Hill (Residence)' },
  { id: 'bl-18', lat: 38.9972, lng: -76.9418, name: 'Cambridge Community' },
  { id: 'bl-19', lat: 38.9955, lng: -76.9406, name: 'Ellicott (North)' },
  { id: 'bl-20', lat: 38.9935, lng: -76.9415, name: 'Prince Frederick Hall' },
  { id: 'bl-21', lat: 38.9920, lng: -76.9410, name: 'Denton Hall' },

  // South Campus dorms
  { id: 'bl-22', lat: 38.9845, lng: -76.9460, name: 'South Campus Diner' },
  { id: 'bl-23', lat: 38.9835, lng: -76.9450, name: 'Carroll Hall' },
  { id: 'bl-24', lat: 38.9837, lng: -76.9435, name: 'Ellicott Hall' },
  { id: 'bl-25', lat: 38.9828, lng: -76.9422, name: 'Cumberland Hall' },

  // Athletics / West campus
  { id: 'bl-26', lat: 38.9928, lng: -76.9498, name: 'Maryland Stadium (East Gate)' },
  { id: 'bl-27', lat: 38.9938, lng: -76.9480, name: 'Ludwig Field' },
  { id: 'bl-28', lat: 38.9912, lng: -76.9500, name: 'Leonardtown Community' },
  { id: 'bl-29', lat: 38.9902, lng: -76.9515, name: 'Fraternity Row (East)' },

  // Health & services
  { id: 'bl-30', lat: 38.9874, lng: -76.9472, name: 'Health Center' },
  { id: 'bl-31', lat: 38.9864, lng: -76.9478, name: 'Terrapin Trail' },
  { id: 'bl-32', lat: 38.9853, lng: -76.9468, name: 'Annapolis Hall' },

  // Parking garages
  { id: 'bl-33', lat: 38.9843, lng: -76.9408, name: 'Regents Drive Garage' },
  { id: 'bl-34', lat: 38.9920, lng: -76.9392, name: 'Paint Branch Garage' },
  { id: 'bl-35', lat: 38.9950, lng: -76.9465, name: 'Lot 1 Garage' },
  { id: 'bl-36', lat: 38.9910, lng: -76.9475, name: 'Lot 4 (North)' },

  // Far reaches
  { id: 'bl-37', lat: 38.9800, lng: -76.9440, name: 'Knox Road Entrance' },
  { id: 'bl-38', lat: 38.9985, lng: -76.9430, name: 'Varsity Drive (North)' },
  { id: 'bl-39', lat: 38.9860, lng: -76.9330, name: 'Regents Drive (East End)' },
  { id: 'bl-40', lat: 38.9888, lng: -76.9540, name: 'Route 1 / Baltimore Ave' },
];

// Parking lot centers — used for heatmap danger scoring and route penalty
// Each entry covers a ~120m radius to account for lot size
const PARKING_CENTERS = [
  // Garages
  { lat: 38.9843, lng: -76.9408, name: 'Regents Drive Garage' },
  { lat: 38.9920, lng: -76.9388, name: 'Paint Branch Drive Garage' },
  { lat: 38.9952, lng: -76.9470, name: 'Lot 1 Garage (Stadium Dr)' },

  // Stadium / North athletic lots (Lot 1a, 1b, 2 — large surface lots)
  { lat: 38.9970, lng: -76.9510, name: 'Lot 1a (Stadium North)' },
  { lat: 38.9945, lng: -76.9520, name: 'Lot 1b (Stadium West)' },
  { lat: 38.9928, lng: -76.9500, name: 'Lot 2 (Leonardtown)' },

  // Cole Field House / XFINITY Center area (Lot 4, Lot Y, Lot YY)
  { lat: 38.9938, lng: -76.9490, name: 'Lot 4 (Cole Field House)' },
  { lat: 38.9958, lng: -76.9460, name: 'Lot YY (XFINITY North)' },
  { lat: 38.9950, lng: -76.9440, name: 'Lot Y (XFINITY East)' },

  // Comcast / North campus lots (Lot 10, Lot 11)
  { lat: 38.9932, lng: -76.9418, name: 'Lot 10 (Comcast Center)' },
  { lat: 38.9918, lng: -76.9410, name: 'Lot 11 (Denton / Ellicott North)' },

  // Engineering / East campus (Lot 4A, Lot 4B, Lot QQ)
  { lat: 38.9908, lng: -76.9370, name: 'Lot 4A (Engineering East)' },
  { lat: 38.9893, lng: -76.9358, name: 'Lot QQ (Paint Branch East)' },

  // South campus lots (Lot 3, Lot EE, near Ellicott / South diner)
  { lat: 38.9832, lng: -76.9462, name: 'Lot 3 / South Campus Diner' },
  { lat: 38.9820, lng: -76.9445, name: 'Lot EE (South Campus)' },
  { lat: 38.9838, lng: -76.9430, name: 'Lot FF (Ellicott Hall)' },

  // Route 1 / Baltimore Ave surface lots (Lot Z, Lot ZZ)
  { lat: 38.9850, lng: -76.9520, name: 'Lot Z (Route 1 North)' },
  { lat: 38.9810, lng: -76.9535, name: 'Lot ZZ (Route 1 South)' },
  { lat: 38.9875, lng: -76.9505, name: 'Lot TT (Fraternity Row)' },

  // Adelphi Road / North perimeter
  { lat: 38.9980, lng: -76.9450, name: 'Lot BB (Varsity Drive)' },
  { lat: 38.9975, lng: -76.9405, name: 'Lot CC (North Campus)' },
];

// Community pin type definitions
const PIN_TYPES = {
  unsafe: {
    label: 'Unsafe Area',
    icon: '⚠️',
    color: '#ef4444',
    description: 'Report an area that feels unsafe'
  },
  broken_light: {
    label: 'Broken Streetlight',
    icon: '💡',
    color: '#f97316',
    description: 'Streetlight out or broken'
  },
  blue_light_issue: {
    label: 'Blue Light Issue',
    icon: '🔵',
    color: '#3b82f6',
    description: 'Blue light phone not working'
  },
  safe_spot: {
    label: 'Safe Spot',
    icon: '✅',
    color: '#22c55e',
    description: 'Open business, safe gathering place'
  },
  loitering: {
    label: 'Loitering / Suspicious',
    icon: '👁️',
    color: '#a855f7',
    description: 'Suspicious activity observed'
  }
};
