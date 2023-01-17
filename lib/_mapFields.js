const Promise = require('bluebird')
const path = require('path')
const moment = require('moment')
const R = require('ramda')
const { _normalizeTitle } = require('./_normalizeTitle')
const CurrencyConverter = require('./_CurrencyConverter')
const currencyConverter = new CurrencyConverter()
const numbro = require('numbro')

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
        acx: 30,
      }

      // Map fields that are common to all input formats
      const mappedRecord = {
        transactionDate: transactionDate.format('MM-DD-YYYY'),
        dueDate: transactionDate
          .clone()
          .add(revenueDelayDays[self.format], 'days')
          .format('MM-DD-YYYY'),
        terms: `Net ${revenueDelayDays[self.format]}`,
        lineItemServiceDate: transactionDate.format('MM-DD-YYYY'),
        lineItemTaxable: 'No',
      }

      const formatSpecific = {
        nook: _nookSpecific,
        lsi: _lsiSpecific,
        ibooks: _ibooksSpecific,
        kindle: _kindleSpecific,
        google: _googleSpecific,
        kobo: _koboSpecific,
        acx: _acxSpecific,
      }
      const formatMappings = formatSpecific[self.format](row, transactionDate)
      // Add invoiceNo here because it depends on formatSpecific mapped fields and the inputFile name
      formatMappings.invoiceNo = `${transactionDate.format('YYYY-MM')}_${
        self.format
      }_${formatMappings.currencyCode}`
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
      currencyConverter
        .getRate(fieldMap['currencyCode'], 'USD')
        .then((rate) => {
          if (fieldMap['currencyCode'] !== 'USD') {
            fieldMap.memo = `Converted to USD from ${fieldMap.lineItemAmount.toFixed(
              2
            )} ${fieldMap['currencyCode']} at ${rate}`
            fieldMap.lineItemRate = (fieldMap.lineItemRate * rate).toFixed(2)
            fieldMap.lineItemAmount = (fieldMap.lineItemAmount * rate).toFixed(
              2
            )
          }

          // delete fields that we don't want/need in QB import file
          // we don't upload the item rate so that QB will calculate the correct rate itself.
          resolve(R.omit(['title', 'lineItemRate'], fieldMap))
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
    throw new Error(
      `file name ${fName} not properly formated with month and year`
    )
  }
  const transactionDate = moment(
    `${yearMonth[1]}/${yearMonth[2]}`,
    'YYYY/MM'
  ).endOf('month')
  return transactionDate
}

function _nookSpecific(row, transactionDate) {
  if (R.has('Unit Royalty', row)) {
    return {
      customer: 'Barnes & Noble - Nook',
      lineItem: 'Other Income - Nook',
      lineItemQuantity: parseInt(row['Units Sold']),
      lineItemDescription: `Compensation from Nook Sales ${transactionDate.format(
        'YYYY-MMM'
      )}`,
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
      lineItemDescription: `Compensation from Nook Sales ${transactionDate.format(
        'YYYY-MMM'
      )}`,
      lineItemRate: parseFloat(row['Royalty per Unit']),
      lineItemAmount: parseFloat(row['Total Royalty']),
      memo: '',
      title: row['Title'],
      currencyCode: row['Payment Currency'],
    }
  }
}

function _koboSpecific(row, transactionDate) {
  let headers = {
    quantity: 'Quantity',
    lineItemAmount: 'COGS in Payable Currency',
  }
  if (R.not(R.has(headers['quantity'], row))) {
    headers = R.assoc('quantity', 'Total Qty', headers)
  }
  if (R.not(R.has(headers['lineItemAmount'], row))) {
    headers = R.assoc('lineItemAmount', 'COGS (Payable Currency)', headers)
  }
  return {
    customer: 'Kobo',
    lineItem: 'Other Income - Kobo',
    lineItemQuantity: parseInt(row[headers['quantity']]),
    lineItemDescription: `Compensation from Kobo sales ${transactionDate.format(
      'YYYY-MMM'
    )}`,
    lineItemRate: parseFloat(
      (
        parseFloat(row[headers['lineItemAmount']]) /
        parseInt(row[headers['quantity']])
      ).toFixed(2)
    ),
    lineItemAmount: parseFloat(row[headers['lineItemAmount']]),
    memo: '',
    title: row['Title'],
    currencyCode: row['Payable Currency'],
  }
}

function _lsiSpecific(row, transactionDate) {
  // Need to calculate the unit price for this on
  const periodColumnPrefix = row.hasOwnProperty('MTD_avg_wholesale_price')
    ? 'MTD_'
    : 'PTD_'
  const avgWholesalePrice = parseFloat(
    row[`${periodColumnPrefix}avg_wholesale_price`]
  )
  const printCharge = parseFloat(
    row[`${periodColumnPrefix}extended_print_charge`]
  )
  const qty = parseInt(row[`${periodColumnPrefix}Quantity`])
  const lineUnitPrice = qty === 0 ? 0 : avgWholesalePrice + printCharge / qty
  return {
    customer: 'Lightning Source',
    lineItem: 'Other Income - Lightning Source',
    lineItemQuantity: qty,
    lineItemDescription: `Compensation from LSI ${transactionDate.format(
      'YYYY-MMM'
    )}`,
    lineItemRate: lineUnitPrice,
    lineItemAmount: parseFloat(row[`${periodColumnPrefix}pub_comp`]),
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
    lineItemDescription: `Compensation from Kindle Sales ${transactionDate.format(
      'YYYY-MMM'
    )}`,
    lineItemRate: parseFloat(
      (parseFloat(row['Royalty']) / parseInt(row['Units Sold'])).toFixed(2)
    ),
    lineItemAmount: parseFloat(row['Royalty']),
    memo: '',
    title: row['Title'],
    currencyCode: row['CurrencyCode'],
  }
}

function _acxSpecific(row, transactionDate) {
  const qty = numbro(row['Qty._3']).value()
  const royalty = numbro(row['Royalty Earned_3']).value()
  return {
    customer: 'ACX',
    lineItem: 'Other Income - Acx',
    lineItemQuantity: qty,
    lineItemDescription: `Compensation from ACX Sales ${transactionDate.format(
      'YYYY-MMM'
    )}`,
    lineItemRate: (royalty / qty).toFixed(2),
    lineItemAmount: royalty,
    memo: '',
    title: row['Title'],
    currencyCode: 'USD', // ACX reports in USD
  }
}

function _ibooksSpecific(row, transactionDate) {
  return {
    customer: 'Apple itunes',
    lineItem: 'Other Income - Apple iTunes',
    lineItemQuantity: parseInt(row['Quantity']),
    lineItemDescription: `Compensation from Apple iBook Sales ${transactionDate.format(
      'YYYY-MMM'
    )}`,
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
    lineItemDescription: `Compensation from Google Play Sales ${transactionDate.format(
      'YYYY-MMM'
    )}`,
    lineItemRate: (
      parseFloat(row['Earnings Amount']) / parseInt(row['Qty'])
    ).toFixed(2),
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
