require("dotenv").config();
const { PriceBook } = require("../../models/PriceBook/priceBook");
const priceBookService = require("../../services/PriceBook/priceBookService");
const dealerService = require("../../services/Dealer/dealerService");
const orderService = require("../../services/Order/orderService");
const userService = require("../../services/User/userService");
const axios = require("axios")
const maillogservice = require("../../services/User/maillogServices")
const dealerPriceService = require("../../services/Dealer/dealerPriceService");
const maillogService = require("../../services/User/maillogServices")
const eligibilityService = require("../../services/Dealer/eligibilityService");
const constant = require("../../config/constant")
const randtoken = require('rand-token').generator()
const mongoose = require('mongoose');
const logs = require("../../models/User/logs");
const supportingFunction = require('../../config/supportingFunction')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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 ');
const emailConstant = require('../../config/emailConstant');
const multer = require('multer');
const path = require('path');

//multer file upload 
const { S3Client } = require('@aws-sdk/client-s3');
const XLSX = require("xlsx");

const aws = require('aws-sdk');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');
const terms = require("../../models/User/terms");
const options = require("../../models/User/options");
aws.config.update({
  accessKeyId: process.env.aws_access_key_id,
  secretAccessKey: process.env.aws_secret_access_key,
});
const S3Bucket = new aws.S3();
// s3 bucket connections
const s3 = new S3Client({
  region: process.env.region,
  credentials: {
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
  }
});
const folderName = 'companyPriceBook'; // Replace with your specific folder name
const StorageP = multerS3({
  s3: s3,
  bucket: process.env.bucket_name,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const fileName = file.fieldname + '-' + Date.now() + path.extname(file.originalname);
    const fullPath = `${folderName}/${fileName}`;
    cb(null, fullPath);
  }
});
var uploadP = multer({
  storage: StorageP,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).single('companyPriceBook');
//------------- price book api's------------------//

//get all price books
exports.getAllPriceBooks = async (req, res, next) => {
  try {
    let data = req.body
    let categorySearch = req.body.category ? req.body.category : ''
    let queryCategories = {
      $and: [
        { isDeleted: false },
        { 'name': { '$regex': req.body.category ? req.body.category.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } }
      ]
    };
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchName = req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : ''
    let searchName1 = req.body.pName ? req.body.pName.replace(/\s+/g, ' ').trim() : ''
    console.log(typeof (data.status))
    let filterStatus = (data.status === "true" || data.status === "false") ? (data.status === "true" ? true : false) : ""
    data.status = typeof (filterStatus) == "string" ? "all" : filterStatus
    let query;
    if (!Array.isArray(data.coverageType) && data.coverageType != '') {
      res.send({
        code: constant.errorCode,
        message: "Coverage type should be an array!"
      });
      return;
    }
    if (data.status != "all") {
      if (data.coverageType != "") {
        query = {
          $and: [
            { isDeleted: false },
            { 'name': { '$regex': searchName, '$options': 'i' } },
            { 'pName': { '$regex': searchName1, '$options': 'i' } },
            { 'coverageType': data.coverageType },
            { 'status': data.status },
            { 'category': { $in: catIdsArray } }
          ]
        };
      } else {
        query = {
          $and: [
            { isDeleted: false },
            { 'name': { '$regex': searchName, '$options': 'i' } },
            { 'pName': { '$regex': searchName1, '$options': 'i' } },
            { 'status': data.status },
            { 'category': { $in: catIdsArray } }
          ]
        };
      }

    }
    else if (data.coverageType.length > 0) {
      query = {
        $and: [
          { isDeleted: false },
          { 'pName': { '$regex': searchName1, '$options': 'i' } },
          { "coverageType.value": { "$all": data.coverageType } },
          { "coverageType": { "$size": data.coverageType.length } },
          { 'name': { '$regex': searchName, '$options': 'i' } },
          { 'category': { $in: catIdsArray } }
        ]
      };
    } else {
      query = {
        $and: [
          { isDeleted: false },
          { 'pName': { '$regex': searchName1, '$options': 'i' } },
          { 'name': { '$regex': searchName, '$options': 'i' } },
          { 'category': { $in: catIdsArray } },
          //  { 'status': data.status },


        ]
      };
    }
    if (data.term != '') {
      query.$and.push({ 'term': Number(data.term) });
    }
    if (data.priceType != '') {
      query.$and.push({ 'priceType': data.priceType });
      if (data.priceType == 'Flat Pricing') {
        if (data.range != '') {
          query.$and.push({ 'rangeStart': { $lte: Number(data.range) } });
          query.$and.push({ 'rangeEnd': { $gte: Number(data.range) } });
        }
      }
    }

    let projection = { isDeleted: 0, __v: 0 }

    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    let limit = req.body.limit ? req.body.limit : 10000
    let page = req.body.page ? req.body.page : 1
    const priceBooks = await priceBookService.getAllPriceBook(query, projection, limit, page);

    if (!priceBooks) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: priceBooks
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Get all actvie price book
exports.getAllActivePriceBook = async (req, res) => {
  try {
    let data = req.body
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let getPriceBooks = await priceBookService.getAllActivePriceBook({ status: true, isDeleted: false }, { __v: 0 })
    if (!getPriceBooks) {
      res.send({
        code: constant.errorCode,
        message: "Unable to find the price books"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getPriceBooks
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//create new price book
exports.createPriceBook = async (req, res, next) => {
  try {
    let data = req.body
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`

    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    let checkCat = await priceBookService.getPriceCatById({ _id: data.priceCatId })

    if (!checkCat) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Price Category"
      })
      return;
    }
    let quantityPriceDetail;

    if (data.priceType == 'Quantity Pricing') {
      quantityPriceDetail = data.quantityPriceDetail;
    }

    const count = await priceBookService.getPriceBookCount();
    data.name = data.name.trim().replace(/\s+/g, ' ');

    // price book data 
    let priceBookData = {
      name: data.name,
      pName: data.pName,
      description: data.description,
      term: data.term,
      frontingFee: data.frontingFee,
      reinsuranceFee: data.reinsuranceFee,
      adminFee: data.adminFee,
      priceType: data.priceType,
      rangeStart: data.rangeStart,
      rangeEnd: data.rangeEnd,
      reserveFutureFee: data.reserveFutureFee,
      quantityPriceDetail: quantityPriceDetail,
      category: checkCat._id,
      coverageType: data.coverageType,
      status: data.status,
      unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
    }
    let checkPriceBook = await priceBookService.getPriceBookById({ name: { '$regex': new RegExp(`^${data.name}$`, 'i') } }, {})

    if (checkPriceBook.length > 0) {
      res.send({
        code: constant.errorCode,
        message: "Product already exist with this sku"
      })
      return;
    }

    let savePriceBook = await priceBookService.createPriceBook(priceBookData)

    if (!savePriceBook) {
      let logData = {
        userId: req.teammateId,
        endpoint: "price/createPriceBook",
        body: req.body,
        response: {
          code: constant.errorCode,
          message: "Unable to save the price book",
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to save the price book",

      })
    } else {
      // Send notification when create
      const adminPriceBookQuery = {
        metaData: {
          $elemMatch: {
            $and: [
              { "adminNotification.priceBookAdd": true },
              { status: true },
              {
                $or: [
                  { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
                ]
              }
            ]
          }
        },
      }
      let adminUsers = await supportingFunction.getNotificationEligibleUser(adminPriceBookQuery, { email: 1 })
      const IDs = adminUsers.map(user => user._id)
      let notificationData = {
        title: "New GetCover Pricebook Added",
        description: `A new GetCover Pricebook ${data.pName} has been added under category ${checkCat.name} by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.userId,
        contentId: savePriceBook._id,
        flag: 'priceBook',
        endPoint: base_url + "companyPriceBook/" + data.name,
        redirectionId: "/companyPriceBook/" + data.name,
        notificationFor: IDs
      };
      let createNotification = await userService.createNotification(notificationData);

      // Send Email code here
      let notificationEmails = adminUsers.map(user => user.email)
      //Get Website Setting
      const settingData = await userService.getSetting({});
      priceBookData.category = checkCat.name
      priceBookData.coverageType = data.coverageType.map(item => item.label).join(', ');
      const admin = await userService.getSingleUserByEmail({ metaData: { $elemMatch: { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), status: true } } }, {})
      let emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        priceBookData: priceBookData,
        senderName: "Admin",
        content: `A new company pricebook ${data.pName} has been added with the following data:`,
        subject: "Create Price Book"
      }
      console.log("checking the data++++++++++++", notificationEmails)

      let mailing = await sgMail.send(emailConstant.sendPriceBookNotification(notificationEmails, [], emailData))

      maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.price_book)
      console.log("mail log data ++++++++++++++", mailing)
      let logData = {
        userId: req.teammateId,
        endpoint: "price/createPriceBook",
        body: req.body,
        response: {
          code: constant.successCode,
          message: "Success",
          data: savePriceBook
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.successCode,
        message: "Success",
        data: savePriceBook
      })
    }
  } catch (err) {
    let logData = {
      userId: req.teammateId,
      endpoint: "price/createPriceBook catch",
      body: req.body,
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//get price book by id 
exports.getPriceBookById = async (req, res, next) => {
  try {
    let query = { _id: new mongoose.Types.ObjectId(req.params.priceBookId) }
    let projection = { isDeleted: 0, __v: 0 }
    const singlePriceBook = await priceBookService.getPriceBookById(
      query, projection
    );

    singlePriceBook[0].optionDropdown = [];

    // Iterate through each coverageType item
    singlePriceBook[0].coverageType.forEach(coverageItem => {
      // Check against each option's value array
      singlePriceBook[0].options.forEach(option => {
        const matchingValue = option.value.find(optValue => optValue.value === coverageItem.value);
        if (matchingValue) {
          // Push the matching option into the coverageType1 array
          singlePriceBook[0].optionDropdown.push(matchingValue);
        }
      });
    });
    if (!singlePriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the price book detail"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: singlePriceBook[0]
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//update price book
exports.updatePriceBook = async (req, res, next) => {
  try {
    let data = req.body
    if (req.role !== 'Super Admin') {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    let criteria = { _id: req.params.priceId }

    if (data.priceCatId) {
      let checkCat = await priceBookService.getPrice({ _id: data.priceCatId })
      if (!checkCat) {
        res.send({
          code: constant.errorCode,
          message: "Invalid category ID"
        })
        return;
      }
      //data to
      let newValue = {
        $set: {
          name: data.name,
          pName: data.pName,
          description: data.description,
          term: data.term,
          frontingFee: data.frontingFee,
          reserveFutureFee: data.reserveFutureFee,
          reinsuranceFee: data.reinsuranceFee,
          adminFee: data.adminFee,
          category: data.category,
          status: data.status
        }
      };
      let option = { new: true }

      let updateCat = await priceBookService.updatePriceBook(criteria, newValue, option)
      if (!updateCat) {
        res.send({
          code: constant.errorCode,
          message: "Unable to update the price"
        })
      } else {
        res.send({
          code: constant.successCode,
          message: "Successfully updated"
        })
      }
    }

    //data to
    let newValue = {
      $set: {
        name: data.name,
        pName: data.pName,
        description: data.description,
        term: data.term,
        coverageType: data.coverageType,
        frontingFee: data.frontingFee,
        reserveFutureFee: data.reserveFutureFee,
        reinsuranceFee: data.reinsuranceFee,
        adminFee: data.adminFee,
        category: data.category,
      }
    };
    let option = { new: true }

    let updateCat = await priceBookService.updatePriceBook(criteria, newValue, option)
    if (!updateCat) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the price"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Successfully updated"
      })
    }

  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Update by Price Id by me
exports.updatePriceBookById = async (req, res, next) => {
  try {
    const { body, params, role } = req;
    // Check if the user is a Super Admin
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only Super Admin is allowed to perform this action"
      });
      return;
    }
    // Check if the request body is empty
    if (Object.keys(body).length === 0) {
      res.send({
        code: constant.errorCode,
        message: "Content cannot be empty"
      });
      return;
    }

    //check Category exist with this ID

    const isValid = await priceBookService.getPriceCatById({ _id: body.priceCatId }, {});
    if (!isValid) {
      res.send({
        code: constant.errorCode,
        message: "Category is not exist with this ID"
      });
      return;
    }


    const criteria = { _id: new mongoose.Types.ObjectId(params.priceBookId) };
    let projection = { isDeleted: 0, __v: 0 }
    const existingPriceBook = await priceBookService.getPriceBookById(criteria, projection);
    if (!existingPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Price Book is not exist with this id"
      });
      return;
    }

    const newValue = {
      $set: {
        status: body.status,
        pName: body.pName || existingPriceBook.pName,
        frontingFee: body.frontingFee || existingPriceBook.frontingFee,
        coverageType: body.coverageType || existingPriceBook.coverageType,
        reserveFutureFee: body.reserveFutureFee || existingPriceBook.reserveFutureFee,
        reinsuranceFee: body.reinsuranceFee || existingPriceBook.reinsuranceFee,
        adminFee: body.adminFee || existingPriceBook.adminFee,
        category: body.priceCatId || existingPriceBook.category,
        description: body.description || existingPriceBook.description,
        priceType: body.priceType || existingPriceBook.priceType,
        rangeStart: body.rangeStart ? body.rangeStart : existingPriceBook.rangeStart,
        rangeEnd: body.rangeEnd ? body.rangeEnd : existingPriceBook.rangeStart,
        quantityPriceDetail: body.quantityPriceDetail || existingPriceBook.quantityPriceDetail
      }
    };
    // Update Price Book Status

    const updateResult = await priceBookService.updatePriceBook({ _id: params.priceBookId }, newValue, { new: true })
    if (!updateResult) {
      // Update Dealer Price Book Status
      res.send({
        code: constant.errorCode,
        message: "Unable to update the price book",
      });
      return;
    }

    else {
      //change dealer status if body status is false
      if (body.status == false) {
        const newValue = { status: body.status };
        const option = { new: true };
        let updateOrder = await orderService.updateManyOrder({ 'productsArray.priceBookId': params.priceBookId, status: 'Pending' }, { status: 'Archieved' }, option)
        const updatedPriceBook = await dealerPriceService.updateDealerPrice({ priceBook: params.priceBookId }, newValue, { new: true });
      }
    }

    // Send notification when updated
    const adminPriceUpdateQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "adminNotification.priceBookUpdate": true },
            { status: true },
            {
              $or: [
                { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
              ]
            }
          ]
        }
      },
    }
    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminPriceUpdateQuery, { email: 1 })
    const IDs = adminUsers.map(user => user._id)
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`
    let notificationData
    if (req.body.priceType) {
      notificationData = {
        title: "GetCover Pricebook updated",
        description: `GetCover Pricebook ${existingPriceBook[0]?.pName} has been updated by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.userId,
        flag: 'priceBook',
        notificationFor: IDs,
        endPoint: base_url + "companyPriceBook/" + existingPriceBook[0]?.name,
        redirectionId: "companyPriceBook/" + existingPriceBook[0]?.name
      };
    }
    else {
      notificationData = {
        title: "GetCover Pricebook Status Updated",
        description: `GetCover Pricebook ${existingPriceBook[0]?.pName} status has been updated to ${body.status ? 'Active' : "Inactive"} by  ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.userId,
        flag: 'priceBook',
        notificationFor: IDs,
        endPoint: base_url + "companyPriceBook/" + existingPriceBook[0]?.name,
        redirectionId: "companyPriceBook/" + existingPriceBook[0]?.name
      };
    }
    let createNotification = await userService.createNotification(notificationData);

    // Send Email code here
    let notificationEmails = adminUsers.map(user => user.email)
    const admin = await userService.getSingleUserByEmail({ metaData: { $elemMatch: { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), status: true } } }, {})

    //Get Website Setting
    const settingData = await userService.getSetting({});
    let emailData;
    if (req.body.priceType) {
      emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: "Dear Admin",
        content: `A company Pricebook ${existingPriceBook[0]?.pName} has been updated. To view the changes, please click here."`,
        subject: "Update Price Book",
        redirectId: base_url + "companyPriceBook/" + existingPriceBook[0]?.name
      }
    }
    else {
      emailData = {
        darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
        lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
        address: settingData[0]?.address,
        websiteSetting: settingData[0],
        senderName: "Dear Admin",
        content: `The Company Pricebook ${existingPriceBook[0]?.pName} has been made ${body.status ? 'Active' : "Inactive"} in the system. To review the changes, please click here."`,
        subject: "Update Status",
        redirectId: base_url + "companyPriceBook/" + existingPriceBook[0]?.name
      }
    }
    let mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, "noreply@getcover.com", emailData))
    maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)

    let logData = {
      userId: req.teammateId,
      endpoint: "price/updatePriceBook",
      body: req.body,
      response: {
        code: constant.successCode,
        message: "Successfully Update",
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.successCode,
      message: "Successfully Update",
    });
    return;

  } catch (error) {
    let logData = {
      userId: req.teammateId,
      endpoint: "price/updatePriceBook catch",
      body: req.body,
      response: {
        code: constant.errorCode,
        message: error.message
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

//Search price price books
exports.searchPriceBook = async (req, res, next) => {
  try {
    let query = {
      $or: [
        { 'name': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } },
        { 'description': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } },
        { 'state': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } },
        { 'city': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } },
        { 'zip': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } },
      ]
    };
    let projection = { isDeleted: 0, __v: 0 };
    const priceBooks = await priceBookService.getAllPriceBook(query, projection);

    if (!priceBooks) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
      result: priceBooks
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

// create price category api's
exports.createPriceBookCat = async (req, res) => {
  try {
    // Ensure the user has the required role
    if (req.role !== 'Super Admin') {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    const data = req.body;
    data.name = data.name.trim().replace(/\s+/g, ' ');
    // Check if the category already exists
    const existingCategory = await priceBookService.getPriceCatByName({ name: { '$regex': new RegExp(`^${data.name}$`, 'i') } }, { isDeleted: 0, __v: 0 });
    if (existingCategory) {
      res.send({
        code: constant.errorCode,
        message: "Category already exist"
      })
      return;
    }
    // Check Total Counts
    const count = await priceBookService.getTotalCount();
    const catData = {
      name: data.name,
      description: data.description,
      unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
    };
    // Create the price category
    const createdCategory = await priceBookService.createPriceCat(catData);
    if (!createdCategory) {
      let logData = {
        userId: req.teammateId,
        endpoint: "price/createPriceBookCat",
        body: catData,
        response: {
          code: constant.errorCode,
          message: 'Unable to create the price category'
        }
      }
      await logs(logData).save()

      res.send({
        code: constant.errorCode,
        message: 'Unable to create the price category'
      });
      return;
    }
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`
    // save notification for create category
    const adminCategoryQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "adminNotification.categoryAdded": true },
            { status: true },
            {
              $or: [
                { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
              ]
            }
          ]
        }
      },
    }
    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminCategoryQuery, { email: 1 })
    const IDs = adminUsers.map(user => user._id)
    let notificationData = {
      title: "New Pricebook Category Added",
      description: `A new Pricebook Category ${req.body.name} has been added by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
      userId: req.userId,
      flag: 'category',
      endPoint: base_url + "category",
      redirectionId: "/category",
      notificationFor: IDs
    };
    let createNotification = await userService.createNotification(notificationData);

    // Send Email code here
    let notificationEmails = adminUsers.map(user => user.email)
    const settingData = await userService.getSetting({});
    const admin = await userService.getSingleUserByEmail({ metaData: { $elemMatch: { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isDeleted: false, status: true } } }, {})
    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: "Dear Admin",

      content: `A new Price Book Category ${data.name} has been added to the system by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
      subject: "New Category Added"
    }
    let mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
    maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)

    let logData = {
      userId: req.teammateId,
      endpoint: "price/createPriceBookCat",
      body: catData,
      response: {
        code: constant.successCode,
        message: 'Created Successfully',
        data: createdCategory
      }
    }
    await logs(logData).save()
    // Return success response
    res.send({
      code: constant.successCode,
      message: 'Created Successfully',
      data: createdCategory
    });

  } catch (err) {
    let logData = {
      userId: req.teammateId,
      endpoint: "price/createPriceBookCat  catchError",
      body: req.body,
      response: {
        code: constant.errorCode,
        message: err.message,
      }
    }
    await logs(logData).save()
    // Handle unexpected errors
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

// get all price category
exports.getPriceBookCat = async (req, res) => {
  try {
    let data = req.body
    let projection = { isDeleted: 0, __v: 0 }
    let query;

    if (data.status) {
      query = {
        $and: [
          { 'name': { '$regex': req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          { 'status': data.status },
          { isDeleted: false }
        ]
      }
    } else {
      query = {
        $and: [
          { 'name': { '$regex': req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          { isDeleted: false }
        ]
      }
    }

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

// get active price book categories  by price book ids
exports.getActivePriceBookCategories = async (req, res) => {
  try {
    let data = req.body
    let ID = req.query.priceBookId == "undefined" ? "61c8c7d38e67bb7c7f7eeeee" : req.query.priceBookId
    if (data.dealerId) {
      var getDealer = await dealerService.getDealerByName({ _id: data.dealerId }, { __v: 0 })
      if (!getDealer) {
        res.send({
          code: constant.errorCode,
          message: "Invalid dealer ID"
        })
        return;
      }
    }

    let query1 = { _id: new mongoose.Types.ObjectId(ID) }

    let getPriceBook = await priceBookService.getPriceBookById(query1, {})
    let coverageType = data.coverageType ? data.coverageType : getDealer?.coverageType


    let queryPrice;
    queryPrice = {
      $and: [
        { status: true },
      ]
    }
    if (coverageType) {
      const optionQuery = {
        value: {
          $elemMatch: {
            value: { $in: coverageType }
          }
        }
      }
      const dynamicOption = await userService.getOptions(optionQuery)

      const filteredOptions = dynamicOption.value
        .filter(item => !coverageType.includes(item.value))
        .map(item => item.value);
      queryPrice = {
        $and: [
          { status: true },
          {
            "coverageType.value": {
              $in: coverageType
            }
          },
          {
            "coverageType.value": {
              $nin: filteredOptions
            }
          }
        ]
      }


    }

    let getPriceBook1 = await priceBookService.getAllPriceIds(queryPrice, {})


    let catIds = getPriceBook1.map(catId => new mongoose.Types.ObjectId(catId.category))

    let query;

    if (!coverageType) {
      query = {
        $and: [
          { status: true },
        ]
      }
    } else {
      query = {
        $and: [
          { status: true },
          { _id: { $in: catIds } }
        ]
      }
    }
    let projection = { __v: 0 }
    let getCategories = await priceBookService.getAllActivePriceCat(query, projection)

    if (!getCategories) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the categories"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getCategories,
        coverageType: data.coverageType ? data.coverageType : getDealer?.coverageType
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// Exported function to update price book category
exports.updatePriceBookCat = async (req, res) => {
  try {
    let data = req.body
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only Super Admin is allowed to perform this action"
      });
      return;
    }

    const isValid = await priceBookService.getPriceCatById({ _id: req.params.catId }, {});
    if (!isValid) {
      res.send({
        code: constant.errorCode,
        message: "Category is not exist with this ID"
      });
      return;
    }

    if (data.name == undefined && data.description == undefined) {
      res.send({
        code: constant.errorCode,
        message: "No data provided"
      })
      return
    }
    // Check if the category already exists
    if (isValid.name.toLowerCase() != req.body.name.toLowerCase()) {
      const existingCategory = await priceBookService.getPriceCatByName({ name: { '$regex': new RegExp(`^${req.body.name}$`, 'i') } }, { isDeleted: 0, __v: 0 });
      if (existingCategory) {
        res.send({
          code: constant.errorCode,
          message: "Category already exist"
        })
        return;
      }
    }

    const newValue = {
      $set: {
        name: data.name ? data.name : isValid.name,
        description: data.description ? data.description : isValid.description,
        status: data.status
      }
    };

    const updateCatResult = await priceBookService.updatePriceCategory({ _id: req.params.catId }, newValue, { new: true });
    if (!updateCatResult) {
      let logData = {
        userId: req.teammateId,
        endpoint: "price/updatePricebookCat",
        body: newValue,
        response: {
          code: constant.errorCode,
          message: "Unable to update the price book category"
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to update the price book category"
      })
    }
    else {
      //Update PriceBook if status is false
      if (data.status == false) {
        let updatePriceBook = await priceBookService.updatePriceBook({ category: updateCatResult._id }, { status: data.status }, { new: true })
        let projection = { isDeleted: 0, __v: 0 }
        let updateOrder = await orderService.updateManyOrder({ 'productsArray.categoryId': req.params.catId, status: 'Pending' }, { status: 'Archieved' }, { new: true })
        const allPriceBookIds = await priceBookService.getAllPriceIds({ category: req.params.catId }, projection);
        const priceIdsToUpdate = allPriceBookIds.map((price) => price._id);
        if (priceIdsToUpdate) {
          dealerCreateria = { priceBook: { $in: priceIdsToUpdate } }
          const updatedPriceBook1 = await dealerPriceService.updateDealerPrice(dealerCreateria, { status: data.status }, { new: true });
        }

      }
    }
    // Send notification when update
    const checkLoginUser = await supportingFunction.getPrimaryUser({ _id: req.teammateId })
    const base_url = `${process.env.SITE_URL}`
    const adminUpdateCategoryQuery = {
      metaData: {
        $elemMatch: {
          $and: [
            { "adminNotification.categoryUpdate": true },
            { status: true },
            {
              $or: [
                { roleId: new mongoose.Types.ObjectId(process.env.super_admin) },
              ]
            }
          ]
        }
      },
    }
    let adminUsers = await supportingFunction.getNotificationEligibleUser(adminUpdateCategoryQuery, { email: 1 })
    const IDs = adminUsers.map(user => user._id)
    let notificationData;
    if (isValid.status == data.status) {
      notificationData = {
        title: "Pricebook Category Updated",
        description: `Pricebook Category ${data.name} has been updated by ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.userId,
        contentId: req.params.catId,
        flag: 'category',
        notificationFor: IDs,
        endPoint: base_url + "category",
        redirectionId: "/category"
      };
    }
    else {
      notificationData = {
        title: "Pricebook Category Status Updated",
        description: `Pricebook Category ${isValid.name} status has been updated to ${data.status == true ? "Active" : "Inactive"} ${checkLoginUser.metaData[0]?.firstName + " " + checkLoginUser.metaData[0]?.lastName}.`,
        userId: req.userId,
        contentId: req.params.catId,
        flag: 'category',
        notificationFor: IDs,
        endPoint: base_url + "category",
        redirectionId: "/category"
      };
    }

    let createNotification = await userService.createNotification(notificationData);
    // Send Email code here
    let notificationEmails = adminUsers.map(user => user.email)
    const settingData = await userService.getSetting({});
    const admin = await userService.getSingleUserByEmail({ metaData: { $elemMatch: { roleId: new mongoose.Types.ObjectId("656f0550d0d6e08fc82379dc"), isDeleted: false, status: true } } }, {})
    let emailData = {
      darkLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoDark.fileName,
      lightLogo: process.env.API_ENDPOINT + "uploads/logo/" + settingData[0]?.logoLight.fileName,
      address: settingData[0]?.address,
      websiteSetting: settingData[0],
      senderName: "Dear Admin",

      content: "The category " + data.name + " updated successfully.",
      subject: "Update Category"
    }
    let mailing = await sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, ["noreply@getcover.com"], emailData))
    maillogservice.createMailLogFunction(mailing, emailData, adminUsers, process.env.update_status)

    let logData = {
      userId: req.teammateId,
      endpoint: "price/updatePricebookCat",
      body: req.body,
      response: {
        code: constant.successCode,
        message: "Successfully updated",
        result: updateCatResult
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.successCode,
      message: "Successfully updated",
      result: updateCatResult
    })
  } catch (err) {
    let logData = {
      userId: req.teammateId,
      endpoint: "price/updatePricebookCat  catch",
      body: req.body,
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

// get price category by ID
exports.getPriceBookCatById = async (req, res) => {
  try {
    let ID = { _id: req.params.catId }
    let projection = { isDeleted: 0, __v: 0 }
    let getPriceCat = await priceBookService.getPriceCatById(ID, projection);
    if (!getPriceCat) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the price category"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getPriceCat
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// search price category with name
exports.searchPriceBookCategories = async (req, res) => {
  try {
    let data = req.body;
    let query = { 'name': { '$regex': req.body.name.replace(/\s+/g, ' ').trim(), '$options': 'i' } };
    let projection = { __v: 0, status: 0 };
    let seachCategory = await priceBookService.getAllPriceCat(query, projection);
    if (!seachCategory) {
      res.send({
        code: constant.errorCode,
        message: "No data found for price categories"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
      result: seachCategory
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get price book by category name
exports.getPriceBookByCategory = async (req, res) => {
  try {
    let data = req.body
    let catQuery = { name: req.params.categoryName }
    let catProjection = { __v: 0 }
    // check the request is having category id or not
    let checkCategory = await priceBookService.getPriceCatByName(catQuery, catProjection)

    if (!checkCategory) {
      res.send({
        code: constant.errorCode,
        message: "Invalid category"
      })
      return;
    }

    let fetchPriceBooks = await priceBookService.getAllPriceBook({ category: checkCategory._id }, { __v: 0 })

    if (!fetchPriceBooks) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the price books"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: 'Data fetched successfully',
      result: {
        priceBooks: fetchPriceBooks
      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//get price book by category id
exports.getPriceBookByCategoryId = async (req, res) => {
  try {
    let data = req.body
    let catQuery = { _id: req.params.categoryId }
    let catProjection = { __v: 0 }
    // check the request is having category id or not
    let checkCategory = await priceBookService.getPriceCatByName(catQuery, catProjection)
    if (!checkCategory) {
      res.send({
        code: constant.errorCode,
        message: "Invalid category"
      })
      return;
    }
    let limit = req.body.limit ? req.body.limit : 10000
    let page = req.body.page ? req.body.page : 1

    let queryFilter
    // queryFilter = {
    //   $and: [
    //     { status: true }
    //   ]
    // }

    // const dynamicOption = await userService.getOptions(optionQuery)
    // const filteredOptions = dynamicOption.value.filter(item => coverageType.includes(item.value));

    if (data.coverageType) {
      let coverageType = data.coverageType
      const optionQuery = {
        value: {
          $elemMatch: {
            value: { $in: coverageType }
          }
        }
      }
      const dynamicOption = await userService.getOptions(optionQuery)
      const filteredOptions = dynamicOption.value
        .filter(item => !coverageType.includes(item.value))
        .map(item => item.value);

      queryFilter = {
        $and: [
          { category: new mongoose.Types.ObjectId(req.params.categoryId) },
          {
            "coverageType.value": {
              $in: coverageType
            }
          },
          {
            "coverageType.value": {
              $nin: filteredOptions
            }
          },
          { status: true }
        ]
      }
    }

    let fetchPriceBooks = await priceBookService.getAllPriceBook(queryFilter, { __v: 0 }, limit, page)
    res.send({
      code: constant.successCode,
      message: 'Data fetched successfully',
      result: {
        priceBooks: fetchPriceBooks ? fetchPriceBooks : []
      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get coverage type by price book
exports.getCoverageType = async (req, res) => {
  try {
    let data = req.body
    let priceBookId = { _id: req.params.priceBookId }
    // check the request is having price book  or not
    let checkPriceBook = await priceBookService.findByName1(priceBookId)
    if (!checkPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Price Book"
      })
      return;
    }
    const coverageType = checkPriceBook.coverageType.map(item => item.value)
    // Get ADh value from the dealer
    const dealerData = await dealerService.getDealerByName({ _id: data.dealerId })
    const optionQuery = {
      value: {
        $elemMatch: {
          value: { $in: coverageType }
        }
      }
    }
    const dynamicOption = await userService.getOptions(optionQuery)

    const filteredOptions = dynamicOption.value.filter(item => coverageType.includes(item.value));

    const adhDays = dealerData.adhDays;
    const mergedData = adhDays.map(adh => {
      const match = filteredOptions.find(opt => opt.value === adh.label);
      if (match) {
        return { label: match.label, value: match.value, waitingDays: adh.value, deductible: adh.value1, amountType: adh.amountType }

      }

      return adh;
    });

    res.send({
      code: constant.successCode,
      message: 'Data fetched successfully',
      result: mergedData
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getCoverageTypeAndAdhDays = async (req, res) => {
  try {
    let data = req.body
    let priceBookId = { _id: req.params.priceBookId }
    // check the request is having price book  or not
    let checkPriceBook = await priceBookService.findByName1(priceBookId)
    if (!checkPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Price Book"
      })
      return;
    }
    const coverageType = checkPriceBook.coverageType.map(item => item.value)
    // Get ADh value from the dealer
    // console.log("coverageType0000000000000000000000",coverageType)
    const dealerData = await dealerService.getDealerByName({ _id: data.dealerId }, { adhDays: 1, })
    const optionQuery = {
      value: {
        $elemMatch: {
          value: { $in: coverageType }
        }
      }
    }

    const dynamicOption = await userService.getOptions(optionQuery)
    const filteredOptions = dynamicOption.value.filter(item => coverageType.includes(item.value));
    const adhDays = dealerData.adhDays;
    // const mergedData = adhDays.map(adh => {
    //   const match = filteredOptions.find(opt => opt.value === adh.label);
    //   if (match) {
    //     return { label: match.label, value: match.value, waitingDays: adh.waitingDays, deductible: adh.deductible, amountType: adh.amountType }

    //   }

    //   return adh;
    // });

    const mergedData = filteredOptions.map(filter => {
      const match = adhDays.find(opt => opt.value === filter.value);
      if (match) {
        return { label: filter.label, value: filter.value, waitingDays: match.waitingDays, deductible: match.deductible, amountType: match.amountType }

      }

      return filter;
    });

    const eligibilityCriteria = await eligibilityService.getEligibility({ userId: data.dealerId });

    res.send({
      code: constant.successCode,
      message: 'Data fetched successfully',
      result: {
        dealerData: dealerData,
        eligibilityCriteria: eligibilityCriteria ? eligibilityCriteria : {},
        priceBook: checkPriceBook,
        mergedData


      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get category bu price book name
exports.getCategoryByPriceBook = async (req, res) => {
  try {
    let data = req.body
    let checkPriceBook = await priceBookService.getPriceBookById({ name: req.params.name }, {})
    if (!checkPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "No such Price Book found."
      })
      return;
    }
    let getCategoryDetail = await priceBookService.getPriceCatByName({ _id: checkPriceBook.category }, {})
    if (!getCategoryDetail) {
      res.send({
        code: constant.errorCode,
        message: "Category not found"
      })
      return;
    }
    res.send({
      code: constant.successCode,
      message: "Success",
      result: {
        priceBookCategory: getCategoryDetail,
        priceBookDetails: checkPriceBook
      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get File data from S3 bucket
const getObjectFromS3 = (bucketReadUrl) => {
  return new Promise((resolve, reject) => {
    S3Bucket.getObject(bucketReadUrl, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const wb = XLSX.read(data.Body, { type: 'buffer' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        let headers = [];

        for (let cell in sheet) {
          if (
            /^[A-Z]1$/.test(cell) &&
            sheet[cell].v !== undefined &&
            sheet[cell].v !== null &&
            sheet[cell].v.trim() !== ""
          ) {
            headers.push(sheet[cell].v);
          }
        }

        const result = {
          headers: headers,
          data: XLSX.utils.sheet_to_json(sheet, { defval: "" }),
        };

        resolve(result);
      }
    });
  });
};

//upload  price book
exports.uploadRegularPriceBook = async (req, res) => {
  try {
    uploadP(req, res, async (err) => {
      let file = req.file;
      let data = req.body
      if (!file || !data.priceType) {
        res.send({
          code: constant.errorCode,
          message: "File and price type is required"
        })
        return
      }
      const bucketReadUrl = { Bucket: process.env.bucket_name, Key: file.key };
      // Await the getObjectFromS3 function to complete
      const result = await getObjectFromS3(bucketReadUrl);
      let responseData = result.data;
      const headers = result.headers

      if (data.priceType == "Regular Pricing") {
        //check the header of file
        if (headers.length !== 10) {
          res.send({
            code: constant.errorCode,
            message: "Invalid file format detected. The sheet should contain exactly three columns."
          })
          return
        }
        // updating the key names 
        let totalDataComing = responseData.map(item => {
          let keys = Object.keys(item);
          return {
            category: item[keys[0]].trim().replace(/\s+/g, ' '),  // First key's value
            name: item[keys[1]].trim().replace(/\s+/g, ' '),   // Second key's value
            pName: item[keys[2]].trim().replace(/\s+/g, ' '),  // Third key's value
            description: item[keys[3]].trim().replace(/\s+/g, ' '),   // Second key's value
            frontingFee: item[keys[4]],   // Second key's value
            reinsuranceFee: item[keys[5]],   // Second key's value
            reserveFutureFee: item[keys[6]],   // Second key's value
            adminFee: item[keys[7]],   // Second key's value
            coverageType: item[keys[8]],   // Second key's value
            term: item[keys[9]],   // Second key's value
          };
        });
        const totalDataOriginal = responseData.map(item => {
          let keys = Object.keys(item);
          return {
            Category: item[keys[0]],  // First key's value
            "Product Sku": item[keys[1]],   // Second key's value
            "Product Name": item[keys[2]],  // Third key's value
            Description: item[keys[3]],   // Second key's value
            "Fronting Fee": item[keys[4]],   // Second key's value
            "Reinsaurance Fee": item[keys[5]],   // Second key's value
            "Reserve Future Fee": item[keys[6]],   // Second key's value
            "Admin Fee": item[keys[7]],   // Second key's value
            "Coverage Type": item[keys[8]],   // Second key's value
            Term: item[keys[9]],    // Second key's value
          };
        });

        for (let c = 0; c < totalDataComing.length; c++) {

          totalDataComing[c].inValid = false
          totalDataComing[c].reason = "Success"
          function convertToMonths(term) {
            // Use a regular expression to extract the number and the unit (year/years)
            const match = term.match(/(\d+)\s*(year|years)/i);

            if (match) {
              const years = parseInt(match[1], 10);  // Extract the number of years
              const months = years * 12;             // Convert years to months
              return months;
            } else {
              totalDataComing[c].inValid = true
              totalDataComing[c].reason = "Invalid term"
              console.log("term invalid ");
            }
          }
          let category = totalDataComing[c].category;
          let name = totalDataComing[c].name;
          let term = convertToMonths(totalDataComing[c].term);
          let coverageType = totalDataComing[c].coverageType;
          let catSearch = new RegExp(`^${category}$`, 'i');
          let priceNameSearch = new RegExp(`^${name}$`, 'i');
          let checkCategory = await priceBookService.getPriceCatByName({ name: catSearch })
          if (!checkCategory) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid category"
          }
          let checkPriceBook = await priceBookService.findByName1({ name: { '$regex': new RegExp(`^${name}$`, 'i') } })
          if (checkPriceBook) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Product sku already exist"
          }
          if (!name) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Product name required"
          }
          let checkTerms = await terms.findOne({ terms: term })
          if (!checkTerms) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid term"
          }
          coverageType = coverageType.split(',').map(type => type.trim());
          coverageType = [...new Set(coverageType)]
          // coverageType = ["breakdown", "accidental", "liquid_damage"]
          let checkCoverageType = await options.findOne({ "value.label": { $all: coverageType }, "name": "coverage_type" })

          if (!checkCoverageType) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid coverage type"
          }

          totalDataComing[c].coverageType = coverageType
          if (checkCoverageType) {
            let mergedArray = coverageType.map(id => {
              // Find a match in array2 based on id
              let match = checkCoverageType.value.find(item2 => item2.label === id);

              // Return the match only if found
              // return match ? match :null; // If no match, return the id object
              return match ? { label: match.label, value: match.value } : null; // If no match, return the id object
            });
            totalDataComing[c].coverageType = mergedArray

          }
          totalDataComing[c].category = checkCategory ? checkCategory._id : ""
          totalDataComing[c].term = term
          totalDataComing[c].priceType = "Regular Pricing"
          totalDataComing[c].frontingFee = totalDataComing[c].frontingFee ? totalDataComing[c].frontingFee : 0
          totalDataComing[c].reinsuranceFee = totalDataComing[c].reinsuranceFee ? totalDataComing[c].reinsuranceFee : 0
          totalDataComing[c].reserveFutureFee = totalDataComing[c].reserveFutureFee ? totalDataComing[c].reserveFutureFee : 0
          totalDataComing[c].adminFee = totalDataComing[c].adminFee ? totalDataComing[c].adminFee : 0
          // totalDataComing[c].inValid = totalDataComing[c].description != "" ? false : true
          // console.log("sldfjshfljhdf",totalDataComing[c],"======",totalDataComing[c].description,"++++++++++++")
          // totalDataComing[c].reason = totalDataComing[c].description != "" ? "" : "Description is required"
          // totalDataComing[c].inValid = totalDataComing[c].pName != "" ? false : true
          // totalDataComing[c].reason = totalDataComing[c].pName != "" ? "" : "Product name is required"
          if (!totalDataComing[c].description || !totalDataComing[c].pName) {
            totalDataComing[c].reason = "Product name and description both are required"
            totalDataComing[c].inValid = true
          }

          if (!totalDataComing[c].inValid) {
            let createCompanyPriceBook = await priceBookService.createPriceBook(totalDataComing[c])
          }
        }

        function convertArrayToHTMLTable(array) {
          const header = Object.keys(array[0]).map(key => `<th>${key}</th>`).join('');
          const rows = array.map(obj => {
            const values = Object.values(obj).map(value => `<td>${value}</td>`);
            values[2] = `${values[2]}`;
            return values.join('');
          });

          const htmlContent = `<html>
              <head>
                  <style>
                      table {
                          border-collapse: collapse;
                          width: 100%; 
                      }
                      th, td {
                          border: 1px solid #dddddd;
                          text-align: left;
                          padding: 8px;
                      }
                      th {
                          background-color: #f2f2f2;
                      }
                  </style>
              </head>
              <body>
                  <table>
                      <thead><tr>${header}</tr></thead>
                      <tbody>${rows.map(row => `<tr>${row}</tr>`).join('')}</tbody>
                  </table>
              </body>
          </html>`;

          return htmlContent;
        }
        let totalDataOriginal1 = totalDataOriginal.map((item) => {
          let match = totalDataComing.find((secondItem) => secondItem.name === item["Product Sku"]);
          if (match) {
            // If match is found, add reason and status
            return {
              ...item,
              reason: match.reason,
              status: match.inValid ? 'Unsuccessful' : 'Successful'
            };
          }
        });

        const htmlTableString = convertArrayToHTMLTable(totalDataOriginal1);
        let mailing = await sgMail.send(emailConstant.sendPriceBookFile(("yashasvi@codenomad.net"), ["anil@codenomad.net"], htmlTableString));
        maillogservice.createMailLogFunction(mailing, users, htmlTableString)

        res.send({
          code: constant.successCode,
          data: totalDataComing
        })
      } else if (data.priceType == "Flat Pricing") {
        if (headers.length !== 12) {
          res.send({
            code: constant.errorCode,
            message: "Invalid file format detected. The sheet should contain exactly three columns."
          })
          return
        }

        // updating the key names 
        let totalDataComing = responseData.map(item => {
          let keys = Object.keys(item);
          return {
            category: item[keys[0]].trim().replace(/\s+/g, ' '),  // First key's value
            name: item[keys[1]],   // Second key's value
            pName: item[keys[2]],  // Third key's value
            description: item[keys[3]],   // Second key's value
            frontingFee: item[keys[4]],   // Second key's value
            reinsuranceFee: item[keys[5]],   // Second key's value
            reserveFutureFee: item[keys[6]],   // Second key's value
            adminFee: item[keys[7]],   // Second key's value
            coverageType: item[keys[8]],   // Second key's value
            term: item[keys[9]],   // Second key's value
            rangeStart: item[keys[10]],   // Second key's value
            rangeEnd: item[keys[11]],   // Second key's value
          };
        });

        let totalDataOriginal = responseData.map(item => {
          let keys = Object.keys(item);
          return {
            Category: item[keys[0]],  // First key's value
            "Product Sku": item[keys[1]],   // Second key's value
            "Product Name": item[keys[2]],  // Third key's value
            Description: item[keys[3]],   // Second key's value
            "Fronting Fee": item[keys[4]],   // Second key's value
            "Reinsaurance Fee": item[keys[5]],   // Second key's value
            "Reserve Future Fee": item[keys[6]],   // Second key's value
            "Admin Fee": item[keys[7]],   // Second key's value
            "Coverage Type": item[keys[8]],   // Second key's value
            Term: item[keys[9]],   // Second key's value
            "Range Start": item[keys[10]],   // Second key's value
            "Range End": item[keys[11]],   // Second key's value
          };
        });




        for (let c = 0; c < totalDataComing.length; c++) {

          totalDataComing[c].inValid = false
          totalDataComing[c].reason = "Success"
          function convertToMonths(term) {
            // Use a regular expression to extract the number and the unit (year/years)
            const match = term.match(/(\d+)\s*(year|years)/i);

            if (match) {
              const years = parseInt(match[1], 10);  // Extract the number of years
              const months = years * 12;             // Convert years to months
              return months;
            } else {
              totalDataComing[c].inValid = true
              totalDataComing[c].reason = "Invalid term"
            }
          }
          let category = totalDataComing[c].category;
          let name = totalDataComing[c].name;
          let term = convertToMonths(totalDataComing[c].term);
          let coverageType = totalDataComing[c].coverageType;
          let catSearch = new RegExp(`^${category}$`, 'i');
          let priceNameSearch = new RegExp(`^${name}$`, 'i');
          let checkCategory = await priceBookService.getPriceCatByName({ name: catSearch })
          if (!checkCategory) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid category"
          }
          let checkPriceBook = await priceBookService.findByName1({ name: name })
          if (checkPriceBook) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Product sku already exist"
          }
          console.log("name check ----------------------", name)
          if (!name) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Product name required"
          }
          let checkTerms = await terms.findOne({ terms: term })
          if (!checkTerms) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid term"
          }
          coverageType = coverageType.split(',').map(type => type.trim());
          coverageType = [...new Set(coverageType)]

          // coverageType = ["breakdown", "accidental", "liquid_damage"]
          let checkCoverageType = await options.findOne({ "value.label": { $all: coverageType }, "name": "coverage_type" })

          if (!checkCoverageType) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid coverage type"
          }
          totalDataComing[c].coverageType = coverageType
          if (checkCoverageType) {

            let mergedArray = coverageType.map(id => {
              // Find a match in array2 based on id
              let match = checkCoverageType.value.find(item2 => item2.label == id);

              // Return the match only if found
              // return match ? match :null; // If no match, return the id object
              return match ? { label: match.label, value: match.value } : null; // If no match, return the id object
            });
            totalDataComing[c].coverageType = mergedArray

          }
          if (totalDataComing[c].rangeStart < 0 || !totalDataComing[c].rangeStart) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid range start price"
          }
          if (totalDataComing[c].rangeEnd < 0 || !totalDataComing[c].rangeEnd || totalDataComing[c].rangeEnd < totalDataComing[c].rangeStart) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid range end price"
          }
          totalDataComing[c].category = checkCategory ? checkCategory._id : ""
          totalDataComing[c].term = term
          totalDataComing[c].priceType = "Flat Pricing"
          totalDataComing[c].frontingFee = totalDataComing[c].frontingFee ? totalDataComing[c].frontingFee : 0
          totalDataComing[c].reinsuranceFee = totalDataComing[c].reinsuranceFee ? totalDataComing[c].reinsuranceFee : 0
          totalDataComing[c].reserveFutureFee = totalDataComing[c].reserveFutureFee ? totalDataComing[c].reserveFutureFee : 0
          totalDataComing[c].adminFee = totalDataComing[c].adminFee ? totalDataComing[c].adminFee : 0
          // totalDataComing[c].inValid = totalDataComing[c].description != "" ? false : true
          // console.log("sldfjshfljhdf",totalDataComing[c],"======",totalDataComing[c].description,"++++++++++++")
          // totalDataComing[c].reason = totalDataComing[c].description != "" ? "" : "Description is required"
          // totalDataComing[c].inValid = totalDataComing[c].pName != "" ? false : true
          // totalDataComing[c].reason = totalDataComing[c].pName != "" ? "" : "Product name is required"
          if (!totalDataComing[c].description || !totalDataComing[c].pName) {
            totalDataComing[c].reason = "Product name and description both are required"
            totalDataComing[c].inValid = true
          }

          if (!totalDataComing[c].inValid) {
            let createCompanyPriceBook = await priceBookService.createPriceBook(totalDataComing[c])
          }
        }


        function convertArrayToHTMLTable(array) {
          const header = Object.keys(array[0]).map(key => `<th>${key}</th>`).join('');
          const rows = array.map(obj => {
            const values = Object.values(obj).map(value => `<td>${value}</td>`);
            values[2] = `${values[2]}`;
            return values.join('');
          });

          const htmlContent = `<html>
              <head>
                  <style>
                      table {
                          border-collapse: collapse;
                          width: 100%; 
                      }
                      th, td {
                          border: 1px solid #dddddd;
                          text-align: left;
                          padding: 8px;
                      }
                      th {
                          background-color: #f2f2f2;
                      }
                  </style>
              </head>
              <body>
                  <table>
                      <thead><tr>${header}</tr></thead>
                      <tbody>${rows.map(row => `<tr>${row}</tr>`).join('')}</tbody>
                  </table>
              </body>
          </html>`;

          return htmlContent;
        }
        let totalDataOriginal1 = totalDataOriginal.map((item) => {
          let match = totalDataComing.find((secondItem) => secondItem.name === item["Product Sku"]);
          if (match) {
            // If match is found, add reason and status
            return {
              ...item,
              reason: match.reason,
              status: match.inValid ? 'Unsuccessful' : 'Successful'
            };
          }
        });
        const htmlTableString = convertArrayToHTMLTable(totalDataOriginal1);
        const mailing = await sgMail.send(emailConstant.sendPriceBookFile(("yashasvi@codenomad.net"), ["noreply@getcover.com"], htmlTableString));


        res.send({
          code: constant.successCode,
          data: totalDataComing
        })

      } else if (data.priceType == "Quantity Pricing") {
        if (headers.length < 12) {
          res.send({
            code: constant.errorCode,
            message: "Invalid file format detected. The sheet should contain exactly three columns."
          })
          return
        }

        let quantityPriceDetail = []
        // updating the key names 
        let totalDataComing = responseData.map(item => {
          quantityPriceDetail = []

          let keys = Object.keys(item);
          for (let i = 0; i < (headers.length - 10) / 2; i++) { // Loop for creating 6 entries
            if (item[keys[10 + (2 * i)]] != "" || item[keys[11 + (2 * i)]] != "") {
              console.log(i, '++++++++++', item[keys[10 + i]], "----------------------", item[keys[11 + i]])
              quantityPriceDetail.push({
                name: item[keys[10 + (2 * i)]],       // Set the name value from item
                quantity: item[keys[11 + (2 * i)]]   // Set the quantity value from item
              });
            }
          }
          return {
            category: item[keys[0]].trim().replace(/\s+/g, ' '),  // First key's value
            name: item[keys[1]],   // Second key's value
            pName: item[keys[2]],  // Third key's value
            description: item[keys[3]],   // Second key's value
            frontingFee: item[keys[4]],   // Second key's value
            reinsuranceFee: item[keys[5]],   // Second key's value
            reserveFutureFee: item[keys[6]],   // Second key's value
            adminFee: item[keys[7]],   // Second key's value
            coverageType: item[keys[8]],   // Second key's value
            term: item[keys[9]],   // Second key's value
            quantityPriceDetail: quantityPriceDetail
          };
        });

        let totalDataOriginal = responseData.map(item => {
          quantityPriceDetail = []

          let keys = Object.keys(item);
          for (let i = 0; i < (headers.length - 10) / 2; i++) { // Loop for creating 6 entries
            if (item[keys[10 + (2 * i)]] != "" || item[keys[11 + (2 * i)]] != "") {
              console.log(i, '++++++++++', item[keys[10 + i]], "----------------------", item[keys[11 + i]])
              quantityPriceDetail.push({
                name: item[keys[10 + (2 * i)]],       // Set the name value from item
                quantity: item[keys[11 + (2 * i)]]   // Set the quantity value from item
              });
            }
          }
          return {
            Category: item[keys[0]],  // First key's value
            "Product Sku": item[keys[1]],   // Second key's value
            "Product Name": item[keys[2]],  // Third key's value
            Description: item[keys[3]],   // Second key's value
            "Fronting Fee": item[keys[4]],   // Second key's value
            "Reinsaurance Fee": item[keys[5]],   // Second key's value
            "Reserve Future Fee": item[keys[6]],   // Second key's value
            "Admin Fee": item[keys[7]],   // Second key's value
            "Coverage Type": item[keys[8]],   // Second key's value
            Term: item[keys[9]],   // Second key's value
            "Name 1": item[keys[10]],   // Second key's value
            "Max Quantity 1": item[keys[11]],   // Second key's value
            "Name 2": item[keys[12]],   // Second key's value
            "Max Quantity 2": item[keys[13]],   // Second key's value
            "Name 3": item[keys[14]],   // Second key's value
            "Max Quantity 3": item[keys[15]],   // Second key's value
            "Name 4": item[keys[16]],   // Second key's value
            "Max Quantity 4": item[keys[17]],   // Second key's value
            "Name 5": item[keys[18]],   // Second key's value
            "Max Quantity 5": item[keys[19]],   // Second key's value
            "Name 6": item[keys[20]],   // Second key's value
            "Max Quantity 6": item[keys[21]],   // Second key's value
            // quantityPriceDetail: quantityPriceDetail
          };
        });

        for (let c = 0; c < totalDataComing.length; c++) {

          totalDataComing[c].inValid = false
          totalDataComing[c].reason = "Success"

          // function to convert the year to months
          function convertToMonths(term) {
            // Use a regular expression to extract the number and the unit (year/years)
            const match = term.match(/(\d+)\s*(year|years)/i);

            if (match) {
              const years = parseInt(match[1], 10);  // Extract the number of years
              const months = years * 12;             // Convert years to months
              return months;
            } else {
              totalDataComing[c].inValid = true
              totalDataComing[c].reason = "Invalid term"
            }
          }

          // function for quantity price item details
          function validateQuantityPriceDetail(data) {
            let invalidEntries = data.quantityPriceDetail.filter(item => {
              return !item.name?.trim() || !item.quantity;
            });

            if (invalidEntries.length > 0) {
              console.log("Error: Some entries have empty name or quantity values.");
              return false;
            }

            console.log("All entries are valid.");
            return true;
          }

          let category = totalDataComing[c].category;
          let name = totalDataComing[c].name;
          let term = convertToMonths(totalDataComing[c].term);
          let coverageType = totalDataComing[c].coverageType;
          let catSearch = new RegExp(`^${category}$`, 'i');
          let priceNameSearch = new RegExp(`^${name}$`, 'i');
          let checkCategory = await priceBookService.getPriceCatByName({ name: catSearch })
          if (!checkCategory) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid category"
          }
          let checkPriceBook = await priceBookService.findByName1({ name: name })
          if (checkPriceBook) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Product sku already exist"
          }
          console.log("name check ----------------------", name)
          if (!name) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Product name required"
          }
          let checkTerms = await terms.findOne({ terms: term })
          if (!checkTerms) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid term"
          }
          coverageType = coverageType.split(',').map(type => type.trim());
          coverageType = [...new Set(coverageType)]

          // coverageType = ["breakdown", "accidental", "liquid_damage"]
          let checkCoverageType = await options.findOne({ "value.label": { $all: coverageType }, "name": "coverage_type" })

          if (!checkCoverageType) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid coverage type"
          }
          totalDataComing[c].coverageType = coverageType
          if (checkCoverageType) {
            let mergedArray = coverageType.map(id => {
              // Find a match in array2 based on id
              let match = checkCoverageType.value.find(item2 => item2.label === id);

              // Return the match only if found
              // return match ? match :null; // If no match, return the id object
              return match ? { label: match.label, value: match.value } : null; // If no match, return the id object
            });
            totalDataComing[c].coverageType = mergedArray

          }
          if (!validateQuantityPriceDetail(totalDataComing[c])) {
            totalDataComing[c].inValid = true
            totalDataComing[c].reason = "Invalid quantity price items"
          }

          totalDataComing[c].category = checkCategory ? checkCategory._id : ""
          totalDataComing[c].term = term
          totalDataComing[c].priceType = "Quantity Pricing"
          totalDataComing[c].frontingFee = totalDataComing[c].frontingFee ? totalDataComing[c].frontingFee : 0
          totalDataComing[c].reinsuranceFee = totalDataComing[c].reinsuranceFee ? totalDataComing[c].reinsuranceFee : 0
          totalDataComing[c].reserveFutureFee = totalDataComing[c].reserveFutureFee ? totalDataComing[c].reserveFutureFee : 0
          totalDataComing[c].adminFee = totalDataComing[c].adminFee ? totalDataComing[c].adminFee : 0
          // totalDataComing[c].inValid = totalDataComing[c].description != "" ? false : true
          // console.log("sldfjshfljhdf",totalDataComing[c],"======",totalDataComing[c].description,"++++++++++++")
          // totalDataComing[c].reason = totalDataComing[c].description != "" ? "" : "Description is required"
          // totalDataComing[c].inValid = totalDataComing[c].pName != "" ? false : true
          // totalDataComing[c].reason = totalDataComing[c].pName != "" ? "" : "Product name is required"
          if (!totalDataComing[c].description || !totalDataComing[c].pName) {
            totalDataComing[c].reason = "Product name and description both are required"
            totalDataComing[c].inValid = true
          }

          if (!totalDataComing[c].inValid) {
            let createCompanyPriceBook = await priceBookService.createPriceBook(totalDataComing[c])
          }
        }

        function convertArrayToHTMLTable(array) {
          const header = Object.keys(array[0]).map(key => `<th>${key}</th>`).join('');
          const rows = array.map(obj => {
            const values = Object.values(obj).map(value => `<td>${value}</td>`);
            values[2] = `${values[2]}`;
            return values.join('');
          });

          const htmlContent = `<html>
              <head>
                  <style>
                      table {
                          border-collapse: collapse;
                          width: 100%; 
                      }
                      th, td {
                          border: 1px solid #dddddd;
                          text-align: left;
                          padding: 8px;
                      }
                      th {
                          background-color: #f2f2f2;
                      }
                  </style>
              </head>
              <body>
                  <table>
                      <thead><tr>${header}</tr></thead>
                      <tbody>${rows.map(row => `<tr>${row}</tr>`).join('')}</tbody>
                  </table>
              </body>
          </html>`;

          return htmlContent;
        }
        let totalDataOriginal1 = totalDataOriginal.map((item) => {
          console.log("item check ++++++++++++++++++++++++", item)
          let match = totalDataComing.find((secondItem) => secondItem.name === item["Product Sku"]);
          if (match) {
            // If match is found, add reason and status
            return {
              ...item,
              reason: match.reason,
              status: match.inValid ? 'Unsuccessful' : 'Successful'
            };
          }
        });
        const htmlTableString = convertArrayToHTMLTable(totalDataOriginal1);
        const mailing = await sgMail.send(emailConstant.sendPriceBookFile(("yashasvi@codenomad.net"), ["anil@codenomad.net"], htmlTableString));

        res.send({
          code: constant.successCode,
          data: totalDataComing
        })
      } else {
        res.send({
          code: constant.errorCode,
          message: "Invalid price type "
        })
      }

    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//not using 
exports.uploadCompanyPriceBook = async (req, res) => {
  try {
    let data = req.body

    if (data.priceType == "Regular Price") {
      let callApi = await uploadRegularPriceBook(req, res)
      res.send({
        callApi
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

