import {
    Configuration,
    MxPlatformApi,
    TransactionsResponseBody,
    TransactionResponse,
    AccountsResponseBody,
    AccountResponse
} from 'mx-platform-node'
import { Config, updateConfig } from '../../common/config'
import { Account, MxAccountConfig } from '../../types/account'
import { IntegrationId } from '../../types/integrations'
import { MxConfig, defaultMxConfig } from '../../types/integrations/mx'
import path from 'path'
import { parseISO, format, subMonths } from 'date-fns'
import express from 'express'
import { logInfo, logError, logWarn } from '../../common/logging'
import http from 'http'
import { Transaction } from '../../types/transaction'

export class MxIntegration {
    config: Config
    mxConfig: MxConfig
    client: MxPlatformApi

    constructor(config: Config) {
        this.config = config
        this.mxConfig = this.config.integrations[IntegrationId.Mx] as MxConfig

        const configuration = new Configuration({
            // Configure with your this.client ID/API Key from https://dashboard.mx.com
            username: this.mxConfig.credentials.clientId,
            password: this.mxConfig.credentials.apiKey,

            // Configure environment. https://int-api.mx.com for development, https://api.mx.com for production
            basePath:
                process.env.DEVELOPMENT_ENVIRONMENT == 'production' ? 'https://api.mx.com' : 'https://int-api.mx.com',

            baseOptions: {
                headers: {
                    Accept: 'application/vnd.mx.api.v1+json'
                }
            }
        })

        this.client = new MxPlatformApi(configuration)

        this.getOrCreateUser()
    }

    //If userGUID is not set in config, attempts to create one. If that fails, checks if one already exists.
    public async getOrCreateUser() {
        let guid = ''
        if (this.mxConfig.userGUID === '') {
            try {
                console.log('create user call')
                guid = (await this.client.createUser({ user: { id: 'mintable' } })).data.user.guid
                updateConfig(config => {
                    const mxConfig = (config.integrations[IntegrationId.Mx] as MxConfig) || defaultMxConfig
                    mxConfig.userGUID = guid
                    config.integrations[IntegrationId.Mx] = mxConfig

                    return config
                })
            } catch (e) {
                logWarn('Failed to create user, continuing as if it exists', e)
                try {
                    guid = await (await this.client.listUsers(1, 1, 'mintable')).data.users[0].guid
                    updateConfig(config => {
                        const mxConfig = (config.integrations[IntegrationId.Mx] as MxConfig) || defaultMxConfig
                        mxConfig.userGUID = guid
                        config.integrations[IntegrationId.Mx] = mxConfig

                        return config
                    })
                } catch (e) {
                    logError('Failed to read user', e)
                }
            }
        }
    }

    public accountSetup = (): Promise<void> => {
        return new Promise(resolve => {
            const client = this.client
            const userGuid = this.mxConfig.userGUID
            const app = express()
                .use(express.json())
                .use(express.urlencoded({ extended: true }))
                .use(express.static(path.resolve(path.join(__dirname, '../../../docs'))))

            let server: http.Server

            //need callback to save ID
            //which could be a dummy entry, since Mx pulls everything associated with your userGUID
            //Or break things down by member (instituion), which would be in line with how plaid is setup, config wise.

            app.post('/api/get_mxconnect_widget_url', async function(request, response) {
                try {
                    const widgetRequestBody = {
                        widget_url: {
                            include_transactions: true,
                            is_mobile_webview: false,
                            mode: 'verification',
                            ui_message_version: 4,
                            widget_type: 'connect_widget'
                        }
                    }

                    const widgetResponse = await client.requestWidgetURL(userGuid, widgetRequestBody)
                    console.log('got url')
                    response.json(widgetResponse.data?.widget_url)
                    //   response.json(widgetResponse.data?.widget_url?.url)
                } catch (e) {
                    logError('requestWidgetURL', e)
                }
            })

            // app.post('/remove', (req, res) => {
            //     try {
            //         updateConfig(config => {
            //             if (config.accounts[req.body.accountId]) {
            //                 delete config.accounts[req.body.accountId]
            //             }
            //             this.config = config
            //             return config
            //         })
            //         logInfo('Successfully removed Mx account.', req.body.accountId)
            //         return res.json({})
            //     } catch (error) {
            //         logError('Error removing Mx account.', error)
            //     }
            // })

            app.post('/done', (req, res) => {
                res.json({})
                server.close()
                return resolve()
            })

            app.get('/', (req, res) =>
                res.sendFile(path.resolve(path.join(__dirname, '../../../src/integrations/mx/account-setup.html')))
            )

            server = http.createServer(app).listen('8000')
        })
    }

    public fetchPagedTransactions = async (startDate: Date, endDate: Date): Promise<TransactionResponse[]> => {
        return new Promise(async (resolve, reject) => {
            // accountConfig = accountConfig as PlaidAccountConfig
            try {
                const dateFormat = 'yyyy-MM-dd'
                const start = format(startDate, dateFormat)
                const end = format(endDate, dateFormat)

                let page = 1
                let count = 500
                let result: TransactionsResponseBody = (
                    await this.client.listTransactions(this.mxConfig.userGUID, start, page, count, end)
                ).data

                let transactions: TransactionResponse[] = result.transactions

                while (transactions.length < result.pagination.total_entries) {
                    page += 1
                    const next_page: TransactionsResponseBody = (
                        await this.client.listTransactions(this.mxConfig.userGUID, start, page, count, end)
                    ).data
                    transactions = transactions.concat(next_page.transactions)
                }

                return resolve(transactions)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public fetchPagedAccounts = async (): Promise<AccountResponse[]> => {
        return new Promise(async (resolve, reject) => {
            // accountConfig = accountConfig as PlaidAccountConfig
            try {
                let page = 1
                let count = 10
                let result: AccountsResponseBody = (
                    await this.client.listUserAccounts(this.mxConfig.userGUID, undefined, page, count)
                ).data

                let accounts: AccountResponse[] = result.accounts

                while (accounts.length < result.pagination.total_entries) {
                    page += 1
                    const next_page: AccountsResponseBody = (
                        await this.client.listUserAccounts(this.mxConfig.userGUID, undefined, page, count)
                    ).data
                    accounts = accounts.concat(next_page.accounts)
                }

                return resolve(accounts)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public fetchAccount = async (
        accountConfig: MxAccountConfig,
        startDate: Date,
        endDate: Date
    ): Promise<Account[]> => {
        if (startDate < subMonths(new Date(), 5)) {
            logWarn('Transaction history older than 6 months may not be available for some institutions.', {})
        }

        let accounts: Account[] = await this.fetchPagedAccounts().then(data => {
            return data.map(account => ({
                integration: IntegrationId.Mx,
                accountId: account.guid,
                mask: account.account_number,
                institution: account.institution_code,
                account: account.name,
                type: account.subtype || account.type,
                current: account.balance,
                available: account.available_balance,
                limit: account.credit_limit, //|| account.available_credit,
                currency: account.currency_code,
                transactions: []
            }))
        })

        let transactions: Transaction[] = await this.fetchPagedTransactions(startDate, endDate)
            .then(data => {
                return data.map(transaction => ({
                    integration: IntegrationId.Mx,
                    name: transaction.description,
                    account: transaction.account_id,
                    date: parseISO(transaction.date),
                    amount: transaction.amount,
                    currency: transaction.currency_code,
                    type: transaction.type,
                    accountId: transaction.account_guid,
                    transactionId: transaction.guid,
                    category: transaction.category,
                    latitude: transaction.latitude,
                    longitude: transaction.longitude,
                    pending: transaction.status === 'PENDING'
                }))
            })
            .catch(error => {
                logError(`Error fetching account ${accountConfig.id}.`, error)
                return []
            })

        //transactions aren't under the correct account for this array,
        //but everything already has the relevant IDs, so it doesn't matter
        if (accounts.length > 0) {
            accounts[0].transactions = transactions
        }

        logInfo(`Fetched ${accounts.length} sub-accounts and ${transactions.length} transactions.`, accounts)
        // return accounts
        return accounts
    }
}
