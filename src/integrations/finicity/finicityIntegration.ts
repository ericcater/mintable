import path from 'path'
import { parseISO, format, subMonths } from 'date-fns'
import { Config, updateConfig } from '../../common/config'
import { FinicityConfig, FinicityEnvironmentType } from '../../types/integrations/finicity'
import { IntegrationId } from '../../types/integrations'
import express from 'express'
import bodyParser from 'body-parser'
import { logInfo, logError, logWarn } from '../../common/logging'
import http from 'http'
import { AccountConfig, Account } from '../../types/account'
import { Transaction } from '../../types/transaction'

const FINICITY_USER_ID = 'LOCAL'

export class FinicityIntegration {
    config: Config
    finicityConfig: FinicityConfig
    environment: string

    constructor(config: Config) {
        this.config = config
        this.finicityConfig = this.config.integrations[IntegrationId.Finicity] as FinicityConfig
        
    }
}
