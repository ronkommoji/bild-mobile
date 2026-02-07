export const LightTheme = {
  background: '#FFFDF1',
  surface: '#FFFFFF',
  accent: '#FFCE99',
  primary: '#FF9644',
  text: '#562F00',
  textLight: '#8B6914',
  textMuted: '#A08050',
  white: '#FFFFFF',
  border: '#E8DCC8',
  success: '#4CAF50',
  error: '#E53935',
  warning: '#FF9800',
  blocked: '#E53935',
  inProgress: '#2196F3',
  cardBg: '#FFFFFF',
  shadow: 'rgba(86, 47, 0, 0.08)',
  inputBg: '#FFFFFF',
  tabBar: '#FFFFFF',
  modalBg: '#FFFDF1',
  projectActiveItem: '#FFF5EB',
};

export const DarkTheme = {
  background: '#1A1310',
  surface: '#2A2118',
  accent: '#5C4428',
  primary: '#FF9644',
  text: '#F5E6D3',
  textLight: '#C9AD8A',
  textMuted: '#8A7560',
  white: '#FFFFFF',
  border: '#3D3028',
  success: '#66BB6A',
  error: '#EF5350',
  warning: '#FFA726',
  blocked: '#EF5350',
  inProgress: '#42A5F5',
  cardBg: '#2A2118',
  shadow: 'rgba(0, 0, 0, 0.3)',
  inputBg: '#2A2118',
  tabBar: '#221A13',
  modalBg: '#1A1310',
  projectActiveItem: '#3D3028',
};

export type ThemeColors = typeof LightTheme;

// Keep a static reference for non-hook usage
export const Colors = LightTheme;

export const Priorities = {
  high: { color: '#E53935', bg: '#FFEBEE', label: 'High' },
  medium: { color: '#FF9800', bg: '#FFF3E0', label: 'Medium' },
  low: { color: '#4CAF50', bg: '#E8F5E9', label: 'Low' },
};

export const DarkPriorities = {
  high: { color: '#EF5350', bg: '#3D1A1A', label: 'High' },
  medium: { color: '#FFA726', bg: '#3D2E1A', label: 'Medium' },
  low: { color: '#66BB6A', bg: '#1A3D1A', label: 'Low' },
};

export const StatusColors = {
  pending: { color: '#9E9E9E', bg: '#F5F5F5', label: 'Pending' },
  in_progress: { color: '#2196F3', bg: '#E3F2FD', label: 'In Progress' },
  blocked: { color: '#E53935', bg: '#FFEBEE', label: 'Blocked' },
  completed: { color: '#4CAF50', bg: '#E8F5E9', label: 'Completed' },
};

export const DarkStatusColors = {
  pending: { color: '#9E9E9E', bg: '#2A2A2A', label: 'Pending' },
  in_progress: { color: '#42A5F5', bg: '#1A2A3D', label: 'In Progress' },
  blocked: { color: '#EF5350', bg: '#3D1A1A', label: 'Blocked' },
  completed: { color: '#66BB6A', bg: '#1A3D1A', label: 'Completed' },
};
