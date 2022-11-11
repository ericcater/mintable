import { PlaidConfig } from './integrations/plaid'
import { GoogleConfig } from './integrations/google'
import { CSVImportConfig } from './integrations/csv-import'
import { CSVExportConfig } from './integrations/csv-export'
import { MxConfig } from './integrations/mx'

export enum IntegrationType {
    Import = 'import',
    Export = 'export'
}

export enum IntegrationId {
    Plaid = 'plaid',
    Google = 'google',
    Mx = 'mx',
    CSVImport = 'csv-import',
    CSVExport = 'csv-export'
}

export interface BaseIntegrationConfig {
    id: IntegrationId
    name: string
    type: IntegrationType
}

export type IntegrationConfig = PlaidConfig | MxConfig | GoogleConfig | CSVImportConfig | CSVExportConfig
