// Company directory seed.
//
// Only STABLE facts live here: official name, headquarters country/city, sector,
// editorial size class and listing symbol. Every figure (revenue, profit, market
// cap, employees, prices, news) is fetched live from public sources and carries
// its own source and date. Nothing financial is hardcoded.
//
// Row: id | official name | country | city | sector | size (M mega, L large, G growth) | TICKER:EXCHANGE | US ticker for SEC filings
// Empty ticker = not publicly traded (private or state-owned parent).

import type { CompanySeed, SectorId, SizeClass } from '../types';
import { CITIES, CITY_NAMES } from './cities';
import { VERIFIED } from './verified';

const TABLE = `
apple|Apple Inc.|US|cupertino|tech|M|AAPL:NASDAQ
microsoft|Microsoft|US|redmond|tech|M|MSFT:NASDAQ
nvidia|NVIDIA|US|santaclara|semis|M|NVDA:NASDAQ
alphabet|Alphabet Inc.|US|mountainview|tech|M|GOOGL:NASDAQ
amazon|Amazon|US|seattle|retail|M|AMZN:NASDAQ
meta|Meta Platforms|US|menlopark|tech|M|META:NASDAQ
tesla|Tesla, Inc.|US|austin|auto|M|TSLA:NASDAQ
broadcom|Broadcom|US|paloalto|semis|M|AVGO:NASDAQ
oracle|Oracle Corporation|US|austin|tech|L|ORCL:NYSE
salesforce|Salesforce|US|sanfrancisco|tech|L|CRM:NYSE
amd|Advanced Micro Devices|US|santaclara|semis|L|AMD:NASDAQ
intel|Intel|US|santaclara|semis|L|INTC:NASDAQ
qualcomm|Qualcomm|US|sandiego|semis|L|QCOM:NASDAQ
micron|Micron Technology|US|boise|semis|L|MU:NASDAQ
palantir|Palantir Technologies|US|denver|ai|L|PLTR:NASDAQ
snowflake|Snowflake Inc.|US|bozeman|tech|G|SNOW:NYSE
crowdstrike|CrowdStrike|US|austin|tech|G|CRWD:NASDAQ
openai|OpenAI|US|sanfrancisco|ai|L|
anthropic|Anthropic|US|sanfrancisco|ai|G|
databricks|Databricks|US|sanfrancisco|ai|G|
spacex|SpaceX|US|starbase|aerospace|L|
exxon|ExxonMobil|US|springtx|oilgas|M|XOM:NYSE
chevron|Chevron Corporation|US|houston|oilgas|M|CVX:NYSE
nextera|NextEra Energy|US|junobeach|energy|L|NEE:NYSE
firstsolar|First Solar|US|tempe|renewables|G|FSLR:NASDAQ
freeport|Freeport-McMoRan|US|phoenix|mining|L|FCX:NYSE
newmont|Newmont Corporation|US|denver|mining|L|NEM:NYSE
deere|Deere & Company|US|moline|agri|L|DE:NYSE
adm|Archer-Daniels-Midland|US|chicago|agri|L|ADM:NYSE
cargill|Cargill|US|minnetonka|agri|L|
ford|Ford Motor Company|US|dearborn|auto|L|F:NYSE
gm|General Motors|US|detroit|auto|L|GM:NYSE
boeing|Boeing|US|arlington|aerospace|L|BA:NYSE
lockheed|Lockheed Martin|US|bethesda|defense|L|LMT:NYSE
rtx|RTX Corporation|US|arlington|defense|L|RTX:NYSE
northrop|Northrop Grumman|US|fallschurch|defense|L|NOC:NYSE
caterpillar|Caterpillar Inc.|US|irving|heavy|L|CAT:NYSE
koch|Koch Industries|US|wichita|heavy|L|
jnj|Johnson & Johnson|US|newbrunswick|health|M|JNJ:NYSE
pfizer|Pfizer|US|newyork|pharma|L|PFE:NYSE
lilly|Eli Lilly and Company|US|indianapolis|pharma|M|LLY:NYSE
moderna|Moderna|US|cambridgema|biotech|G|MRNA:NASDAQ
amgen|Amgen|US|thousandoaks|biotech|L|AMGN:NASDAQ
unitedhealth|UnitedHealth Group|US|minnetonka|health|M|UNH:NYSE
jpmorgan|JPMorgan Chase|US|newyork|finance|M|JPM:NYSE
visa|Visa Inc.|US|sanfrancisco|finance|M|V:NYSE
berkshire|Berkshire Hathaway|US|omaha|insurance|M|BRK-B:NYSE
prologis|Prologis|US|sanfrancisco|realestate|L|PLD:NYSE
walmart|Walmart|US|bentonville|retail|M|WMT:NYSE
costco|Costco|US|issaquah|retail|L|COST:NASDAQ
cocacola|The Coca-Cola Company|US|atlanta|food|L|KO:NYSE
pepsico|PepsiCo|US|purchase|food|L|PEP:NASDAQ
marriott|Marriott International|US|bethesda|tourism|L|MAR:NASDAQ
airbnb|Airbnb|US|sanfrancisco|tourism|L|ABNB:NASDAQ
booking|Booking Holdings|US|norwalk|tourism|L|BKNG:NASDAQ
ups|United Parcel Service|US|atlanta|logistics|L|UPS:NYSE
fedex|FedEx|US|memphis|logistics|L|FDX:NYSE
unionpacific|Union Pacific|US|omaha|transport|L|UNP:NYSE
delta|Delta Air Lines|US|atlanta|transport|L|DAL:NYSE
uber|Uber|US|sanfrancisco|transport|L|UBER:NYSE
att|AT&T|US|dallas|telecom|L|T:NYSE
verizon|Verizon|US|newyork|telecom|L|VZ:NYSE
wm|Waste Management|US|houston|sanitation|L|WM:NYSE
fluor|Fluor Corporation|US|irving|construction|G|FLR:NYSE
bechtel|Bechtel|US|reston|construction|L|
coursera|Coursera|US|mountainview|education|G|COUR:NYSE
duolingo|Duolingo|US|pittsburgh|education|G|DUOL:NASDAQ
accenture|Accenture|IE|dublin|bizservices|L|ACN:NYSE
shopify|Shopify|CA|ottawa|tech|L|SHOP:NASDAQ
rbc|Royal Bank of Canada|CA|toronto|finance|L|RY:NYSE
enbridge|Enbridge|CA|calgary|oilgas|L|ENB:NYSE
nutrien|Nutrien|CA|saskatoon|agri|L|NTR:NYSE
cnr|Canadian National Railway|CA|montreal|transport|L|CNI:NYSE
brookfield|Brookfield Corporation|CA|toronto|finance|L|BN:NYSE
bombardier|Bombardier|CA|montreal|aerospace|G|BBD-B:TSX
lululemon|Lululemon Athletica|CA|vancouver|retail|L|LULU:NASDAQ
americamovil|América Móvil|MX|mexicocity|telecom|L|AMX:NYSE
cemex|Cemex|MX|monterrey|construction|G|CX:NYSE
femsa|FEMSA|MX|monterrey|food|L|FMX:NYSE
gmexico|Grupo México|MX|mexicocity|mining|L|GMEXICOB:BMV
petrobras|Petrobras|BR|riodejaneiro|oilgas|L|PETR4:B3|PBR
vale|Vale S.A.|BR|riodejaneiro|mining|L|VALE3:B3|VALE
itau|Itaú Unibanco|BR|saopaulo|finance|L|ITUB4:B3|ITUB
bradesco|Bradesco|BR|osasco|finance|L|BBDC4:B3|BBD
bancobrasil|Banco do Brasil|BR|brasilia|finance|L|BBAS3:B3
ambev|Ambev|BR|saopaulo|food|L|ABEV3:B3|ABEV
jbs|JBS S.A.|BR|saopaulo|food|L|JBSS3:B3
embraer|Embraer|BR|sjcampos|aerospace|L|EMBR3:B3|ERJ
weg|WEG|BR|jaragua|heavy|L|WEGE3:B3
eletrobras|Eletrobras|BR|riodejaneiro|energy|L|ELET3:B3
sabesp|Sabesp|BR|saopaulo|sanitation|L|SBSP3:B3|SBS
localiza|Localiza|BR|belohorizonte|transport|G|RENT3:B3
nubank|Nu Holdings (Nubank)|BR|saopaulo|finance|L|NU:NYSE
rumo|Rumo|BR|curitiba|logistics|G|RAIL3:B3
magalu|Magazine Luiza|BR|saopaulo|retail|G|MGLU3:B3
natura|Natura &Co|BR|saopaulo|retail|G|NATU3:B3
totvs|TOTVS|BR|saopaulo|tech|G|TOTS3:B3
gerdau|Gerdau|BR|saopaulo|heavy|L|GGBR4:B3|GGB
suzano|Suzano|BR|saopaulo|heavy|L|SUZB3:B3|SUZ
mercadolibre|MercadoLibre|UY|montevideo|retail|L|MELI:NASDAQ
ypf|YPF|AR|buenosaires|oilgas|G|YPF:NYSE
codelco|Codelco|CL|santiago|mining|L|
sqm|SQM|CL|santiago|mining|G|SQM:NYSE
latam|LATAM Airlines Group|CL|santiago|transport|G|LTM:NYSE
ecopetrol|Ecopetrol|CO|bogota|oilgas|L|EC:NYSE
bancolombia|Bancolombia|CO|medellin|finance|G|CIB:NYSE
credicorp|Credicorp|PE|lima|finance|G|BAP:NYSE
asml|ASML|NL|veldhoven|semis|M|ASML:AMS|ASML
sap|SAP SE|DE|walldorf|tech|M|SAP:XETRA|SAP
siemens|Siemens|DE|munich|heavy|M|SIE:XETRA
volkswagen|Volkswagen Group|DE|wolfsburg|auto|L|VOW3:XETRA
bmw|BMW|DE|munich|auto|L|BMW:XETRA
mercedes|Mercedes-Benz Group|DE|stuttgart|auto|L|MBG:XETRA
allianz|Allianz|DE|munich|insurance|L|ALV:XETRA
dtelekom|Deutsche Telekom|DE|bonn|telecom|L|DTE:XETRA
basf|BASF|DE|ludwigshafen|heavy|L|BAS:XETRA
bayer|Bayer|DE|leverkusen|pharma|L|BAYN:XETRA
vonovia|Vonovia|DE|bochum|realestate|L|VNA:XETRA
airbus|Airbus|NL|leiden|aerospace|M|AIR:EPA
total|TotalEnergies|FR|courbevoie|oilgas|L|TTE:EPA|TTE
lvmh|LVMH|FR|paris|retail|M|MC:EPA
loreal|L'Oréal|FR|paris|retail|L|OR:EPA
sanofi|Sanofi|FR|paris|pharma|L|SAN:EPA|SNY
schneider|Schneider Electric|FR|ruelmalmaison|heavy|L|SU:EPA
axa|AXA|FR|paris|insurance|L|CS:EPA
vinci|Vinci|FR|ruelmalmaison|construction|L|DG:EPA
veolia|Veolia|FR|aubervilliers|sanitation|L|VIE:EPA
thales|Thales|FR|paris|defense|L|HO:EPA
mistral|Mistral AI|FR|paris|ai|G|
nestle|Nestlé|CH|vevey|food|M|NESN:SIX
novartis|Novartis|CH|basel|pharma|L|NOVN:SIX|NVS
roche|Roche|CH|basel|pharma|L|ROG:SIX
ubs|UBS Group|CH|zurich|finance|L|UBSG:SIX|UBS
abb|ABB|CH|zurich|heavy|L|ABBN:SIX
zurichins|Zurich Insurance Group|CH|zurich|insurance|L|ZURN:SIX
glencore|Glencore|CH|baar|mining|L|GLEN:LSE
shell|Shell plc|GB|london|oilgas|M|SHEL:LSE|SHEL
bp|BP|GB|london|oilgas|L|BP:LSE|BP
astrazeneca|AstraZeneca|GB|cambridgeuk|pharma|L|AZN:LSE|AZN
hsbc|HSBC Holdings|GB|london|finance|L|HSBA:LSE|HSBC
unilever|Unilever|GB|london|food|L|ULVR:LSE|UL
riotinto|Rio Tinto|GB|london|mining|L|RIO:LSE|RIO
anglo|Anglo American|GB|london|mining|L|AAL:LSE
bae|BAE Systems|GB|farnborough|defense|L|BA:LSE
rollsroyce|Rolls-Royce Holdings|GB|london|aerospace|L|RR:LSE
vodafone|Vodafone Group|GB|newbury|telecom|L|VOD:LSE|VOD
arm|Arm Holdings|GB|cambridgeuk|semis|L|ARM:NASDAQ
pearson|Pearson plc|GB|london|education|G|PSON:LSE|PSO
spotify|Spotify|SE|stockholm|tech|L|SPOT:NYSE
ericsson|Ericsson|SE|stockholm|telecom|L|ERIC-B:STO|ERIC
volvo|Volvo Group|SE|gothenburg|auto|L|VOLV-B:STO
ikea|Inter IKEA Group|NL|delft|retail|L|
novonordisk|Novo Nordisk|DK|bagsvaerd|pharma|M|NOVO-B:CPH|NVO
vestas|Vestas Wind Systems|DK|aarhus|renewables|L|VWS:CPH
orsted|Ørsted|DK|fredericia|renewables|L|ORSTED:CPH
maersk|A.P. Møller–Maersk|DK|copenhagen|logistics|L|MAERSK-B:CPH
equinor|Equinor|NO|stavanger|oilgas|L|EQNR:OSL|EQNR
iberdrola|Iberdrola|ES|bilbao|renewables|L|IBE:BME
inditex|Inditex|ES|arteixo|retail|L|ITX:BME
santander|Banco Santander|ES|madrid|finance|L|SAN:BME|SAN
enel|Enel|IT|rome|energy|L|ENEL:BIT
eni|Eni|IT|rome|oilgas|L|ENI:BIT|E
ferrari|Ferrari N.V.|IT|maranello|auto|L|RACE:NYSE
leonardo|Leonardo S.p.A.|IT|rome|defense|L|LDO:BIT
ing|ING Group|NL|amsterdam|finance|L|INGA:AMS|ING
heineken|Heineken|NL|amsterdam|food|L|HEIA:AMS
orlen|PKN Orlen|PL|plock|oilgas|L|PKN:WSE
cdprojekt|CD Projekt|PL|warsaw|tech|G|CDR:WSE
koc|Koç Holding|TR|istanbul|other|L|KCHOL:IST
thy|Turkish Airlines|TR|istanbul|transport|L|THYAO:IST
aselsan|Aselsan|TR|ankara|defense|G|ASELS:IST
tsmc|TSMC|TW|hsinchu|semis|M|2330:TWSE|TSM
foxconn|Foxconn (Hon Hai Precision)|TW|newtaipei|tech|L|2317:TWSE
mediatek|MediaTek|TW|hsinchu|semis|L|2454:TWSE
samsung|Samsung Electronics|KR|suwon|tech|M|005930:KRX
skhynix|SK hynix|KR|icheon|semis|L|000660:KRX
hyundai|Hyundai Motor Company|KR|seoul|auto|L|005380:KRX
lges|LG Energy Solution|KR|seoul|energy|L|373220:KRX
samsungbio|Samsung Biologics|KR|incheon|biotech|G|207940:KRX
naver|Naver|KR|seongnam|tech|G|035420:KRX
toyota|Toyota Motor Corporation|JP|toyotacity|auto|M|7203:TSE|TM
sony|Sony Group|JP|tokyo|tech|L|6758:TSE|SONY
softbank|SoftBank Group|JP|tokyo|telecom|L|9984:TSE
mhi|Mitsubishi Heavy Industries|JP|tokyo|heavy|L|7011:TSE
tokyoelectron|Tokyo Electron|JP|tokyo|semis|L|8035:TSE
nintendo|Nintendo|JP|kyoto|other|L|7974:TSE
mufg|Mitsubishi UFJ Financial Group|JP|tokyo|finance|L|8306:TSE|MUFG
takeda|Takeda Pharmaceutical|JP|tokyo|pharma|L|4502:TSE|TAK
fastretailing|Fast Retailing|JP|tokyo|retail|L|9983:TSE
nipponsteel|Nippon Steel|JP|tokyo|heavy|L|5401:TSE
jrcentral|Central Japan Railway|JP|nagoya|transport|L|9022:TSE
tencent|Tencent|CN|shenzhen|tech|M|0700:HKEX
alibaba|Alibaba Group|CN|hangzhou|retail|L|9988:HKEX|BABA
baidu|Baidu|CN|beijing|ai|L|9888:HKEX|BIDU
byd|BYD Company|CN|shenzhen|auto|L|1211:HKEX
catl|CATL|CN|ningde|energy|L|300750:SZSE
moutai|Kweichow Moutai|CN|renhuai|food|L|600519:SSE
pingan|Ping An Insurance|CN|shenzhen|insurance|L|2318:HKEX
icbc|ICBC|CN|beijing|finance|L|1398:HKEX
petrochina|PetroChina|CN|beijing|oilgas|L|0857:HKEX
chinamobile|China Mobile|CN|hongkong|telecom|L|0941:HKEX
xiaomi|Xiaomi|CN|beijing|tech|L|1810:HKEX
meituan|Meituan|CN|beijing|retail|L|3690:HKEX
smic|SMIC|CN|shanghai|semis|L|0981:HKEX
comac|COMAC|CN|shanghai|aerospace|L|
huawei|Huawei|CN|shenzhen|telecom|L|
bytedance|ByteDance|CN|beijing|ai|L|
deepseek|DeepSeek|CN|hangzhou|ai|G|
cscec|China State Construction Engineering|CN|beijing|construction|L|601668:SSE
crrc|CRRC|CN|beijing|transport|L|601766:SSE
cosco|COSCO Shipping|CN|shanghai|logistics|L|1919:HKEX
zijin|Zijin Mining|CN|xiamen|mining|L|2899:HKEX
longi|LONGi Green Energy|CN|xian|renewables|G|601012:SSE
aia|AIA Group|HK|hongkong|insurance|L|1299:HKEX
dbs|DBS Group|SG|singapore|finance|L|D05:SGX
singtel|Singtel|SG|singapore|telecom|G|Z74:SGX
sea|Sea Limited|SG|singapore|tech|L|SE:NYSE
grab|Grab Holdings|SG|singapore|transport|G|GRAB:NASDAQ
keppel|Keppel|SG|singapore|infra|G|BN4:SGX
bca|Bank Central Asia|ID|jakarta|finance|L|BBCA:IDX
telkom|Telkom Indonesia|ID|jakarta|telecom|G|TLKM:IDX
ptt|PTT Public Company|TH|bangkok|oilgas|L|PTT:SET
cpall|CP All|TH|bangkok|retail|G|CPALL:SET
vingroup|Vingroup|VN|hanoi|realestate|G|VIC:HOSE
petronas|Petronas|MY|kualalumpur|oilgas|L|
maybank|Maybank|MY|kualalumpur|finance|L|1155:KLSE
reliance|Reliance Industries|IN|mumbai|oilgas|L|RELIANCE:NSE
tcs|Tata Consultancy Services|IN|mumbai|tech|L|TCS:NSE
infosys|Infosys|IN|bengaluru|tech|L|INFY:NSE|INFY
hdfcbank|HDFC Bank|IN|mumbai|finance|L|HDFCBANK:NSE|HDB
tatamotors|Tata Motors|IN|mumbai|auto|L|TATAMOTORS:NSE
adanigreen|Adani Green Energy|IN|ahmedabad|renewables|G|ADANIGREEN:NSE
lt|Larsen & Toubro|IN|mumbai|construction|L|LT:NSE
airtel|Bharti Airtel|IN|newdelhi|telecom|L|BHARTIARTL:NSE
sunpharma|Sun Pharmaceutical|IN|mumbai|pharma|L|SUNPHARMA:NSE
itc|ITC Limited|IN|kolkata|food|L|ITC:NSE
indigo|InterGlobe Aviation (IndiGo)|IN|gurugram|transport|L|INDIGO:NSE
bajajfin|Bajaj Finance|IN|pune|finance|L|BAJFINANCE:NSE
kaspi|Kaspi.kz|KZ|almaty|finance|G|KSPI:NASDAQ
aramco|Saudi Aramco|SA|dhahran|oilgas|M|2222:TADAWUL
sabic|SABIC|SA|riyadh|heavy|L|2010:TADAWUL
alrajhi|Al Rajhi Bank|SA|riyadh|finance|L|1120:TADAWUL
stc|stc Group|SA|riyadh|telecom|L|7010:TADAWUL
acwa|ACWA Power|SA|riyadh|renewables|G|2082:TADAWUL
maaden|Ma'aden|SA|riyadh|mining|L|1211:TADAWUL
adnoc|ADNOC|AE|abudhabi|oilgas|L|
emirates|Emirates Group|AE|dubai|transport|L|
dpworld|DP World|AE|dubai|logistics|L|
emaar|Emaar Properties|AE|dubai|realestate|L|EMAAR:DFM
masdar|Masdar|AE|abudhabi|renewables|G|
g42|G42|AE|abudhabi|ai|G|
qatarenergy|QatarEnergy|QA|doha|oilgas|L|
qnb|Qatar National Bank|QA|doha|finance|L|QNBK:QSE
teva|Teva Pharmaceutical Industries|IL|telaviv|pharma|L|TEVA:NYSE
checkpoint|Check Point Software|IL|telaviv|tech|G|CHKP:NASDAQ
elbit|Elbit Systems|IL|haifa|defense|G|ESLT:NASDAQ
mobileye|Mobileye|IL|jerusalem|auto|G|MBLY:NASDAQ
naspers|Naspers|ZA|capetown|tech|L|NPN:JSE
mtn|MTN Group|ZA|johannesburg|telecom|L|MTN:JSE
sasol|Sasol|ZA|johannesburg|oilgas|G|SOL:JSE|SSL
standardbank|Standard Bank Group|ZA|johannesburg|finance|L|SBK:JSE
shoprite|Shoprite Holdings|ZA|capetown|retail|G|SHP:JSE
sanlam|Sanlam|ZA|capetown|insurance|G|SLM:JSE
eskom|Eskom|ZA|johannesburg|energy|L|
dangote|Dangote Group|NG|lagos|heavy|L|
safaricom|Safaricom|KE|nairobi|telecom|G|SCOM:NSEKE
ethiopian|Ethiopian Airlines|ET|addisababa|transport|G|
sonatrach|Sonatrach|DZ|algiers|oilgas|L|
ocp|OCP Group|MA|casablanca|mining|L|
cib|Commercial International Bank|EG|cairo|finance|G|COMI:EGX
bhp|BHP|AU|melbourne|mining|M|BHP:ASX|BHP
csl|CSL Limited|AU|melbourne|biotech|L|CSL:ASX
cba|Commonwealth Bank of Australia|AU|sydney|finance|L|CBA:ASX
woolworths|Woolworths Group|AU|sydney|retail|L|WOW:ASX
telstra|Telstra|AU|melbourne|telecom|L|TLS:ASX
fortescue|Fortescue|AU|perth|mining|L|FMG:ASX
woodside|Woodside Energy|AU|perth|oilgas|L|WDS:ASX
atlassian|Atlassian|AU|sydney|tech|L|TEAM:NASDAQ
macquarie|Macquarie Group|AU|sydney|finance|L|MQG:ASX
qantas|Qantas|AU|sydney|transport|L|QAN:ASX
brambles|Brambles|AU|sydney|logistics|L|BXB:ASX
transurban|Transurban|AU|melbourne|infra|L|TCL:ASX
goodman|Goodman Group|AU|sydney|realestate|L|GMG:ASX
fph|Fisher & Paykel Healthcare|NZ|auckland|health|G|FPH:NZX
fonterra|Fonterra|NZ|auckland|food|L|
xero|Xero|NZ|wellington|tech|G|XRO:ASX
`;

/** Yahoo Finance suffix per exchange. Exchanges not listed have no Yahoo mapping. */
const YAHOO_SUFFIX: Record<string, string> = {
  NASDAQ: '', NYSE: '', B3: '.SA', LSE: '.L', XETRA: '.DE', EPA: '.PA', AMS: '.AS', SIX: '.SW', TSE: '.T',
  HKEX: '.HK', KRX: '.KS', TWSE: '.TW', NSE: '.NS', TADAWUL: '.SR', ASX: '.AX', TSX: '.TO', BIT: '.MI',
  BME: '.MC', STO: '.ST', CPH: '.CO', OSL: '.OL', SSE: '.SS', SZSE: '.SZ', BMV: '.MX', JSE: '.JO',
  TASE: '.TA', SGX: '.SI', IST: '.IS', WSE: '.WA', IDX: '.JK', SET: '.BK', KLSE: '.KL', QSE: '.QA',
  NZX: '.NZ', EGX: '.CA', NSEKE: '.NR',
};

const SIZE_MAP: Record<string, SizeClass> = { M: 'mega', L: 'large', G: 'growth' };
const US_EXCHANGES = new Set(['NASDAQ', 'NYSE']);

function parse(): CompanySeed[] {
  const out: CompanySeed[] = [];
  for (const raw of TABLE.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const [id, name, country, city, sector, size, listing = '', adr] = line.split('|');
    const coords = CITIES[city];
    if (!coords) throw new Error(`Radar seed: unknown city "${city}" for ${id}`);
    const [ticker, exchange] = listing ? listing.split(':') : [undefined, undefined];
    const suffix = exchange !== undefined ? YAHOO_SUFFIX[exchange] : undefined;
    const v = VERIFIED[id];
    const derived = ticker && suffix !== undefined ? `${ticker}${suffix}` : undefined;
    // A symbol that returned no price during verification is not queried at runtime.
    const yahoo = v?.y ?? (v?.px === false ? undefined : derived);
    const sec = adr || (exchange && US_EXCHANGES.has(exchange) ? ticker : undefined);
    out.push({
      id,
      name,
      country,
      city: CITY_NAMES[city] ?? city,
      lat: coords[0],
      lon: coords[1],
      sector: sector as SectorId,
      size: SIZE_MAP[size] ?? 'large',
      listed: Boolean(ticker),
      ticker,
      exchange,
      yahoo,
      sec,
      qid: v?.qid,
    });
  }
  return out;
}

export const COMPANIES: CompanySeed[] = parse();

const byId = new Map(COMPANIES.map((c) => [c.id, c]));
export function getCompany(id: string): CompanySeed | undefined {
  return byId.get(id);
}
