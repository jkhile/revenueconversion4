function _normalizeTitle (title) {
  // Normalize a book title by forcing to all lower case and converting any curly quotes to straight quotes
  let normalizedTitle = title.toLowerCase()
  normalizedTitle = normalizedTitle.replace(/[“”]/g, '"')
  normalizedTitle = normalizedTitle.replace(/[‘’]/g, '\'')
  return normalizedTitle
}

module.exports = {
  _normalizeTitle
}
