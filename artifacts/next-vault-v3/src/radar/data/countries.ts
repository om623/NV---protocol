// ISO 3166-1 numeric -> alpha-2 (the ids used by world-atlas), plus continent grouping.
// Names are NOT stored here: they come from Intl.DisplayNames in the active language.

import type { Continent } from '../types';

const NUMERIC_TO_A2 =
  '004AF008AL010AQ012DZ016AS020AD024AO028AG031AZ032AR036AU040AT044BS048BH050BD051AM052BB056BE060BM064BT068BO070BA072BW076BR084BZ086IO090SB092VG096BN100BG104MM108BI112BY116KH120CM124CA132CV136KY140CF144LK148TD152CL156CN158TW170CO174KM175YT178CG180CD184CK188CR191HR192CU196CY203CZ204BJ208DK212DM214DO218EC222SV226GQ231ET232ER233EE234FO238FK239GS242FJ246FI248AX250FR254GF258PF260TF262DJ266GA268GE270GM275PS276DE288GH292GI296KI300GR304GL308GD312GP316GU320GT324GN328GY332HT334HM336VA340HN344HK348HU352IS356IN360ID364IR368IQ372IE376IL380IT384CI388JM392JP398KZ400JO404KE408KP410KR414KW417KG418LA422LB426LS428LV430LR434LY438LI440LT442LU446MO450MG454MW458MY462MV466ML470MT474MQ478MR480MU484MX492MC496MN498MD499ME500MS504MA508MZ512OM516NA520NR524NP528NL531CW533AW534SX540NC548VU554NZ558NI562NE566NG570NU574NF578NO580MP581UM583FM584MH585PW586PK591PA598PG600PY604PE608PH612PN616PL620PT624GW626TL630PR634QA638RE642RO643RU646RW652BL654SH659KN660AI662LC663MF666PM670VC674SM678ST682SA686SN688RS690SC694SL702SG703SK704VN705SI706SO710ZA716ZW724ES728SS729SD732EH740SR748SZ752SE756CH760SY762TJ764TH768TG772TK776TO780TT784AE788TN792TR795TM796TC798TV800UG804UA807MK818EG826GB831GG832JE833IM834TZ840US850VI854BF858UY860UZ862VE876WF882WS887YE894ZM';

const numericMap = new Map<string, string>();
for (let i = 0; i < NUMERIC_TO_A2.length; i += 5) {
  numericMap.set(NUMERIC_TO_A2.slice(i, i + 3), NUMERIC_TO_A2.slice(i + 3, i + 5));
}

/** All alpha-2 codes that exist as sovereign / territory entries in the geodata. */
export const KNOWN_A2: Set<string> = new Set(numericMap.values());

/** world-atlas feature id (e.g. "076", or 76 as a number) -> alpha-2 */
export function a2FromNumeric(id: string | number | undefined): string | null {
  if (id === undefined || id === null) return null;
  const key = String(id).padStart(3, '0');
  return numericMap.get(key) ?? null;
}

const GROUPS: Record<Exclude<Continent, 'AS'>, string> = {
  NA: 'US CA MX GT BZ HN SV NI CR PA CU JM HT DO BS BB TT AG DM GD KN LC VC BM GL PR VI KY TC AI MS VG AW CW SX BL MF GP MQ PM',
  SA: 'AR BO BR CL CO EC GY PY PE SR UY VE FK GF GS',
  EU: 'AL AD AT BY BE BA BG HR CY CZ DK EE FO FI FR DE GI GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA AX GG JE IM',
  ME: 'AE BH IR IQ IL JO KW LB OM PS QA SA SY TR YE',
  AF: 'DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW SH',
  OC: 'AU NZ PG FJ SB VU NC PF WS TO KI FM MH PW NR TV CK NU TK WF AS GU MP PN NF UM',
  AN: 'AQ',
};

const continentMap = new Map<string, Continent>();
for (const [cont, list] of Object.entries(GROUPS)) {
  for (const a2 of list.split(' ')) continentMap.set(a2, cont as Continent);
}

/** Anything not listed explicitly (the rest of Asia) falls back to AS. */
export function continentOf(a2: string): Continent {
  return continentMap.get(a2) ?? 'AS';
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();

/** Localised country name; falls back to the code if the runtime cannot resolve it. */
export function countryName(a2: string, bcp47: string): string {
  try {
    let dn = displayNamesCache.get(bcp47);
    if (!dn) {
      dn = new Intl.DisplayNames([bcp47], { type: 'region' });
      displayNamesCache.set(bcp47, dn);
    }
    return dn.of(a2) ?? a2;
  } catch {
    return a2;
  }
}

/** Flag emoji are intentionally NOT used in the UI; this returns the alpha-2 for badges. */
export function isKnownCountry(a2: string): boolean {
  return continentMap.has(a2) || a2.length === 2;
}
