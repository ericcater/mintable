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

    customerId
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
    },
    customerId: ''
}

export interface Customer {
    id: string
    username: string
    firstName: string
    lastName: string
    type: string
    createdDate: string
    lastModifiedDate: string
}

export enum Method {
    POST = 'POST',
    DELETE = 'DELETE',
    GET = 'GET',
    PUT = 'PUT'
}

export interface apiRequestArgs {
    method: Method
    endpoint: string
    data?: string
}
