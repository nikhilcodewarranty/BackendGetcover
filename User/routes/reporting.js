const express = require("express");
const router = express.Router();

const userController = require("../controller/usersController");// user controller
const reportingController = require("../controller/reportingController");// reporting controller
const dealerController = require("../../Dealer/controller/dealerController");// user controller
const servicerAdminController = require("../../Provider/controller/serviceAdminController");// user controller
const { verifyToken } = require('../../middleware/auth');  // authentication with jwt as middleware
const validator = require('../config/validation');
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware');

router.post('/dailyReporting', reportingController.dailySales)
router.post('/weeklySales', reportingController.weeklySales)
router.post('/daySale', reportingController.daySale)
router.get('/getReportingDealers', [verifyToken], reportingController.getReportingDealers)
router.get('/getReportingPriceBooks', [verifyToken], reportingController.getReportingPriceBooks)


module.exports = router;
