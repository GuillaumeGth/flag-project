// 🎨 Flag App - Neo-Cartographic Theme
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

  // === Primary Palette (Violet + Cyan exploration theme) ===
  primary: {
    violet: '#7C5CFC',       // Your signature violet
    violetLight: '#9B7FFF',
    violetDark: '#6344E8',
    cyan: '#00E5FF',         // Discovery/active state
    cyanLight: '#5FF3FF',
    cyanDark: '#00B8D4',
    magenta: '#FF00E5',      // Accent for special moments
  },

  // === Gradients (for backgrounds, buttons, highlights) ===
  gradients: {
    primary: ['#7C5CFC', '#00E5FF'] as const,           // Violet to cyan
    discovery: ['#FF00E5', '#7C5CFC', '#00E5FF'] as const, // Magenta > violet > cyan
    subtle: ['#1A1A28', '#12121D'] as const,            // Subtle depth
    glow: ['rgba(124, 92, 252, 0.3)', 'rgba(0, 229, 255, 0.3)'] as const, // Soft glow
    topographic: ['#0A0A12', '#1A1A28', '#0A0A12'] as const, // Contour lines effect
  },

  // === Semantic Colors ===
  success: '#00E676',       // Bright green for discoveries
  warning: '#FFB300',       // Amber for proximity alerts
  error: '#FF3D71',         // Vibrant red
  info: '#00E5FF',          // Cyan for information

  // === Text Hierarchy ===
  text: {
    primary: '#FFFFFF',
    secondary: '#B8B8D0',    // Slightly purple-tinted gray
    tertiary: '#7A7A95',     // Muted
    disabled: '#4A4A5C',
    accent: '#00E5FF',       // Cyan for highlighted text
  },

  // === Borders & Dividers ===
  border: {
    default: 'rgba(124, 92, 252, 0.15)',  // Subtle violet tint
    light: 'rgba(255, 255, 255, 0.08)',
    accent: 'rgba(0, 229, 255, 0.3)',     // Cyan glow
    glow: 'rgba(124, 92, 252, 0.4)',      // Glowing borders
  },

  // === Overlays & Shadows ===
  overlay: {
    light: 'rgba(0, 0, 0, 0.3)',
    medium: 'rgba(0, 0, 0, 0.6)',
    dark: 'rgba(0, 0, 0, 0.85)',
  },

  // === Special Effects ===
  glow: {
    violet: '#7C5CFC',
    cyan: '#00E5FF',
    magenta: '#FF00E5',
    white: '#FFFFFF',
  },

  // === Message States ===
  message: {
    sent: '#7C5CFC',
    received: 'rgba(30, 30, 45, 0.7)',
    undiscovered: 'rgba(255, 0, 229, 0.2)',  // Magenta tint
    discovered: 'rgba(0, 229, 255, 0.2)',     // Cyan tint
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
    shadowColor: colors.primary.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  glowViolet: {
    shadowColor: colors.primary.violet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
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
