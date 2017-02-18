const _ = require('underscore')
const co = require('co')

const listCollections = co.wrap(function * (db) {
  let collections = yield db.arango.listCollections()
  collections = _.map(collections, c => c.name)
  return collections
})

const deleteCollections = co.wrap(function * (db) {
  const collections = yield listCollections(db)
  for (let e of collections) {
    yield db.arango.collection(e).drop()
  }
})

const clean = (data) => {
  const fields = ['_key', '_id', '_rev', 'createdAt', 'updatedAt']

  if (_.isArray(data)) {
    return data.map(e => _.omit(e, ...fields))
  } else {
    return _.omit(data, ...fields)
  }
}

module.exports = { deleteCollections, listCollections, clean }
