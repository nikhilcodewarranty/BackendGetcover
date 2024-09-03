const mongoose = require("mongoose");
const connection = require('../../db');

// Option Schema
const optionSchema = new mongoose.Schema({
    name: {
        type: String,
        default: ''
    },
    label: {
        type: String,
        default: ''
    },
    value: {
        type: [{
            label: String,
            value: String
        }],
        default: []
    }
});

module.exports = connection.userConnection.model("option", optionSchema);
