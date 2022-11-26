export interface Holdings {
    accountId: string
    cost_basis: number
    institution_price: number
    institution_price_as_of: Date
    institution_price_datetime: Date
    institution_value: number
    // iso_currency_code: string,
    quantity: number
    security_id: string
    // unofficial_currency_code: null

    security_name: string
}
