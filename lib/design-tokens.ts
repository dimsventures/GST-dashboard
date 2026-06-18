export const tokens = {
  colors: {
    bg: {
      base: '#f5f4f2',
      surface: '#eeedeb',
      white: '#ffffff',
    },
    border: {
      default: '#e4e2de',
      strong: '#d0cdc8',
    },
    text: {
      primary: '#1a1a1a',
      secondary: '#4a4a4a',
      muted: '#888888',
      faint: '#c0bdb8',
    },
    accent: {
      red: '#d12b2b',       // GST brand red — exact dari codebase
      redDark: '#b32222',
      redBg: '#fef2f2',
      redBorder: '#fad4d4',
    },
    black: '#111111',
    semantic: {
      green: '#15a34a',
      greenBg: '#f0fdf4',
      greenBorder: '#bbf7d0',
      gold: '#c9841a',
      goldBg: '#fffbf0',
      goldBorder: '#f0d88a',
      blue: '#2563eb',
      blueBg: '#eff6ff',
    },
    dark: {
      bg: '#141414',
      surface: '#252525',
      white: '#1e1e1e',
      border: '#2e2e2e',
      borderStrong: '#3d3d3d',
      text: '#e8e6e3',
      textSecondary: '#9a9794',
      textMuted: '#5a5752',
    },
  },
  radius: {
    sm: '5px',
    md: '8px',
    lg: '10px',
    xl: '12px',
  },
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,.06)',
    md: '0 4px 12px rgba(0,0,0,.08)',
  },
  spacing: {
    sidebarWidth: '200px',
    sidebarCollapsed: '60px',
    topbarHeight: '52px',
  },
  font: {
    sans: 'var(--font-inter), Inter, system-ui, sans-serif',
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
} as const

export type Tokens = typeof tokens
