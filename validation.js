const _ = require('underscore')
const Joi = require('joi')

module.exports = (data, schema) => {
  return new Promise((resolve, reject) => {
    if (schema) {
      schema._key = Joi.string().optional()
      schema._id = Joi.string().optional()
      schema._rev = Joi.string().optional()
      schema.createdAt = Joi.number().optional()
      schema.updatedAt = Joi.number().optional()

      schema = Joi.array().items(Joi.object().keys(schema)).single()

      Joi.validate(data, schema, (err, value) => {
        if (err) {
          reject(err)
        } else {
          resolve(value)
        }
      })
    } else {
      if (!_.isArray(data)) { data = [data] }
      resolve(data)
    }
  })
}
