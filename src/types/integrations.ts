import { PlaidConfig } from './integrations/plaid'
import { GoogleConfig } from './integrations/google'
import { CSVImportConfig } from './integrations/csv-import'
import { CSVExportConfig } from './integrations/csv-export'
import { TellerConfig } from './integrations/teller'

export enum IntegrationType {
    Import = 'import',
    Export = 'export'
}

export enum IntegrationId {
    Plaid = 'plaid',
    Google = 'google',
    CSVImport = 'csv-import',
    CSVExport = 'csv-export',
    Teller = 'teller'
}

export interface BaseIntegrationConfig {
    id: IntegrationId
    name: string
    type: IntegrationType
}

export type IntegrationConfig = PlaidConfig | GoogleConfig | CSVImportConfig | CSVExportConfig | TellerConfig
