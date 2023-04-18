import { getConfig } from '../common/config'
import { PlaidIntegration } from '../integrations/plaid/plaidIntegration'
import { TellerIntegration } from '../integrations/teller/tellerIntegration'
import { GoogleIntegration } from '../integrations/google/googleIntegration'
import { logError, logInfo } from '../common/logging'
import { Account, AccountTypes } from '../types/account'
import { IntegrationId } from '../types/integrations'
import { parseISO, subMonths, startOfMonth } from 'date-fns'
import { CSVImportIntegration } from '../integrations/csv-import/csvImportIntegration'
import { CSVExportIntegration } from '../integrations/csv-export/csvExportIntegration'
import { Transaction, TransactionRuleCondition, TransactionRule } from '../types/transaction'

export default async () => {
    const config = getConfig()

    // Start date to fetch transactions, default to 2 months of history
    let startDate = config.transactions.startDate
        ? parseISO(config.transactions.startDate)
        : startOfMonth(subMonths(new Date(), 2))

    // End date to fetch transactions in YYYY-MM-DD format, default to current date
    let endDate = config.transactions.endDate ? parseISO(config.transactions.endDate) : new Date()

    let accounts: Account[] = []

    for (const accountId in config.accounts) {
        const accountConfig = config.accounts[accountId]

        logInfo(`Fetching account ${accountConfig.id} using ${accountConfig.integration}`)

        switch (accountConfig.integration) {
            case IntegrationId.Plaid:
                const plaid = new PlaidIntegration(config)

                if (accountConfig.type === AccountTypes.Invesment) {
                }

                switch (accountConfig.type) {
                    case AccountTypes.Invesment:
                        const accountHoldings = await plaid.fetchAccountWithHoldings(accountConfig)
                        const accountInvestmentTransactions = await plaid.fetchAccountWithInvestmentTransactions(
                            accountConfig,
                            startDate,
                            endDate
                        )

                        accountHoldings.forEach(holding => {
                            accountInvestmentTransactions.find(
                                account => account.accountId === holding.accountId
                            ).holdings = holding.holdings
                        })

                        accounts = accounts.concat(accountInvestmentTransactions)
                        break
                    case AccountTypes.Disabled:
                         break;
                    case AccountTypes.Transactional:
                    default:
                        accounts = accounts.concat(
                            await plaid.fetchAccountWithTransactions(accountConfig, startDate, endDate)
                        )
                        break
                }
                break

            case IntegrationId.CSVImport:
                const csv = new CSVImportIntegration(config)
                accounts = accounts.concat(await csv.fetchAccount(accountConfig, startDate, endDate))
                break

            case IntegrationId.Teller:
                try {
                    const teller = new TellerIntegration(config)
                    accounts = accounts.concat(await teller.fetchAccount(accountConfig, startDate, endDate))
                    break
                }
                catch {
                    logError("probably failed in github actions")
                }

            default:
                break
        }
    }

    accounts.flat(10)

    const numTransactions = () =>
        accounts
            .map(account => (account.hasOwnProperty('transactions') ? account.transactions.length : 0))
            .reduce((a, b) => a + b, 0)

    const totalTransactions = numTransactions()

    // const transactionMatchesRule = (transaction: Transaction, rule: TransactionRule): boolean => {
    //     return rule.conditions
    //         .map(condition => new RegExp(condition.pattern, condition.flags).test(transaction[condition.property]))
    //         .every(condition => condition === true)
    // }

    // // Transaction Rules
    // if (config.transactions.rules) {
    //     let countOverridden = 0

    //     accounts = accounts.map(account => ({
    //         ...account,
    //         transactions: account.transactions
    //             .map(transaction => {
    //                 config.transactions.rules.forEach(rule => {
    //                     if (transaction && transactionMatchesRule(transaction, rule)) {
    //                         if (rule.type === 'filter') {
    //                             transaction = undefined
    //                         }
    //                         if (rule.type === 'override' && transaction.hasOwnProperty(rule.property)) {
    //                             transaction[rule.property] = (transaction[rule.property].toString() as String).replace(
    //                                 new RegExp(rule.findPattern, rule.flags),
    //                                 rule.replacePattern
    //                             )
    //                             countOverridden += 1
    //                         }
    //                     }
    //                 })

    //                 return transaction
    //             })
    //             .filter(transaction => transaction !== undefined)
    //     }))

    //     logInfo(`${numTransactions()} transactions out of ${totalTransactions} total transactions matched filters.`)
    //     logInfo(`${countOverridden} out of ${totalTransactions} total transactions overridden.`)
    // }

    switch (config.balances.integration) {
        case IntegrationId.Google:
            const google = new GoogleIntegration(config)
            await google.updateBalances(accounts)
            break
        case IntegrationId.CSVExport:
            const csv = new CSVExportIntegration(config)
            await csv.updateBalances(accounts)
            break
        default:
            break
    }

    switch (config.transactions.integration) {
        case IntegrationId.Google:
            const google = new GoogleIntegration(config)
            await google.updateTransactions(accounts, AccountTypes.Transactional)
            await google.updateHoldings(accounts.filter(account => account.holdings))
            await google.updateTransactions(accounts, AccountTypes.Invesment)

            break
        case IntegrationId.CSVExport:
            const csv = new CSVExportIntegration(config)
            await csv.updateTransactions(accounts)
            break
        default:
            break
    }
    logInfo("Done!")
}
