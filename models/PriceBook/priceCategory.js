const mongoose = require("mongoose");
const connection = require('../../db')
const priceCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    index:true
  },
  description: {
    type: String,
  },
  status: {
    type: Boolean,
    default: true,
    index:true
  },
  unique_key: {
    type: Number,
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = connection.userConnection.model("priceCategory", priceCategorySchema);
