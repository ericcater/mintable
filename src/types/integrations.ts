import { PlaidConfig } from './integrations/plaid'
import { GoogleConfig } from './integrations/google'
import { CSVImportConfig } from './integrations/csv-import'
import { CSVExportConfig } from './integrations/csv-export'
import { FinicityConfig } from './integrations/finicity'

export enum IntegrationType {
    Import = 'import',
    Export = 'export'
}

export enum IntegrationId {
    Plaid = 'plaid',
    Finicity = 'finicity',
    Google = 'google',
    CSVImport = 'csv-import',
    CSVExport = 'csv-export'
}

export interface BaseIntegrationConfig {
    id: IntegrationId
    name: string
    type: IntegrationType
}

export type IntegrationConfig = PlaidConfig | FinicityConfig | GoogleConfig | CSVImportConfig | CSVExportConfig
