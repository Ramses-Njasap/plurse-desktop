import { app } from 'electron'
import path from 'path'
import { DB_NAME } from './variables'

export const DB_PATH = path.join(app.getPath('userData'), DB_NAME)

export const AUTH_FILE = path.join(app.getPath('userData'), 'auth.json')

// constants.ts (you would need to update this file as well)
export const SUPPORTED_CURRENCIES: { code: string; name: string }[] = [
  // { code: 'USD', name: 'United States Dollar' },
  // { code: 'EUR', name: 'Euro' },
  { code: 'XAF ', name: 'Central African CFA Franc' }
  // { code: 'GBP', name: 'British Pound' },
  // { code: 'JPY', name: 'Japanese Yen' }
]

export const SUPPORTED_LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' }
  // { code: 'es', name: 'Spanish' },
  // { code: 'de', name: 'German' },
  // { code: 'it', name: 'Italian' }
]

export const ACCOUNT_ROLES: { role: string; description: string }[] = [
  { role: 'admin', description: 'Administrator with full access' },
  { role: 'manager', description: 'Manager with elevated permissions' },
  { role: 'staff', description: 'Staff member with standard access' },
  { role: 'accountant', description: 'Accountant with financial access' },
  { role: 'sales_person', description: 'Sales person with sales access' },
  { role: 'viewer', description: 'Viewer with read-only access' }
]

export const PAYMENT_METHODS: { methods: string; description: string }[] = [
  { methods: 'cash', description: 'Payment made in cash' },
  { methods: 'mobile money', description: 'Payment made via mobile money services' },
  { methods: 'bank transfer', description: 'Payment made through bank transfer' },
  { methods: 'credit card', description: 'Payment made using credit card' },
  { methods: 'debit card', description: 'Payment made using debit card' },
  { methods: 'check', description: 'Payment made by check' },
  { methods: 'in kind', description: 'Payment made with goods or services instead of money' },
  { methods: 'other', description: 'Other payment methods' }
]


export const TRANSACTION_TYPE: { type: string; description: string }[] = [
  { type: 'cashin', description: 'Money received' },
  { type: 'cashout', description: '' },
  { type: 'transfer', description: 'Movement of money from local cashier to bank or main account' }
]
