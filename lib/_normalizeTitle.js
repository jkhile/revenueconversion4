function _normalizeTitle (title) {
  // Normalize a book title by forcing to all lower case
  let normalizedTitle = title.toLowerCase()
  //   removing any single quotes
  normalizedTitle = normalizedTitle.replace(/[‘’']/g, '')
  //   and converting curly quotes to straight quotes
  normalizedTitle = normalizedTitle.replace(/[“”]/g, '"')
  return normalizedTitle
}

module.exports = {
  _normalizeTitle
}
