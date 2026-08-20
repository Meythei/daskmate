// Monotone stand-ins for Google Calendar's fixed event colorId palette, used
// only for rendering existing (non-template) events fetched from the API.
export const googleColorIdToHex: Record<string, string> = {
  "1": "#d4d4d8",
  "2": "#a1a1aa",
  "3": "#71717a",
  "4": "#c4c4c9",
  "5": "#9a9aa2",
  "6": "#8a8a92",
  "7": "#b4b4bc",
  "8": "#52525b",
  "9": "#e4e4e7",
  "10": "#7a7a82",
  "11": "#5f5f68",
};

export function eventColor(colorId?: string | null): string {
  if (colorId && googleColorIdToHex[colorId]) return googleColorIdToHex[colorId];
  return "#a1a1aa";
}
