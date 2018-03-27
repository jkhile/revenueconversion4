const Promise = require('bluebird')
const path = require('path')
const moment = require('moment')
const R = require('ramda')
const { _normalizeTitle } = require('./_normalizeTitle')
const CurrencyConverter = require('./_CurrencyConverter')
const currencyConverter = new CurrencyConverter()

function _mapFields(row) {
  // 'this' is an object with 'format' and 'inputFile' properties
  const self = this
  return new Promise((resolve, reject) => {
    try {
      // 'self' will have 'format', 'inputFile'  and 'mapFile' properties
      const transactionDate = _transactionDateFromFileName(self.inputFile)

      const revenueDelayDays = {
        lsi: 90,
        kindle: 60,
        ibooks: 30,
        nook: 60,
        google: 60,
        kobo: 60,
      }

      // Map fields that are common to all input formats
      const mappedRecord = {
        transactionDate: transactionDate.format('MM/DD/YYYY'),
        dueDate: transactionDate.clone().add(revenueDelayDays[self.format], 'days').format('MM/DD/YYYY'),
        terms: `Net ${revenueDelayDays[self.format]}`,
        lineItemServiceDate: transactionDate.format('MM/DD/YYYY'),
        lineItemTaxable: 'No',
      }

      const formatSpecific = {
        nook: _nookSpecific,
        lsi: _lsiSpecific,
        ibooks: _ibooksSpecific,
        kindle: _kindleSpecific,
        google: _googleSpecific,
        kobo: _koboSpecific,
      }
      const formatMappings = formatSpecific[self.format](row, transactionDate)
      // Add invoiceNo here because it depends on formatSpecific mapped fields and the inputFile name
      formatMappings.invoiceNo = `${path.parse(self.inputFile).name}_${formatMappings.currencyCode}`
      const fieldMap = Object.assign(mappedRecord, formatMappings)

      // Lookup the Quickbooks class that correspondes to the title of the book
      // memo tht the title may take slightly different forms as reported by the
      // various distribution outlets so there may need to be multiple entries in
      // the map files
      const normalizedTitle = _normalizeTitle(fieldMap.title)
      fieldMap.lineItemClass = self.mapFile[normalizedTitle]
      // if (self.inputFile.match(/\/DCM\//)) {
      //   fieldMap.LineClass = DCM_titleToClassMap[normalizedTitle]
      // } else {
      //   fieldMap.LineClass = FEP_titleToClassMap[normalizedTitle]
      // }
      if (!fieldMap.lineItemClass) {
        global.missingTitles.push(normalizedTitle)
      }

      // Do currency conversion where necessary using todays rates
      currencyConverter.getRate(fieldMap['currencyCode'], 'USD').then((rate) => {
        if (fieldMap['currencyCode'] !== 'USD') {
          fieldMap.memo = `Converted to USD from ${fieldMap.lineAmount.toFixed(2)} ${fieldMap[
            'currencyCode'
          ]} at ${rate}`
          fieldMap.lineItemRage = (fieldMap.lineItemRate * rate).toFixed(2)
          fieldMap.lineItemAmount = (fieldMap.lineItemAmount * rate).toFixed(2)
        }
        // delete fieldMap.currencyCode
        resolve(R.omit(['title'], fieldMap))
      })
    } catch (error) {
      reject(error)
    }
  })
}

function _transactionDateFromFileName(fileName) {
  // input files, by design, contain the year, month and source as elements of the name
  const fName = path.parse(fileName).name
  const yearMonth = fName.match(/^(\d{4})-(\d{2})/)
  if (!yearMonth) {
    throw new Error(`file name ${fName} not properly formated with month and year`)
  }
  const transactionDate = moment(`${yearMonth[1]}/${yearMonth[2]}`, 'YYYY/MM').endOf('month')
  return transactionDate
}

function _nookSpecific(row, transactionDate) {
  if (R.has('Unit Royalty', row)) {
    return {
      customer: 'Barnes & Noble - Nook',
      lineItem: 'Other Income - Nook',
      lineItemQuantity: parseInt(row['Units Sold']),
      lineItemDescription: `Compensation from Nook Sales ${transactionDate.format('YYYY-MMM')}`,
      lineItemRate: parseFloat(row['Unit Royalty']),
      lineItemAmount: parseFloat(row['Total Royalty']),
      memo: '',
      title: row['Title'],
      currencyCode: row['Currency'],
    }
  } else if (R.has('Royalty per Unit', row)) {
    return {
      customer: 'Barnes & Noble - Nook',
      lineItem: 'Other Income - Nook',
      lineItemQuantity: parseInt(row['Net Units Sold']),
      lineDescription: `Compensation from Nook Sales ${transactionDate.format('YYYY-MMM')}`,
      lineItemRate: parseFloat(row['Royalty per Unit']),
      lineItemAmount: parseFloat(row['Total Royalty']),
      memo: '',
      title: row['Title'],
      currencyCode: row['Payment Currency'],
    }
  }
}

function _koboSpecific(row, transactionDate) {
  return {
    customer: 'Kobo',
    lineItem: 'Other Income - Kobo',
    lineItemQuantity: parseInt(row['Quantity']),
    lineItemDescription: `Compensation from Kobo sales ${transactionDate.format('YYYY-MMM')}`,
    lineItemRate: parseFloat((parseFloat(row['COGS in Payable Currency']) / parseInt(row['Quantity'])).toFixed(2)),
    lineItemAmount: parseFloat(row['COGS in Payable Currency']),
    memo: '',
    title: row['Title'],
    currencyCode: row['Payable Currency'],
  }
}

function _lsiSpecific(row, transactionDate) {
  // Need to calculate the unit price for this one
  const avgWholesalePrice = parseFloat(row['MTD_avg_wholesale_price'])
  const printCharge = parseFloat(row['MTD_extended_print_charge'])
  const qty = parseInt(row['MTD_Quantity'])
  const lineUnitPrice = qty === 0 ? 0 : avgWholesalePrice + printCharge / qty
  return {
    customer: 'Lightning Source',
    lineItem: 'Other Income - Lightning Source',
    lineItemQuantity: qty,
    lineItemDescription: `Compensation from LSI ${transactionDate.format('YYYY-MMM')}`,
    lineItemRate: lineUnitPrice,
    lineItemAmount: parseFloat(row['MTD_pub_comp']),
    memo: '',
    title: row['title'],
    currencyCode: row['reporting_currency_code'],
  }
}

function _kindleSpecific(row, transactionDate) {
  return {
    customer: 'Amazon Digital Kindle',
    lineItem: 'Other Income - Kindle',
    lineItemQuantity: parseInt(row['Units Sold']),
    lineItemDescription: `Compensation from Kindle Sales ${transactionDate.format('YYYY-MMM')}`,
    lineItemRate: parseFloat((parseFloat(row['Royalty']) / parseInt(row['Units Sold'])).toFixed(2)),
    lineItemAmount: parseFloat(row['Royalty']),
    memo: '',
    title: row['Title'],
    currencyCode: row['CurrencyCode'],
  }
}

function _ibooksSpecific(row, transactionDate) {
  return {
    customer: 'Apple itunes',
    lineItem: 'Other Income - Apple iTunes',
    lineItemQuantity: parseInt(row['Quantity']),
    lineItemDescription: `Compensation from Apple iBook Sales ${transactionDate.format('YYYY-MMM')}`,
    lineItemRate: parseFloat(row['Partner Share']),
    lineItemAmount: parseFloat(row['Extended Partner Share']),
    memo: '',
    title: row['Title'],
    currencyCode: row['Partner Share Currency'],
  }
}

function _googleSpecific(row, transactionDate) {
  return {
    customer: 'google play',
    lineItem: 'Other Income - Google Play',
    lineItemQuantity: parseInt(row['Qty']),
    lineItemDescription: `Compensation from Google Play Sales ${transactionDate.format('YYYY-MMM')}`,
    lineItemRate: (parseFloat(row['Earnings Amount']) / parseInt(row['Qty'])).toFixed(2),
    lineItemAmount: parseFloat(row['Earnings Amount']),
    memo: '',
    title: row['Title'],
    currencyCode: row['Earnings Currency'],
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
  _googleSpecific,
}
