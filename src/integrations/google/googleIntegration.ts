import { format, formatISO, parseISO, startOfMonth } from 'date-fns'
import { Credentials, OAuth2Client } from 'google-auth-library'
import { google, sheets_v4 } from 'googleapis'
import { groupBy, sortBy } from 'lodash'
import { Config, updateConfig } from '../../common/config'
import { logError, logInfo } from '../../common/logging'
import { Account, AccountTypes } from '../../types/account'
import { IntegrationId } from '../../types/integrations'
import { GoogleConfig } from '../../types/integrations/google'
var axios = require('axios').default

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
    existingSheets: [sheets_v4.Schema$Sheet[]] = [[]]

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

    public async getSheets(documentId?: string): Promise<sheets_v4.Schema$Sheet[]> {
        const docId = documentId || this.googleConfig.documentId[0]

        if (this.existingSheets.length < 1 || this.existingSheets[0].length < 1) {
            for (let i in this.googleConfig.documentId) {
                this.existingSheets.push(await this.asysncgetSheetsWorker(this.googleConfig.documentId[i]))
            }
        }

        const id = this.googleConfig.documentId.indexOf(docId)
        return this.existingSheets[id]
    }

    public asysncgetSheetsWorker(documentId: string): Promise<sheets_v4.Schema$Sheet[]> {
        return this.sheets
            .get({ spreadsheetId: documentId || this.googleConfig.documentId[0] })
            .then(({ data }) => {
                logInfo(`Fetched ${data.sheets.length} sheets.`, data.sheets)
                const i = this.googleConfig.documentId.indexOf(documentId || this.googleConfig.documentId[0])
                this.existingSheets[i] = data.sheets
                return data.sheets
            })
            .catch(error => {
                logError(`Error fetching sheets for spreadsheet ${this.googleConfig.documentId[0]}`, error)
                return []
            })
    }

    public copySheet = async (title: string, sourceDocumentId?: string): Promise<sheets_v4.Schema$SheetProperties> => {
        const sheets = await this.getSheets(sourceDocumentId || this.googleConfig.documentId[0])
        let sourceSheetId

        try {
            sourceSheetId = sheets.find(sheet => sheet.properties.title === title).properties.sheetId
        } catch (error) {
            logError(`Error finding template sheet ${title} in document ${sourceDocumentId}`, { error, sheets })
        }

        return this.sheets.sheets
            .copyTo({
                spreadsheetId: sourceDocumentId || this.googleConfig.documentId[0],
                sheetId: sourceSheetId,
                requestBody: { destinationSpreadsheetId: this.googleConfig.documentId[0] }
            })
            .then(res => {
                logInfo(`Copied sheet ${title}`, res.data)
                return res.data
            })
            .catch(error => {
                logError(`Error copying sheet ${title}`, error)
                return {}
            })
    }

    public addSheet = (title: string, documentId?: string): Promise<sheets_v4.Schema$SheetProperties> => {
        return this.sheets
            .batchUpdate({
                spreadsheetId: documentId || this.googleConfig.documentId[0],
                requestBody: { requests: [{ addSheet: { properties: { title } } }] }
            })
            .then(({ data }) => {
                logInfo(`Added sheet ${title}`, data)
                return data.replies[0].addSheet.properties
            })
            .catch(error => {
                logError(`Error adding sheet ${title}`, error)
                return {}
            })
    }

    public renameSheet = async (
        oldTitle: string,
        newTitle: string,
        documentId?: string
    ): Promise<sheets_v4.Schema$Response[]> => {
        const sheets = await this.getSheets(documentId || this.googleConfig.documentId[0])
        const sheetId = sheets.find(sheet => sheet.properties.title === oldTitle).properties.sheetId

        return this.sheets
            .batchUpdate({
                spreadsheetId: documentId || this.googleConfig.documentId[0],
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
            .then(({ data }) => {
                logInfo(`Renamed sheet ${oldTitle} to ${newTitle}`, data)
                return data.replies
            })
            .catch(error => {
                logError(`Error renaming sheet ${oldTitle} to ${newTitle}`, error)
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

    public clearRanges = (ranges: Range[], documentId?: string): Promise<sheets_v4.Schema$BatchClearValuesResponse> => {
        const translatedRanges = this.translateRanges(ranges)
        return this.sheets.values
            .batchClear({
                spreadsheetId: documentId || this.googleConfig.documentId[0],
                requestBody: { ranges: translatedRanges }
            })
            .then(res => {
                logInfo(`Cleared ${ranges.length} range(s): ${translatedRanges}`, res.data)
                return res.data
            })
            .catch(error => {
                logError(`Error clearing ${ranges.length} range(s): ${translatedRanges}`, error)
                return {}
            })
    }

    public updateRanges = (
        dataRanges: DataRange[],
        documentId?: string
    ): Promise<sheets_v4.Schema$BatchUpdateValuesResponse> => {
        const data = dataRanges.map(dataRange => ({
            range: this.translateRange(dataRange.range),
            values: dataRange.data
        }))
        return this.sheets.values
            .batchUpdate({
                spreadsheetId: documentId || this.googleConfig.documentId[0],
                requestBody: {
                    valueInputOption: `USER_ENTERED`,
                    data: data
                }
            })
            .then(res => {
                logInfo(`Updated ${data.length} range(s): ${data.map(r => r.range)}`, res.data)
                return res.data
            })
            .catch(error => {
                logError(`Error updating ${data.length} range(s): ${data.map(r => r.range)}`, error)
                return {}
            })
    }

    public sortSheets = async (documentId?: string): Promise<sheets_v4.Schema$BatchUpdateSpreadsheetResponse> => {
        const sheets = await this.getSheets(documentId || this.googleConfig.documentId[0])
        const ordered = sortBy(sheets, sheet => sheet.properties.title).reverse()

        return this.sheets
            .batchUpdate({
                spreadsheetId: documentId || this.googleConfig.documentId[0],
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
                logInfo(`Updated indices for ${sheets.length} sheets`, res.data)
                return res.data
            })
            .catch(error => {
                logError(`Error updating indices for ${sheets.length} sheets`, error)
                return {}
            })
    }

    public formatSheets = async (documentId?: string): Promise<sheets_v4.Schema$BatchUpdateSpreadsheetResponse> => {
        const sheets = await this.getSheets(documentId || this.googleConfig.documentId[0])

        return this.sheets
            .batchUpdate({
                spreadsheetId: documentId || this.googleConfig.documentId[0],
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
        clearEntireSheet?: boolean,
        documentId?: string
    ): Promise<sheets_v4.Schema$BatchUpdateValuesResponse> => {
        documentId = documentId || this.googleConfig.documentId[0]
        const sheets = await this.getSheets(documentId)
        const existing = sheets.find(sheet => sheet.properties.title === sheetTitle)

        if (existing === undefined) {
            if (this.googleConfig.template && useTemplate === true) {
                const copied = await this.copySheet(
                    this.googleConfig.template.sheetTitle,
                    documentId || this.googleConfig.template.documentId
                )
                await this.renameSheet(copied.title, sheetTitle, documentId)
            } else {
                await this.addSheet(sheetTitle, documentId)
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

        await this.clearRanges(
            clearEntireSheet === true
                ? [{ sheet: sheetTitle }]
                : [{ sheet: range.sheet, start: range.start, end: range.end.replace(/[0-9]/g, '') }],
            documentId
        )
        return this.updateRanges([{ range, data }], documentId)
    }

    public updateTransactions = async (accounts: Account[], type: AccountTypes, writeToOneSheet?: boolean) => {
        accounts = accounts.filter(account => account.accountType === type)

        if (accounts.length === 0) {
            return
        }
        let properties
        let documentId

        switch (type) {
            case AccountTypes.Invesment:
                properties = this.config.investmentTransactions.properties
                documentId = this.googleConfig.documentId[1]
                break
            case AccountTypes.Disabled:
                break
            case AccountTypes.Transactional:
            default:
                properties = this.config.transactions.properties
                documentId = this.googleConfig.documentId[0]
                break
        }

        // Sort transactions by date
        const transactions = sortBy(accounts.map(account => account.transactions).flat(10), 'date')

        //Not terribly useful in currently since anything that isn't fetched this run is overwritten
        if (writeToOneSheet) {
            this.updateSheet('AllTest', transactions, properties, true, true, documentId)
        } else {
            const groupedTransactions = groupBy(transactions, transaction => formatISO(startOfMonth(transaction.date)))

            // Write transactions by month, copying template sheet if necessary
            for (const month in groupedTransactions) {
                await this.updateSheet(
                    format(parseISO(month), this.googleConfig.dateFormat || 'yyyy.MM'),
                    groupedTransactions[month],
                    properties,
                    true,
                    false,
                    documentId
                )
            }
        }
        // Sort Sheets
        // await this.sortSheets(documentId)

        // Format, etc.
        // await this.formatSheets(documentId)
    }

    public updateInvestmentTransactions = async (accounts: Account[], writeToOneSheet?: boolean) => {
        const documentId = this.googleConfig.documentId[1]

        // Sort transactions by date
        const investmentTransactions = sortBy(accounts.map(account => account.transactions).flat(10), 'date')

        //Not terribly useful in currently since anything that isn't fetched this run is overwritten
        if (writeToOneSheet) {
            this.updateSheet(
                'AllTest',
                investmentTransactions,
                this.config.investmentTransactions.properties,
                true,
                true,
                documentId
            )
        } else {
            // Split transactions by month
            const groupedTransactions = groupBy(investmentTransactions, transaction =>
                formatISO(startOfMonth(transaction.date))
            )

            // Write transactions by month, copying template sheet if necessary
            for (const month in groupedTransactions) {
                await this.updateSheet(
                    format(parseISO(month), this.googleConfig.dateFormat || 'yyyy.MM'),
                    groupedTransactions[month],
                    this.config.investmentTransactions.properties,
                    true,
                    true,
                    documentId
                )
            }
        }
        // Sort Sheets
        // await this.sortSheets(documentId)

        // Format, etc.
        // await this.formatSheets()
    }

    public updateHoldings = async (accounts: Account[]) => {
        const documentId = this.googleConfig.documentId[1]
        // Sort transactions by date
        const holdings = accounts.map(account => account.holdings).flat(10)

        this.updateSheet('Investments', holdings, this.config.holdings.properties, true, false, documentId)

        // Sort Sheets
        // await this.sortSheets(documentId)

        // Format, etc.
        // await this.formatSheets()
    }

    public updateBalances = async (accounts: Account[]) => {
        // Update Account Balances Sheets
        for (let sheet of this.googleConfig.documentId) {
            this.updateSheet('Balances', accounts, this.config.balances.properties, undefined, undefined, sheet)
        }

        this.balanceHistory('History', accounts)

        // Sort Sheets
        // await this.sortSheets()

        // Format, etc.
        // await this.formatSheets()
    }

    public balanceHistory = async (sheetTitle: string, accounts: Account[], useTemplate?: boolean) => {
        let columnHeaders = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
        columnHeaders = [...columnHeaders, ...columnHeaders.map(x => columnHeaders[0] + x)]
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
        const lastDate = await this.getValues(this.googleConfig.documentId[0], `${sheetTitle}!A:A`).then(
            data => data.values[data.values.length - 1][0]
        )

        if (lastDate === date) {
            console.log('Day has already been recorded in history')
            return
        }
        // #endregion check if this day has been done

        let idsFromSheet = await this.getValues(this.googleConfig.documentId[0], `${sheetTitle}!1:1`).then(
            data => data.values[0]
        )

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

        const existingData = await this.getValues(this.googleConfig.documentId[0], existingDataRange)

        const numRows = existingData.values ? existingData.values.length : 0
        //#endregion get existing data

        const newDataRange: Range = {
            sheet: sheetTitle,
            start: `A${numRows + rowOffset}`,
            end: `${columnHeaders[row.length > 0 ? row.length - 1 : 1]}${numRows + rowOffset}`
        }

        console.log('Recorded new day in history')

        return this.updateRanges([{ range: newDataRange, data: [row] }])
    }

    public getValues(spreadsheetId: string, range: string): Promise<sheets_v4.Schema$ValueRange> {
        return this.sheets.values
            .get({
                spreadsheetId,
                range
            })
            .then(({ data }) => data)
            .catch(error => {
                logError(`Error geting values from  ${range}`, error)
                return {}
            })
    }

    public async setOptionPrices(): Promise<void> {
        let prices: [string[]] = [[]]
        const optionStrings = await this.getValues(this.googleConfig.documentId[1], `Option Prices!A1:A`)

        for (var row of optionStrings.values) {
            if (row.length > 0) {
                const price = (await this.getOptionPrice(row[0])) || -1
                prices.push([row[0], price])
            }
        }

        this.clearRanges([{ sheet: 'Option Prices', start: 'D1', end: `E` }], this.googleConfig.documentId[1])

        this.updateRanges(
            [{ range: { sheet: 'Option Prices', start: 'D1', end: `E${prices.length}` }, data: prices }],
            this.googleConfig.documentId[1]
        )
    }

    //should move this somewhere else
    private async getOptionPrice(optionString: string): Promise<any> {
        const options = {
            method: 'GET',
            url: `http://query2.finance.yahoo.com/v7/finance/options/${optionString}`,
            params: {},
            headers: {}
        }

        return axios.request(options).then(function(response) {
            if (response?.data?.optionChain?.result[0]?.quote?.regularMarketPrice) {
                return response.data.optionChain.result[0].quote.regularMarketPrice
            }
            return -1
        })
    }

    public async cloneTransactions(): Promise<void> {
        logInfo('Cloning transactions')
        const names = (await this.getValues(this.googleConfig.documentId[0], `All!A1:D`)).values

        const range = { sheet: 'Balances', start: 'J1', end: `M` }
        await this.clearRanges([range], this.googleConfig.documentId[2])

        this.updateRanges([{ range, data: names }], this.googleConfig.documentId[2])
    }

    public async cloneAccountNames(): Promise<void> {
        logInfo('Cloning Account Names')
        const transactions = (await this.getValues(this.googleConfig.documentId[0], `Balances!M2:N`)).values
        logInfo('Got Account Names')

        const range = { sheet: 'Balances', start: 'M', end: `N` }
        for (let i = 1; i < this.googleConfig.documentId.length; i++) {
            await this.clearRanges([range], this.googleConfig.documentId[i])

            this.updateRanges([{ range, data: transactions }], this.googleConfig.documentId[i])
        }
    }
}
