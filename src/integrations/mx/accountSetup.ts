import { getConfig } from '../../common/config'
import { logInfo, logError } from '../../common/logging'
import open from 'open'
import { MxIntegration } from './mxIntegration'
import { IntegrationId } from '../../types/integrations'
import { MxConfig } from '../../types/integrations/mx'

export default async () => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('\nThis script will help you add accounts to Mx.\n')
            console.log('\n\t1. A page will open in your browser allowing you to link accounts with Mx.')
            console.log('\t2. Sign in with your banking provider for each account you wish to link.')
            console.log("\t3. Click 'Done Linking Accounts' in your browser when you are finished.\n")

            const config = getConfig()
            const mxConfig = config.integrations[IntegrationId.Mx] as MxConfig
            const mx = new MxIntegration(config)

            logInfo('Account setup in progress.')
            open(`http://localhost:8000?environment=${mxConfig.environment}`)
            await mx.accountSetup()

            logInfo('Successfully set up Mx Account(s).')
            return resolve()
        } catch (e) {
            logError('Unable to set up Mx Account(s).', e)
            return reject()
        }
    })
}
