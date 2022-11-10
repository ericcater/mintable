import { google, sheets_v4 } from 'googleapis'
import { Config, updateConfig } from '../../common/config'
import { IntegrationId } from '../../types/integrations'
import { GoogleConfig } from '../../types/integrations/google'
import { OAuth2Client, Credentials } from 'google-auth-library'
import { logInfo, logError } from '../../common/logging'
import { Account } from '../../types/account'
import { sortBy, groupBy, camelCase, concat } from 'lodash'
import { startOfMonth, format, formatISO, parseISO } from 'date-fns'

export interface Range {
    sheet: string
    start?: string
    end?: string
}

export interface DataRange {
    range: Range
    data: any[][]
}

export class GoogleIntegration {
    config: Config
    googleConfig: GoogleConfig
    client: OAuth2Client
    sheets: sheets_v4.Resource$Spreadsheets

    constructor(config: Config) {
        this.config = config
        this.googleConfig = config.integrations[IntegrationId.Google] as GoogleConfig

        this.client = new google.auth.OAuth2(
            this.googleConfig.credentials.clientId,
            this.googleConfig.credentials.clientSecret,
            this.googleConfig.credentials.redirectUri
        )

        this.client.setCredentials({
            access_token: this.googleConfig.credentials.accessToken,
            refresh_token: this.googleConfig.credentials.refreshToken,
            token_type: this.googleConfig.credentials.tokenType,
            expiry_date: this.googleConfig.credentials.expiryDate
        })

        this.sheets = google.sheets({
            version: 'v4',
            auth: this.client
        }).spreadsheets
    }

    public getAuthURL = (): string =>
        this.client.generateAuthUrl({
            scope: this.googleConfig.credentials.scope
        })

    public getAccessTokens = (authCode: string): Promise<Credentials> =>
        this.client.getToken(authCode).then(response => response.tokens)

    public saveAccessTokens = (tokens: Credentials): void => {
        updateConfig(config => {
            let googleConfig = config.integrations[IntegrationId.Google] as GoogleConfig

            googleConfig.credentials.accessToken = tokens.access_token
            googleConfig.credentials.refreshToken = tokens.refresh_token
            googleConfig.credentials.tokenType = tokens.token_type
            googleConfig.credentials.expiryDate = tokens.expiry_date

            config.integrations[IntegrationId.Google] = googleConfig

            return config
        })
    }

    public getSheets = (documentId?: string): Promise<sheets_v4.Schema$Sheet[]> => {
        return this.sheets
            .get({ spreadsheetId: documentId || this.googleConfig.documentId })
            .then(res => {
                logInfo(`Fetched ${res.data.sheets.length} sheets.`, res.data.sheets)
                return res.data.sheets
            })
            .catch(error => {
                logError(`Error fetching sheets for spreadsheet ${this.googleConfig.documentId}.`, error)
                return []
            })
    }

    public copySheet = async (title: string, sourceDocumentId?: string): Promise<sheets_v4.Schema$SheetProperties> => {
        const sheets = await this.getSheets(sourceDocumentId || this.googleConfig.documentId)
        let sourceSheetId

        try {
            sourceSheetId = sheets.find(sheet => sheet.properties.title === title).properties.sheetId
        } catch (error) {
            logError(`Error finding template sheet ${title} in document ${sourceDocumentId}.`, { error, sheets })
        }

        return this.sheets.sheets
            .copyTo({
                spreadsheetId: sourceDocumentId || this.googleConfig.documentId,
                sheetId: sourceSheetId,
                requestBody: { destinationSpreadsheetId: this.googleConfig.documentId }
            })
            .then(res => {
                logInfo(`Copied sheet ${title}.`, res.data)
                return res.data
            })
            .catch(error => {
                logError(`Error copying sheet ${title}.`, error)
                return {}
            })
    }

    public addSheet = (title: string): Promise<sheets_v4.Schema$SheetProperties> => {
        return this.sheets
            .batchUpdate({
                spreadsheetId: this.googleConfig.documentId,
                requestBody: { requests: [{ addSheet: { properties: { title } } }] }
            })
            .then(res => {
                logInfo(`Added sheet ${title}.`, res.data)
                return res.data.replies[0].addSheet.properties
            })
            .catch(error => {
                logError(`Error adding sheet ${title}.`, error)
                return {}
            })
    }

    public renameSheet = async (oldTitle: string, newTitle: string): Promise<sheets_v4.Schema$Response[]> => {
        const sheets = await this.getSheets()
        const sheetId = sheets.find(sheet => sheet.properties.title === oldTitle).properties.sheetId

        return this.sheets
            .batchUpdate({
                spreadsheetId: this.googleConfig.documentId,
                requestBody: {
                    requests: [
                        {
                            updateSheetProperties: {
                                properties: { sheetId: sheetId, title: newTitle },
                                fields: 'title'
                            }
                        }
                    ]
                }
            })
            .then(res => {
                logInfo(`Renamed sheet ${oldTitle} to ${newTitle}.`, res.data)
                return res.data.replies
            })
            .catch(error => {
                logError(`Error renaming sheet ${oldTitle} to ${newTitle}.`, error)
                return []
            })
    }

    public translateRange = (range: Range): string => {
        let result: string = range.sheet

        if (range.start) {
            result += `!${range.start}`

            if (range.end) {
                result += `:${range.end}`
            }
        }

        return result
    }

    public translateRanges = (ranges: Range[]): string[] => ranges.map(this.translateRange)

    public clearRanges = (ranges: Range[]): Promise<sheets_v4.Schema$BatchClearValuesResponse> => {
        const translatedRanges = this.translateRanges(ranges)
        return this.sheets.values
            .batchClear({
                spreadsheetId: this.googleConfig.documentId,
                requestBody: { ranges: translatedRanges }
            })
            .then(res => {
                logInfo(`Cleared ${ranges.length} range(s): ${translatedRanges}.`, res.data)
                return res.data
            })
            .catch(error => {
                logError(`Error clearing ${ranges.length} range(s): ${translatedRanges}.`, error)
                return {}
            })
    }

    public updateRanges = (dataRanges: DataRange[]): Promise<sheets_v4.Schema$BatchUpdateValuesResponse> => {
        const data = dataRanges.map(dataRange => ({
            range: this.translateRange(dataRange.range),
            values: dataRange.data
        }))
        return this.sheets.values
            .batchUpdate({
                spreadsheetId: this.googleConfig.documentId,
                requestBody: {
                    valueInputOption: `USER_ENTERED`,
                    data: data
                }
            })
            .then(res => {
                logInfo(`Updated ${data.length} range(s): ${data.map(r => r.range)}.`, res.data)
                return res.data
            })
            .catch(error => {
                logError(`Error updating ${data.length} range(s): ${data.map(r => r.range)}.`, error)
                return {}
            })
    }

    public sortSheets = async (): Promise<sheets_v4.Schema$BatchUpdateSpreadsheetResponse> => {
        const sheets = await this.getSheets()
        const ordered = sortBy(sheets, sheet => sheet.properties.title).reverse()

        return this.sheets
            .batchUpdate({
                spreadsheetId: this.googleConfig.documentId,
                requestBody: {
                    requests: ordered.map((sheet, i) => ({
                        updateSheetProperties: {
                            properties: { sheetId: sheet.properties.sheetId, index: i },
                            fields: 'index'
                        }
                    }))
                }
            })
            .then(res => {
                logInfo(`Updated indices for ${sheets.length} sheets.`, res.data)
                return res.data
            })
            .catch(error => {
                logError(`Error updating indices for ${sheets.length} sheets.`, error)
                return {}
            })
    }

    public formatSheets = async (): Promise<sheets_v4.Schema$BatchUpdateSpreadsheetResponse> => {
        const sheets = await this.getSheets()

        return this.sheets
            .batchUpdate({
                spreadsheetId: this.googleConfig.documentId,
                requestBody: {
                    requests: sheets
                        .map(sheet => [
                            {
                                repeatCell: {
                                    range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
                                    cell: {
                                        userEnteredFormat: {
                                            backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                                            horizontalAlignment: 'CENTER',
                                            textFormat: {
                                                foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                                                bold: true
                                            }
                                        }
                                    },
                                    fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                                }
                            },
                            {
                                updateSheetProperties: {
                                    properties: {
                                        sheetId: sheet.properties.sheetId,
                                        gridProperties: { frozenRowCount: 1 }
                                    },
                                    fields: 'gridProperties.frozenRowCount'
                                }
                            },
                            {
                                autoResizeDimensions: {
                                    dimensions: {
                                        sheetId: sheet.properties.sheetId,
                                        dimension: 'COLUMNS',
                                        startIndex: 0,
                                        endIndex: sheet.properties.gridProperties.columnCount
                                    }
                                }
                            }
                        ])
                        .flat(10)
                }
            })
            .then(res => {
                logInfo(`Updated formatting for ${sheets.length} sheets.`, res.data)
                return res.data
            })
            .catch(error => {
                logError(`Error updating formatting for ${sheets.length} sheets.`, error)
                return {}
            })
    }

    public getRowWithDefaults = (row: { [key: string]: any }, columns: string[], defaultValue: any = null): any[] => {
        return columns.map(key => {
            if (row && row.hasOwnProperty(key)) {
                if (key === 'date') {
                    return format(row[key], this.googleConfig.dateFormat || 'yyyy.MM.dd')
                }
                return row[key]
            }
            return defaultValue
        })
    }

    public updateSheet = async (
        sheetTitle: string,
        rows: { [key: string]: any }[],
        columns?: string[],
        useTemplate?: boolean,
        clearEntireSheet?: boolean
    ): Promise<sheets_v4.Schema$BatchUpdateValuesResponse> => {
        const sheets = await this.getSheets()
        const existing = sheets.find(sheet => sheet.properties.title === sheetTitle)

        if (existing === undefined) {
            if (this.googleConfig.template && useTemplate === true) {
                const copied = await this.copySheet(
                    this.googleConfig.template.sheetTitle,
                    this.googleConfig.template.documentId
                )
                await this.renameSheet(copied.title, sheetTitle)
            } else {
                await this.addSheet(sheetTitle)
            }
        }

        columns = columns || Object.keys(rows[0])

        const columnHeaders = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

        const range = {
            sheet: sheetTitle,
            start: `A1`,
            end: `${columnHeaders[columns.length > 0 ? columns.length - 1 : 1]}${rows.length + 1}`
        }
        const data = [columns].concat(rows.map(row => this.getRowWithDefaults(row, columns)))

        await this.clearRanges(clearEntireSheet === true ? [{ sheet: sheetTitle }] : [range])
        return this.updateRanges([{ range, data }])
    }

    public updateTransactions = async (accounts: Account[]) => {
        // Sort transactions by date
        const transactions = sortBy(accounts.map(account => account.transactions).flat(10), 'date')

        // Split transactions by month
        const groupedTransactions = groupBy(transactions, transaction => formatISO(startOfMonth(transaction.date)))

        // Write transactions by month, copying template sheet if necessary
        for (const month in groupedTransactions) {
            await this.updateSheet(
                format(parseISO(month), this.googleConfig.dateFormat || 'yyyy.MM'),
                groupedTransactions[month],
                this.config.transactions.properties,
                true,
                true
            )
        }

        // Sort Sheets
        await this.sortSheets()

        // Format, etc.
        // await this.formatSheets()

        logInfo('You can view your sheet here:\n')
        console.log(`https://docs.google.com/spreadsheets/d/${this.googleConfig.documentId}`)
    }

    public updateBalances = async (accounts: Account[]) => {
        // Update Account Balances Sheets
        await this.updateSheet('Balances', accounts, this.config.balances.properties)

        await this.balanceHistory('History', accounts)

        // Sort Sheets
        await this.sortSheets()

        // Format, etc.
        // await this.formatSheets()

        logInfo('You can view your sheet here:\n')
        console.log(`https://docs.google.com/spreadsheets/d/${this.googleConfig.documentId}`)
    }

    public balanceHistory = async (sheetTitle: string, accounts: Account[], useTemplate?: boolean) => {
        const columnHeaders = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
        const ids = accounts.map(account => account.accountId)
        const rowOffset: number = 3 // 1 to not overwrite last line, two for account id/name
        const dateFormat = 'MM/dd/yyyy'
        const date = format(new Date(), dateFormat)

        //#region create sheet

        //create sheet if it doesn't exist
        const sheets = await this.getSheets()
        const existing = sheets.find(sheet => sheet.properties.title === sheetTitle)

        if (existing === undefined) {
            if (this.googleConfig.template && useTemplate === true) {
                const copied = await this.copySheet(
                    this.googleConfig.template.sheetTitle,
                    this.googleConfig.template.documentId
                )
                await this.renameSheet(copied.title, sheetTitle)
            } else {
                await this.addSheet(sheetTitle)
            }

            this.updateRanges([
                {
                    range: {
                        sheet: sheetTitle,
                        start: 'A1'
                    },
                    data: [['Date']]
                }
            ])
        }
        //#endregion create sheet

        //#region add missing ids

        //#region check if this day has been done
        const lastDate = await this.sheets.values
            .get({
                spreadsheetId: this.googleConfig.documentId,
                range: `${sheetTitle}!A:A`
            })
            .then(res => res.data.values[res.data.values.length-1][0])

        if (lastDate === date) {
            console.log('Day has been recorded')
            return
        }
        // #endregion check if this day has been done

        let idsFromSheet = await this.sheets.values
            .get({
                spreadsheetId: this.googleConfig.documentId,
                range: `${sheetTitle}!1:1`
            })
            .then(res => res.data.values[0])


        const missingIds = ids.filter(id => !idsFromSheet.includes(id))

        this.updateRanges([
            {
                range: {
                    sheet: sheetTitle,
                    start: `${columnHeaders[idsFromSheet.length]}1`,
                    end: `${columnHeaders[idsFromSheet.length + missingIds.length]}1`
                },
                data: [missingIds]
            }
        ])

        //#endregion add missing ids

        const allIds = idsFromSheet.concat(missingIds)


        const row: any[] = allIds.map(id => accounts.find(acc => acc.accountId === id)?.current || '')
        row[0] = date

        //#region get existing data

        const existingDataRange = this.translateRange({
            sheet: sheetTitle,
            start: 'A3',
            end: `${columnHeaders[row.length > 0 ? row.length - 1 : 1]}`
        })

        const existingData = await this.sheets.values.get({
            spreadsheetId: this.googleConfig.documentId,
            range: existingDataRange
        })

        const numRows = existingData.data.values ? existingData.data.values.length : 0
        //#endregion get existing data

        const newDataRange: Range = {
            sheet: sheetTitle,
            start: `A${numRows + rowOffset}`,
            end: `${columnHeaders[row.length > 0 ? row.length - 1 : 1]}${numRows + rowOffset}`
        }

        return this.updateRanges([{ range: newDataRange, data: [row] }])
    }
}
