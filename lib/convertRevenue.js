const Promise = require('bluebird')
const path = require('path')
const walk = require('walk')
const lodash = require('lodash')
const glob = require('glob')
const fs = require('fs')

const {convertRevenueFile} = require('./convertRevenueFile')

function convertRevenue (reportDir) {

  // Yes, intentionally using a global variable for this simple purpose
  global.missingTitles = []
  const walker = walk.walk(reportDir, {})

  walker.on('end', () => {
    console.log('All done')
    if (global.missingTitles.length > 0) {
      console.log('Missing Titles:')
      console.log(missingTitles)
    }
  })

  walker.on('file', (root, filestats, next) => {
    const fname = filestats.name
    if (fname.match(/\d{4}-\d{2}_.*\..{3,4}$/) && !fname.match((/.*[-_]TPI\./))) {
      const inputFile = path.join(root, fname)
      const formats = ['lsi', 'kindle', 'ibooks', 'nook', 'google', 'kobo']
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
      _fileConverted(inputFile)
      .then((converted) => {
        if (!converted) {
          convertRevenueFile(format, inputFile)
          .then(() => {
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

function _fileConverted (inputFile) {
  return new Promise((resolve, reject) => {
    // TODO: temporary code until Kobo support is added
    // if (inputFile.includes('kobo')) {
    //   resolve(true)
    //   return
    // }
    // Are there any output files derived from this file that are newer?
    let alreadyConverted = false
    const inputFileTime = fs.statSync(inputFile).mtime.getTime()
    const { dir, name } = path.parse(inputFile)
    const globPattern = path.join(dir, `${name}*-TPI.csv`)
    const globPromise = Promise.promisify(glob)
    globPromise(globPattern)
    .then((derivedFiles) => {
      if (derivedFiles.length > 0 && lodash.find(derivedFiles, (file) => {
        const fileTime = fs.statSync(file).mtime.getTime()
        return fileTime > inputFileTime
      })) {
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
  _fileConverted
}
