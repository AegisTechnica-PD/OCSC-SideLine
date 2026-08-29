// Matches the Soccer Smarts palette: near-black pitch, chalk text, red accent.
// Token names are kept from v1 so pages don't change: "chalk" is the page
// background, "ink" is the primary text / primary-button fill.
export const C = {
  chalk: "#1B1B1F",                  // page background
  panel: "#151518",
  deep: "#0C0C0E",
  ink: "#FAFAF8",                    // text, primary button fill
  slate: "rgba(250,250,248,0.55)",   // dim text
  mist: "rgba(250,250,248,0.22)",    // borders
  amber: "#E01F2D",                  // accent: numbers, GOAL, selection
  red: "#E01F2D",                    // danger
  grass: "#151518",                  // pitch
  grassDeep: "#101013",
  win: "#4CC26B",
};
export const font = {
  display: "'Lilita One','Barlow Condensed','Arial Narrow',Impact,sans-serif",
  body: "'Nunito',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
};
export const sBtn = { border: `1.5px solid ${C.mist}`, background: "transparent", color: C.ink, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 800, fontFamily: font.body, cursor: "pointer" };
export const inp = { border: `1.5px solid ${C.mist}`, borderRadius: 8, padding: "8px 10px", fontSize: 15, background: C.deep, color: C.ink, fontFamily: font.body, fontWeight: 700 };
export const h2 = { fontFamily: font.display, fontWeight: 400, fontSize: 20, letterSpacing: 1, margin: "16px 0 6px", color: C.ink };
