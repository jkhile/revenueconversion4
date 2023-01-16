const ArgsConfigPrompt = require('./lib/_argsConfigPrompt')
const path = require('path')

const {verifyClassMap} = require('./lib/_verifyClassMap')

function checkClassMap() {
  const argOptions = [
    {name: 'baseDirectory', alias: 'b'},
    {name: 'company', alias: 'c', prompt: 'company to operate on, FEP or DCM'}
  ]
  const programArgs = new ArgsConfigPrompt(argOptions, 'fepdcm').resolve()
  const revenueDirectory = path.resolve(programArgs.baseDirectory, `${programArgs.company.toUpperCase()}/RevenueReports`)
  try {
    verifyClassMap(revenueDirectory)
  } catch (error) {
    console.log('OOPS! An error occurred while running checkClassMap:')
    console.log(error)
  }
}

checkClassMap()
