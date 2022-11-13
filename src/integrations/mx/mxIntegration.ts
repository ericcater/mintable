import { Configuration, MxPlatformApi, UserCreateRequestBody } from 'mx-platform-node'
import { Config, updateConfig } from '../../common/config'
import { Account, MxAccountConfig } from '../../types/account'
import { IntegrationId } from '../../types/integrations'
import { MxConfig, MxEnvironmentType } from '../../types/integrations/mx'
import path from 'path'
import { parseISO, format, subMonths } from 'date-fns'
import plaid, { TransactionsResponse, CreateLinkTokenOptions } from 'plaid'
import { PlaidConfig, PlaidEnvironmentType } from '../../types/integrations/plaid'
import express from 'express'
import bodyParser from 'body-parser'
import { logInfo, logError, logWarn } from '../../common/logging'
import http from 'http'
import { Transaction } from '../../types/transaction'
import dotenv from 'dotenv'

export class MxIntegration {
    config: Config
    mxConfig: MxConfig
    client: MxPlatformApi

    constructor(config: Config) {
        this.config = config
        this.mxConfig = this.config.integrations[IntegrationId.Mx] as MxConfig

        const configuration = new Configuration({
            // Configure with your Client ID/API Key from https://dashboard.mx.com
            username: this.mxConfig.credentials.clientId,
            password: this.mxConfig.credentials.apiKey,

            // Configure environment. https://int-api.mx.com for development, https://api.mx.com for production
            basePath: 'https://int-api.mx.com',

            baseOptions: {
                headers: {
                    Accept: 'application/vnd.mx.api.v1+json'
                }
            }
        })

        this.client = new MxPlatformApi(configuration)

        //TODO run this on account setup
    }

    public async createUser(id: string) {
        try {
            this.client.createUser({ user: { id } })
        } catch {
            //user already exists
        }
    }

    public test() {
        const configuration = new Configuration({
            // Configure with your Client ID/API Key from https://dashboard.mx.com
            username: this.mxConfig.credentials.clientId,
            password: this.mxConfig.credentials.apiKey,

            // Configure environment. https://int-api.mx.com for development, https://api.mx.com for production
            basePath: 'https://int-api.mx.com',

            baseOptions: {
                headers: {
                    Accept: 'application/vnd.mx.api.v1+json'
                }
            }
        })

        const client = new MxPlatformApi(configuration)

        const requestBody = {
            user: {
                metadata: 'Creating a user!'
            }
        }

        const response = client.createUser(requestBody).then(data => console.log(data))
    }

    loadWidget = async (user_guid) => {
        // setIsLoading(true);
        let body = {
          user_id: "",
          ...(user_guid != null && { user_guid: user_guid })
        }
        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        };
        await fetch(`/api/get_mxconnect_widget_url`, requestOptions)
          .then(res => {
            if (res.ok) {
              return res.json();
            }
            throw new Error('Something went wrong')
          })
          .then((res) => {
            // setErrorMessage(null);
            setConnectWidgetUrl(res?.widget_url?.url)
            console.log('Getting connect widget URL', res?.widget_url?.url);
            console.log(res)
          })
          .catch((error) => {
            // setIsLoading(false);
            console.log('error', error);
            // setErrorMessage(error.message);
          });
      }

    public getWidgetUrl() {
        this.client.requestWidgetURL(this.mxConfig.userGUID, {
            widget_url: { widget_type: 'connect_widget', color_scheme: 'dark' }
        })
    }

    // public accountSetup = (): Promise<void> => {
    //     return new Promise((resolve, reject) => {
    //         const client = this.client
    //         const app = express()
    //             .use(bodyParser.json())
    //             .use(bodyParser.urlencoded({ extended: true }))
    //             .use(express.static(path.resolve(path.join(__dirname, '../../../docs'))))

    //         let server: http.Server

    //         // app.post('/get_access_token', (req, res) => {
    //         //     if (req.body.public_token !== undefined) {
    //         //         client.exchangePublicToken(req.body.public_token, (error, tokenResponse) => {
    //         //             if (error != null) {
    //         //                 reject(logError('Encountered error exchanging Plaid public token.', error))
    //         //             }
    //         //             this.savePublicToken(tokenResponse)
    //         //             resolve(logInfo('Plaid access token saved.', req.body))
    //         //         })
    //         //     } else if (req.body.exit !== undefined) {
    //         //         resolve(logInfo('Plaid authentication exited.', req.body))
    //         //     } else {
    //         //         if ((req.body.error['error-code'] = 'item-no-error')) {
    //         //             resolve(logInfo('Account is OK, no further action is required.', req.body))
    //         //         } else {
    //         //             reject(logError('Encountered error during authentication.', req.body))
    //         //         }
    //         //     }
    //         //     return res.json({})
    //         // })

    //         // app.post('/accounts', async (req, res) => {
    //         //     let accounts: { name: string; token: string }[] = []

    //         //     for (const accountId in this.config.accounts) {
    //         //         const accountConfig: PlaidAccountConfig = this.config.accounts[accountId] as PlaidAccountConfig
    //         //         if (accountConfig.integration === IntegrationId.Plaid) {
    //         //             try {
    //         //                 await this.client.getAccounts(accountConfig.token).then(resp => {
    //         //                     accounts.push({
    //         //                         name: resp.accounts[0].name,
    //         //                         token: accountConfig.token
    //         //                     })
    //         //                 })
    //         //             } catch {
    //         //                 accounts.push({
    //         //                     name: 'Error fetching account name',
    //         //                     token: accountConfig.token
    //         //                 })
    //         //             }
    //         //         }
    //         //     }
    //         //     return res.json(accounts)
    //         // })

    //         // app.post('/create_link_token', async (req, res) => {
    //         //     const clientUserId = this.user.client_user_id
    //         //     const options: CreateLinkTokenOptions = {
    //         //         user: {
    //         //             client_user_id: clientUserId
    //         //         },
    //         //         client_name: 'Mintable',
    //         //         products: ['transactions'],
    //         //         country_codes: ['US'], // TODO
    //         //         language: 'en' // TODO
    //         //     }
    //         //     if (req.body.access_token) {
    //         //         options.access_token = req.body.access_token
    //         //         delete options.products
    //         //     }
    //         //     this.client.createLinkToken(options, (err, data) => {
    //         //         if (err) {
    //         //             logError('Error creating Plaid link token.', err)
    //         //         }
    //         //         logInfo('Successfully created Plaid link token.')
    //         //         res.json({ link_token: data.link_token })
    //         //     })
    //         // })

    //         // app.post('/remove', async (req, res) => {
    //         //     try {
    //         //         await updateConfig(config => {
    //         //             Object.values(config.accounts).forEach(account => {
    //         //                 const accountConfig: PlaidAccountConfig = account as PlaidAccountConfig

    //         //                 if (accountConfig.hasOwnProperty('token') && accountConfig.token == req.body.token) {
    //         //                     delete config.accounts[accountConfig.id]
    //         //                 }
    //         //             })
    //         //             this.config = config
    //         //             return config
    //         //         })
    //         //         logInfo('Successfully removed Plaid account.', req.body.token)
    //         //         return res.json({})
    //         //     } catch (error) {
    //         //         logError('Error removing Plaid account.', error)
    //         //     }
    //         // })

    //         app.post('/get_widget_url', async (req, res) => {
    //             console.log('in /get_widget_url')
    //             const widget_url = await this.client
    //                 .requestWidgetURL(this.mxConfig.userGUID, {
    //                     widget_url: { widget_type: 'connect_widget', color_scheme: 'dark' }
    //                 })
    //                 .then(({ data }) => data.widget_url.url)

    //             return res.json(widget_url)
    //         })

    //         app.post('/done', (req, res) => {
    //             res.json({})
    //             return server.close()
    //         })

    //         app.get('/', (req, res) =>
    //             res.sendFile(path.resolve(path.join(__dirname, '../../../src/integrations/mx/account-setup.html')))
    //         )

    //         server = require('http')
    //             .createServer(app)
    //             .listen('8000')
    //     })
    // }

    public accountSetup(): Promise<void> {
        dotenv.config({ path: '../.env' })
        var port = process.env.PORT || 8000

        var app = express()
        app.use(express.json())
        app.use(express.urlencoded({ extended: true }))
        app.use(express.static('public'))

        app.listen(port, function() {
            console.log(`mx-quickconnect node backend is listening on port ${port}`)
        })

        const configuration = new Configuration({
            // Configure with your Client ID/API Key from https://dashboard.mx.com
            username: process.env.CLIENT_ID,
            password: process.env.API_KEY,

            // Configure environment. https://int-api.mx.com for development, https://api.mx.com for production
            basePath: 'https://int-api.mx.com',

            baseOptions: {
                headers: {
                    Accept: 'application/vnd.mx.api.v1+json'
                }
            }
        })

        const client = new MxPlatformApi(configuration)

        app.get('/api/users', async function(_request, response) {
            try {
                const listUsersResponse = await client.listUsers()
                response.json(listUsersResponse.data)
            } catch (e) {
                logAndReturnApiError('listUserAccounts', e, response)
            }
        })

        app.delete('/api/user/:userGuid', async function(request, response) {
            try {
                await client.deleteUser(request.params.userGuid)
                response.json({ user_guid: request.params.userGuid })
            } catch (e) {
                logAndReturnApiError('listUserAccounts', e, response)
            }
        })

        app.post('/api/get_mxconnect_widget_url', async function(request, response) {
            try {
                let userGuid = request.body.user_guid
                if (userGuid == null) {
                    const createUserRequestBody = {
                        user: {
                            id: request.body.user_id ? request.body.user_id : null
                        }
                    }
                    const createUserResponse = await client.createUser(createUserRequestBody)
                    userGuid = createUserResponse.data.user.guid
                }

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
                response.json(widgetResponse.data)
            } catch (e) {
                logAndReturnApiError('requestWidgetURL', e, response)
            }
        })

        app.get('/users/:userGuid/members/:memberGuid/check_balance', async function(request, response) {
            try {
                const listUserAccountsResponse = await client.listUserAccounts(request.params.userGuid)
                response.json(listUserAccountsResponse.data)
            } catch (e) {
                logAndReturnApiError('listUserAccounts', e, response)
            }
        })

        app.post('/users/:userGuid/members/:memberGuid/check_balance', async function(request, response) {
            try {
                const balancesResponse = await client.checkBalances(request.params.memberGuid, request.params.userGuid)
                response.json(balancesResponse.data)
            } catch (e) {
                logAndReturnApiError('checkBalances', e, response)
            }
        })

        app.get('/users/:userGuid/members/:memberGuid/status', async function(request, response) {
            try {
                const statusResponse = await client.readMemberStatus(request.params.memberGuid, request.params.userGuid)
                response.json(statusResponse.data)
            } catch (e) {
                logAndReturnApiError('readMemberStatus', e, response)
            }
        })

        app.get('/users/:userGuid/members/:memberGuid/verify', async function(request, response) {
            try {
                const listAccountNumbersResponse = await client.listAccountNumbersByMember(
                    request.params.memberGuid,
                    request.params.userGuid
                )
                response.json(listAccountNumbersResponse.data)
            } catch (e) {
                logAndReturnApiError('listAccountNumbersByMember', e, response)
            }
        })

        app.get('/users/:userGuid/members/:memberGuid/identify', async function(request, response) {
            try {
                const listAccountOwnersResponse = await client.listAccountOwnersByMember(
                    request.params.memberGuid,
                    request.params.userGuid
                )
                response.json(listAccountOwnersResponse.data)
            } catch (e) {
                logAndReturnApiError('listAccountOwnersResponse', e, response)
            }
        })

        app.post('/users/:userGuid/members/:memberGuid/identify', async function(request, response) {
            try {
                const identifyMemberResponse = await client.identifyMember(
                    request.params.memberGuid,
                    request.params.userGuid
                )
                response.json(identifyMemberResponse.data)
            } catch (e) {
                logAndReturnApiError('identifyMember', e, response)
            }
        })

        app.get('/users/:userGuid/members/:memberGuid/transactions', async function(request, response) {
            try {
                const listTransactionsResponse = await client.listTransactionsByMember(
                    request.params.memberGuid,
                    request.params.userGuid
                )
                response.json(listTransactionsResponse.data)
            } catch (e) {
                logAndReturnApiError('listTransactionsByMember', e, response)
            }
        })

        function logAndReturnApiError(method, e, response) {
            if (!e.response) {
                console.log('Error when calling MxPlatformApi->' + method + ': ' + e)
                response.status('500').send({ errorMessage: e })
                return
            }
            console.log(
                'Error when calling MxPlatformApi->' +
                    method +
                    ': HTTP ' +
                    e.response.status +
                    ' ' +
                    e.response.statusText
            )
            console.log(e.response.data)
            response.status(e.response.status).send({ errorMessage: e.response.data })
        }

        return
    }

    public async fetchAccount(accountConfig: MxAccountConfig, startDate: Date, endDate: Date): Promise<Account[]> {
        return []
    }
}
