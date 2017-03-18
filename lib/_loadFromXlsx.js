const Promise = require('bluebird')
const xlsx = require('xlsx')
const lodash = require('lodash')

function _loadFromXlsx (inputFile, options) {
  return new Promise((resolve) => {
    // options are: sheetName:regex, useSoloSheet:bool
    const workbook = xlsx.readFile(inputFile)
    const sheets = workbook.SheetNames.length
    const sheetName = (sheets === 1 && lodash.get(options, 'useSoloSheet', false)) ? workbook.SheetNames[0] : lodash.get(options, 'sheetName')
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = xlsx.utils.sheet_to_json(worksheet)

    resolve(jsonData)
  })
}

module.exports = {
  _loadFromXlsx
}
