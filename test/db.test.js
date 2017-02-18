const co = require('co')

const expect = require('chai').expect

const password = process.env.ARANGO_ROOT_PASSWORD || 'toor'

const DB = require('../db.js')
const db = new DB({ database: 'test', username: 'root', password })

const helpers = require('./helpers.js')

describe('DB', () => {
  before(() => helpers.deleteCollections(db))
  afterEach(() => helpers.deleteCollections(db))

  it('#collection()', () => {
    return co(function * () {
      yield db.collection('test1')
      yield db.collection('test2')

      let collections = yield helpers.listCollections(db)

      expect(collections).to.have.length(2)
      expect(collections).to.include('test1')
      expect(collections).to.include('test2')
    })
  })

  it('#dropCollection()', () => {
    return co(function * () {
      const test1 = yield db.collection('test1')
      yield db.collection('test2')

      yield db.dropCollection(test1.name)

      let collections = yield helpers.listCollections(db)

      expect(collections).to.have.length(1)
      expect(collections).to.include('test2')
    })
  })

  it('#listCollections()', () => {
    return co(function * () {
      yield db.collection('test1')
      yield db.collection('test2')
      yield db.collection('test3')

      const listCollections = yield db.listCollections()

      expect(listCollections).to.include.members(['test1', 'test2', 'test3'])
    })
  })

  it('#query()', () => {
    return co(function * () {
      const test1 = yield db.collection('test1')

      let data = { msg: 'test' }

      let result = yield db.query(db.aql`
          INSERT ${data} IN ${test1}
              RETURN NEW
      `)

      expect(result[0]).to.have.property('msg', 'test')

      result = yield db.query(db.aql`
          INSERT ${data} IN ${test1}
              RETURN NEW
      `, e => { e.msg = 'test12345'; return e })

      expect(result[0]).to.have.property('msg', 'test12345')
    })
  })
})
