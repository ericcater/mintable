import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { Config, updateConfig } from '../../common/config'
import { IntegrationId } from '../../types/integrations'
import { FinicityConfig, defaultFinicityConfig } from '../../types/integrations/finicity'
import { logError, logWarn } from '../../common/logging'

export class FinicityIntegration {
    config: Config
    finicityConfig: FinicityConfig
    accessToken: string = ''
    baseUrl = 'https://api.finicity.com'
    endpoints = {
        authentication: '/aggregation/v2/partners/authentication',
        getCustomers: '/aggregation/v1/customers',
        addTestingCustomer: '/aggregation/v2/customers/testing',
        addCustomer: '/aggregation/v2/customers/active'
    }

    constructor(config: Config) {
        this.config = config
        this.finicityConfig = this.config.integrations[IntegrationId.Finicity] as FinicityConfig

        this.getAccessToken().then(data => {
            this.accessToken = data
            this.getOrCreateCustomer()
        })
    }

    private async getOrCreateCustomer() {
        console.log(`*${this.accessToken}`)
        if (this.finicityConfig.customerId === '') {
            try {
                const id = this.addTestingCustomer().then(({ data }) => data.id)

                updateConfig(config => {
                    const mxConfig =
                        (config.integrations[IntegrationId.Finicity] as FinicityConfig) || defaultFinicityConfig
                    mxConfig.customerId = id
                    config.integrations[IntegrationId.Finicity] = mxConfig

                    return config
                })
            } catch (e) {
                logWarn('Failed to create user, continuing as if it exists', e)

                try {
                    const id = this.getCustomer('mintable').then(({ data }) => data.id)

                    updateConfig(config => {
                        const mxConfig =
                            (config.integrations[IntegrationId.Finicity] as FinicityConfig) || defaultFinicityConfig
                        mxConfig.customerId = id
                        config.integrations[IntegrationId.Finicity] = mxConfig

                        return config
                    })
                } catch (e) {
                    logError('Failed to read user', e)
                }
            }
        }
    }

    public async doStuff(): Promise<void> {
        await this.addCustomer()

        this.getCustomers()
    }

    public async getAccessToken(): Promise<string> {
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

        return axios
            .request(options)
            .then((response: AxiosResponse) => {
                return response?.data?.token
            })
            .catch(function(error: AxiosError) {
                console.error(error)
            })
    }

    public async addTestingCustomer(): Promise<AxiosResponse> {
        const options: AxiosRequestConfig = {
            method: 'POST',
            url: `${this.baseUrl}${this.endpoints.addTestingCustomer}`,
            data: JSON.stringify({
                username: `mintable`,
                firstName: 'mintable',
                lastName: 'mintable'
            }),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Finicity-App-Key': this.finicityConfig.credentials.appKey,
                'Finicity-App-Token': this.accessToken
            }
        }

        return axios.request(options)
    }

    public async getCustomer(username: string): Promise<AxiosResponse> {
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

        return axios.request(options)
    }

    public async addCustomer() {
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

        return axios
            .request(options)
            .then((response: AxiosResponse) => {
                console.log(response.data)
            })
            .catch(function(error: AxiosError) {
                console.error(error.message)
                console.error(error.response.data)
            })
    }

    public async getCustomers() {
        const options: AxiosRequestConfig = {
            method: 'GET',
            url: `${this.baseUrl}${this.endpoints.getCustomers}`,
            // data: JSON.stringify({
            //     partnerId: this.finicityConfig.credentials.partnerId,
            //     partnerSecret: this.finicityConfig.credentials.secret
            // }),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Finicity-App-Key': this.finicityConfig.credentials.appKey,
                'Finicity-App-Token': this.accessToken
            }
        }

        return axios
            .request(options)
            .then((response: AxiosResponse) => {
                console.log(response.data)
            })
            .catch(function(error: AxiosError) {
                console.error(error)
            })
    }
}
