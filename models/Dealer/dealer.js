const mongoose = require("mongoose");
const connection = require('../../db')

const dealarSchema = new mongoose.Schema({
  name: {
    type: String,
    default: '',
    index: true
  },
  street: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  userAccount: {
    type: Boolean,
    default: false
  },
  zip: {
    type: Number,
    default: ''
  },
  unique_key: {
    type: Number,
  },
  state: {
    type: String,
    default: ''
  },
  country: {
    type: String,
    default: ''
  },
  token: {
    type: String,
    default: ''
  },
  createdBy: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending"
  },
  accountStatus: {
    type: Boolean,
    default: false
  },
  isServicer: {
    type: Boolean,
    default: false
  },

  isShippingAllowed: {
    type: Boolean,
    default: false
  },
  isAccountCreate: {
    type: Boolean,
    default: true
  },
  serviceCoverageType: {
    type: String,
    default: ''
  },
  coverageType: {
    type: [],
    default: []
  },
  adhDays: {
    type: [
      {
        value: {
          type: String
        },
        waitingDays: {
          type: Number
        },
        deductible: {
          type: Number
        },
        amountType: {
          type: String,
          enum: ["amount", "percentage"]
        }
      }
    ]
  },
  termCondition: {
    type: {},
    default: {}
  },
  isDeleted: {
    type: String,
    default: false
  },
}, { timestamps: true });

module.exports = connection.userConnection.model("dealer", dealarSchema);
