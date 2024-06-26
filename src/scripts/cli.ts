#!/usr/bin/env node

import prompts from 'prompts'
import { getConfigSource, readConfig, updateConfig } from '../common/config'
import { logError } from '../common/logging'
import csvExport from '../integrations/csv-export/setup'
import csvImport from '../integrations/csv-import/setup'
import google from '../integrations/google/setup'
import plaidAccountSetup from '../integrations/plaid/accountSetup'
import plaid from '../integrations/plaid/setup'
import tellerAccountSetup from '../integrations/teller/accountSetup'
import teller from '../integrations/teller/setup'
import fetch from './fetch'
import migrate from './migrate'
const chalk = require('chalk')

;(async function() {
    const logo = [
        '\n',
        '          $',
        '          %%',
        '         %%%%%',
        '       %%%%%%%%',
        '     %%%%%%%%%%',
        '   %%%%%%%%%%%%',
        '  %%%% %%%%%%%%',
        '  %%%  %%%%%%',
        '  %%   %%%%%%',
        '   %   %%%',
        '        %%%',
        '         %%',
        '           %',
        '\n'
    ]

    logo.forEach(line => {
        console.log(chalk.green(line))
    })

    console.log(' M I N T A B L E\n')

    const commands = {
        migrate: migrate,
        fetch: fetch,
        'plaid-setup': plaid,
        'plaid-account-setup': plaidAccountSetup,
        'google-setup': google,
        'csv-import-setup': csvImport,
        'csv-export-setup': csvExport,
        'teller-setup': teller,
        'teller-account-setup': tellerAccountSetup
    }

    const arg = process.argv[2]

    if (arg == 'setup') {
        const configSource = getConfigSource()
        if (readConfig(configSource, true)) {
            const overwrite = await prompts([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Config already exists. Do you to overwrite it?',
                    initial: false
                }
            ])
            if (overwrite.confirm === false) {
                logError('Config update cancelled by user.')
            }
        }
        updateConfig(config => config, true)
        await plaid()
        await google()
        await plaidAccountSetup()
    } else if (commands.hasOwnProperty(arg)) {
        commands[arg]()
    } else {
        console.log(`\nmintable v${require('../../package.json').version}\n`)
        console.log('\nusage: mintable <command>\n')
        console.log('available commands:')
        Object.keys(commands)
            .concat(['setup'])
            .forEach(command => console.log(`\t${command}`))
    }
})()
