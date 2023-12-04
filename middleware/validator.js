//* middlewares/Validator.js
const createHttpError = require('http-errors')
//* Include joi to check error type 
const Joi = require('joi')
//* Include all validators
const Validators = require('../User/validators')

module.exports = function (validator) {
    //! If validator is not exist, throw err
    if (!Validators.hasOwnProperty(validator))
        throw new Error(`'${validator}' validator is not exist`)

    return async function (req, res, next) {
        try {
            console.log('validation++++++++++++++++++++++++++++++++1111111')
            const validated = await Validators[validator].validateAsync(req.body)
            req.body = validated
            next()
        } catch (err) {
            console.log('validation++++++++++++++++++++++++++++++++2222')
            //* Pass err to next
            //! If validation error occurs call next with HTTP 422. Otherwise HTTP 500
            if (err.isJoi)
                res.send({
                    code: 405,
                    message: err.message.replace(/['"]+/g, '')
                })
        }
    }
}