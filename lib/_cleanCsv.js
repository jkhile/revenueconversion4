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
  const filteredLines = lines.filter((line, index) => {
    const matched = line.match(keepers[format])
    return index === 0 || matched != null
  })

  // Remove the byte-order-marker is there is one
  if (filteredLines[0].charCodeAt(0) === 49135) {
    // found a byte-order-marker
    filteredLines[0] = filteredLines[0].substr(3)
  }

  // recombine the filtered array of lines back into a single text string
  return filteredLines.join('\n')
}

module.exports = {
  _cleanCsv
}
