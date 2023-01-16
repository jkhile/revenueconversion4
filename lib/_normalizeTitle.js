const snakeCase = require('snake-case')

function _normalizeTitle (title) {
  return snakeCase(title)
}

module.exports = {
  _normalizeTitle
}
