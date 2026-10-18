/** The six geopolitical zones NCDC reports by. */
export const ZONES: Record<string, string[]> = {
  "North West": ["Kaduna", "Sokoto", "Katsina", "Kano", "Kebbi", "Zamfara", "Jigawa"],
  "North East": ["Borno", "Adamawa", "Bauchi", "Gombe", "Taraba", "Yobe"],
  "North Central": ["Benue", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau", "FCT"],
  "South West": ["Ondo", "Lagos", "Ogun", "Osun", "Oyo", "Ekiti"],
  "South East": ["Enugu", "Abia", "Anambra", "Ebonyi", "Imo"],
  "South South": ["Edo", "Rivers", "Akwa Ibom", "Bayelsa", "Cross River", "Delta"],
};

/** ISO 3166-2:NG codes, used to reference a state's situation report. */
const STATE_CODES: Record<string, string> = {
  Abia: "AB", Adamawa: "AD", "Akwa Ibom": "AK", Anambra: "AN", Bauchi: "BA", Bayelsa: "BY",
  Benue: "BE", Borno: "BO", "Cross River": "CR", Delta: "DE", Ebonyi: "EB", Edo: "ED",
  Ekiti: "EK", Enugu: "EN", FCT: "FC", Gombe: "GO", Imo: "IM", Jigawa: "JI", Kaduna: "KD",
  Kano: "KN", Katsina: "KT", Kebbi: "KE", Kogi: "KO", Kwara: "KW", Lagos: "LA",
  Nasarawa: "NA", Niger: "NI", Ogun: "OG", Ondo: "ON", Osun: "OS", Oyo: "OY", Plateau: "PL",
  Rivers: "RI", Sokoto: "SO", Taraba: "TA", Yobe: "YO", Zamfara: "ZA",
};

/** A state's code. A name not on the list — a DHIS2 spelling, say — falls back to its first letters. */
export function stateCode(state: string): string {
  return STATE_CODES[state] ?? state.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
