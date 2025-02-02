const express = require("express"); 
const router = express.Router();
const validator = require('../../middleware/validator'); // validation handler as a middleware
const servicerController = require("../../controllers/Provider/servicerController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware
const supportingFunction = require("../../config/supportingFunction");

// POST routes
router.post("/getServicerUsers", [verifyToken], servicerController.getServicerUsers); // get servicer users
router.post("/addServicerUser", [verifyToken], servicerController.addServicerUser); // add servicer user
router.post("/getServicerDealers", [verifyToken], servicerController.getServicerDealers); // get servicer dealers
router.post("/createRelationWithDealer", [verifyToken], servicerController.createDeleteRelation); // create relation with dealer
router.post("/saleReporting", [verifyToken], servicerController.saleReporting); // sale reporting
router.post("/claimReporting", [verifyToken], servicerController.claimReporting); // claim reporting
router.post("/claimReportinDropdown", [verifyToken], servicerController.claimReportinDropdown); // claim reporting dropdown 

router.get("/getClaimReportingDropdown/:flag", [verifyToken], servicerController.getClaimReportingDropdown); // claim reporting dropdown 
//  router.get("/getClaimReportingDropdown1/:flag", [verifyToken], servicerController.getClaimReportingDropdown1); // claim reporting dropdown 


// PUT routes
router.put("/changePrimaryUser", [verifyToken], servicerController.changePrimaryUser); // change primary user
router.put("/editUserDetail/:userId", [verifyToken], servicerController.editUserDetail); // edit user detail
// GET routes
router.get("/getServicerDetail", [verifyToken], servicerController.getServicerDetail); // get servicer detail
router.get("/getDashboardData", [verifyToken], servicerController.getDashboardData); // get dashboard data
router.get("/getDashboardGraph", [verifyToken], servicerController.getDashboardGraph); // get dashboard graph
router.get("/getDashboardInfo", [verifyToken], servicerController.getDashboardInfo); // get dashboard info
router.get("/getUserId/:userId", [verifyToken], supportingFunction.checkObjectId,servicerController.getUserId); // get user by ID

module.exports = router;
