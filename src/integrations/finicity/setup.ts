import { FinicityEnvironmentType, FinicityConfig, defaultFinicityConfig } from '../../types/integrations/finicity'
import { updateConfig } from '../../common/config'
import { IntegrationId } from '../../types/integrations'
import prompts from 'prompts'
import { logInfo, logError } from '../../common/logging'

export default async () => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('\nThis script will walk you through setting up the Finicity integration. Follow these steps:')
            console.log('\n\t1. Visit https://developer.mastercard.com')
            console.log("\t2. Click 'Get API Keys'")
            console.log('\t3. Fill out the form and wait a few days')
            console.log('\t4. Once approved, visit https://dashboard.finicity.com/team/keys')
            console.log('\t5. Answer the following questions:\n')

            // @types/prompts needs updated to support choice descriptions
            interface ChoiceWithDescription extends prompts.Choice {
                description: string
            }

            const credentials = await prompts([
                {
                    type: 'text',
                    name: 'name',
                    message: 'What would you like to call this integration?',
                    initial: 'Finicity',
                    validate: (s: string) =>
                        1 < s.length && s.length <= 64 ? true : 'Must be between 2 and 64 characters in length.'
                },
                {
                    type: 'select',
                    name: 'environment',
                    message: 'Which Finicity environment would you like to use?',
                    choices: [
                        {
                            title: 'Sandbox',
                            description: 'Test credentials for development purposes (unlimited)',
                            value: FinicityEnvironmentType.Sandbox
                        },
                        {
                            title: 'Production',
                            description: 'Real credentials to financial institutions',
                            value: FinicityEnvironmentType.Production
                        }
                    ] as ChoiceWithDescription[],
                    initial: 1
                },
                {
                    type: 'text',
                    name: 'partnerId',
                    message: "Partner ID (pick the one corresponding to your 'Environment' choice above)",
                    validate: (s: string) => (s.length === 13 ? true : 'Must be 13 characters in length.')
                },
                {
                    type: 'password',
                    name: 'secret',
                    message: "Secret (pick the one corresponding to your 'Environment' choice above)",
                    validate: (s: string) => (s.length === 20 ? true : 'Must be 20 characters in length.')
                },
                {
                    type: 'password',
                    name: 'appKey',
                    message: "App Key (pick the one corresponding to your 'Environment' choice above)",
                    validate: (s: string) => (s.length === 32 ? true : 'Must be 32 characters in length.')
                }
                
            ])

            updateConfig(config => {
                let finicityConfig = (config.integrations[IntegrationId.Finicity] as FinicityConfig) || defaultFinicityConfig

                finicityConfig.name = credentials.name
                finicityConfig.environment = credentials.environment
                finicityConfig.credentials.partnerId = credentials.partnerId
                finicityConfig.credentials.secret = credentials.secret
                finicityConfig.credentials.appKey = credentials.appKey

                config.integrations[IntegrationId.Finicity] = finicityConfig

                return config
            })

            logInfo('Successfully set up Finicity Integration.')
            return resolve()
        } catch (e) {
            logError('Unable to set up Finicity Integration.', e)
            return reject()
        }
    })
}
