import { Configuration, MxPlatformApi, UserCreateRequestBody } from 'mx-platform-node'
import { Config, updateConfig } from '../../common/config'
import { Account, MxAccountConfig } from '../../types/account'
import { IntegrationId } from '../../types/integrations'
import { MxConfig, MxEnvironmentType, defaultMxConfig } from '../../types/integrations/mx'
import path from 'path'
import { parseISO, format, subMonths } from 'date-fns'
import plaid, { TransactionsResponse, CreateLinkTokenOptions } from 'plaid'
import { PlaidConfig, PlaidEnvironmentType } from '../../types/integrations/plaid'
import express from 'express'
import { logInfo, logError, logWarn } from '../../common/logging'
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

        this.createUser()
    }

    public async createUser() {
        let guid = ''
        if (this.mxConfig.userGUID === '') {
            try {
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


}
