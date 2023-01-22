import { BaseIntegrationConfig, IntegrationId, IntegrationType } from '../integrations'

export interface GoogleTemplateSheetSettings {
  documentId: string
  sheetTitle: string
}

export interface GoogleCredentials {
  clientId: string
  clientSecret: string
  redirectUri: string
  
  accessToken?: string
  refreshToken?: string
  scope?: string[]
  tokenType?: string
  expiryDate?: number
}

export interface GoogleConfig extends BaseIntegrationConfig {
  id: IntegrationId.Google
  type: IntegrationType.Export

  credentials: GoogleCredentials
  documentId: string[]
  
  dateFormat?: string

  template?: GoogleTemplateSheetSettings
}

export const defaultGoogleConfig: GoogleConfig = {
  name: '',
  id: IntegrationId.Google,
  type: IntegrationType.Export,

  credentials: {
    clientId: '',
    clientSecret: '',
    redirectUri: 'localhost:8000',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
  },
  documentId: ['']
}
