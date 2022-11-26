import { TransactionBase } from './account'
import { IntegrationId } from './integrations'
// import { InvestmentTransactionSubtype, InvestmentTransactionType } from 'plaid'

export interface InvestmentTransaction extends TransactionBase {
    
    security_id: string | null
    date: Date
    name: string
    quantity: number
    amount: number
    price: number
    fees: number | null
    // type: InvestmentTransactionType
    // subtype: InvestmentTransactionSubtype
    iso_currency_code: string | null
    unofficial_currency_code: string | null
    security_name?: string
    ticker?: string
}

export interface InvestmentTransactionConfig {
    integration: IntegrationId
    properties?: string[]
    startDate?: string
    endDate?: string
}

