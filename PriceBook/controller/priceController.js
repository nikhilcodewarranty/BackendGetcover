const { PriceBook } = require("../model/priceBook");
const priceBookResourceResponse = require("../utils/constant");
const priceBookService = require("../services/priceBookService");
const constant = require("../../config/constant");

exports.getAllPriceBooks = async (req, res, next) => {
  try {
    let query = {status:true,isDeleted:false}
    let projection = {isDeleted:0,__v:0}
    const priceBooks = await priceBookService.getAllPriceBook(query,projection);
    if (!priceBooks) {
     res.send({
      code:constant.errorCode,
      message:"Unable to fetch the data"
     })
     return;
    }
    res.send({
      code:constant.successCode,
      message:"Success"
    })
  } catch (error) {
    res
      .status(priceBookResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.createPriceBook = async (req, res, next) => {
  try {
    let data = req.body
    let checkCat = await priceBookService.getPriceCatById({ _id: data.priceCatId })
    if (!checkCat) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Price Category"
      })
      return;
    }
    let priceBookData = {
      name: data.name,
      description: data.description,
      term: data.term,
      frontingFee: data.frontingFee,
      reinsuranceFee: data.reinsuranceFee,
      adminFee: data.adminFee,
      reserveFutureFee: data.reserveFutureFee,
      category: checkCat._id,
    }
    let savePriceBook = await priceBookService.createPriceBook(priceBookData)
    if (!savePriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Unable to save the price book"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

exports.getPriceBookById = async (req, res, next) => {
  try {
    let query = {_id:req.params.priceId}
    let projection = {isDeleted:0,__v:0}
    const singlePriceBook = await priceBookService.getPriceBookById(
      query,projection
    );
    if (!singlePriceBook) {
     res.send({
      code:constant.errorCode,
      message:"Unable to fetch the price detail"
     })
     return;
    }
    res.send({
      code:constant.successCode,
      message:"Success",
      result:singlePriceBook
    })
    res.json(singlePriceBook);
  } catch (error) {
    res
      .status(priceBookResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.updatePriceBook = async (req, res, next) => {
  try {
    const updatedPriceBook = await priceBookService.updatePriceBook(req.body);
    if (!updatedPriceBook) {
      res.status(404).json("There are no price book updated yet!");
    }
    res.json(updatedPriceBook);
  } catch (error) {
    res
      .status(priceBookResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

exports.deletePriceBook = async (req, res, next) => {
  try {
    const deletedPriceBook = await priceBookService.deletePriceBook(
      req.body.id
    );
    if (!deletedPriceBook) {
      res.status(404).json("There are no price book deleted yet!");
    }
    res.json(deletedPriceBook);
  } catch (error) {
    res
      .status(priceBookResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};



//----------------- price categories api's --------------------------//


// price category api's

exports.createPriceCat = async (req, res) => {
  try {
    let data = req.body
    let catData = {
      name: data.name,
      description: data.description
    }
    let createPriceCat = await priceBookService.createPriceCat(catData)
    if (!createPriceCat) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the price category"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Created Successfully"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get all price category
exports.getPriceCat = async (req, res) => {
  try {
    let projection = { isDeleted: 0, __v: 0 }
    let query = { status: true, isDeleted: false }
    let getCat = await priceBookService.getAllPriceCat(query, projection)
    if (!getCat) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get the price categories"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getCat
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//update price category 
exports.udpatePriceCat = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.catId }
    let checkCat = await priceBookService.getPriceCatById(criteria)
    if (!checkCat) {
      res.send({
        code: constant.errorCode,
        message: "Invalid category ID"
      })
      return;
    };

    let newValue = {
      $set: {
        name: data.name ? data.name : checkCat.name,
        description: data.description ? data.description : checkCat.description,
      }
    };
    let option = { new: true }

    let updateCat = await priceBookService.updatePriceCategory(criteria, newValue, option)
    if (!updateCat) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the data"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Successfully updated"
      })
    }

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

