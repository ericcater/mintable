import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { Config, updateConfig } from '../../common/config'
import { IntegrationId } from '../../types/integrations'
import { Customer, FinicityConfig, defaultFinicityConfig } from '../../types/integrations/finicity'
import { logError, logInfo, logWarn } from '../../common/logging'

export class FinicityIntegration {
    config: Config
    finicityConfig: FinicityConfig
    public Ready: Promise<any>
    accessToken: string = ''
    baseUrl = 'https://api.finicity.com'
    endpoints = {
        authentication: '/aggregation/v2/partners/authentication',
        customers: '/aggregation/v1/customers',
        addTestingCustomer: '/aggregation/v2/customers/testing',
        addCustomer: '/aggregation/v2/customers/active'
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

    private async deleteAllCustomers() {
        logInfo('deleteAllCustomers')
        const customers = await this.getCustomers()

        console.log(customers)
        customers.forEach(customer => {
            console.log(`deleting customer ${customer.id}`)
            this.deleteCustomer(customer.id)
        })
    }

    private async getOrCreateCustomer() {
        logInfo('getOrCreateCustomer')
        if (this.finicityConfig.customerId === '') {
            try {
                logInfo('trying to create customer')

                const id: string = await this.addTestingCustomer('mintable').then(({ data }) => data.id)
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
                logWarn('Failed to create user, continuing as if it exists', e)

                try {
                    const id: string = await this.getCustomer('mintable').then(({ data }) => data.id)
                    console.log(id)

                    updateConfig(config => {
                        const mxConfig =
                            (config.integrations[IntegrationId.Finicity] as FinicityConfig) || defaultFinicityConfig
                        mxConfig.customerId = id
                        config.integrations[IntegrationId.Finicity] = mxConfig

                        return config
                    })
                    logInfo('successfully pulled id')
                } catch (e) {
                    logError('Failed to read user', e)
                }
            }
        }
    }

    public async doStuff(): Promise<void> {
        logInfo('doStuff')
        // await this.deleteAllCustomers()
        await this.getOrCreateCustomer()
        // console.log(await this.getCustomers())
    }

    private async deleteCustomer(id: string) {
        logInfo('deleteCUsomter')
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

    private async apiRequest(method: string, endpoint: string, data?: string): Promise<AxiosResponse> {
        logInfo('deleteCUsomter')
        const options: AxiosRequestConfig = {
            method: method,
            url: `${this.baseUrl}${endpoint}`,
            data,
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

    public async addTestingCustomer(username: string): Promise<Customer> {
        logInfo('addTestingCustomer')
        const options: AxiosRequestConfig = {
            method: 'POST',
            url: `${this.baseUrl}${this.endpoints.addTestingCustomer}`,
            data: JSON.stringify({
                username
            }),
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

    public async getCustomer(username: string): Promise<AxiosResponse> {
        logInfo('getCustomer')
        const options: AxiosRequestConfig = {
            method: 'POST',
            url: `${this.baseUrl}${this.endpoints.addTestingCustomer}`,
            data: JSON.stringify({
                username: `username`
            }),
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

    public async addCustomer(): Promise<AxiosResponse> {
        logInfo('addCustomer')
        const options: AxiosRequestConfig = {
            method: 'POST',
            url: `${this.baseUrl}${this.endpoints.addCustomer}`,
            data: JSON.stringify({
                username: `test_${Date.now()}`,
                firstName: 'John',
                lastName: 'Smith'
            }),
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

    public async getCustomers(): Promise<Customer[]> {
        logInfo('getCustomers')
        const options: AxiosRequestConfig = {
            method: 'GET',
            url: `${this.baseUrl}${this.endpoints.customers}`,
            data: JSON.stringify({
                partnerId: this.finicityConfig.credentials.partnerId,
                partnerSecret: this.finicityConfig.credentials.secret
            }),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Finicity-App-Key': this.finicityConfig.credentials.appKey,
                'Finicity-App-Token': this.accessToken
            }
        }

        return axios.request(options).then(({ data }) => {
            return data.customers
        })
    }
}
