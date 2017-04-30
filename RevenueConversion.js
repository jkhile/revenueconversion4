// This is simple command-line interface to the main convertRevenue module.
// Its use should be temporary until we get an Electron UI interface ready.
// This module is simple ES5 so that no babel transpilation is necessary.
const ArgsConfigPrompt = require('./lib/_argsConfigPrompt')
const path = require('path')

const {convertRevenue} = require('./lib/convertRevenue')

function revenueConversion() {
  const argOptions = [
    {name: 'baseDirectory', alias: 'b'},
    {name: 'company', alias: 'c', prompt: 'company to operate on, FEP or DCM'}
  ]
  const programArgs = new ArgsConfigPrompt(argOptions, 'fepdcm').resolve()
  console.log(programArgs)
  const revenueDirectory = path.resolve(programArgs.baseDirectory, `${programArgs.company.toUpperCase()}/RevenueReports`)
  try {
    console.log('revenueDirectory', revenueDirectory)
    convertRevenue(revenueDirectory)
  } catch (error) {
    console.log('OOPS! An error occurred while running RevenueConversion:')
    console.log(error)
  }
}

revenueConversion()
