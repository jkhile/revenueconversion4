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
      // if (!worksheet['D1'].v.startsWith('Units Sold')) {
      //   throw new Error('Header in cell D1 is not \'Units Sold\'')
      // }
      if (worksheet.hasOwnProperty('D1')) {
        worksheet['D1'].v = worksheet['D1'].w = 'Units Sold'
      }

      let headerRow = 0
      if (worksheet['A1'].v === 'Sales Period') {
        headerRow = 1
      }
      const jsonData = xlsx.utils.sheet_to_json(worksheet, {range: headerRow})

      // Kindle revenue files don't include the currency in the transaction item lines
      // They are, instead, on header lines above a group of transaction lines
      let latestCurrency = 'USD'

      jsonData.forEach(function (rcrd, index, dataArray) {
        if (rcrd.hasOwnProperty('Royalty')) {
          const matched = rcrd['Royalty'].match(/\((...)\)$/)
          if (matched) {
            latestCurrency = matched[1]
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
