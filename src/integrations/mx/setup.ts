
import { existsSync, realpathSync } from 'fs'
import prompts from 'prompts'

import { MxConfig, defaultMxConfig } from '../../types/integrations/mx'
import { updateConfig } from '../../common/config'
import { IntegrationId } from '../../types/integrations'
import { logInfo, logError } from '../../common/logging'

export default async () => {
    try {
        console.log('\nThis script will walk you through setting up the Mx integration. Follow these steps:')
        console.log('\n\t1. Visit https://www.mx.com/')
        console.log('\t2. Click \'Get API Keys\'')
        console.log('\t3. Fill out the form')
        console.log('\t4. Get your development API Key, Client ID')
        //userGUID might need to be manually created
        console.log('\t5. Answer the following questions:\n')

        const credentials = await prompts([
            {
                type: 'text',
                name: 'name',
                message: 'What would you like to call this integration?',
                initial: 'Mx',
                validate: (s: string) =>
                    1 < s.length && s.length <= 64 ? true : 'Must be between 2 and 64 characters in length.'
            },
            {
                type: 'text',
                name: 'apiKey',
                message: 'API Key',
                validate: (s: string) => (s.length === 40 ? true : 'Must be 40 characters in length.')
            },
            {
                type: 'text',
                name: 'clientId',
                message: 'client ID',
                validate: (s: string) => (30 < s.length && s.length <= 50 ? true : 'Must be between 30 and 50 characters in length.')
            },
            {
                type: 'text',
                name: 'userGUID',
                message: 'user GUID',
                validate: (s: string) => s.length && s.startsWith('USR-') ? true : 'Must enter GUID from Mx.'
            }
        ])

        updateConfig(config => {
            const mxConfig = (config.integrations[IntegrationId.Mx] as MxConfig) || defaultMxConfig

            mxConfig.name = credentials.name
            mxConfig.credentials.clientId = credentials.clientId
            mxConfig.credentials.apiKey = credentials.apiKey
            mxConfig.userGUID = credentials.userGUID

            config.integrations[IntegrationId.Mx] = mxConfig

            return config
        })

        logInfo('Successfully set up Mx Integration.')
        return true
    } catch (e) {
        logError('Unable to set up Mx Integration.', e)
        return false
    }
}