const Promise = require('bluebird')
const path = require('path')
const lodash = require('lodash')
const fsExtra = require('fs-extra')
const zlib = require('zlib')
const decompress = require('decompress')
const csv = require('csv')
const tmp = require('tmp')
const {_cleanCsv} = require('./_cleanCsv')

function _loadFromAppleZippedCsv (inputFile) {
  return new Promise((resolve, reject) => {
    const tmpdir = tmp.dirSync({prefix: 'revenue-conversion-', unsafeCleanup: true}).name
    // tmpdir will be cleaned up automatically at process exit
    decompress(inputFile, tmpdir)
      .then(() => {
        const unzippedFiles = fsExtra.readdirSync(tmpdir)
        if (unzippedFiles.length > 2) {
          throw new Error(`Apple file ${inputFile} contains more than two zipped files`)
        }
        // older iBook reports gzipped the data file inside the .zip file
        // as of 2017/10, that is no longer true.
        let csvData = undefined
        const innerZippedFile = lodash.find(unzippedFiles, fn => fn.endsWith('.txt.gz'))
        if (innerZippedFile) {
          const innerZippedResolved = path.join(tmpdir, innerZippedFile)
          csvData = zlib.gunzipSync(fsExtra.readFileSync(innerZippedResolved))
        } else {
          const dataFile = lodash.find(unzippedFiles, fn => fn.endsWith('.txt'))
          csvData = fsExtra.readFileSync(path.join(tmpdir, dataFile))
        }
        csvData = _cleanCsv(csvData.toString(), 'ibooks')
        const parse = Promise.promisify(csv.parse)
        return parse(csvData, {columns: true, delimiter: '\t', relax_column_count: true})
      .then((parsed) => {
        resolve(parsed)
      })
      })
      .catch((error) => {
        console.log('Error in _loadFromAppleZippedCsv: ', error)
        reject(error)
      })
  })
}

module.exports = {
  _loadFromAppleZippedCsv
}
