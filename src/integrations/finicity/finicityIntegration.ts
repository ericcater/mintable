import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { Config, updateConfig } from '../../common/config'
import { IntegrationId } from '../../types/integrations'
import {
    FinicityConfig,
    Method,
    apiRequestArgs,
    defaultFinicityConfig,
    Customer
} from '../../types/integrations/finicity'
import { logError, logInfo, logWarn } from '../../common/logging'
import { response } from 'express'
import { method } from 'lodash'

export class FinicityIntegration {
    config: Config
    finicityConfig: FinicityConfig
    public Ready: Promise<any>
    accessToken: string = ''
    consumerId: string //move this to config?
    baseUrl = 'https://api.finicity.com'
    endpoints = {
        authentication: '/aggregation/v2/partners/authentication',
        customers: '/aggregation/v1/customers',
        addTestingCustomer: '/aggregation/v2/customers/testing',
        addCustomer: '/aggregation/v2/customers/active',
        generateConnectUrl: '/connect/v2/generate',
        createConsumer: '/decisioning/v1/customers/'
    }

    constructor(config: Config) {
        logInfo('constructor')
        this.config = config
        this.finicityConfig = this.config.integrations[IntegrationId.Finicity] as FinicityConfig

        this.Ready = new Promise((resolve, reject) => {
            // now do something asynchronous
            this.getAccessToken()
                .then(result => {
                    this.accessToken = result
                    // at the end of the callback, resolve the readiness promise
                    resolve(undefined)
                })
                .catch(reject)
        })

        // this.Ready.then(() => {

        // })
    }

    public async doStuff(): Promise<void> {
        logInfo('doStuff')
        // await this.deleteAllCustomers()
        await this.getOrCreateCustomer()
        await this.getOrCreateConsumer()
        // console.log(await this.getCustomers('mintable'))
        // console.log(await this.createConsumer())
        console.log(await this.generateConnectUrl())
    }

    private async apiRequest(args: apiRequestArgs, raw?: boolean): Promise<any> {
        logInfo(`apiRequest ${args.endpoint}`)
        const options: AxiosRequestConfig = {
            method: args.method,
            url: `${this.baseUrl}${args.endpoint}`,
            data: args.data || '',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Finicity-App-Key': this.finicityConfig.credentials.appKey,
                'Finicity-App-Token': this.accessToken
            }
        }
        console.log(options)

        return axios.request(options).then(response => {
            if (!raw) {
                return response.data
            }
            return response
        })
        // .catch((e: AxiosError) => {
        //     console.log(e)
        //     console.log(e.cause)
        //     console.log(e.message)
        //     console.log(e.name)
        // })
    }

    public async getAccessToken(): Promise<string> {
        logInfo('getAccessToken')
        const options: AxiosRequestConfig = {
            method: 'POST',
            url: `${this.baseUrl}${this.endpoints.authentication}`,
            data: JSON.stringify({
                partnerId: this.finicityConfig.credentials.partnerId,
                partnerSecret: this.finicityConfig.credentials.secret
            }),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Finicity-App-Key': `${this.finicityConfig.credentials.appKey}`
            }
        }

        return axios.request(options).then((response: AxiosResponse) => {
            return response?.data?.token
        })
    }

    private async getOrCreateCustomer() {
        logInfo('getOrCreateCustomer')
        if (this.finicityConfig.customerId === '') {
            try {
                logInfo('trying to create customer')

                const id: string = await this.addTestingCustomer('mintable').then(data => data.id)
                console.log(id)

                updateConfig(config => {
                    const mxConfig =
                        (config.integrations[IntegrationId.Finicity] as FinicityConfig) || defaultFinicityConfig
                    mxConfig.customerId = id
                    config.integrations[IntegrationId.Finicity] = mxConfig

                    return config
                })
                logInfo('success')
            } catch (e) {
                logWarn('Failed to create user, continuing as if it exists', e.data)

                try {
                    const customer: Customer = await this.getCustomers('mintable').then(data => data[0])
                    console.log(customer.id)

                    if (!customer.id) {
                        throw new Error()
                    }
                    updateConfig(config => {
                        const mxConfig =
                            (config.integrations[IntegrationId.Finicity] as FinicityConfig) || defaultFinicityConfig
                        mxConfig.customerId = customer.id
                        config.integrations[IntegrationId.Finicity] = mxConfig

                        return config
                    })
                    logInfo('successfully pulled id')
                } catch (e) {
                    logError('Failed to read user', e.data)
                }
            }
        }
    }

    private async getOrCreateConsumer() {
        try {
            const existingResponse = await this.getConsumer()
            this.consumerId = existingResponse.id
        } catch {
            const newConsumer = await this.createConsumer()
            this.consumerId = newConsumer.id
        }
    }

    private async deleteAllCustomers() {
        logInfo('deleteAllCustomers')
        const customers = await this.getCustomers()

        console.log(customers)
        customers.forEach(customer => {
            console.log(`deleting customer ${customer.id}`)
            this.deleteCustomer(customer.id)
        })
    }

    private async deleteCustomer(id: string) {
        logInfo('deleteCustomer')
        const options: AxiosRequestConfig = {
            method: 'DELETE',
            url: `${this.baseUrl}${this.endpoints.customers}/${id}`,

            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Finicity-App-Key': this.finicityConfig.credentials.appKey,
                'Finicity-App-Token': this.accessToken
            }
        }

        return axios.request(options).then(({ data }) => {
            return data
        })
    }

    public async addTestingCustomer(username: string): Promise<Customer> {
        logInfo('addTestingCustomer')

        return this.apiRequest({
            method: Method.POST,
            endpoint: this.endpoints.addTestingCustomer,
            data: JSON.stringify({
                username
            })
        })
    }

    public async getCustomer(id: string): Promise<Customer> {
        logInfo('getCustomer')
        return this.apiRequest({
            method: Method.GET,
            endpoint: `${this.endpoints.customers}/${id}`
        }).then(data => {
            console.log(data)
            return data
        })
    }

    public async addCustomer(username: string): Promise<AxiosResponse> {
        logInfo('addCustomer')
        return this.apiRequest({
            method: Method.POST,
            endpoint: this.endpoints.addCustomer,
            data: JSON.stringify({
                username: username
            })
        })
    }

    public async getCustomers(username?: string): Promise<Customer[]> {
        logInfo('getCustomers')
        return this.apiRequest({
            method: Method.GET,
            endpoint: this.endpoints.customers,
            data: JSON.stringify({
                username: username
            })
        }).then(data => data.customers)
    }

    public async generateConnectUrl() {
        return this.apiRequest({
            method: Method.POST,
            endpoint: this.endpoints.generateConnectUrl,
            data: JSON.stringify({
                language: 'en',
                partnerId: this.finicityConfig.credentials.partnerId,
                customerId: this.finicityConfig.customerId,
                consumerId: this.consumerId,
                redirectUri: 'https://www.finicity.com/connect/',
                institutionSettings: {},
                singleUseUrl: false,
                fromDate: 1607450357,
                reportCustomFields: [
                    {
                        label: 'loanID',
                        value: '123456',
                        shown: true
                    },
                    {
                        label: 'loanID',
                        value: '123456',
                        shown: true
                    }
                ]
            })
        })
    }

    public async createConsumer() {
        return this.apiRequest({
            method: Method.POST,
            endpoint: `${this.endpoints.createConsumer}${this.finicityConfig.customerId}/consumer`,
            data: JSON.stringify({
                firstName: 'Homer',
                lastName: 'Loanseeke',
                address: '434 W Ascension Way',
                city: 'Murray',
                state: 'UT',
                zip: '84123',
                phone: '1-800-986-3343',
                ssn: '999601111',
                birthday: {
                    year: 1970,
                    month: 7,
                    dayOfMonth: 4
                },
                email: 'finicity@test.com',
                suffix: 'Mr'
            })
        })
    }

    public async getConsumer(): Promise<any> {
        return this.apiRequest({
            method: Method.GET,
            endpoint: `${this.endpoints.createConsumer}${this.finicityConfig.customerId}/consumer`
        })
    }
}
