const express = require("express");
const router = express.Router();
const reportingController = require("../../controllers/User/reportingController");// reporting controller
const { verifyToken } = require('../../middleware/auth');  // authentication with jwt as middleware

router.post('/getReportingDropdowns', [verifyToken], reportingController.getReportingDropdowns); // get reporting dropdowns
router.get('/getReportingDropdowns1', [verifyToken], reportingController.getReportingDropdowns1); // get reporting dropdowns
router.post('/claimReportinDropdown', [verifyToken], reportingController.claimReportinDropdown); // get claim reporting dropdown




module.exports = router;
