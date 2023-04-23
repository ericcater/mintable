import { getConfig } from '../../common/config'
import { logInfo, logError } from '../../common/logging'
import open from 'open'
import { FinicityIntegration } from './finicityIntegration'
import { IntegrationId } from '../../types/integrations'
import { FinicityConfig } from '../../types/integrations/finicity'

export default async () => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('\nThis script will help you add accounts to Finicity.\n')
            console.log('\n\t1. A page will open in your browser allowing you to link accounts with Finicity.')
            console.log('\t2. Sign in with your banking provider for each account you wish to link.')
            console.log("\t3. Click 'Done Linking Accounts' in your browser when you are finished.\n")

            const config = getConfig()
            const finicityConfig = config.integrations[IntegrationId.Finicity] as FinicityConfig
            const finicity = new FinicityIntegration(config)

            logInfo('Account setup in progress.')
            open(`http://localhost:8000?environment=${finicityConfig.environment}`)
            //await finicity.accountSetup()

            logInfo('Successfully set up Finicity Account(s).')
            return resolve()
        } catch (e) {
            logError('Unable to set up Finicity Account(s).', e)
            return reject()
        }
    })
}
