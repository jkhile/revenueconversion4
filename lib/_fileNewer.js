const fs = require('fs')

function _fileNewer (file1, file2) {
  // returns true if file1 is newer than file2
  let file2Stats = null
  try {
    file2Stats = fs.statSync(file2)
  } catch (error) {
    // file2 doesn't exist so file 1 is 'newer'
    return true
  }
  const file1Stats = fs.statSync(file1)
  return file1Stats.mtime.getTime() > file2Stats.mtime.getTime()
}

module.exports = {
  _fileNewer
}
