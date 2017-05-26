const Promise = require('bluebird')
const fs = require('fs')
const d3Dsv = require('d3-dsv')
const jschardet = require('jschardet')
const Iconv = require('iconv').Iconv

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
          bufrEncoding === 'EUC-JP' ||
          bufrEncoding === 'ascii'
        ) {
          bufrEncoding = 'UTF-8'
        }
        const iconv = new Iconv(bufrEncoding, 'UTF-8')
        if (bufrEncoding !== 'UTF-8') {
          console.log(`Converting encoding from ${bufrEncoding} to UTF-8`)
        }
        const utf8Bufr = iconv.convert(inputBuffer)
        const inputText = utf8Bufr.toString('UTF-8')
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
