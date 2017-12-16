const Promise = require('bluebird')
const R = require('ramda')
const path = require('path')
const lodash = require('lodash')
const fsExtra = require('fs-extra')
const zlib = require('zlib')
const decompress = require('decompress')
const csv = require('csv')
const tmp = require('tmp')
const { _cleanCsv } = require('./_cleanCsv')

function _loadFromAppleZippedCsv(inputFile) {
  return new Promise((resolve, reject) => {
    const tmpdir = tmp.dirSync({ prefix: 'revenue-conversion-', unsafeCleanup: true }).name
    // tmpdir will be cleaned up automatically at process exit
    decompress(inputFile, tmpdir)
      .then(() => {
        const unzippedFiles = fsExtra.readdirSync(tmpdir)
        // if (unzippedFiles.length > 2) {
        //   throw new Error(`Apple file ${inputFile} contains more than two zipped files`)
        // }

        // Valid iBook files will have a 'Summary.csv' file included
        if (!R.find(R.test(/Summary.csv/), unzippedFiles)) {
          throw new Error('zip file does not contain "Summary.csv"')
        }
        // But we don't actually need the summary file, so remove it
        const dataFiles = R.reject(R.test(/Summary.csv/), unzippedFiles)

        let csvData = undefined
        const innerZippedFile = lodash.find(dataFiles, fn => fn.endsWith('.txt.gz'))
        if (innerZippedFile) {
          // Older ibooks report files contained only one data file and it
          // was gzipped (even though contained within a zip file)
          const innerZippedResolved = path.join(tmpdir, innerZippedFile)
          csvData = zlib.gunzipSync(fsExtra.readFileSync(innerZippedResolved))
        } else {
          // As of about October, 2017, ibooks report files can contain multiple
          // data files within the zip file and the inner data files are not longer gzipped
          const combinedFiles = R.map(fn => {
            return fsExtra.readFileSync(path.join(tmpdir, fn), {encoding: 'utf-8'})
          }, unzippedFiles)
          csvData = R.flatten(combinedFiles)
          // const dataFile = lodash.find(unzippedFiles, fn => fn.endsWith('.txt'))
          // csvData = fsExtra.readFileSync(path.join(tmpdir, dataFile))
        }
        csvData = _cleanCsv(csvData.toString(), 'ibooks')
        const parse = Promise.promisify(csv.parse)
        return parse(csvData, { columns: true, delimiter: '\t', relax_column_count: true }).then(parsed => {
          resolve(parsed)
        })
      })
      .catch(error => {
        console.log('Error in _loadFromAppleZippedCsv: ', error)
        reject(error)
      })
  })
}

module.exports = {
  _loadFromAppleZippedCsv,
}
