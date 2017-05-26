const glob = require('glob')
const R = require('ramda')
const fsExtra = require('fs-extra')
const ArgsConfigPrompt = require('./lib/_argsConfigPrompt')
const path = require('path')

function main() {
  const argOptions = [
    { name: 'baseDirectory', alias: 'b' },
    { name: 'company', alias: 'c', prompt: 'company to operate on, FEP or DCM' },
  ]
  const programArgs = new ArgsConfigPrompt(argOptions, 'fepdcm').resolve()
  const revenueDirectory = path.resolve(
    programArgs.baseDirectory,
    `${programArgs.company.toUpperCase()}/RevenueReports`
  )
  try {
    const convertedFiles = glob.sync(`${revenueDirectory}/**/*-TPI.*`)
    R.forEach(f => {
      console.log(`Deleting ${f}`)
      fsExtra.removeSync(f)
    }, convertedFiles)
  } catch (error) {
    console.log('OOPS! An error occurred while running removeConverted:')
    console.log(error)
  }
}

main()
