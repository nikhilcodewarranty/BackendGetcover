const mongoose = require("mongoose");
const connection = require('../../db')
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: '',
    unique: true
  },
  password: {
    type: String,
    default: ''
  },
  accountId: {
    type: String,
    default: ''
  },
  resetPasswordCode:{
    type:String,
    default:null
  },
  isResetPassword:{
    type:Boolean,
    default:false
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId, ref: "roles",
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  status: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: String,
    default: false
  },
  approvedStatus: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default:"Pending"
  }
}, { timestamps: true });

module.exports = connection.userConnection.model("user", userSchema);
