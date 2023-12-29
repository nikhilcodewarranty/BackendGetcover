const express = require("express");
const router = express.Router();
const validator = require('../config/validation') // validation handler as a middleware
const serviceController = require("../controller/serviceController");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware

router.post("/createServiceProvider",validator('create_servicer_validation'),[verifyToken],serviceController.createServiceProvider)
router.put("/approveServicer/:servicerId",[verifyToken],serviceController.approveServicer)
router.post("/register", serviceController.registerServiceProvider)
router.get("/serviceProvider", serviceController.getAllServiceProviders);
router.get("/servicers/:status", [verifyToken], serviceController.getServicer); //get all dealers
router.get("/getServiceProviderById/:servicerId", [verifyToken], serviceController.getServiceProviderById); //get all dealers
router.delete("/rejectServicer/:servicerId", [verifyToken], serviceController.rejectServicer); //get all dealers

router.get("/serviceProvider/create-serviceProvider", serviceController.createServiceProvider);

module.exports = router;
