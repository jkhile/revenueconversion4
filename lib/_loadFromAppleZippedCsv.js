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
        const innerZippedBaseName = lodash.find(unzippedFiles, fn => fn.endsWith('.txt.gz'))
        const innerZippedFullName = path.join(tmpdir, innerZippedBaseName)
        const unzipped2 = zlib.gunzipSync(fsExtra.readFileSync(innerZippedFullName))
        // console.log('unzipped2: ', unzipped2.toString())
        const csvData = _cleanCsv(unzipped2.toString(), 'ibooks')
        // console.log('csvData: ', csvData)
        const parse = Promise.promisify(csv.parse)
        return parse(csvData, {columns: true, delimiter: '\t', relax_column_count: true})
      .then((parsed) => {
        // console.log('\n\nparsed: ', parsed)
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
