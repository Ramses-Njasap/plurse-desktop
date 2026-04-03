interface CountryCode {
  code: string
  country: string
  display: string
}

interface Languages {
  code: string
  name: string
}

interface Currencies {
  code: string
  name: string
}

export const countryCodes: CountryCode[] = [
  { code: '+237', country: 'Cameroon', display: '+237 (CM)' }
]

export const languages: Languages[] = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' }
]

export const currencies: Currencies[] = [{ code: 'XAF ', name: 'Central African CFA Franc' }]
