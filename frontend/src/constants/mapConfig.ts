/**
 * Map presentation constants, extracted from MapScreen.
 *
 * These are pure data with no dependency on component state, so keeping them in
 * the 7k-line screen file only made that file harder to navigate. Markers and
 * list rows both read from here, which also stops the two drifting apart.
 */

export const PIN_ICONS: Record<string, string> = {
  bathroom: 'water-outline',
  food: 'restaurant-outline',
  pharmacy: 'medical-outline',
  study: 'book-outline',
  coffee: 'cafe-outline',
  parking: 'car-outline',
  safe_walk: 'walk-outline',
  open_late: 'time-outline',
  default: 'location-outline',
};

export const PIN_TYPE_COLORS: Record<string, string> = {
  bathroom: '#3B82F6',
  food: '#F97316',
  pharmacy: '#EF4444',
  study: '#8B5CF6',
  coffee: '#92400E',
  parking: '#6B7280',
  safe_walk: '#10B981',
  open_late: '#F59E0B',
  default: '#3DDC91',
};

export const EVENT_ICONS: Record<string, string> = {
  social: 'people-outline',
  academic: 'school-outline',
  sports: 'fitness-outline',
  club: 'flag-outline',
  party: 'beer-outline',
  music: 'musical-notes-outline',
  other: 'calendar-outline',
};

export const REPORT_ICONS: Record<string, string> = {
  hazard: 'warning-outline',
  food_status: 'restaurant-outline',
  campus_update: 'school-outline',
  safety: 'shield-outline',
  accessibility: 'accessibility-outline',
};

export const REPORT_ICON_DEFAULT = 'flag-outline';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
}

/**
 * The full set of quick actions. `selectQuickActions` narrows this to the few
 * worth surfacing — showing all six gave every action equal weight, so none of
 * them read as the primary path.
 */
export const ALL_QUICK_ACTIONS: QuickAction[] = [
  { id: 'active_reports', label: 'Active Reports', icon: 'warning-outline' },
  { id: 'food_open', label: 'Food Open Now', icon: 'restaurant-outline' },
  { id: 'events_today', label: 'Events Today', icon: 'calendar-outline' },
  { id: 'saved', label: 'Saved Places', icon: 'bookmark-outline' },
  { id: 'add_report', label: 'Add Report', icon: 'flag-outline' },
  { id: 'friends', label: 'Friends Nearby', icon: 'people-outline' },
];

const byId = (id: string): QuickAction =>
  ALL_QUICK_ACTIONS.find((a) => a.id === id) ?? ALL_QUICK_ACTIONS[0];

/**
 * Choose three quick actions based on context, most relevant first.
 *
 * Time of day drives most of it: food at meal times, events in the evening,
 * safety-oriented actions late at night. Users with saved places get quicker
 * access to them; users without are nudged toward contributing instead.
 */
export function selectQuickActions(options: {
  /** 0-23, in the user's local time. */
  hour: number;
  hasSavedPlaces: boolean;
  hasActiveReports: boolean;
}): QuickAction[] {
  const { hour, hasSavedPlaces, hasActiveReports } = options;
  const picks: string[] = [];

  // Anything happening right now outranks everything else.
  if (hasActiveReports) picks.push('active_reports');

  const isMealTime = (hour >= 7 && hour < 10) || (hour >= 11 && hour < 14) || (hour >= 17 && hour < 21);
  const isEvening = hour >= 16 && hour < 23;
  const isLateNight = hour >= 23 || hour < 5;

  if (isLateNight) {
    // Late night is when the safety-oriented surface matters most.
    push(picks, 'active_reports');
    push(picks, 'friends');
    push(picks, 'food_open');
  } else if (isMealTime) {
    push(picks, 'food_open');
    push(picks, isEvening ? 'events_today' : 'saved');
  } else if (isEvening) {
    push(picks, 'events_today');
    push(picks, 'food_open');
  } else {
    push(picks, 'saved');
    push(picks, 'events_today');
  }

  if (hasSavedPlaces) push(picks, 'saved');
  push(picks, 'add_report');
  push(picks, 'friends');

  return picks.slice(0, 3).map(byId);
}

function push(list: string[], id: string) {
  if (!list.includes(id)) list.push(id);
}
