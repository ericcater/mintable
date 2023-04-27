import { parseISO, startOfMonth, subMonths } from 'date-fns'
import { getConfig } from '../common/config'
import { logInfo } from '../common/logging'
import { CSVExportIntegration } from '../integrations/csv-export/csvExportIntegration'
import { CSVImportIntegration } from '../integrations/csv-import/csvImportIntegration'
import { GoogleIntegration } from '../integrations/google/googleIntegration'
import { PlaidIntegration } from '../integrations/plaid/plaidIntegration'
import { TellerIntegration } from '../integrations/teller/tellerIntegration'
import { Account, AccountTypes } from '../types/account'
import { IntegrationId } from '../types/integrations'

export default async () => {
    const config = getConfig()

    //not an ideal spot for this
    const google = new GoogleIntegration(config)

    google.cloneAccountNames()
    google.setOptionPrices()

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
                        break
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
                const teller = new TellerIntegration(config)
                accounts = accounts.concat(await teller.fetchAccount(accountConfig, startDate, endDate))
                break

            default:
                break
        }
    }

    accounts.flat(10)

    switch (config.transactions.integration) {
        case IntegrationId.Google:
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

    switch (config.balances.integration) {
        case IntegrationId.Google:
            await google.updateBalances(accounts)
            break
        case IntegrationId.CSVExport:
            const csv = new CSVExportIntegration(config)
            await csv.updateBalances(accounts)
            break
        default:
            break
    }

    await google.cloneTransactions()

    logInfo('Done!')
}
