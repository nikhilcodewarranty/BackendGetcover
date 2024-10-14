const express = require("express");
const router = express.Router();
const validator = require('../../middleware/validator') // validation handler as a middleware
const priceController = require("../../controllers/PriceBook/priceController"); // price controller 
const { verifyToken } = require('../../middleware/auth') // authentication with jwt as middleware
const supportingFunction = require("../../config/supportingFunction")

// price book api's
router.post("/createPriceBook", [verifyToken], validator('create_price_validation'), priceController.createPriceBook); // create price book with defined price category ID
router.get("/getPriceBookById/:priceBookId", [verifyToken], supportingFunction.checkObjectId, priceController.getPriceBookById); //get price book detail with ID
router.post("/priceBooks", [verifyToken], priceController.getAllPriceBooks); //get price books api
router.get("/getAllActivePriceBook", [verifyToken], priceController.getAllActivePriceBook); //get price books api
router.post("/searchPriceBook", [verifyToken], validator('search_price_book_validation'), priceController.searchPriceBook); // search price book with defined price category ID
router.put("/updatePriceBook/:priceBookId", [verifyToken], priceController.updatePriceBookById); // update price book detail with ID
router.get("/getPriceBookByCategory/:categoryName", [verifyToken], priceController.getPriceBookByCategory); // update price book detail with ID
router.post("/getPriceBookByCategoryId/:categoryId", [verifyToken], priceController.getPriceBookByCategoryId); // update price book detail with ID
router.post("/getCoverageType/:priceBookId", [verifyToken], priceController.getCoverageType); //Get coverage type by price book
router.post("/getCoverageTypeAndAdhDays/:priceBookId", [verifyToken], priceController.getCoverageTypeAndAdhDays); //Get coverage type and adh days from dealer by price book
// price categories api's
router.post('/createPriceBookCategory', [verifyToken], validator("create_price_cat_validation"), priceController.createPriceBookCat) // create price book category with uninque name
router.post('/searchPriceBookCategories', [verifyToken], validator("search_price_cat_validation"), priceController.searchPriceBookCategories) // search price book category with  name
router.put('/updatePriceBookCategory/:catId', [verifyToken], validator("update_price_cat_validation"), priceController.updatePriceBookCat) //update price book category with ID
router.post('/getPriceBookCategories', [verifyToken], validator("filter_price_cat"), priceController.getPriceBookCat) // get price book category api
router.post('/getActivePriceBookCategories', [verifyToken], priceController.getActivePriceBookCategories) // get price book category api
router.get('/getPriceBookCategoryById/:catId', [verifyToken], supportingFunction.checkObjectId, priceController.getPriceBookCatById) // get price book by category
router.get('/getCategoryByPriceBook/:name', [verifyToken], priceController.getCategoryByPriceBook) // get price book category by price book
// Dealer Price Book api's

module.exports = router;
