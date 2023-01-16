const Promise = require('bluebird')
const lodash = require('lodash')
const superagent = require('superagent')
const AsyncCache = require('async-cache')

module.exports = class CurrencyConverter {
  constructor () {
    this.rateCache = new AsyncCache({
      max: 100,
      maxAge: 1000 * 60 * 10,
      load: function (codes, callback) {
        const [fromCode, toCode] = codes.split('.')
        const requestUrl = `http://currencies.apps.grandtrunk.net/getlatest/${fromCode}/${toCode}`
        superagent.get(requestUrl)
        .end((err, res) => {
          const rate = parseFloat(res.text)
          if (!err && !lodash.isFinite(rate)) {
            err = new Error(`illegal currency code, from:${fromCode}, to:${toCode}`)
          }
          callback(err, rate)
        })
      }
    })
  }

  getRate (fromCode, toCode) {
    return new Promise((resolve, reject) => {
      if (fromCode === toCode) {
        resolve(1.0)
      } else {
        const rateCache = this.rateCache
        const cacheGet = Promise.promisify(rateCache.get, {context: rateCache})
        const cacheKey = `${fromCode}.${toCode}`
        cacheGet(cacheKey)
        .then((rate) => {
          resolve(rate)
        })
        .catch((error) => {
          reject(error)
        })
      }
    })
  }

  convert (amount, fromCode, toCode) {
    return new Promise((resolve, reject) => {
      this.getRate(fromCode, toCode)
      .then((rate) => {
        resolve(amount * rate)
      })
      .catch((error) => {
        reject(error)
      })
    })
  }
}
