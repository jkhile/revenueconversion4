const Promise = require('bluebird')
const commandLineArgs = require('command-line-args')
const xlsx = require('xlsx')
const { writeFileSync } = require('fs-extra')

function _loadAcxXlsx(inputFile) {
  return new Promise((resolve, reject) => {
    try {
      const workbook = xlsx.readFile(inputFile)
      if (
        workbook.SheetNames.length !== 2 ||
        workbook.SheetNames[1] !== 'Sales Details'
      ) {
        throw new Error(
          `input file ${inputFile} does not have two worksheets or second worksheet is not Sales Details`
        )
      }
      const worksheet = workbook.Sheets['Sales Details']
      // Check that the report structure is as expected
      const expectedHeaders = {
        C4: 'Title',
        E4: 'Mkt',
        R4: 'Qty.',
        T4: 'Royalty',
      }
      if ('!ref' in worksheet) {
        const range = xlsx.utils.decode_range(worksheet['!ref'])
        if (range.e.r < 4) {
          throw new Error(
            `input file ${inputFile} does not have enough rows for the expected headers`
          )
        }
      } else {
        throw new Error(
          `input file ${inputFile} does not have a !ref property to define the range in the worksheet`
        )
      }

      for (const cell in expectedHeaders) {
        if (!worksheet[cell]['v'].startsWith(expectedHeaders[cell])) {
          throw new Error(
            `input file ${inputFile} does not have the expected header ${cell}:${expectedHeaders[cell]}`
          )
        }
      }
      // Fix the header of the RoyaltyEarned column to exclude the \n so sheet_to_json() will work
      worksheet['T4'].w = 'RoyaltyEarned'
      const sheetData = xlsx.utils.sheet_to_json(worksheet, { range: 3 })
      const revenueRows = sheetData.filter((value) => {
        return 'Title' in value
      })
      resolve(revenueRows)
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  _loadAcxXlsx,
}
