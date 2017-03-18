// This is simple command-line interface to the main convertRevenue module.
// Its use should be temporary until we get an Electron UI interface ready.
// This module is simple ES5 so that no babel transpilation is necessary.

const commander = require('commander')
const path = require('path')

const {convertRevenue} = require('./lib/convertRevenue')

function revenueConversion() {
  commander
    .option('-d, --dir [directory name]', 'name of base directory containing revenue reports')
    .parse(process.argv)

  if (!commander.hasOwnProperty('dir')) {
    commander.help()
    throw new Error('--directory option not specified')
  }

  try {
    convertRevenue(path.resolve(commander.dir))
  } catch (error) {
    console.log('OOPS! An error occurred while running RevenueConversion:')
    console.log(error)
  }
}

revenueConversion()
