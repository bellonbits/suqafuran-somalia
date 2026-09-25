/**
 * Somali Markets Database
 * Used for shop location filtering and display across Somalia
 */

export const SOMALI_MARKETS = [
  // Mogadishu (Muqdisho)
  "Bakaara Market (Mogadishu)",
  "Suuq Bacaad (Mogadishu)",
  "Hamar Weyne Market (Mogadishu)",
  "Madina Market (Mogadishu)",
  "Suuqa Degmada Wadajir (Mogadishu)",
  "Suuqa KM4 (Mogadishu)",
  "Suuqa Bulo Xuubey (Mogadishu)",

  // Hargeisa (Hargeysa)
  "Waaheen Market (Hargeisa)",
  "Gobanimo Market (Hargeisa)",
  "Suuqa Hoose (Hargeisa)",
  "Suuqa Daami (Hargeisa)",

  // Bosaso (Boosaaso)
  "Suuqa Weyn (Bosaso)",
  "Suuqa Bander Qassim (Bosaso)",
  "Suuqa Xaafada New Bosaso",

  // Garowe (Garoowe)
  "Suuqa Xero Dayax (Garowe)",
  "Suuqa Bartamaha (Garowe)",
  "Suuqa Gambool (Garowe)",

  // Kismayo (Kismaayo)
  "Suuqa Calanley (Kismayo)",
  "Suuqa Farjano (Kismayo)",
  "Suuqa Guulwade (Kismayo)",

  // Baidoa (Baydhabo)
  "Suuqa Isha (Baidoa)",
  "Suuqa Dhexe (Baidoa)",
  "Suuqa Berdale (Baidoa)",

  // Galkayo (Gaalkacyo)
  "Suuqa Israac (Galkayo)",
  "Suuqa Garsoor (Galkayo)",

  // Berbera
  "Suuqa Dekedda (Berbera)",
  "Suuqa Bartamaha (Berbera)",

  // Burao (Burco)
  "Suuqa Burao (Burco)",
  "Suuqa Xoolaha (Burco)",

  // Beledweyne
  "Suuqa Buundo Weyn (Beledweyne)",
  "Suuqa Howlwadaag (Beledweyne)",
] as const;

// Backwards compatibility alias
export const KENYAN_MARKETS = SOMALI_MARKETS;

export type Market = typeof SOMALI_MARKETS[number];

export const DEFAULT_MARKET: Market = "Bakaara Market (Mogadishu)";

export const MARKETS_SORTED = [...SOMALI_MARKETS].sort();

export const MARKET_TO_CITY: Record<Market, string> = {
  // Mogadishu
  "Bakaara Market (Mogadishu)": "Mogadishu",
  "Suuq Bacaad (Mogadishu)": "Mogadishu",
  "Hamar Weyne Market (Mogadishu)": "Mogadishu",
  "Madina Market (Mogadishu)": "Mogadishu",
  "Suuqa Degmada Wadajir (Mogadishu)": "Mogadishu",
  "Suuqa KM4 (Mogadishu)": "Mogadishu",
  "Suuqa Bulo Xuubey (Mogadishu)": "Mogadishu",

  // Hargeisa
  "Waaheen Market (Hargeisa)": "Hargeisa",
  "Gobanimo Market (Hargeisa)": "Hargeisa",
  "Suuqa Hoose (Hargeisa)": "Hargeisa",
  "Suuqa Daami (Hargeisa)": "Hargeisa",

  // Bosaso
  "Suuqa Weyn (Bosaso)": "Bosaso",
  "Suuqa Bander Qassim (Bosaso)": "Bosaso",
  "Suuqa Xaafada New Bosaso": "Bosaso",

  // Garowe
  "Suuqa Xero Dayax (Garowe)": "Garowe",
  "Suuqa Bartamaha (Garowe)": "Garowe",
  "Suuqa Gambool (Garowe)": "Garowe",

  // Kismayo
  "Suuqa Calanley (Kismayo)": "Kismayo",
  "Suuqa Farjano (Kismayo)": "Kismayo",
  "Suuqa Guulwade (Kismayo)": "Kismayo",

  // Baidoa
  "Suuqa Isha (Baidoa)": "Baidoa",
  "Suuqa Dhexe (Baidoa)": "Baidoa",
  "Suuqa Berdale (Baidoa)": "Baidoa",

  // Galkayo
  "Suuqa Israac (Galkayo)": "Galkayo",
  "Suuqa Garsoor (Galkayo)": "Galkayo",

  // Berbera
  "Suuqa Dekedda (Berbera)": "Berbera",
  "Suuqa Bartamaha (Berbera)": "Berbera",

  // Burao
  "Suuqa Burao (Burco)": "Burao",
  "Suuqa Xoolaha (Burco)": "Burao",

  // Beledweyne
  "Suuqa Buundo Weyn (Beledweyne)": "Beledweyne",
  "Suuqa Howlwadaag (Beledweyne)": "Beledweyne",
};

export function getMarketsByCity(city: string): Market[] {
  return SOMALI_MARKETS.filter((market) => MARKET_TO_CITY[market] === city);
}

export function getCities(): string[] {
  return [...new Set(Object.values(MARKET_TO_CITY))].sort();
}
