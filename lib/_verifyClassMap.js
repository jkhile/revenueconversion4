const path = require('path')
const fsExtra = require('fs-extra')
const R = require('ramda')

// We look for two files in the revenueDirectory: the class map file used by convertRevenue:
// 'FEP-title-to-QB-class-map.js' and a file with a list of all the current class codes: FEP-current-class-list.txt
// The class list can be generated as a report in Quickbooks and exported.
// This function reports on any class names that show up in the map file but aren't found in the class list file
function verifyClassMap(revenueDirectory) {
  // Make sure both files exist
  const mapFile = path.resolve(revenueDirectory, 'FEP-title-to-QB-class-map.js')
  const classListFile = path.resolve(revenueDirectory, 'FEP-current-class-list.txt')
  // Make sure both files exist
  if (!fsExtra.pathExistsSync(mapFile)) {
    throw new Error(`Can't find map file ${mapFile}`)
  }
  if (!fsExtra.pathExistsSync(classListFile)) {
    throw new Error(`Can't find class list file ${classListFile}`)
  }

  // Load current class list as an array of strings
  const classListContent = fsExtra.readFileSync(classListFile, { encoding: 'utf8' })
  const classList = classListContent.split('\r\n')

  const classMap = require(mapFile)
  const classesInMap = R.values(classMap)
  R.forEach(c => {
    if (classList.indexOf(c) === -1) {
      console.log(`class '${c}' not found in class list`)
    }
  }, classesInMap)
}

module.exports = { verifyClassMap }
