import { BaseIntegrationConfig, IntegrationId, IntegrationType } from '../integrations'

export enum MxEnvironmentType {
    Development = 'development',
    Sandbox = 'sandbox'
}

export interface MxCredentials {
    clientId: string
    apiKey: string
}

export interface MxConfig extends BaseIntegrationConfig {
    id: IntegrationId.Mx
    
    type: IntegrationType.Import

    environment: MxEnvironmentType

    credentials: MxCredentials

    userGUID: string
}
