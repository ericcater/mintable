import { Holdings as Holding } from './holdings'
import { IntegrationId, IntegrationType } from './integrations'
import { Transaction } from './transaction'
import { InvestmentTransaction } from './investmentTransaction'
export interface Account {
    // where this account's information came from
    integration: IntegrationId

    accountType?: AccountTypes

    // unique identifier for this account
    accountId?: string
    // masked account number (e.g xxxx xxxx xxxx 1947)
    mask?: string

    // a institution can have multiple accounts (e.g. Chase)
    institution?: string
    // an account has a number associated to it (e.g. Sapphire Reserve Credit Card)
    account: string

    // type of account (e.g. credit card, 401k, etc.)
    type?: string

    current?: number
    available?: number
    limit?: number
    currency?: string

    // transaction list
    transactions?: TransactionBase[]

    holdings?: Holding[]
}

export type TransactionBase = {
    integration: IntegrationId,
    transactionId: string
    accountId: string
    amount: number
    date : Date
    name: string,
}

export enum AccountTypes {
    Invesment = 'Investment',
    Transactional = 'Transactional',
    Disabled = 'Disabled'
}

export interface BaseAccountConfig {
    id: string
    integration: IntegrationId
    type?: AccountTypes
}

export interface PlaidAccountConfig extends BaseAccountConfig {
    token: string
}

export interface CSVAccountConfig extends BaseAccountConfig {
    paths: string[]
    transformer: { [inputColumn: string]: keyof Transaction }
    dateFormat: string
    negateValues?: boolean
}

export interface TellerAccountConfig extends BaseAccountConfig {
    token: string
}

export type AccountConfig = PlaidAccountConfig | CSVAccountConfig | TellerAccountConfig
