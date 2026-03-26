// 🎨 Fläag App - Neo-Cartographic Theme
// Direction: Premium exploration & discovery with holographic elements

export const colors = {
  // === Backgrounds ===
  background: {
    primary: '#0A0A12',      // Deep space black
    secondary: '#12121D',    // Slightly lighter
    tertiary: '#1A1A28',     // Surface elevation
  },

  // === Surfaces (Glassmorphism) ===
  surface: {
    glass: 'rgba(30, 30, 45, 0.7)',        // Main glass surface
    glassLight: 'rgba(42, 42, 60, 0.5)',   // Lighter glass
    glassDark: 'rgba(20, 20, 32, 0.85)',   // Darker, more opaque
    elevated: '#1E1E2D',                    // Solid elevated surface
  },

  // === Primary Palette (Purple theme) ===
  primary: {
    violet: '#A78BFA',       // Medium purple
    violetLight: '#C4B5FD',
    violetDark: '#7C3AED',
    cyan: '#A78BFA',         // Medium purple (main action color)
    cyanLight: '#C4B5FD',
    cyanDark: '#7C3AED',
    magenta: '#D8B4FE',      // Light lavender accent
  },

  // === Gradients (for backgrounds, buttons, highlights) ===
  gradients: {
    button: ['#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6'] as const, // Button gradient (5-stop purple)
    primary: ['#A78BFA', '#7C3AED'] as const,           // Purple gradient
    discovery: ['#D8B4FE', '#A78BFA', '#7C3AED'] as const, // Lavender > purple > deep purple
    heroButton: ['#F3E8FF', '#E9D5FF', '#D8B4FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED'] as const, // Ultra-vibrant purple cascade
    subtle: ['#1A1A28', '#12121D'] as const,            // Subtle depth
    glow: ['rgba(167, 139, 250, 0.3)', 'rgba(124, 58, 237, 0.3)'] as const, // Purple glow
    glowIntense: ['rgba(216, 180, 254, 0.6)', 'rgba(167, 139, 250, 0.6)', 'rgba(124, 58, 237, 0.8)'] as const, // Intense purple glow
    topographic: ['#0A0A12', '#1A1A28', '#0A0A12'] as const, // Contour lines effect
  },

  // === Semantic Colors ===
  success: '#5FD68A',       // Vibrant green for discoveries
  warning: '#FFA94D',       // Amber for proximity alerts
  error: '#FF5C7C',         // Rose-red
  info: '#A78BFA',          // Purple for information

  // === Text Hierarchy ===
  text: {
    primary: '#FFFFFF',
    secondary: '#B8B8D0',    // Slightly purple-tinted gray
    tertiary: '#7A7A95',     // Muted purple-gray
    disabled: '#4A4A5C',
    accent: '#A78BFA',       // Purple for highlighted text
  },

  // === Borders & Dividers ===
  border: {
    default: 'rgba(167, 139, 250, 0.2)',   // Purple tint
    light: 'rgba(255, 255, 255, 0.08)',
    accent: 'rgba(167, 139, 250, 0.4)',    // Purple glow
    glow: 'rgba(167, 139, 250, 0.45)',     // Strong purple borders
  },

  // === Overlays & Shadows ===
  overlay: {
    light: 'rgba(0, 0, 0, 0.3)',
    medium: 'rgba(0, 0, 0, 0.6)',
    dark: 'rgba(0, 0, 0, 0.85)',
  },

  // === Special Effects ===
  glow: {
    violet: '#A78BFA',
    cyan: '#A78BFA',
    magenta: '#D8B4FE',
    white: '#FFFFFF',
  },

  // === Message States ===
  message: {
    sent: '#3c2f63',
    received: 'rgba(30, 30, 45, 0.7)',
    undiscovered: 'rgba(216, 180, 254, 0.25)',  // Lavender tint
    discovered: 'rgba(167, 139, 250, 0.25)',    // Purple tint
  },
};

// === Shadow Presets ===
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  glowViolet: {
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5,
  },
};

// === Border Radius ===
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

// === Spacing System ===
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// === Typography ===
export const typography = {
  // For React Native, these would be font families you'd need to load
  // Consider using: SF Pro Display (iOS), Google Sans Display, or Outfit
  display: {
    fontFamily: 'System', // Replace with loaded font
    fontWeight: '700' as const,
  },
  heading: {
    fontFamily: 'System', // Replace with loaded font
    fontWeight: '600' as const,
  },
  body: {
    fontFamily: 'System',
    fontWeight: '400' as const,
  },
  mono: {
    fontFamily: 'Menlo', // For coordinates, technical info
    fontWeight: '400' as const,
  },

  // Size scale
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 40,
  },
};

// === Scrollbar ===
export const scrollbar = {
  /** Gradient colors du thumb (vertical, top→bottom) */
  gradient: ['rgba(124, 92, 252, 0.85)', 'rgba(0, 200, 255, 0.7)'] as const,
  /** Couleur du track (fond de la scrollbar) */
  trackColor: 'rgba(255,255,255,0.06)' as const,
  /** Largeur du track et du thumb (px) */
  width: 3,
  /** Border radius du track et du thumb */
  borderRadius: 2,
  /** Marge intérieure par rapport aux bords du container (px) */
  inset: 4,
  /** Hauteur minimale du thumb (px) */
  minThumbHeight: 36,
};

// === Animation Durations ===
export const duration = {
  fast: 150,
  normal: 250,
  slow: 350,
  verySlow: 500,
};

// === Blur Values (for glassmorphism) ===
export const blur = {
  sm: 10,
  md: 20,
  lg: 30,
  xl: 40,
};
