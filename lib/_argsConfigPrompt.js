const R = require('ramda')
const commandLineArgs = require('command-line-args')
const rc = require('rc')
const prompt = require('prompt-sync')

// options: an array of objects with properties:
//  name: the command line arg: --name, required
//  alias: a one-letter alias for the full name
//  type: a function that will take in text and return value
//  prompt: the screen prompt to show user if needed
class ArgsConfigPrompt {
  constructor(options, configFileName) {
    this.options = options
    this.configFileName = configFileName
  }

  resolve() {
    // Check, in order, command line args then config file.
    // If still not defined, prompt for value

    // First, get any args specified on the command line

    const clArgs = commandLineArgs(this.options)
    const rcArgs = rc(this.configFileName, {}, () => { })
    const provided = R.merge(R.omit(['config', 'configs'], rcArgs), clArgs)

    // Find any args still missing that need to be prompted for
    const wanted = R.map(o => o.name, this.options)
    const found = R.keys(provided)
    const promptFor = R.difference(wanted, found)

    if (promptFor.length > 0) {
      const promptFunc = prompt({ sigint: true })
      R.forEach(p => {

        const opt = R.find(R.propEq('name', p), this.options)
        const promptText = R.has('prompt', opt) ? `${opt.prompt}: ` : `Enter ${p}: `
        provided[p] = promptFunc(promptText)
      }, promptFor)
    }
    return provided
  }
}

module.exports = ArgsConfigPrompt
