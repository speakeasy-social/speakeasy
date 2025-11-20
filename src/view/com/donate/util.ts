export type StepState = {
  currentStep: 'intro' | 'payment' | 'subscription'
  disableButtons: boolean
}

export const hasCurrencyError = (value: string): boolean => {
  const num = Number(value)
  return value === '' ? false : isNaN(num) || num <= 0
}

export const convertAmount = (value: string): number => {
  const rounded = Number.parseFloat(value).toFixed(2)
  return Number(rounded) * 100
}

// Stripe supported currencies
export const STRIPE_CURRENCIES = [
  {code: 'AED', name: 'United Arab Emirates Dirham'},
  {code: 'AUD', name: 'Australian Dollar'},
  {code: 'BGN', name: 'Bulgarian Lev'},
  {code: 'BRL', name: 'Brazilian Real'},
  {code: 'CAD', name: 'Canadian Dollar'},
  {code: 'CHF', name: 'Swiss Franc'},
  {code: 'CZK', name: 'Czech Koruna'},
  {code: 'DKK', name: 'Danish Krone'},
  {code: 'EUR', name: 'Euro'},
  {code: 'GBP', name: 'British Pound'},
  {code: 'HKD', name: 'Hong Kong Dollar'},
  {code: 'HUF', name: 'Hungarian Forint'},
  {code: 'INR', name: 'Indian Rupee'},
  {code: 'JPY', name: 'Japanese Yen'},
  {code: 'MXN', name: 'Mexican Peso'},
  {code: 'MYR', name: 'Malaysian Ringgit'},
  {code: 'NOK', name: 'Norwegian Krone'},
  {code: 'NZD', name: 'New Zealand Dollar'},
  {code: 'PLN', name: 'Polish Zloty'},
  {code: 'RON', name: 'Romanian Leu'},
  {code: 'SEK', name: 'Swedish Krona'},
  {code: 'SGD', name: 'Singapore Dollar'},
  {code: 'THB', name: 'Thai Baht'},
  {code: 'USD', name: 'US Dollar'},
] as const

// Currency symbols mapping
export const CURRENCY_SYMBOLS: Record<string, string> = {
  AED: 'د.إ',
  AUD: '$',
  BGN: 'лв',
  BRL: 'R$',
  CAD: '$',
  CHF: 'Fr',
  CZK: 'Kč',
  DKK: 'kr',
  EUR: '€',
  GBP: '£',
  HKD: '$',
  HUF: 'Ft',
  INR: '₹',
  JPY: '¥',
  MXN: '$',
  MYR: 'RM',
  NOK: 'kr',
  NZD: '$',
  PLN: 'zł',
  RON: 'lei',
  SEK: 'kr',
  SGD: '$',
  THB: '฿',
  USD: '$',
}

export const getCurrencySymbol = (code: string): string => {
  return CURRENCY_SYMBOLS[code] || '$'
}

// Timezone to currency mapping
const TIMEZONE_TO_CURRENCY: Record<string, string> = {
  // United States
  'America/New_York': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Phoenix': 'USD',
  'America/Anchorage': 'USD',
  'Pacific/Honolulu': 'USD',
  // Canada
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
  'America/Edmonton': 'CAD',
  'America/Winnipeg': 'CAD',
  'America/Halifax': 'CAD',
  // United Kingdom
  'Europe/London': 'GBP',
  // Eurozone
  'Europe/Paris': 'EUR',
  'Europe/Berlin': 'EUR',
  'Europe/Rome': 'EUR',
  'Europe/Madrid': 'EUR',
  'Europe/Amsterdam': 'EUR',
  'Europe/Brussels': 'EUR',
  'Europe/Vienna': 'EUR',
  'Europe/Dublin': 'EUR',
  'Europe/Lisbon': 'EUR',
  'Europe/Helsinki': 'EUR',
  'Europe/Athens': 'EUR',
  // Switzerland
  'Europe/Zurich': 'CHF',
  // Scandinavia
  'Europe/Stockholm': 'SEK',
  'Europe/Oslo': 'NOK',
  'Europe/Copenhagen': 'DKK',
  // Eastern Europe
  'Europe/Warsaw': 'PLN',
  'Europe/Prague': 'CZK',
  'Europe/Budapest': 'HUF',
  'Europe/Bucharest': 'RON',
  'Europe/Sofia': 'BGN',
  // Asia-Pacific
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
  'Australia/Brisbane': 'AUD',
  'Australia/Perth': 'AUD',
  'Pacific/Auckland': 'NZD',
  'Asia/Tokyo': 'JPY',
  'Asia/Hong_Kong': 'HKD',
  'Asia/Singapore': 'SGD',
  'Asia/Kuala_Lumpur': 'MYR',
  'Asia/Bangkok': 'THB',
  'Asia/Kolkata': 'INR',
  'Asia/Mumbai': 'INR',
  'Asia/Dubai': 'AED',
  // Americas
  'America/Mexico_City': 'MXN',
  'America/Sao_Paulo': 'BRL',
}

export const getCurrencyFromTimezone = (): string => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return TIMEZONE_TO_CURRENCY[timezone] || 'NZD'
  } catch {
    return 'NZD'
  }
}
