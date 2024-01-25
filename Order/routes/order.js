const express = require("express");
const router = express.Router();
const orderController = require("../controller/order");
const { verifyToken } = require('../../middleware/auth'); // authentication with jwt as middleware

router.post('/createOrder',[verifyToken],orderController.createOrder)
router.post('/checkFileValidation',[verifyToken],orderController.checkFileValidation)
router.post('/checkMultipleFileValidation',[verifyToken],orderController.checkMultipleFileValidation)

router.post('/getAllOrders',[verifyToken],orderController.getAllOrders)
router.post('/getServicer',[verifyToken],orderController.getServicer)

router.post('/getCustomerInOrder',[verifyToken],orderController.getCustomerInOrder)
router.post('/getCategoryAndPriceBooks/:dealerId',[verifyToken],orderController.getCategoryAndPriceBooks)


module.exports = router;
