import {
  AirVent,
  ArrowUpDown,
  Bus,
  Car,
  Cctv,
  Check,
  Cigarette,
  CookingPot,
  Dumbbell,
  Fan,
  Fingerprint,
  GraduationCap,
  Hospital,
  KeyRound,
  Lamp,
  Landmark,
  MapPin,
  PawPrint,
  PlugZap,
  Refrigerator,
  ShieldCheck,
  ShoppingBag,
  ShowerHead,
  Sofa,
  TrainFront,
  Trees,
  Tv,
  Utensils,
  WashingMachine,
  Waves,
  Wifi,
  type LucideIcon,
} from 'lucide-react'

/** An icon for each amenity in the catalogue, matched on its name. */
const AMENITY_ICONS: Array<[RegExp, LucideIcon]> = [
  [/air ?con/i, AirVent],
  [/cctv|camera/i, Cctv],
  [/desk/i, Lamp],
  [/ev|charger/i, PlugZap],
  [/fan/i, Fan],
  [/fingerprint/i, Fingerprint],
  [/fitness|gym/i, Dumbbell],
  [/furnish|sofa/i, Sofa],
  [/key ?card/i, KeyRound],
  [/kitchen|stove/i, CookingPot],
  [/laundry|washing/i, WashingMachine],
  [/lift|elevator/i, ArrowUpDown],
  [/parking/i, Car],
  [/pet/i, PawPrint],
  [/pool/i, Waves],
  [/refrigerator|fridge/i, Refrigerator],
  [/security|guard/i, ShieldCheck],
  [/smok/i, Cigarette],
  [/television|tv/i, Tv],
  [/water heater|heater/i, ShowerHead],
  [/wi-?fi|internet/i, Wifi],
]

export function amenityIcon(name: string): LucideIcon {
  return AMENITY_ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? Check
}

const NEARBY_ICONS: Array<[RegExp, LucideIcon]> = [
  [/school|universit|college|campus/i, GraduationCap],
  [/hospital|clinic/i, Hospital],
  [/market|mall|shop|supermarket|plaza|centre|center/i, ShoppingBag],
  [/bus/i, Bus],
  [/train|station|railway/i, TrainFront],
  [/park|garden|lake/i, Trees],
  [/restaurant|cafe|coffee|food/i, Utensils],
  [/bank|office|pagoda|temple|church|mosque/i, Landmark],
]

export function nearbyPlaceIcon(place: string): LucideIcon {
  return NEARBY_ICONS.find(([pattern]) => pattern.test(place))?.[1] ?? MapPin
}

/** "AIR CONDITIONER" reads better as "Air Conditioner"; short codes such as CCTV stay as they are. */
export function amenityLabel(name: string): string {
  if (name !== name.toUpperCase()) return name
  return name
    .split(' ')
    .map((word) => (word.length <= 4 && /^(CCTV|WIFI|EV|TV)$/.test(word) ? (word === 'WIFI' ? 'Wi-Fi' : word) : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(' ')
}

/** Splits the agent's free-text list ("School, Hospital") into separate places. */
export function splitNearbyPlaces(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/[,;\n·]+/)
    .map((place) => place.trim())
    .filter(Boolean)
}
