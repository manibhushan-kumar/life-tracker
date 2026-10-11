// --- Country -> IANA time zone mapping (World Clock feature) ---------------
// A static ISO-3166-1 alpha-2 country code -> [IANA zone id, ...] table,
// sourced from the IANA time zone database's country/zone assignments
// (the same public data underlying zone1970.tab, which is what every
// timezone-picker library - browsers included - ultimately derives from).
//
// Why a static table instead of a runtime API: there is no built-in browser
// API that maps "country" -> "its time zones" (Intl only knows about
// individual zone ids and region *names*, see _wcCountryName in
// world-clock.js). The zone ids themselves, and every current UTC offset /
// DST transition for them, ARE still computed live via Intl.DateTimeFormat
// at render time (see world-clock.js) - this table only supplies WHICH zone
// ids belong to WHICH country, nothing date- or offset-specific, so it
// doesn't go stale the way a hardcoded offset table would.
//
// Curation note for multi-zone countries (US, RU, CA, AU, BR, MX, ID, ...):
// the full IANA database keeps some zones separate purely for HISTORICAL
// reasons (e.g. a dozen-plus small Indiana/Kentucky/North Dakota counties in
// the US that all currently follow Eastern or Central time, but adopted DST
// in different years decades ago). Listing every one of those would just
// show duplicate clocks with identical current times, which is exactly what
// requirement "avoid duplicate timezone entries where appropriate" warns
// against - so each entry below is trimmed to one representative zone id
// per practically-distinct region (matching how consumer world-clock apps
// and sites like timeanddate.com group them), not literally every historical
// IANA sub-zone. Nothing here is an invented/fake zone id - every entry is a
// real, valid IANA identifier for that country.
const TZ_COUNTRY_ZONES = {
  // --- Africa (no DST anywhere on the continent currently) ---
  DZ: ['Africa/Algiers'], AO: ['Africa/Luanda'], BJ: ['Africa/Porto-Novo'],
  BW: ['Africa/Gaborone'], BF: ['Africa/Ouagadougou'], BI: ['Africa/Bujumbura'],
  CV: ['Atlantic/Cape_Verde'], CM: ['Africa/Douala'], CF: ['Africa/Bangui'],
  TD: ['Africa/Ndjamena'], KM: ['Indian/Comoro'], CG: ['Africa/Brazzaville'],
  CD: ['Africa/Kinshasa', 'Africa/Lubumbashi'], CI: ['Africa/Abidjan'],
  DJ: ['Africa/Djibouti'], EG: ['Africa/Cairo'], GQ: ['Africa/Malabo'],
  ER: ['Africa/Asmara'], SZ: ['Africa/Mbabane'], ET: ['Africa/Addis_Ababa'],
  GA: ['Africa/Libreville'], GM: ['Africa/Banjul'], GH: ['Africa/Accra'],
  GN: ['Africa/Conakry'], GW: ['Africa/Bissau'], KE: ['Africa/Nairobi'],
  LS: ['Africa/Maseru'], LR: ['Africa/Monrovia'], LY: ['Africa/Tripoli'],
  MG: ['Indian/Antananarivo'], MW: ['Africa/Blantyre'], ML: ['Africa/Bamako'],
  MR: ['Africa/Nouakchott'], MU: ['Indian/Mauritius'], YT: ['Indian/Mayotte'],
  MA: ['Africa/Casablanca'], MZ: ['Africa/Maputo'], NA: ['Africa/Windhoek'],
  NE: ['Africa/Niamey'], NG: ['Africa/Lagos'], RW: ['Africa/Kigali'],
  RE: ['Indian/Reunion'], SH: ['Atlantic/St_Helena'], ST: ['Africa/Sao_Tome'],
  SN: ['Africa/Dakar'], SC: ['Indian/Mahe'], SL: ['Africa/Freetown'],
  SO: ['Africa/Mogadishu'], ZA: ['Africa/Johannesburg'], SS: ['Africa/Juba'],
  SD: ['Africa/Khartoum'], TZ: ['Africa/Dar_es_Salaam'], TG: ['Africa/Lome'],
  TN: ['Africa/Tunis'], UG: ['Africa/Kampala'], EH: ['Africa/El_Aaiun'],
  ZM: ['Africa/Lusaka'], ZW: ['Africa/Harare'],

  // --- Americas ---
  AG: ['America/Antigua'],
  AR: ['America/Argentina/Buenos_Aires'],
  BS: ['America/Nassau'], BB: ['America/Barbados'], BZ: ['America/Belize'],
  BO: ['America/La_Paz'],
  BR: ['America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco', 'America/Noronha'],
  CA: ['America/St_Johns', 'America/Halifax', 'America/Toronto', 'America/Winnipeg', 'America/Regina', 'America/Edmonton', 'America/Vancouver'],
  CL: ['America/Santiago', 'Pacific/Easter'],
  CO: ['America/Bogota'], CR: ['America/Costa_Rica'], CU: ['America/Havana'],
  DM: ['America/Dominica'], DO: ['America/Santo_Domingo'],
  EC: ['America/Guayaquil', 'Pacific/Galapagos'],
  SV: ['America/El_Salvador'], GD: ['America/Grenada'], GT: ['America/Guatemala'],
  GY: ['America/Guyana'], HT: ['America/Port-au-Prince'], HN: ['America/Tegucigalpa'],
  JM: ['America/Jamaica'],
  MX: ['America/Mexico_City', 'America/Cancun', 'America/Chihuahua', 'America/Hermosillo', 'America/Tijuana'],
  NI: ['America/Managua'], PA: ['America/Panama'], PY: ['America/Asuncion'],
  PE: ['America/Lima'], PR: ['America/Puerto_Rico'],
  KN: ['America/St_Kitts'], LC: ['America/St_Lucia'], VC: ['America/St_Vincent'],
  SR: ['America/Paramaribo'], TT: ['America/Port_of_Spain'],
  US: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'America/Adak', 'Pacific/Honolulu'],
  UY: ['America/Montevideo'], VE: ['America/Caracas'],
  GL: ['America/Nuuk', 'America/Danmarkshavn', 'America/Scoresbysund', 'America/Thule'],
  BM: ['Atlantic/Bermuda'], VI: ['America/St_Thomas'], VG: ['America/Tortola'],
  KY: ['America/Cayman'], TC: ['America/Grand_Turk'], AI: ['America/Anguilla'],
  AW: ['America/Aruba'], CW: ['America/Curacao'], SX: ['America/Lower_Princes'],
  BQ: ['America/Kralendijk'], MS: ['America/Montserrat'], MQ: ['America/Martinique'],
  GP: ['America/Guadeloupe'], GF: ['America/Cayenne'], FK: ['Atlantic/Stanley'],
  PM: ['America/Miquelon'],

  // --- Asia ---
  AF: ['Asia/Kabul'], AM: ['Asia/Yerevan'], AZ: ['Asia/Baku'], BH: ['Asia/Bahrain'],
  BD: ['Asia/Dhaka'], BT: ['Asia/Thimphu'], BN: ['Asia/Brunei'], KH: ['Asia/Phnom_Penh'],
  CN: ['Asia/Shanghai', 'Asia/Urumqi'], CY: ['Asia/Nicosia'], GE: ['Asia/Tbilisi'],
  HK: ['Asia/Hong_Kong'], IN: ['Asia/Kolkata'],
  ID: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
  IR: ['Asia/Tehran'], IQ: ['Asia/Baghdad'], IL: ['Asia/Jerusalem'], JP: ['Asia/Tokyo'],
  JO: ['Asia/Amman'], KZ: ['Asia/Almaty', 'Asia/Aqtobe'], KW: ['Asia/Kuwait'],
  KG: ['Asia/Bishkek'], LA: ['Asia/Vientiane'], LB: ['Asia/Beirut'], MO: ['Asia/Macau'],
  MY: ['Asia/Kuala_Lumpur'], MV: ['Indian/Maldives'],
  MN: ['Asia/Ulaanbaatar', 'Asia/Hovd'], MM: ['Asia/Yangon'], NP: ['Asia/Kathmandu'],
  KP: ['Asia/Pyongyang'], OM: ['Asia/Muscat'], PK: ['Asia/Karachi'],
  PS: ['Asia/Gaza'], PH: ['Asia/Manila'], QA: ['Asia/Qatar'], SA: ['Asia/Riyadh'],
  SG: ['Asia/Singapore'], KR: ['Asia/Seoul'], LK: ['Asia/Colombo'], SY: ['Asia/Damascus'],
  TW: ['Asia/Taipei'], TJ: ['Asia/Dushanbe'], TH: ['Asia/Bangkok'], TL: ['Asia/Dili'],
  TR: ['Europe/Istanbul'], TM: ['Asia/Ashgabat'], AE: ['Asia/Dubai'],
  UZ: ['Asia/Tashkent'], VN: ['Asia/Ho_Chi_Minh'], YE: ['Asia/Aden'],

  // --- Europe ---
  AL: ['Europe/Tirane'], AD: ['Europe/Andorra'], AT: ['Europe/Vienna'],
  BY: ['Europe/Minsk'], BE: ['Europe/Brussels'], BA: ['Europe/Sarajevo'],
  BG: ['Europe/Sofia'], HR: ['Europe/Zagreb'], CZ: ['Europe/Prague'],
  DK: ['Europe/Copenhagen'], EE: ['Europe/Tallinn'], FO: ['Atlantic/Faroe'],
  FI: ['Europe/Helsinki'], FR: ['Europe/Paris'], DE: ['Europe/Berlin'],
  GI: ['Europe/Gibraltar'], GR: ['Europe/Athens'], HU: ['Europe/Budapest'],
  IS: ['Atlantic/Reykjavik'], IE: ['Europe/Dublin'], IM: ['Europe/Isle_of_Man'],
  IT: ['Europe/Rome'], JE: ['Europe/Jersey'], GG: ['Europe/Guernsey'],
  XK: ['Europe/Belgrade'], LV: ['Europe/Riga'], LI: ['Europe/Vaduz'],
  LT: ['Europe/Vilnius'], LU: ['Europe/Luxembourg'], MT: ['Europe/Malta'],
  MD: ['Europe/Chisinau'], MC: ['Europe/Monaco'], ME: ['Europe/Podgorica'],
  NL: ['Europe/Amsterdam'], MK: ['Europe/Skopje'], NO: ['Europe/Oslo'],
  PL: ['Europe/Warsaw'], PT: ['Europe/Lisbon', 'Atlantic/Azores'],
  RO: ['Europe/Bucharest'],
  RU: ['Europe/Kaliningrad', 'Europe/Moscow', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Asia/Magadan', 'Asia/Kamchatka'],
  SM: ['Europe/San_Marino'], RS: ['Europe/Belgrade'], SK: ['Europe/Bratislava'],
  SI: ['Europe/Ljubljana'], ES: ['Europe/Madrid', 'Atlantic/Canary'],
  SE: ['Europe/Stockholm'], CH: ['Europe/Zurich'], UA: ['Europe/Kyiv'],
  GB: ['Europe/London'], VA: ['Europe/Vatican'], AX: ['Europe/Mariehamn'],
  SJ: ['Arctic/Longyearbyen'],

  // --- Oceania ---
  AU: ['Australia/Sydney', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Darwin', 'Australia/Perth', 'Australia/Lord_Howe'],
  FJ: ['Pacific/Fiji'],
  KI: ['Pacific/Tarawa', 'Pacific/Kiritimati', 'Pacific/Kanton'],
  MH: ['Pacific/Majuro'],
  FM: ['Pacific/Chuuk', 'Pacific/Pohnpei', 'Pacific/Kosrae'],
  NR: ['Pacific/Nauru'],
  NZ: ['Pacific/Auckland', 'Pacific/Chatham'],
  PW: ['Pacific/Palau'],
  PG: ['Pacific/Port_Moresby', 'Pacific/Bougainville'],
  WS: ['Pacific/Apia'], SB: ['Pacific/Guadalcanal'], TO: ['Pacific/Tongatapu'],
  TV: ['Pacific/Funafuti'], VU: ['Pacific/Efate'],
  PF: ['Pacific/Tahiti', 'Pacific/Marquesas', 'Pacific/Gambier'],
  NC: ['Pacific/Noumea'], GU: ['Pacific/Guam'], MP: ['Pacific/Saipan'],
  AS: ['Pacific/Pago_Pago'], CK: ['Pacific/Rarotonga'], NU: ['Pacific/Niue'],
  TK: ['Pacific/Fakaofo'], WF: ['Pacific/Wallis'], NF: ['Pacific/Norfolk'],
  PN: ['Pacific/Pitcairn'],

  // --- Indian Ocean / misc small territories ---
  IO: ['Indian/Chagos'], CC: ['Indian/Cocos'], CX: ['Indian/Christmas'],
  TF: ['Indian/Kerguelen'], UM: ['Pacific/Midway'],

  // --- Antarctica (research stations, not a country but has its own ISO code) ---
  AQ: ['Antarctica/McMurdo', 'Antarctica/Palmer', 'Antarctica/Rothera', 'Antarctica/Casey', 'Antarctica/Davis', 'Antarctica/Mawson', 'Antarctica/Troll', 'Antarctica/Vostok', 'Antarctica/Syowa']
};
