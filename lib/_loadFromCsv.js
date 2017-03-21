const Promise = require('bluebird')
const fs = require('fs')
const csv = require('csv')
const detectCharacterEncoding = require('detect-character-encoding')
const {_cleanCsv} = require('./_cleanCsv')

function _loadFromCsv (inputFile, format) {
  const readFile = Promise.promisify(fs.readFile)
  const parse = Promise.promisify(csv.parse)
  const formatOptions = {
    'lsi': {
      csvDelimiter: '\t',
      encoding: 'utf8'
    },
    'ibooks': {
      csvDelimiter: '\t',
      encoding: 'utf8'
    },
    'nook': {
      csvDelimiter: ',',
      encoding: 'utf8'
    },
    'google': {
      csvDelimiter: '\t',
      encoding: 'utf16le'
    },
    'kobo': {
      csvDelimiter: ',',
      encoding: 'utf8'
    }
  }
  return new Promise((resolve, reject) => {
    readFile(inputFile)
    .then((inputBuffer) => {
      const encoding = detectCharacterEncoding(inputBuffer)
      let bufrEncoding = encoding.encoding
      if (bufrEncoding === 'ISO-8859-1' || bufrEncoding === 'windows-1252') {
        bufrEncoding = 'latin1'
      }
      const inputText = inputBuffer.toString(bufrEncoding)
      const csvText = _cleanCsv(inputText, format)
      fs.writeFileSync('csvText.txt', csvText)
      // A decided kluge to deal with the fact that Google made significant changes to its report format
      if (format === 'google' && encoding.encoding === 'UTF-8') {
        formatOptions.google.csvDelimiter = ','
      }
      return parse(csvText, {columns: true, delimiter: formatOptions[format].csvDelimiter, relax_column_count: true})
    })
    .then((parsedData) => {
      resolve(parsedData)
    })
    .catch((error) => {
      reject(error)
    })
  })
}

module.exports = {
  _loadFromCsv
}
