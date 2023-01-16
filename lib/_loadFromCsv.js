const Promise = require('bluebird')
const fs = require('fs')
const d3Dsv = require('d3-dsv')
const jschardet = require('jschardet')
const iconv = require('iconv-lite')

const { _cleanCsv } = require('./_cleanCsv')

function _loadFromCsv(inputFile, format) {
  const readFile = Promise.promisify(fs.readFile)
  return new Promise((resolve, reject) => {
    readFile(inputFile)
      .then(inputBuffer => {
        const encoding = jschardet.detect(inputBuffer)
        let bufrEncoding = encoding.encoding
        if (
          bufrEncoding === 'ISO-8859-1' ||
          bufrEncoding === 'ISO-8859-2' ||
          bufrEncoding === 'EUC-JP' ||
          bufrEncoding === 'ascii' ||
          bufrEncoding === 'windows-1252'
        ) {
          bufrEncoding = 'UTF-8'
        }
        const inputText = inputBuffer.toString(bufrEncoding)
        const csvText = _cleanCsv(inputText, format)
        const tabDelimited = Boolean(csvText.split('\n')[0].match(/\t/))
        const parsed = tabDelimited ? d3Dsv.tsvParse(csvText) : d3Dsv.csvParse(csvText)
        resolve(parsed)
      })
      .catch(error => {
        reject(error)
      })
  })
}

module.exports = {
  _loadFromCsv,
}
