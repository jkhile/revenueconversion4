const Promise = require('bluebird')
const lodash = require('lodash')
const fs = require('fs')
const path = require('path')
const csv = require('csv')
const chalk = require('chalk')
const R = require('ramda')
const { _loadKindleXlsx } = require('./_loadKindleXlsx')
const { _loadFromXlsx } = require('./_loadFromXlsx')
const { _loadFromCsv } = require('./_loadFromCsv')
const { _loadFromAppleZippedCsv } = require('./_loadFromAppleZippedCsv')
const { _mapFields } = require('./_mapFields')

function convertRevenueFile(format, inputFile) {
  return new Promise((resolve, reject) => {
    console.log(chalk.green.bold(`Converting: ${inputFile}`))
    // Read the revenue report file based on the specified format
    let loadInputFile = null
    if (format === 'kindle') {
      loadInputFile = _loadKindleXlsx(inputFile, format)
    } else if (format === 'kobo') {
      if (inputFile.endsWith('.csv')) {
        loadInputFile = _loadFromCsv(inputFile, format)
      } else {
        loadInputFile = _loadFromXlsx(inputFile, { sheetName: 'Kobo' })
      }
    } else if (format === 'ibooks') {
      // Apple wraps their reports in zip files so we have to work a bit harder to get at them.
      loadInputFile = _loadFromAppleZippedCsv(inputFile)
    } else {
      loadInputFile = _loadFromCsv(inputFile, format)
    }
    loadInputFile
      .then((revenueData) => {
        // revenueData is an array of objects containing column_header: value pairs
        // Since each source uses a different spreadsheet layout with different columns,
        // we need to map the resulting data to a common format

        // mapOptions will be passed into the map funtion, accessible as 'this'
        const company = inputFile.match(/[\/\\](DCM|FEP)[\/\\]/)[1]
        const revenueDir = inputFile.match(/^(.*[\/\\]RevenueReports)/)[1]
        const mapFileName = path.join(revenueDir, `${company}-title-to-QB-class-map.js`)
        const mapFile = require(mapFileName)
        // const titleToClassMap =
        const mapOptions = {
          format,
          inputFile,
          mapFile,
        }
        // Create an array of promises to convert each source rcrd into a rcrd suitable
        // for import into Quickbooks
        const convertedRcrds = revenueData.map(_mapFields, mapOptions)
        return Promise.all(convertedRcrds)
      })
      .then((convertedRows) => {
        // convertedRows is now an array of record objects formatted for import in QB
        // If any rows are missing a value for the LineClass property, report an error and bail
        if (lodash.find(convertedRows, (row) => !row.lineItemClass)) {
          global.notConverted.push(inputFile)
          // console.log(chalk.red.bold('Error: Cannot covert. One or more records are missing LineClass field'))
          return
        }
        // remove any rcrds where 'LineQty' value is <= 0
        convertedRows = convertedRows.filter((row) => {
          return row['lineItemQuantity'] > 0
        })

        // merge any rows for the same book with the same details
        const mergedRows = convertedRows.reduce((accumulator, row) => {
          // See if there is already a row in the accumulator for the same book
          const found = lodash.find(accumulator, (value) => {
            return value.lineItemClass === row.lineItemClass && value.lineItemRate === row.lineItemRate
          })
          if (found) {
            found.lineItemQuantity += row.lineItemQuantity
            found.lineItemAmount += row.lineItemAmount
          } else {
            accumulator.push(row)
          }
          return accumulator
        }, [])

        // organize by currency code
        const byCurrency = lodash.reduce(
          mergedRows,
          (accumulator, row) => {
            if (!accumulator.hasOwnProperty(row.currencyCode)) {
              accumulator[row.currencyCode] = []
            }
            accumulator[row.currencyCode].push(row)
            return accumulator
          },
          {}
        )

        // create an output file for each currency found in the input file
        const csvStringify = Promise.promisify(csv.stringify)
        const outputPromises = lodash.map(byCurrency, (rows, currencyCode) => {
          const parts = path.parse(inputFile)
          const outputFile = path.join(parts.dir, `${parts.name}_${currencyCode}-TPI.csv`)
          const outputParts = path.parse(outputFile)
          if (outputParts.name.length > 21) {
            console.log('too long')
          }
          const relabeledRows = relabelRows(rows)
          csvStringify(relabeledRows, { header: true }).then((outputText) => {
            fs.writeFileSync(outputFile, outputText)
            return Promise.resolve(true)
          })
        })
        return Promise.all(outputPromises)
      })
      .then(() => {
        resolve(true)
      })
      .catch((error) => {
        console.log('Caught error in convertRevenueFile:')
        console.log(error)
        global.notConverted.push(inputFile)
        reject(error)
      })
  })
}

function relabelRows(rows) {
  // map of internal labels for fields to those used by the QB import app
  const fields = {
    invoiceNo: 'Invoice No',
    customer: 'Customer',
    transactionDate: 'Invoice Date',
    dueDate: 'Due Date',
    currencyCode: 'Currency Code',
    terms: 'Terms',
    memo: 'Memo',
    lineItem: 'Line Item',
    lineItemDescription: 'Line Item Description',
    lineItemClass: 'Line Item Class',
    lineItemServiceDate: 'Line Item Service Date',
    lineItemQuantity: 'Line Item Quantity',
    lineItemRate: 'Line Item Rate',
    lineItemAmount: 'Line Item Amount',
    lineItemTaxable: 'Line Item Taxable',
    title: '',
  }

  function assignLabels(row) {
    let relabeledRow = {}
    R.forEachObjIndexed((value, key) => {
      relabeledRow = R.assoc(fields[key], value, relabeledRow)
    }, row)
    return relabeledRow
  }

  const relabeledRows = R.map(assignLabels, rows)
  return relabeledRows
}

module.exports = {
  convertRevenueFile,
}
