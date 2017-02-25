const assert = require('assert')
const _ = require('underscore')
const co = require('co')
const Joi = require('joi')
const validation = require('./validation.js')

class Model {
  static get Joi () {
    return Joi
  }
  constructor (name, db, schema) {
    this.db = db
    this.schema = schema

    this._ready = db.collection(name).then(collection => {
      this.collection = collection
    })
  }
  ready () {
    const self = this

    return co(function* () {
      yield self._ready
    })
  }
  get name () {
    return this.collection.name
  }
  create (data) {
    const self = this

    return co(function* () {
      yield self.ready()

      const now = _.now()

      data = yield validation(data, self.schema)
      data = data.map(e => Object.assign({ createdAt: now }, e))

      return self.collection.import(data)
    }).catch(console.error)
  }
  find (opts = {}) {
    const self = this

    return co(function* () {
      yield self.ready()

      let { filter, skip = 0, limit = 100, sort } = opts

      skip = parseInt(skip)
      limit = parseInt(limit)

      let q = self.db.qb.for('doc').in(self.collection.name)

      q = qFilter(q, filter, self.db)
      q = qSort(q, sort)
      q = q.limit(skip, limit)

      return self.db.query(q.return('doc'))
    }).catch(console.error)
  }
  findBy (pattern, limit = 100) {
    const self = this

    return co(function* () {
      yield self.ready()
      const cursor = yield self.collection.byExample(pattern, { limit })

      return cursor.all()
    }).catch(console.error)
  }
  findOne (opts = {}) {
    const self = this

    return co(function* () {
      yield self.ready()

      let data

      if (_.isString(opts)) {
        data = yield self.collection.document(opts)
      } else {
        let { filter, sort, skip = 0 } = opts

        let q = self.db.qb.for('doc').in(self.collection.name)

        q = qFilter(q, filter, self.db)
        q = qSort(q, sort)
        q = q.limit(skip, 1)

        data = (yield self.db.query(q.return('doc')))[0]
      }

      return data
    }).catch(console.error)
  }
  update (pattern, newValue) {
    const self = this
    const now = _.now()

    return co(function* () {
      yield self.ready()

      if (_.isString(pattern)) {
        newValue = Object.assign({ updatedAt: now }, newValue)
        return self.collection.update(pattern, newValue)
      }

      if (_.isArray(pattern)) {
        pattern = pattern.map(e => Object.assign({ updatedAt: now }, e))
        pattern = yield validation(pattern, self.schema)
        return self.collection.bulkUpdate(pattern)
      }

      if (_.isObject(pattern) && newValue) {
        [newValue] = yield validation(newValue, self.schema)
        newValue = Object.assign({ updatedAt: now }, newValue)
        return self.collection.updateByExample(pattern, newValue)
      }
    }).catch(console.error)
  }
  delete (pattern) {
    const self = this

    return co(function* () {
      yield self.ready()

      if (_.isString(pattern)) { pattern = [pattern] }

      if (pattern) {
        if (_.isArray(pattern) && _.isString(pattern[0])) {
          return self.collection.removeByKeys(pattern)
        } else if (_.isObject(pattern)) {
          return self.collection.removeByExample(pattern)
        }
      }
    }).catch(console.error)
  }
  deleteAll () {
    return this.collection.truncate()
  }
  count (filter) {
    const self = this

    return co(function* () {
      yield self.ready()

      if (filter) {
        let q = self.db.qb.for('doc').in(self.collection.name)

        q = qFilter(q, filter, self.db)
        q = q.collectWithCountInto('count')

        let data = yield self.db.query(q.return('count'))

        return data[0]
      } else {
        let result = yield self.collection.count()
        return result.count
      }
    }).catch(console.error)
  }
}

function qFilter (q, filter, db) {
  if (filter) {
    if (!_.isArray(filter)) { filter = [filter] }

    if (filter.length) {
      filter.forEach(e => {
        let expr = e.split(' ').filter(e => !!e)
        assert(expr.length === 3, `Wrong filter - ${e}`)

        let [field, condition] = expr

        let arg = e.split(condition)[1].trim()

        field = 'doc.' + field
        condition = condition.toLowerCase()

        if (arg === 'null') {
          arg = null
        } else {
          let num = +arg
          if (!arg.includes('\'') && !arg.includes('"') && num) {
            arg = db.qb.num(num)
          } else {
            arg = db.qb.str(arg.replace(/^("|')|("|')$/g, ''))
          }
        }

        switch (condition) {
          case '==' : q = q.filter(db.qb.eq(field, arg)); break
          case '!=' : q = q.filter(db.qb.neq(field, arg)); break
          case '<' : q = q.filter(db.qb.lt(field, arg)); break
          case '<=' : q = q.filter(db.qb.lte(field, arg)); break
          case '>' : q = q.filter(db.qb.gt(field, arg)); break
          case '>=' : q = q.filter(db.qb.gte(field, arg)); break

          case 'like' : q = q.filter(db.qb.eq(db.qb.LIKE(field, arg, true), true)); break

          default: throw new Error(`Wrong condition - ${condition}`)
        }
      })
    }
  }

  return q
}

function qSort (q, sort) {
  if (sort) {
    if (!_.isArray(sort)) { sort = [sort] }

    if (sort.length) {
      sort.forEach(e => {
        let expr = e.split(' ').filter(e => !!e)
        assert(expr.length === 2, `Wrong sort - ${e}`)

        let [field, direction] = expr

        field = 'doc.' + field
        direction = direction.toLowerCase()

        if (direction === '1') { direction = 'ASC' }
        if (direction === '0') { direction = 'DESC' }

        q = q.sort(field, direction)
      })
    }
  }

  return q
}

module.exports = Model
