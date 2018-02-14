const R = require('ramda')

function _cleanCsv (rawData, format) {
  // Removes any lines from a .csv file that aren't actually revenue transaction records, based on format
  const keepers = {
    'nook': /^\d{1,2}\/\d{1,2}\/\d{4},/,
    'lsi': /^\d+\t/,
    'ibooks': /^\d\d\/\d\d\/\d{4}\t/,
    'google': /\"?\d{1,2}\/\d{1,2}\/\d{2}/,
    'kobo': /^\d{1,2}\/\d{1,2}\/\d{2},/
  }

  if (!keepers.hasOwnProperty(format)) {
    throw new Error(`${format} is not a recognized revenue format`)
  }

  // rawData will be long string comprising lines from the input file
  const lines = rawData.split(/\r?\n/)

  // Remove the byte-order-marker is there is one
  if (lines[0].charCodeAt(0) === 49135) {
    // found a byte-order-marker
    lines[0] = lines[0].substr(3)
  }

  let headerRow = -1
  const filteredLines = lines.filter((line, index) => {
    const matched = line.match(keepers[format])
    if (matched && headerRow < 0) {
      headerRow = index - 1
    }
    return Boolean(matched)
  })

  if (headerRow < 0) {
    throw new Error(`Couldn't determine header row in ${format} file`)
  }
  const cleanedLines = R.insert(0, lines[headerRow], filteredLines)

  // recombine the filtered array of lines back into a single text string
  return cleanedLines.join('\n')
}

module.exports = {
  _cleanCsv
}
