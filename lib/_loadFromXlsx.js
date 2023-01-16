const Promise = require('bluebird')
const xlsx = require('xlsx')
const lodash = require('lodash')

function _loadFromXlsx (inputFile, options) {
  return new Promise((resolve, reject) => {
    // options are: sheetName:regex, useSoloSheet:bool
    try {
    const workbook = xlsx.readFile(inputFile)
    const sheets = workbook.SheetNames.length
    const sheetName = (sheets === 1 && lodash.get(options, 'useSoloSheet', false)) ? workbook.SheetNames[0] : lodash.get(options, 'sheetName')
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = xlsx.utils.sheet_to_json(worksheet)
    return resolve(jsonData)
    } catch (error) {
      console.log(`Error in _loadFromXlsx(${inputFile}:`)
      return reject(error)
    }
  })
}

module.exports = {
  _loadFromXlsx
}
