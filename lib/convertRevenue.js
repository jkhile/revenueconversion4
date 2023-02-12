const Promise = require('bluebird')
const path = require('path')
const walk = require('walk')
const lodash = require('lodash')
const glob = require('glob')
const fsExtra = require('fs-extra')

const { convertRevenueFile } = require('./convertRevenueFile')

function convertRevenue(reportDir) {
  if (!fsExtra.pathExistsSync(reportDir)) {
    throw new Error(`Can't find report directory: ${reportDir}`)
  }
  // Yes, intentionally using global variables for this simple purpose
  global.missingTitles = []
  global.notConverted = []
  const walker = walk.walk(reportDir, {})

  walker.on('end', () => {
    console.log('All done')
    if (global.notConverted.length > 0) {
      console.log('The following files could not be converted:')
      lodash.forEach(lodash.uniq(global.notConverted), (l) => console.log(l))
    }
    if (global.missingTitles.length > 0) {
      // fsExtra.writeFileSync('missing.txt', JSON.stringify(lodash.uniq(global.missingTitles), null, 2))
      const missingTitlesReport = lodash.map(
        global.missingTitles,
        (l) => `  '${l}': '',`
      )
      console.log('Missing Titles:')
      fsExtra.writeFileSync('missing.txt', '{\n')
      lodash.forEach(lodash.uniq(missingTitlesReport), (l) => {
        console.log(l)
        fsExtra.appendFileSync('missing.txt', `${l}\n`)
      })
      fsExtra.appendFileSync('missing.txt', '}\n')
    }
  })

  walker.on('file', (root, filestats, next) => {
    const fname = filestats.name
    // 2020-04-30 add test for legal filename
    // if (!fname.match(/^\d{4}-\d{2}_[a-z]{3,6}(?:_[A-Z]{2,3})?(?:_[A-Z]{3}-TPI)?\.(?:xls|xlsx|csv|zip)/)) {
    //   console.log('Suspicious file name: ', fname)
    // }
    if (
      fname.match(/^\d{4}-\d{2}_.*\..{3,4}$/) &&
      !fname.match(/.*[-_]TPI.*\.csv/)
    ) {
      const inputFile = path.join(root, fname)
      const formats = [
        'lsi',
        'kindle',
        'ibooks',
        'nook',
        'google',
        'kobo',
        'acx',
      ]
      let format = null
      const matched = fname.match(/\d{4}-\d{2}_(.*?)(_.*)?\..+$/)
      if (matched.length > 1) {
        format = matched[1]
      }
      if (!format) {
        throw new Error(`Can't identify format of input file ${fname}`)
      }
      if (!lodash.includes(formats, format)) {
        throw new Error(`Unrecognized format for input file ${inputFile}`)
      }
      _fileConverted(inputFile).then((converted) => {
        if (!converted) {
          convertRevenueFile(format, inputFile)
            .then(() => {
              next()
            })
            .catch((error) => {
              console.log(`Could not convert ${inputFile}. Error:`)
              console.log(error)
              next()
            })
        } else {
          next()
        }
      })
    } else {
      next()
    }
  })
}

function _fileConverted(inputFile) {
  return new Promise((resolve, reject) => {
    // Are there any output files derived from this file that are newer?
    let alreadyConverted = false
    const inputFileTime = fsExtra.statSync(inputFile).mtime.getTime()
    const { dir, name } = path.parse(inputFile)
    const globPattern = path.join(dir, `${name}*-TPI.csv`)
    const globPromise = Promise.promisify(glob)
    globPromise(globPattern)
      .then((derivedFiles) => {
        if (
          derivedFiles.length > 0 &&
          lodash.find(derivedFiles, (file) => {
            const fileTime = fsExtra.statSync(file).mtime.getTime()
            return fileTime > inputFileTime
          })
        ) {
          alreadyConverted = true
        }
        resolve(alreadyConverted)
      })
      .catch((error) => {
        reject(error)
      })
  })
}

module.exports = {
  convertRevenue,
  _fileConverted,
}
