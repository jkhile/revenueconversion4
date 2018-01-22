const Promise = require('bluebird')
const xlsx = require('xlsx')

function _loadKindleXlsx (inputFile) {
  // Read a .xlsx source file, then extract and return the contents as a JS object
  return new Promise((resolve, reject) => {
    try {
      const workbook = xlsx.readFile(inputFile)
      // Starting 2016-09, the .xlsx file has multiple worksheets.
      if (workbook.SheetNames.length > 1 && !workbook.Workbook.Sheets[0].name.startsWith('eBook Royalty')) {
        throw new Error(`input file ${inputFile} has more than one worksheet and first sheet is not eBook Royalty Report`)
      }
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]

      // Some older Kindle .xlsx files had a bug in the form of '\r\n' characters at the end of the 'Units Sold' header
      // The 'Units Sold' header should appear in cell D1
      if (worksheet.hasOwnProperty('D1')) {
        worksheet['D1'].v = worksheet['D1'].w = 'Units Sold'
      }

      // As of 2017/10, Kindle .xlsx reports added a top line with the date of the report,
      // which means we need to start the conversion to json with line 1 rather than line 0
      let headerRow = 0
      if (worksheet['A1'].v === 'Sales Period') {
        headerRow = 1
      }
      const jsonData = xlsx.utils.sheet_to_json(worksheet, {range: headerRow})

      // Kindle revenue files don't include the currency in the transaction item lines
      // They are, instead, on header lines above a group of transaction lines.
      // Note: as of 2017/11, Kindle report files now DO include the currency as a column
      // in the reports so the code below has been fixed to work with both formats
      let latestCurrency = 'USD'

      jsonData.forEach(function (rcrd, index, dataArray) {
        if (rcrd.hasOwnProperty('Royalty')) {
          const matched = rcrd['Royalty'].match(/\((...)\)$/)
          if (matched) {
            latestCurrency = matched[1]
          } else if (rcrd.hasOwnProperty('Currency')) {
            latestCurrency = rcrd.Currency
          }
          if (parseInt(rcrd['Units Sold']) > 0) {
            dataArray[index]['CurrencyCode'] = latestCurrency
          }
        }
      })

      const revenueData = jsonData.filter((value) => {
        return parseInt(value['Units Sold']) > 0
      })

      resolve(revenueData)
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  _loadKindleXlsx
}
