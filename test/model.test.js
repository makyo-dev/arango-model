const _ = require('underscore')
const co = require('co')

const expect = require('chai').expect

const password = process.env.ARANGO_ROOT_PASSWORD || 'toor'

const DB = require('../db.js')
const db = new DB({ database: 'test', username: 'root', password })
const Model = require('../model.js')

const helpers = require('./helpers.js')

let dataset = [{ test: 2 }, { test: 1 }, { test: 3 }]
let datasetASC = [{ test: 1 }, { test: 2 }, { test: 3 }]
let datasetDESC = [{ test: 3 }, { test: 2 }, { test: 1 }]

describe('Model', () => {
  let model

  before(() => helpers.deleteCollections(db))

  beforeEach(() => {
    model = new Model('testCollection', db)
    return model.ready()
  })

  afterEach(() => helpers.deleteCollections(db))

  it('#name', () => {
    return co(function * () {
      expect(model.name).to.equal('testCollection')
    })
  })

  describe('#create()', () => {
    it('should create single document', () => {
      return co(function * () {
        let result = yield model.create({ test: 'test1' })

        expect(result).to.have.property('created', 1)
        expect(result).to.have.property('errors', 0)

        result = yield db.query(db.aql`
            FOR t IN testCollection
                RETURN t
        `)

        expect(result).to.have.lengthOf(1)
        expect(result[0]).to.contain.all.keys(['test', 'createdAt'])
      })
    })

    it('should create multiple documents', () => {
      return co(function * () {
        let result = yield model.create([{ test: 'test2' }, { test: 'test3' }])

        expect(result).to.have.property('created', 2)
        expect(result).to.have.property('errors', 0)

        result = yield db.query(db.aql`
            FOR t IN testCollection
                RETURN t
        `)

        result.forEach((e) => {
          expect(e).to.contain.all.keys(['test', 'createdAt'])
          expect(e.test).to.be.oneOf(['test2', 'test3'])
        })
      })
    })

    it('should validate data by schema', () => {
      return co(function * () {
        let j = Model.Joi

        let schema = {
          s: j.string(),
          n: j.number(),
          o: j.object(),
          a: j.array()
        }

        let obj1 = { s: 'test', n: 123, o: {}, a: [] }

        let model = new Model('testCollection', db, schema)

        yield model.create(obj1)
      })
    })
  })

  describe('#find()', () => {
    it('should find documents with limit', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.find({ limit: 2 })

        expect(result).to.have.lengthOf(2)
      })
    })

    it('should sort documents', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.find({ sort: 'test ASC' })
        result = helpers.clean(result)
        expect(result).to.eql(datasetASC)

        result = yield model.find({ sort: 'test 1' })
        result = helpers.clean(result)
        expect(result).to.eql(datasetASC)

        result = yield model.find({ sort: 'test DESC' })
        result = helpers.clean(result)
        expect(result).to.eql(datasetDESC)

        result = yield model.find({ sort: 'test 0' })
        result = helpers.clean(result)
        expect(result).to.eql(datasetDESC)
      })
    })

    it('should skip documents', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.find({ skip: 2, sort: 'test 1' })

        expect(result).to.have.lengthOf(1)
        expect(result[0]).to.have.property('test', datasetASC[2].test)

        result = yield model.find({ skip: 2, sort: 'test 0' })

        expect(result).to.have.lengthOf(1)
        expect(result[0]).to.have.property('test', datasetDESC[2].test)
      })
    })

    it('should filter documents', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.find({ filter: 'test == 2' })

        expect(result).to.have.lengthOf(1)
        expect(result[0]).to.have.property('test', 2)

        result = yield model.find({ filter: 'test != 2' })

        expect(result).to.have.lengthOf(2)
        result.forEach((e) => {
          expect(e.test).to.be.oneOf([1, 3])
        })

        result = yield model.find({ filter: 'test < 3' })

        expect(result).to.have.lengthOf(2)
        result.forEach((e) => {
          expect(e.test).to.be.oneOf([1, 2])
        })

        result = yield model.find({ filter: 'test <= 2' })

        expect(result).to.have.lengthOf(2)
        result.forEach((e) => {
          expect(e.test).to.be.oneOf([1, 2])
        })

        result = yield model.find({ filter: 'test > 1' })

        expect(result).to.have.lengthOf(2)
        result.forEach((e) => {
          expect(e.test).to.be.oneOf([2, 3])
        })

        result = yield model.find({ filter: 'test >= 2' })

        expect(result).to.have.lengthOf(2)
        result.forEach((e) => {
          expect(e.test).to.be.oneOf([2, 3])
        })

        yield model.create([
          { test: 'qwe123' },
          { test: 'qwe321' },
          { test: 'qwe312' }
        ])

        result = yield model.find({ filter: 'test LIKE qwe3%' })

        expect(result).to.have.lengthOf(2)
        result.forEach((e) => {
          expect(e.test).to.be.oneOf(['qwe321', 'qwe312'])
        })
      })
    })
  })

  it('#findBy()', () => {
    return co(function * () {
      yield model.create(dataset)

      let result = yield model.findBy(dataset[2])

      expect(result).to.have.lengthOf(1)
      expect(result[0]).to.have.property('test', dataset[2].test)

      yield model.create(dataset)
      yield model.create(dataset)

      result = yield model.findBy(dataset[2], 2)

      expect(result).to.have.lengthOf(2)
      result.forEach((e) => {
        expect(e).to.have.property('test', 3)
      })
    })
  })

  describe('#findOne()', () => {
    it('should sort documents', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.findOne({ sort: 'test ASC' })
        result = helpers.clean(result)
        expect(result).to.be.a('object')
        expect(result).to.eql(datasetASC[0])

        result = yield model.findOne({ sort: 'test 1' })
        result = helpers.clean(result)
        expect(result).to.be.a('object')
        expect(result).to.eql(datasetASC[0])

        result = yield model.findOne({ sort: 'test DESC' })
        result = helpers.clean(result)
        expect(result).to.be.a('object')
        expect(result).to.eql(datasetDESC[0])

        result = yield model.findOne({ sort: 'test 0' })
        result = helpers.clean(result)
        expect(result).to.be.a('object')
        expect(result).to.eql(datasetDESC[0])
      })
    })

    it('should skip documents', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.findOne({ skip: 1, sort: 'test ASC' })

        expect(result).to.be.a('object')
        expect(result).to.have.property('test', datasetASC[1].test)

        result = yield model.findOne({ skip: 1, sort: 'test DESC' })

        expect(result).to.be.a('object')
        expect(result).to.have.property('test', datasetDESC[1].test)
      })
    })

    it('should filter documents', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.findOne({ filter: 'test == 2' })

        expect(result).to.be.a('object')
        expect(result).to.have.property('test', 2)

        result = yield model.findOne({ filter: 'test != 2' })

        expect(result).to.be.a('object')
        expect(result).to.not.have.property('test', 2)

        result = yield model.findOne({ filter: 'test < 3' })

        expect(result).to.be.a('object')
        expect(result).to.not.have.property('test', 3)

        result = yield model.findOne({ filter: 'test <= 2' })

        expect(result).to.be.a('object')
        expect(result.test).to.be.oneOf([1, 2])

        result = yield model.findOne({ filter: 'test > 1' })

        expect(result).to.be.a('object')
        expect(result.test).to.be.oneOf([2, 3])

        result = yield model.findOne({ filter: 'test >= 2' })

        expect(result).to.be.a('object')
        expect(result.test).to.be.oneOf([2, 3])

        yield model.create([
          { test: 'qwe123' },
          { test: 'qwe321' },
          { test: 'qwe312' }
        ])

        result = yield model.findOne({ filter: 'test LIKE qwe3%' })

        expect(result).to.be.a('object')
        expect(result.test).to.be.oneOf(['qwe321', 'qwe312'])
      })
    })

    it('should find document by key', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.findBy(dataset[0])

        let key = result[0]._key

        result = yield model.findOne(key)

        expect(result).to.be.a('object')
        expect(result).to.have.property('test', dataset[0].test)
      })
    })
  })

  describe('#update()', () => {
    it('should update document by key', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.findBy(dataset[0])

        let key = result[0]._key

        let data = { test: '12345' }

        result = yield model.update(key, data)
        result = yield model.findBy(data)

        expect(result).to.have.lengthOf(1)
        expect(result[0]).to.have.property('test', data.test)
        expect(result[0]).to.have.property('updatedAt')
      })
    })

    it('should update multiple documents', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.find()

        result.forEach((e, i) => { e.test += 5 * i })

        yield model.update(result)

        let result1 = yield model.find()

        expect(result1).to.have.lengthOf(3)
        expect(result1[0]).to.have.property('updatedAt')
        expect(helpers.clean(result1)).to.be.eql(helpers.clean(result))
      })
    })

    it('should update document by example', () => {
      return co(function * () {
        yield model.create(dataset)

        const data = { test: 12345 }

        let result = yield model.update(datasetASC[1], data)
        expect(result).to.have.property('updated', 1)
        expect(result).to.have.property('error', false)

        result = yield model.find({ sort: 'test ASC' })
        expect(_.last(result)).to.have.property('updatedAt')

        result = helpers.clean(result)
        expect(result).to.have.length(3)
        expect(result).to.include(data)
      })
    })

    it('should validate data by schema', () => {
      return co(function * () {
        let j = Model.Joi

        let schema = {
          s: j.string(),
          n: j.number(),
          o: j.object(),
          a: j.array()
        }

        let obj1 = { s: 'test', n: 123, o: {}, a: [] }
        let obj2 = { s: 'test1', n: '1234', o: { q: 1 }, a: [1, 2, 3, 4, 5] }

        let model = new Model('testCollection', db, schema)

        yield model.create(obj1)
        yield model.update(obj1, obj2)
      })
    })
  })

  describe('#delete()', () => {
    it('should delete single document by key', () => {
      return co(function * () {
        yield model.create(datasetASC)

        let result = yield model.find({ sort: 'test ASC' })

        result = yield model.delete(result[0]._key)

        expect(result).to.have.property('removed', 1)
        expect(result).to.have.property('error', false)

        result = yield model.find()

        expect(result).to.have.lengthOf(2)
        result.forEach((e) => {
          expect(e.test).to.be.oneOf([2, 3])
        })
      })
    })

    it('should delete multiple documents by key', () => {
      return co(function * () {
        yield model.create(datasetASC)

        let result = yield model.find({ sort: 'test ASC' })

        result = yield model.delete([result[0]._key, result[1]._key])

        expect(result).to.have.property('removed', 2)
        expect(result).to.have.property('error', false)

        result = yield model.find()

        expect(result).to.have.lengthOf(1)
        expect(result[0]).to.have.property('test', datasetASC[2].test)
      })
    })
  })

  describe('#deleteAll()', () => {
    it('should delete all documents', () => {
      return co(function * () {
        yield model.create(dataset)

        let result = yield model.find()
        expect(result).to.have.lengthOf(3)

        result = yield model.deleteAll()
        expect(result).to.have.property('error', false)

        result = yield model.find()
        expect(result).to.have.lengthOf(0)
      })
    })
  })

  it('#count()', () => {
    return co(function * () {
      yield model.create(datasetASC)

      let result = yield model.count()

      expect(result).to.equal(3)

      yield model.create(datasetASC[1])

      result = yield model.count()
      expect(result).to.equal(4)

      result = yield model.count(`test == ${datasetASC[1].test}`)
      expect(result).to.equal(2)

      result = yield model.count(`test > ${datasetASC[0].test}`)
      expect(result).to.equal(3)
    })
  })
})
