const _ = require('underscore')
const co = require('co')
const qb = require('aqb')
const aqlQuery = require('arangojs').aql

class DB {
  get qb () {
    return qb
  }
  get aql () {
    return aqlQuery
  }
  constructor ({
    database,
    username,
    password,
    host = '127.0.0.1',
    port = 8529,
    https = false,
    verbose = false
  }) {
    if (https) {
      port = 443
    }
    this._verbose = verbose
    this.arango = require('arangojs')({
      url: `http${https ? 's' : ''}://${username}:${password}@${host}:${port}`,
      databaseName: database
    })
  }
  collection (collectionName, opts) {
    const self = this
    const collection = this.arango.collection(collectionName)

    return co(function * () {
      if (!(yield self.collectionExists(collectionName))) {
        yield collection.create()
        if (self._verbose) {
          console.log(`Collection ${collectionName} just created!`)
        }
      }
      return collection
    }).catch(console.error)
  }
  dropCollection (collectionName) {
    const self = this
    const collection = this.arango.collection(collectionName)

    return co(function * () {
      if (yield self.collectionExists(collectionName)) {
        yield collection.drop()
        if (self._verbose) {
          console.log(`Collection ${collectionName} just droped!`)
        }
      } else if (self._verbose) {
        console.error(`Collection ${collectionName} does not exist!`)
      }
    }).catch(console.error)
  }
  listCollections () {
    const db = this.arango

    return co(function * () {
      let listCollections = yield db.listCollections()
      return _.map(listCollections, c => c.name)
    }).catch(console.error)
  }
  query (aql, map) {
    const self = this

    return co(function * () {
      let cursor = yield self.arango.query(aql)
      return _.isFunction(map) ? cursor.map(map) : cursor.all()
    }).catch(console.error)
  }
  collectionExists (collectionName) {
    const self = this

    return co(function * () {
      let listCollections = yield self.listCollections()

      return listCollections.includes(collectionName)
    }).catch(console.error)
  }
}

module.exports = DB
