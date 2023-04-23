#!/usr/bin/env node

import prompts from 'prompts'
const chalk = require('chalk')
import { updateConfig, readConfig, getConfigSource } from '../common/config'
import plaid from '../integrations/plaid/setup'
import mx from '../integrations/mx/setup'
import google from '../integrations/google/setup'
import csvImport from '../integrations/csv-import/setup'
import csvExport from '../integrations/csv-export/setup'
import plaidAccountSetup from '../integrations/plaid/accountSetup'
import mxAccountSetup from '../integrations/mx/accountSetup'
import fetch from './fetch'
import migrate from './migrate'
import { logError } from '../common/logging'
;(async function() {
    const logo = [
        '\n',
        '          %',
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
        'mx-setup': mx,
        'mx-account-setup': mxAccountSetup,
        'google-setup': google,
        'csv-import-setup': csvImport,
        'csv-export-setup': csvExport
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
        //TODO ask what type of account they'd like to setup
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
