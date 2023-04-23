import { BaseIntegrationConfig, IntegrationId, IntegrationType } from '../integrations'

export enum FinicityEnvironmentType {
    Production = 'production',
    Sandbox = 'sandbox'
}

export interface FinicityCredentials {
    partnerId: string
    appKey: string
    secret: string
}

export interface FinicityConfig extends BaseIntegrationConfig {
    id: IntegrationId.Finicity
    type: IntegrationType.Import

    environment: FinicityEnvironmentType

    credentials: FinicityCredentials
}

export const defaultFinicityConfig: FinicityConfig = {
    name: '',
    id: IntegrationId.Finicity,
    type: IntegrationType.Import,

    environment: FinicityEnvironmentType.Production,

    credentials: {
        partnerId: '',
        appKey: '',
        secret: ''
    }
}
