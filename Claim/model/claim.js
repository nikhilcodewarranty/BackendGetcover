const { string } = require("joi");
const mongoose = require("mongoose");
const connection = require('../../db')

const claimSchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "contracts",
    index: true
  },
  orderId: {
    type: String,
    default: '',
    index: true
  },
  venderOrder: {
    type: String,
    default: ''
  },
  serial: {
    type: String,
    default: ''
  },
  productName: {
    type: String,
    default: ''
  },
  pName: {
    type: String,
    default: ''
  },
  model: {
    type: String,
    default: ''
  },
  manufacture: {
    type: String,
    default: ''
  },

  claimFile: {
    type: 'String',
    enum: ['Open', 'Completed', 'Rejected'],
    default: 'Open',
    index: true
  },
  reason: {
    type: 'String',
    default: '',
  },
  unique_key_number: {
    type: Number,
  },
  unique_key_search: {
    type: String,
  },
  unique_key: {
    type: String,
    index: true
  },
  servicerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "serviceproviders",
    default: null,
    index: true
  },
  dealerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "dealers",
    default: null,
    index: true
  },
  resellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "resellers",
    default: null,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "customers",
    default: null,
    index: true
  },
  action: {
    type: String,
    default: ''
  },
  bdAdh: {
    type: String,
    default: ''
  },
  diagnosis: {
    type: String,
  },
  receiptImage: {
    type: [],
    default: []
  },
  shippingCarrier: {
    type: String,
    default: ''
  },
  shippingLabel: {
    type: String,
    default: ''
  },
  claimDate: {
    type: Date,
    default: Date.now()
  },
  lossDate: {
    type: Date,
    default: Date.now()
  },
  claimType: {
    type: String,
    default: 'New'
  },
  trackingNumber: {
    type: String,
    default: ''
  },
  trackingType: {
    type: String,
    default: ''
  },
  servicePaymentStatus: {
    type: String,
    default: 'Pending'
  },
  claimPaymentStatus: {
    type: String,
    default: 'Unpaid',
    enum: ['Paid', 'Unpaid'],

  },
  shippingAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  repairParts: {
    type: [],
    default: []
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  note: {
    type: String,
    default: ''
  },
  customerStatus: {
    type: [
      {
        status: {
          type: String,
          default: 'Request Submitted'
        },
        date: {
          type: Date,
          default: Date.now()
        }
      },
    ],
    default: [{
      status: 'Request Submitted',
      date: Date.now()
    }]
  },
  trackStatus: {
    type: [
      {
        status: {
          type: String,
          default: 'Request Submitted'
        },
        date: {
          type: Date,
          default: Date.now()
        }
      },
    ],
    default: [
      {
        status: 'Open',
        date: Date.now()
      },
      {
        status: 'Request Submitted',
        date: Date.now()
      },
      {
        status: 'Request Sent',
        date: Date.now()
      },
    ]
  },
  claimStatus: {
    type: [
      {
        status: {
          type: String,
          default: 'Open'
        },
        date: {
          type: Date,
          default: Date.now()

        }
      },
    ],
    default: [{
      status: 'Open',
      date: Date.now()
    }]
  },
  repairStatus: {
    type: [
      {
        status: {
          type: String,
          default: 'Request Approved'
        },
        date: {
          type: Date,
          default: Date.now()
        }
      },
    ],
    default: [{
      status: 'Request Sent',
      date: Date.now()
    }]
  },
}, { timestamps: true });

module.exports = connection.userConnection.model("claim", claimSchema);
