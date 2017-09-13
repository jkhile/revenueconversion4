const Promise = require('bluebird')
const path = require('path')
const moment = require('moment')
const {_normalizeTitle} = require('./_normalizeTitle')
const CurrencyConverter = require('./_CurrencyConverter')
const currencyConverter = new CurrencyConverter()

function _mapFields (row) {
  // 'this' is an object with 'format' and 'inputFile' properties
  const self = this
  return new Promise((resolve, reject) => {
    try {
      // 'self' will have 'format', 'inputFile'  and 'mapFile' properties
      const transactionDate = _transactionDateFromFileName(self.inputFile)

      const revenueDelayDays = {
        'lsi': 90,
        'kindle': 60,
        'ibooks': 30,
        'nook': 60,
        'google': 60,
        'kobo': 60
      }

      // Map fields that are common to all input formats
      const mappedRecord = {
        RefNumber: `${path.parse(self.inputFile).name}_${row.CurrencyCode}`,
        // RefNumber: path.parse(self.inputFile).name,
        TxnDate: transactionDate.format('MM/DD/YYYY'),
        DueDate: transactionDate.clone().add(revenueDelayDays[self.format], 'days').format('MM/DD/YYYY'),
        SalesTerm: `Net ${revenueDelayDays[self.format]}`,
        LineServiceDate: transactionDate.format('MM/DD/YYYY'),
        LineTaxable: 'No'
      }

      const formatSpecific = {
        'nook': _nookSpecific,
        'lsi': _lsiSpecific,
        'ibooks': _ibooksSpecific,
        'kindle': _kindleSpecific,
        'google': _googleSpecific,
        'kobo': _koboSpecific
      }
      const formatMappings = formatSpecific[self.format](row, transactionDate)
      const fieldMap = Object.assign(mappedRecord, formatMappings)

      // Lookup the Quickbooks class that correspondes to the title of the book
      // Note tht the title may take slightly different forms as reported by the
      // various distribution outlets so there may need to be multiple entries in
      // the map files
      const normalizedTitle = _normalizeTitle(fieldMap.Title)
      fieldMap.LineClass = self.mapFile[normalizedTitle]
      // if (self.inputFile.match(/\/DCM\//)) {
      //   fieldMap.LineClass = DCM_titleToClassMap[normalizedTitle]
      // } else {
      //   fieldMap.LineClass = FEP_titleToClassMap[normalizedTitle]
      // }
      if (!fieldMap.LineClass) {
        global.missingTitles.push(normalizedTitle)
      }

      // Do currency conversion where necessary using todays rates
      currencyConverter.getRate(fieldMap['CurrencyCode'], 'USD')
      .then((rate) => {
        if (fieldMap['CurrencyCode'] !== 'USD') {
          fieldMap.Note = `Converted to USD from ${fieldMap.LineAmount.toFixed(2)} ${fieldMap['CurrencyCode']} at ${rate}`
          fieldMap.LineUnitPrice = (fieldMap.LineUnitPrice * rate).toFixed(2)
          fieldMap.LineAmount = (fieldMap.LineAmount * rate).toFixed(2)
        }
        // delete fieldMap.CurrencyCode
        resolve(fieldMap)
      })
    } catch (error) {
      reject(error)
    }
  })
}

function _transactionDateFromFileName (fileName) {
  // input files, by design, contain the year, month and source as elements of the name
  const fName = path.parse(fileName).name
  const yearMonth = fName.match(/^(\d{4})-(\d{2})/)
  if (!yearMonth) {
    throw new Error(`file name ${fName} not properly formated with month and year`)
  }
  const transactionDate = moment(`${yearMonth[1]}/${yearMonth[2]}`, 'YYYY/MM').endOf('month')
  return transactionDate
}

function _nookSpecific (row, transactionDate) {
  return {
    Customer: 'Barnes & Noble - Nook',
    LineItem: 'Other Income - Nook',
    LineQty: parseInt(row['Units Sold']),
    LineDesc: `Compensation from Nook Sales ${transactionDate.format('YYYY-MMM')}`,
    LineUnitPrice: parseFloat(row['Unit Royalty']),
    LineAmount: parseFloat(row['Total Royalty']),
    Note: '',
    Title: row['Title'],
    CurrencyCode: row['Currency']
  }
}

function _koboSpecific (row, transactionDate) {
  return {
    Customer: 'Kobo',
    LineItem: 'Other Income - Kobo',
    LineQty: parseInt(row['Quantity']),
    LineDesc: `Compensation from Kobo sales ${transactionDate.format('YYYY-MMM')}`,
    LineUnitPrice: parseFloat((parseFloat(row['COGS in Payable Currency']) / parseInt(row['Quantity'])).toFixed(2)),
    LineAmount: parseFloat(row['COGS in Payable Currency']),
    Note: '',
    Title: row['Title'],
    CurrencyCode: row['Payable Currency']
  }
}

function _lsiSpecific (row, transactionDate) {
  // Need to calculate the unit price for this one
  const avgWholesalePrice = parseFloat(row['MTD_avg_wholesale_price'])
  const printCharge = parseFloat(row['MTD_extended_print_charge'])
  const qty = parseInt(row['MTD_Quantity'])
  const lineUnitPrice = (qty === 0 ? 0 : avgWholesalePrice + printCharge / qty)
  return {
    Customer: 'Lightning Source',
    LineItem: 'Other Income - Lightning Source',
    LineQty: qty,
    LineDesc: `Compensation from LSI ${transactionDate.format('YYYY-MMM')}`,
    LineUnitPrice: lineUnitPrice,
    LineAmount: parseFloat(row['MTD_pub_comp']),
    Note: '',
    Title: row['title'],
    CurrencyCode: row['reporting_currency_code']
  }
}

function _kindleSpecific (row, transactionDate) {
  return {
    Customer: 'Amazon Digital Kindle',
    'LineItem': 'Other Income - Kindle',
    LineQty: parseInt(row['Units Sold']),
    LineDesc: `Compensation from Kindle Sales ${transactionDate.format('YYYY-MMM')}`,
    LineUnitPrice: parseFloat((parseFloat(row['Royalty']) / parseInt(row['Units Sold'])).toFixed(2)),
    LineAmount: parseFloat(row['Royalty']),
    Note: '',
    Title: row['Title'],
    CurrencyCode: row['CurrencyCode']
  }
}

function _ibooksSpecific (row, transactionDate) {
  return {
    Customer: 'Apple itunes',
    LineItem: 'Other Income - Apple iTunes',
    LineQty: parseInt(row['Quantity']),
    LineDesc: `Compensation from Apple iBook Sales ${transactionDate.format('YYYY-MMM')}`,
    LineUnitPrice: parseFloat(row['Partner Share']),
    LineAmount: parseFloat(row['Extended Partner Share']),
    Note: '',
    Title: row['Title'],
    CurrencyCode: row['Partner Share Currency']
  }
}

function _googleSpecific (row, transactionDate) {
  return {
    Customer: 'google play',
    LineItem: 'Other Income - Google Play',
    LineQty: parseInt(row['Qty']),
    LineDesc: `Compensation from Google Play Sales ${transactionDate.format('YYYY-MMM')}`,
    LineUnitPrice: (parseFloat(row['Earnings Amount']) / parseInt(row['Qty'])).toFixed(2),
    LineAmount: parseFloat(row['Earnings Amount']),
    Note: '',
    Title: row['Title'],
    CurrencyCode: row['Earnings Currency']
  }
}

module.exports = {
  _mapFields,
  _transactionDateFromFileName,
  _nookSpecific,
  _koboSpecific,
  _lsiSpecific,
  _kindleSpecific,
  _ibooksSpecific,
  _googleSpecific
}
