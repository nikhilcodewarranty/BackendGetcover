const Joi = require("joi")
const create_servicer_validation = Joi.object({
    accountName: Joi.string().trim().replace(/\s+/g, ' ').required(),
    status: Joi.boolean().required(),
    street: Joi.string().trim().replace(/\s+/g, ' ').required(),
    city: Joi.string().trim().replace(/\s+/g, ' ').required(),
    zip: Joi.number().required(),
    state: Joi.string().trim().replace(/\s+/g, ' ').required(),
    country: Joi.string().trim().replace(/\s+/g, ' ').required(),
    email: Joi.string().replace(/\s+/g, ' ').trim().required(),
    firstName: Joi.string().replace(/\s+/g, ' ').trim().optional(),
    oldName: Joi.string().replace(/\s+/g, ' ').trim().optional(),
    oldEmail: Joi.string().replace(/\s+/g, ' ').trim().optional(),
    lastName: Joi.string().replace(/\s+/g, ' ').trim().optional(),
    phoneNumber:Joi.string().required(),  
    isPrimary: Joi.boolean().optional(),
    status: Joi.boolean().optional(),
    flag: Joi.string().optional(),
    providerId: Joi.string().optional(),
    position: Joi.string().trim().allow('').replace(/\s+/g, ' ').optional(),
    members: Joi.array().items(Joi.object().keys({
        email: Joi.string().replace(/\s+/g, ' ').trim().required(),
        firstName: Joi.string().replace(/\s+/g, ' ').trim().required(),
        lastName: Joi.string().replace(/\s+/g, ' ').trim().required(),
        phoneNumber:  Joi.string().required(), 
        isPrimary: Joi.boolean().required(),
        status: Joi.boolean().required(),
        position: Joi.string().trim().allow('').replace(/\s+/g, ' ').optional()
    }).unknown(true)).unique((a, b) => a.email === b.email).message("Each servicer's email must be unique."),
})

module.exports = create_servicer_validation