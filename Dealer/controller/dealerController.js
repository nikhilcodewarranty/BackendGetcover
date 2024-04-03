require('dotenv').config()
const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const dealerRelationService = require("../services/dealerRelationService");
const customerService = require("../../Customer/services/customerService");
const claimService = require("../../Claim/services/claimService");
const dealerPriceService = require("../services/dealerPriceService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const dealerRelation = require("../../Provider/model/dealerServicer");
const servicerService = require("../../Provider/services/providerService");
const userService = require("../../User/services/userService");
const role = require("../../User/model/role");
const dealer = require("../model/dealer");
const constant = require('../../config/constant');
const bcrypt = require("bcrypt");
const XLSX = require("xlsx");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const emailConstant = require('../../config/emailConstant');
const mongoose = require('mongoose');
const fs = require('fs');
const json2csv = require('json-2-csv').json2csv;
const connection = require('../../db');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading

const csvParser = require('csv-parser');
const { id } = require('../validators/register_dealer');
const { isBoolean } = require('util');
const { string } = require('joi');
const providerService = require('../../Provider/services/providerService');
const { getServicer } = require('../../Provider/controller/serviceAdminController');
const resellerService = require('../services/resellerService');
const orderService = require('../../Order/services/orderService');
const order = require('../../Order/model/order');
const { constants } = require('buffer');
const contractService = require('../../Contract/services/contractService');


var StorageP = multer.diskStorage({
  destination: function (req, files, cb) {
    cb(null, path.join(__dirname, '../../uploads/resultFile'));
  },
  filename: function (req, files, cb) {
    cb(null, files.fieldname + '-' + Date.now() + path.extname(files.originalname))
  }
})

var uploadP = multer({
  storage: StorageP,
}).single('file');



const checkObjectId = async (Id) => {
  // Check if the potentialObjectId is a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(Id)) {
    return true;
  } else {
    return false;
  }
}

// get all dealers 
exports.getAllDealers = async (req, res) => {
  try {

    let data = req.body

    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let dealerFilter = {
      $and: [
        { isDeleted: false },
        { status: "Approved" },
        { 'name': { '$regex': req.body.name ? req.body.name.trim().replace(/\s+/g, ' ') : '', '$options': 'i' } }
      ]

    };

    //let query = { isDeleted: false, status: "Approved" }
    let projection = { __v: 0, isDeleted: 0 }
    let dealers = await dealerService.getAllDealers(dealerFilter, projection);
    const dealerIds = dealers.map(obj => obj._id);
    let query1 = { accountId: { $in: dealerIds }, isPrimary: true };

    // if (req.body.email && req.body.phoneNumber) {
    //   query1 = {
    //     ...query1,
    //     $and: [
    //       { email: { '$regex': req.body.email ? req.body.email.trim().replace(/\s+/g, ' ') : '', '$options': 'i' } },
    //       { phoneNumber: { '$regex': req.body.phoneNumber ? req.body.phoneNumber.trim().replace(/\s+/g, ' ') : '', '$options': 'i' } }
    //     ]
    //   };
    // } else {
    //   // If only one of them is provided, use $or
    //   const orConditions = [];

    //   if (req.body.email !== undefined && req.body.email != '') {
    //     orConditions.push({ email: req.body.email });
    //   }

    //   if (req.body.phoneNumber !== undefined && req.body.phoneNumber != '') {
    //     orConditions.push({ phoneNumber: req.body.phoneNumber });
    //   }

    //   if (orConditions.length > 0) {
    //     query1 = {
    //       ...query1,
    //       $or: orConditions
    //     };
    //   }

    // }

    //-------------Get All Dealers Id's------------------------

    // Get Dealer Primary Users from colection
    //const query1 = { accountId: { $in: dealerIds }, isPrimary: true };
    //User Query Filter

    let dealarUser = await userService.getMembers(query1, projection)

    //Get Dealer Order Data     

    let orderQuery = { dealerId: { $in: dealerIds }, status: "Active" };
    let project = {
      productsArray: 1,
      dealerId: 1,
      unique_key: 1,
      servicerId: 1,
      customerId: 1,
      resellerId: 1,
      paymentStatus: 1,
      status: 1,
      venderOrder: 1,
      orderAmount: 1,
    }

    let orderData = await orderService.getAllOrderInCustomers(orderQuery, project, "$dealerId");


    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };
    // return false;

    const result_Array = dealarUser.map(item1 => {
      const matchingItem = dealers.find(item2 => item2._id.toString() === item1.accountId.toString());
      const orders = orderData.find(order => order._id.toString() === item1.accountId.toString())

      if (matchingItem || orders) {
        return {
          ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          dealerData: matchingItem.toObject(),
          ordersData: orders ? orders : {}
        };
      } else {
        return dealerData.toObject();
      }
    });

    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phoneNumber ? data.phoneNumber : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.dealerData.name) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });



    res.send({
      code: constant.successCode,
      data: filteredData
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};


//Get Pending Request dealers
exports.getPendingDealers = async (req, res) => {
  try {

    let data = req.body

    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    let dealerFilter = {
      $and: [
        { isDeleted: false },
        { status: "Pending" },
        { 'name': { '$regex': req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } }
      ]

    };
    // let query = { isDeleted: false, status: "Pending" }
    let projection = { __v: 0, isDeleted: 0 }
    let dealers = await dealerService.getAllDealers(dealerFilter, projection);
    //-------------Get All Dealers Id's------------------------

    const dealerIds = dealers.map(obj => obj._id);

    let query1 = { accountId: { $in: dealerIds }, isPrimary: true };

    // if (req.body.email && req.body.phoneNumber) {
    //   query1 = {
    //     ...query1,
    //     $and: [
    //       { email: { '$regex': req.body.email ? req.body.email : '', '$options': 'i' } },
    //       { phoneNumber: req.body.phoneNumber }
    //     ]
    //   };
    // } else {
    //   // If only one of them is provided, use $or
    //   const orConditions = [];

    //   if (req.body.email !== undefined && req.body.email != '') {
    //     orConditions.push({ email: req.body.email });
    //   }

    //   if (req.body.phoneNumber !== undefined && req.body.phoneNumber != '') {
    //     orConditions.push({ phoneNumber: req.body.phoneNumber });
    //   }

    //   if (orConditions.length > 0) {
    //     query1 = {
    //       ...query1,
    //       $or: orConditions
    //     };
    //   }

    // }

    let dealarUser = await userService.getMembers(query1, projection)
    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };

    const result_Array = dealarUser.map(item1 => {
      const matchingItem = dealers.find(item2 => item2._id.toString() === item1.accountId.toString());

      if (matchingItem) {
        return {
          ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          dealerData: matchingItem.toObject()
        };
      } else {
        return dealerData.toObject();
      }
    });

    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phoneNumber ? data.phoneNumber.replace(/\s+/g, ' ').trim() : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.dealerData.name) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });


    res.send({
      code: constant.successCode,
      data: filteredData
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//create new dealer
exports.createDealer = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let data = req.body
    let dealerData = {}
    const createdDealer = await dealerService.createDealer(dealerData);
    if (!createdDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create a new Dealer"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//get dealer detail by ID
exports.getDealerById = async (req, res) => {
  try {
    //fetching data from user table
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    const dealers = await dealerService.getSingleDealerById({ _id: req.params.dealerId });

    //result.metaData = singleDealer
    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "No data found"
      });
      return
    }
    const query1 = { accountId: { $in: [dealers[0]._id] }, isPrimary: true };

    let dealarUser = await userService.getMembers(query1, { isDeleted: false })


    if (!dealarUser) {
      res.send({
        code: constant.errorCode,
        message: "No any user of this dealer"
      });
      return
    }

    let project = {
      productsArray: 1,
      dealerId: 1,
      unique_key: 1,
      servicerId: 1,
      customerId: 1,
      resellerId: 1,
      paymentStatus: 1,
      status: 1,
      venderOrder: 1,
      orderAmount: 1,
    }

    let query = {
      $and: [
        { dealerId: new mongoose.Types.ObjectId(req.params.dealerId), status: "Active" }
      ]
    }

    let ordersResult = await orderService.getAllOrderInCustomers(query, project, "$dealerId");

    //Get Claim Result 
    const claimQuery = { claimFile: 'Completed' }

    let lookupQuery = [
      {
        $match: claimQuery
      },
      {
        $lookup: {
          from: "contracts",
          localField: "contractId",
          foreignField: "_id",
          as: "contracts",
        }
      },
      {
        $unwind: "$contracts"
      },
      {
        $lookup: {
          from: "orders",
          localField: "contracts.orderId",
          foreignField: "_id",
          as: "contracts.orders",
        },

      },
      {
        $unwind: "$contracts.orders"
      },
      {
        $match:
        {
          $and: [
            // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
            { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.params.dealerId) },
          ]
        },
      },
      {
        "$group": {
          "_id": "",
          "totalAmount": {
            "$sum": {
              "$sum": "$totalAmount"
            }
          },
        },

      },
    ]
    let valueClaim = await claimService.valueCompletedClaims(lookupQuery);

    const rejectedQuery = { claimFile: { $ne: "Rejected" } }
    //Get number of claims
    let numberOfCompleletedClaims = [
      {
        $match: rejectedQuery
      },
      {
        $lookup: {
          from: "contracts",
          localField: "contractId",
          foreignField: "_id",
          as: "contracts",
        }
      },
      {
        $unwind: "$contracts"
      },
      {
        $lookup: {
          from: "orders",
          localField: "contracts.orderId",
          foreignField: "_id",
          as: "contracts.orders",
        },

      },
      {
        $unwind: "$contracts.orders"
      },
      {
        $match:
        {
          $and: [
            // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
            { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.params.dealerId) },
          ]
        },
      },
    ]
    let numberOfClaims = await claimService.getAllClaims(numberOfCompleletedClaims);
    const claimData = {
      numberOfClaims: numberOfClaims.length,
      valueClaim: valueClaim[0]?.totalAmount
    }


    const result_Array = dealarUser.map(item1 => {
      const matchingItem = dealers.find(item2 => item2._id.toString() === item1.accountId.toString());
      if (matchingItem) {
        return {
          ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          dealerData: matchingItem.toObject(),
          ordersResult: ordersResult,
          claimData: claimData
        };
      } else {
        return dealerData.toObject();
      }
    });

    res.send({
      code: constant.successCode,
      message: "Success",
      result: result_Array,
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

//get dealer detail by ID
exports.getUserByDealerId = async (req, res) => {
  try {
    let data = req.body
    //fetching data from user table
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    // const dealers = await dealerService.getSingleDealerById({ _id: req.params.dealerId }, { accountStatus: 1 });
    const dealers = await dealerService.getDealerById(req.params.dealerId);

    //result.metaData = singleDealer
    if (!dealers) {
      res.send({
        code: constant.errorCode,
        message: "Dealer not found"
      });
      return;
    };
    const users = await dealerService.getUserByDealerId({ accountId: req.params.dealerId, isDeleted: false });

    let name = data.firstName ? data.firstName : ""
    let nameArray = name.trim().split(" ");

    // Create new keys for first name and last name
    let newObj = {
      f_name: nameArray[0],  // First name
      l_name: nameArray.slice(1).join(" ")  // Last name (if there are multiple parts)
    };

    // const firstNameRegex = new RegExp(newObj.f_name ? newObj.f_name.replace(/\s+/g, ' ').trim() : '', 'i')
    // const lastNameRegex = new RegExp(newObj.l_name ? newObj.l_name.replace(/\s+/g, ' ').trim() : '', 'i')
    const firstNameRegex = new RegExp(data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', 'i')
    const lastNameRegex = new RegExp(data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', 'i')
    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')


    let filteredData = users.filter(entry => {
      return (
        firstNameRegex.test(entry.firstName) &&
        lastNameRegex.test(entry.lastName) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });


    //result.metaData = singleDealer
    if (!users) {
      res.send({
        code: constant.errorCode,
        message: "No data found"
      });
      return
    }
    console.log(dealers)
    res.send({
      code: constant.successCode,
      message: "Success",
      result: filteredData,
      dealerData: dealers,
      dealerStatus: dealers.accountStatus
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

//update dealer detail with ID
exports.updateDealer = async (req, res) => {
  try {
    let data = req.body;
    let criteria = { _id: req.params.dealerId };
    let newValue = {
      $set: {
        // body data will be pass here
      }
    };
    let option = { new: true };
    const updatedDealer = await dealerService.updateDealer(criteria, newValue, option);
    if (!updatedDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the dealer data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Updated Successfully"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

// delete dealer with dealer ID
exports.deleteDealer = async (req, res) => {
  try {
    let data = req.body;
    let criteria = { _id: req.params.dealerId };
    let newValue = {
      $set: {
        isDeleted: true
      }
    };
    let option = { new: true };
    const deletedDealer = await dealerService.deleteDealer(criteria, newValue, option);
    if (!deletedDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the dealer"
      })
      return;
    };
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//
exports.uploadTermAndCondition = async (req, res, next) => {
  try {
    uploadP(req, res, async (err) => {
      if (req.role != 'Super Admin') {
        res.send({
          code: constant.errorCode,
          message: 'Only suoer admin allow to do this action!'
        });
        return;
      }
      let file = req.file;
      // let filename = file.filename;
      // let originalName = file.originalname;
      // let size = file.size;
      // let files = []

      res.send({
        code: constant.successCode,
        message: 'Success!',
        file
      })
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
    return
  }

}

/**---------------------------------------------------Register Dealer-------------------------------------------- */
exports.registerDealer = async (req, res) => {
  try {
    const data = req.body;
    // Check if the specified role exists
    // { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
    const checkRole = await role.findOne({ role: { '$regex': new RegExp(`^${req.body.role}$`, 'i') } });
    if (!checkRole) {
      res.send({
        code: constant.errorCode,
        message: "Invalid role"
      })
      return;
    }
    // Check if the dealer already exists
    const pendingDealer = await dealerService.getDealerByName({ name: { '$regex': new RegExp(`^${req.body.name}$`, 'i') }, status: "Pending" }, { isDeleted: 0, __v: 0 });
    if (pendingDealer) {
      res.send({
        code: constant.errorCode,
        message: "You have registered already with this name! Waiting for the approval"
      })
      return;
    }

    // Check if the dealer already exists
    const existingDealer = await dealerService.getDealerByName({ name: { '$regex': new RegExp(`^${req.body.name}$`, 'i') } }, { isDeleted: 0, __v: 0 });
    if (existingDealer) {
      res.send({
        code: constant.errorCode,
        message: "Account name already exist"
      })
      return;
    }


    // Check if the email already exists
    const pendingUser = await userService.findOneUser({ email: req.body.email });
    if (pendingUser) {
      let checkDealer = await dealerService.getDealerByName({ _id: pendingUser.accountId })
      if (checkDealer) {
        if (checkDealer.status == "Pending") {
          res.send({
            code: constant.errorCode,
            message: "You have registered already with this email! Waiting for the approval"
          })
          return;
        }
      }


    }

    // Check if the email already exists
    const existingUser = await userService.findOneUser({ email: req.body.email });
    if (existingUser) {
      res.send({
        code: constant.errorCode,
        message: "User already exist with this email"
      })
      return;
    }

    const count = await dealerService.getDealerCount();

    //console.log("count=======================",count);return false;

    // console.log(count);return false;
    // Extract necessary data for dealer creation
    const dealerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
    };

    // Register the dealer
    const createdDealer = await dealerService.registerDealer(dealerMeta);
    if (!createdDealer) {
      res.send({
        code: constant.errorCode,
        message: "Unbale to create the dealer"
      })
      return;
    }

    // Create user metadata
    const userMetaData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      roleId: checkRole._id,
      accountId: createdDealer._id,
      metaId: createdDealer._id,
    };

    // Create the user
    const createdUser = await userService.createUser(userMetaData);

    if (!createdUser) {
      res.send({
        code: constant.errorCode,
        message: 'Unable to create dealer user',
      });
      return
    }
    //Send Notification to dealer 

    const notificationData = {
      title: "New Dealer Registration",
      description: data.name + " " + "has finished registering as a new dealer. For the onboarding process to proceed more quickly, kindly review and give your approval.",
      userId: createdDealer._id,
      flag: 'dealer'
    };


    // Create the user
    const createNotification = await userService.createNotification(notificationData);

    if (createNotification) {
      // Send Email code here
      let mailing = sgMail.send(emailConstant.dealerWelcomeMessage(data.email))

    }
    res.send({
      code: constant.successCode,
      data: createdDealer,
    });
    return

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message,
    });
    return;
  }
};

exports.statusUpdate = async (req, res) => {
  try {
    // Check if the user has the required role
    if (req.role !== "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin is allowed to perform this action"
      });
      return
    }

    // Check if the dealerPriceBookId is a valid ObjectId
    const isValid = await checkObjectId(req.params.dealerPriceBookId);
    if (!isValid) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Dealer Price Book ID"
      });
      return;
    }

    // Fetch existing dealer price book data
    const criteria = { _id: req.params.dealerPriceBookId };
    const projection = { isDeleted: 0, __v: 0 };
    const existingDealerPriceBook = await dealerPriceService.getDealerPriceById(criteria, projection);

    if (!existingDealerPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Price Book not found"
      });
      return;
    }

    // Check if the priceBook is a valid ObjectId
    const isPriceBookValid = await checkObjectId(req.body.priceBook);
    if (!isPriceBookValid) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Price Book ID"
      });
      return;
    }

    // Prepare the update data
    const newValue = {
      $set: {
        brokerFee: req.body.brokerFee || existingDealerPriceBook.brokerFee,
        status: req.body.status,
        retailPrice: req.body.retailPrice || existingDealerPriceBook.retailPrice,
        priceBook: req.body.priceBook || existingDealerPriceBook.priceBook,
      }
    };

    const option = { new: true };

    // Update the dealer price status
    const updatedResult = await dealerService.statusUpdate(criteria, newValue, option);

    if (!updatedResult) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the dealer price status"
      });

      return;

    }
    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      data: updatedResult
    });

    return

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message,
    });
    return
  }
};

// All Dealer Books
exports.getAllDealerPriceBooks = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let projection = { isDeleted: 0, __v: 0 }
    let query = { isDeleted: false }
    let getDealerPrice = await dealerPriceService.getAllDealerPrice(query, projection)
    if (!getDealerPrice) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get the dealer price books"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getDealerPrice
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.changeDealerStatus = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    const singleDealer = await dealerService.getDealerById({ _id: req.params.dealerId });

    if (!singleDealer) {
      res.send({
        code: constant.errorCode,
        message: "Dealer not found"
      })
      return;
    }
    //Update Dealer User Status if inactive
    if (!req.body.status) {
      let dealerUserCreateria = { accountId: req.params.dealerId };
      let newValue = {
        $set: {
          status: req.body.status
        }
      };
      let option = { new: true };
      const changeDealerUser = await userService.updateUser(dealerUserCreateria, newValue, option);

      //Inactive dealer price Books
      // const changeDealerPriceBookStatus = await dealerPriceService.updateDealerPrice({ dealerId: req.params.dealerId }, {
      //   $set: {
      //     status: req.body.status
      //   }
      // }, option);

      //Archeive All orders when dealer inactive
      let orderCreteria = { dealerId: req.params.dealerId, status: 'Pending' };
      let updateStatus = await orderService.updateManyOrder(orderCreteria, { status: 'Archieved' }, { new: true })

      // // Inactive Dealer Customer
      // const changeDealerCustomerStatus = await customerService.updateCustomerData({ dealerId: req.params.dealerId }, {
      //   $set: {
      //     status: req.body.status
      //   }
      // }, option);

      // // Get Dealer Customers
      // let projection = { __v: 0, isDeleted: 0 }

      // let allCustomers = await customerService.getAllCustomers({ dealerId: req.params.dealerId }, projection)

      // let customerIdsArray = allCustomers.map(customer => customer._id.toString())
      // let queryIds = { accountId: { $in: customerIdsArray } };

      // //Inactive Customer Status
      // const changeCustomerUserStatus = await customerService.updateCustomerData(queryIds,{status: req.body.status}, option);

      // console.log("changeCustomerUserStatus++++++++",changeCustomerUserStatus)

    }

    else {
      if (singleDealer.isAccountCreate) {
        let dealerUserCreateria = { accountId: req.params.dealerId, isPrimary: true };
        let newValue = {
          $set: {
            status: req.body.status
          }
        };
        let option = { new: true };
        const changeDealerUser = await userService.updateUser(dealerUserCreateria, newValue, option);
      }
   }
    option = { new: true };
    //Update Dealer Status
    newValue = {
      $set: {
        accountStatus: req.body.status
      }
    };
    const changedDealerStatus = await dealerService.updateDealerStatus({ _id: req.params.dealerId }, newValue, option);
    if (changedDealerStatus) {
      res.send({
        code: constant.successCode,
        message: 'Updated Successfully!',
        data: changedDealerStatus
      })
    }
    else {
      res.send({
        code: constant.errorCode,
        message: 'Unable to update dealer status!',
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


exports.getDealerPriceBookById = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let projection = {

      _id: 1,
      name: 1,
      wholesalePrice: {
        $sum: [
          // { $arrayElemAt: ["$priceBooks.reserveFutureFee", 0] },
          // { $arrayElemAt: ["$priceBooks.reinsuranceFee", 0] },
          // { $arrayElemAt: ["$priceBooks.adminFee", 0] },
          // { $arrayElemAt: ["$priceBooks.frontingFee", 0] }
          "$priceBooks.reserveFutureFee",
          "$priceBooks.reinsuranceFee",
          "$priceBooks.adminFee",
          "$priceBooks.frontingFee",
        ],
      },
      "priceBook": 1,
      "dealerId": 1,
      "status": 1,
      "retailPrice": 1,
      "description": 1,
      "isDeleted": 1,
      // "brokerFee": {
      //   $subtract: ["$retailPrice","$wholesalePrice" ],
      // },
      "unique_key": 1,
      "__v": 1,
      "createdAt": 1,
      "updatedAt": 1,
      priceBooks: 1,
      dealer: 1

    }
    let query = { isDeleted: false, _id: new mongoose.Types.ObjectId(req.params.dealerPriceBookId) }
    let getDealerPrice = await dealerPriceService.getDealerPriceBookById(query, projection)
    if (!getDealerPrice) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get the dealer price books"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getDealerPrice
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get Dealer Price Books
exports.getDealerPriceBookByDealerId = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }

    let checkDealer = await dealerService.getSingleDealerById({ _id: req.params.dealerId }, { isDeleted: false })

    if (checkDealer.length == 0) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Not found"
      })
      return;
    }
    let projection = {

      _id: 1,
      name: 1,
      wholesalePrice: {
        $sum: [
          // { $arrayElemAt: ["$priceBooks.reserveFutureFee", 0] },
          // { $arrayElemAt: ["$priceBooks.reinsuranceFee", 0] },
          // { $arrayElemAt: ["$priceBooks.adminFee", 0] },
          // { $arrayElemAt: ["$priceBooks.frontingFee", 0] }
          "$priceBooks.reserveFutureFee",
          "$priceBooks.reinsuranceFee",
          "$priceBooks.adminFee",
          "$priceBooks.frontingFee",
        ],
      },
      "priceBook": 1,
      "dealerId": 1,
      "status": 1,
      "retailPrice": 1,
      "description": 1,
      "isDeleted": 1,
      // "brokerFee": {
      //   $subtract: ["$retailPrice","$wholesalePrice" ],
      // },
      "unique_key": 1,
      "__v": 1,
      "createdAt": 1,
      "updatedAt": 1,
      priceBooks: 1,
      dealer: 1

    }
    let query = { isDeleted: false, dealerId: new mongoose.Types.ObjectId(req.params.dealerId) }
    let getDealerPrice = await dealerPriceService.getDealerPriceBookById(query, projection)
    if (!getDealerPrice) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get the dealer price books"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: getDealerPrice
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getAllPriceBooksByFilter = async (req, res, next) => {
  try {
    let data = req.body
    data.status = typeof (data.status) == "string" ? "all" : data.status
    console.log(data)
    let categorySearch = req.body.category ? req.body.category : ''
    let queryCategories = {
      $and: [
        { isDeleted: false },
        { 'name': { '$regex': req.body.category ? req.body.category : '', '$options': 'i' } }
      ]
    };
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchName = req.body.name ? req.body.name : ''
    let query
    console.log("lklklkkklk", data.status)
    // let query ={'dealerId': new mongoose.Types.ObjectId(data.dealerId) };
    if (data.status != 'all' && data.status != undefined) {
      query = {
        $and: [
          { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
          { 'priceBooks.category._id': { $in: catIdsArray } },
          { 'status': data.status },
          {
            dealerId: new mongoose.Types.ObjectId(data.dealerId)
          }
        ]
      };
    } else {
      query = {
        $and: [
          { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
          { 'priceBooks.category._id': { $in: catIdsArray } },
          {
            dealerId: new mongoose.Types.ObjectId(data.dealerId)
          }
        ]
      };
    }


    //
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
    const priceBooks = await dealerPriceService.getAllPriceBooksByFilter(query, projection, limit, page);
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

exports.getAllDealerPriceBooksByFilter = async (req, res, next) => {
  try {
    let data = req.body

    data.status = typeof (data.status) == "string" ? "all" : data.status

    //  data.status =  data.status==='true'  ? true : false;
    //return;

    console.log(data.status)
    console.log(typeof (data.status))

    let categorySearch = req.body.category ? req.body.category : ''
    let queryCategories = {
      $and: [
        { isDeleted: false },
        { 'name': { '$regex': req.body.category ? req.body.category.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } }
      ]
    };
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchDealerName = req.body.name ? req.body.name : ''
    let query
    let matchConditions = [];

    matchConditions.push({ 'priceBooks.category._id': { $in: catIdsArray } });


    if (data.status != 'all' && data.status != undefined) {
      console.log("dssdsdf");
      matchConditions.push({ 'status': data.status });
    }

    if (data.term) {
      matchConditions.push({ 'priceBooks.term': Number(data.term) });
    }

    if (data.name) {
      matchConditions.push({ 'dealer.name': { '$regex': req.body.name ? req.body.name.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } });
    }
    const matchStage = matchConditions.length > 0 ? { $match: { $and: matchConditions } } : {};
    console.log(matchStage);
    // console.log(matchStage);return;

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

    console.log('matching ----------------------------------', matchStage)

    const priceBooks = await dealerPriceService.getAllDealerPriceBooksByFilter(matchStage, projection, limit, page);
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
      result: priceBooks,
      matchStage
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};


function uniqByKeepLast(data, key) {

  return [

    ...new Map(

      data.map(x => [key(x), x])

    ).values()

  ]

}


exports.uploadPriceBook = async (req, res) => {
  try {
    // Check if a file is uploaded

    // console.log("filesPath=========",req.file);return;
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    if (!req.file) {
      res.send({
        code: constant.errorCode,
        message: "No file uploaded"
      })
      return;
    }
    let csvName = req.file.filename
    const csvWriter = createCsvWriter({
      path: './uploads/resultFile/' + csvName,
      header: [
        { id: 'priceBook', title: 'Price Book' },
        { id: 'status', title: 'Status' },
        { id: 'reason', title: 'Reason' },
        // Add more headers as needed
      ],
    });


    //check Dealer Exist
    let checkDealer = await dealerService.getSingleDealerById({ _id: req.body.dealerId }, { isDeleted: false })
    // Your array of objects


    if (checkDealer.length == 0) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Not found"
      })
      return;
    }
    // if (checkDealer[0].status == 'Pending') {
    //   res.send({
    //     code: constant.errorCode,
    //     message: "Dealer has not been approved yet!"
    //   })
    //   return;
    // }
    let priceBookName = [];
    let csvStatus = [];
    let newArray1;
    let allPriceBooks;
    let passedEnteries = []
    let upload
    const wb = XLSX.readFile(req.file.path);
    const sheets = wb.SheetNames;
    const ws = wb.Sheets[sheets[0]];
    const headers = [];
    for (let cell in ws) {
      // Check if the cell is in the first row and has a non-empty value
      if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
        headers.push(ws[cell].v);
      }
    }
    if (sheets.length > 0) {
      let original_csv_array = ['priceBook', 'retailPrice'];

      if (original_csv_array.length != headers.length) {
        res.send({
          code: constant.errorCode,
          message: 'The uploaded file coloumn is not match.Please check the uploaded file'
        });
        return;
      }

      let equality = Array.isArray(original_csv_array) &&
        Array.isArray(headers) &&
        original_csv_array.length === headers.length &&
        original_csv_array.every((val, index) => val === headers[index]);

      if (!equality) {
        res.send({
          code: constant.errorCode,
          message: 'Invalid uploaded file! '
        });
        return;
      }

      const data = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);

      //Get data from csv when priceBooks and retailPrice is not undefined

      let results = data
        .filter(obj => obj.priceBook !== undefined && obj.retailPrice !== undefined)
        .map(obj => ({
          priceBook: obj.priceBook,
          retailPrice: obj.retailPrice,
        }));

      let allResults = data
        .map(obj => ({
          priceBook: obj.priceBook,
          retailPrice: obj.retailPrice,
        }));

      // Get only unique data from csv
      let unique = uniqByKeepLast(results, it => it.priceBook)

      // Get only name from unique

      priceBookName = unique.map(obj => obj.priceBook);
      const priceBookName1 = results.map(name => new RegExp(`^${name.priceBook}$`, 'i'));
      //Get founded products
      const foundProducts = await priceBookService.findByName(priceBookName1);

      if (foundProducts.length > 0) {
        const count = await dealerPriceService.getDealerPriceCount();
        // Extract the names and ids of found products
        let foundProductData1 = foundProducts.map(product => {
          if (product.status) {
            return {
              priceBook: product._id,
              name: product.name,
              dealerId: req.body.dealerId,
              status: true,
              wholePrice: (Number(product.frontingFee) + Number(product.reserveFutureFee) + Number(product.reinsuranceFee) + Number(product.adminFee)).toFixed(2)
            }
          }
        });

        //Get inactive products

        const inactiveData = foundProducts.filter(inactive => inactive.status === false);

        const foundProductData = foundProductData1.filter(item1 => item1 !== undefined);


        if (inactiveData.length > 0) {
          inactiveData.map(inactive => {
            let csvData = {
              'priceBook': inactive.name,
              'status': 'Failed',
              'reason': 'The product is inactive',

            }
            csvStatus.push(csvData)
          })

        }
        const inactiveNames = inactiveData.map(inactive => inactive.name.toLowerCase());
        // Remove product from csv based on inactive name
        priceBookName = priceBookName.filter(name => !inactiveNames.includes(name.toLowerCase()));
        console.log("results=========================", allResults);
        const missingProductNames = allResults.filter(name => {
          const lowercaseName = name.priceBook != '' ? name.priceBook.toLowerCase() : name.priceBook;
          return !foundProductData.some(product => product.name.toLowerCase() === lowercaseName);
        });

        // console.log("missingProductNames=========================", missingProductNames); return
        if (missingProductNames.length > 0) {
          missingProductNames.map(product => {
            let csvData = {
              'priceBook': product,
              'status': 'Failed',
              'reason': 'The product is not exist in the catalog',

            }
            csvStatus.push(csvData)
          })
        }
        // Extract _id values from priceBookIds
        const allpriceBookIds = foundProductData.map(obj => new mongoose.Types.ObjectId(obj.priceBook));
        // Check for duplicates and return early if found
        if (allpriceBookIds.length > 0) {
          let query = {
            $and: [
              { 'priceBook': { $in: allpriceBookIds } },
              { 'dealerId': new mongoose.Types.ObjectId(req.body.dealerId) }
            ]
          }
          let existingData = await dealerPriceService.findByIds(query);
          if (existingData.length > 0) {
            allPriceBooks = existingData.map(obj => obj.priceBooks).flat();
            newArray1 = results
              .filter(obj => !allPriceBooks.some(existingObj => existingObj.name.toLowerCase().includes(obj.priceBook.toLowerCase())))
              .map(obj => ({
                priceBook: obj.priceBook,
                status: true,
                retailPrice: obj.retailPrice,
                dealerId: req.body.dealerId,
              }));
            // Merge brokerFee from newArray into foundProductData based on priceBook
            const mergedArray = foundProductData.map(foundProduct => {
              const matchingItem = newArray1.find(item => item.priceBook.toLowerCase() === foundProduct.name.toLowerCase());

              if (matchingItem != undefined) {
                let csvData = {
                  'priceBook': foundProduct.name,
                  'status': 'Passed',
                  'reason': 'Successfull Processed!',
                }
                csvStatus.push(csvData)
                passedEnteries.push(csvData)
                return {
                  ...foundProduct,
                  retailPrice: matchingItem.retailPrice,
                  brokerFee: ((matchingItem.retailPrice) - foundProduct.wholePrice).toFixed(2),
                  unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1,
                  wholesalePrice: foundProduct.wholePrice
                };
              }
            });
            const mergedArrayWithoutUndefined = mergedArray.filter(item => item !== undefined);
            existingData.forEach(product => {
              product.priceBooks.forEach(priceBook => {
                const matchedData = unique.filter(item => priceBook.name == item.priceBook);
                let newValue = {
                  $set: {
                    retailPrice: matchedData[0].retailPrice
                  }
                };
                let option = { new: true }
                let update = dealerPriceService.updateDealerPrice({ dealerId: req.body.dealerId, priceBook: priceBook._id, status: true }, newValue, option);
                let csvData = {
                  'priceBook': priceBook.name,
                  'status': 'Passed',
                  'reason': 'Successfull Processed!',
                }
                csvStatus.push(csvData)
                passedEnteries.push(csvData)
              });
            });

            upload = await dealerPriceService.uploadPriceBook(mergedArrayWithoutUndefined);
          }
          else {

            newArray1 = results
              .filter(obj => foundProductData.some(existingObj => existingObj.name.toLowerCase() == obj.priceBook.toLowerCase()))
              .map((obj, index) => {
                const matchingProduct = foundProductData.find(existingObj => existingObj.name.toLowerCase() == obj.priceBook.toLowerCase());
                if (matchingProduct) {
                  let csvData = {
                    'priceBook': obj.priceBook,
                    'status': 'Passed',
                    'reason': 'Successfull Processed!',
                  }
                  csvStatus.push(csvData)
                  passedEnteries.push(csvData)
                }
                const updatedCount = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + index + 1;
                //Print the value of updatedCount
                return {
                  priceBook: matchingProduct.priceBook,
                  status: true,
                  dealerId: req.body.dealerId,
                  unique_key: updatedCount,
                  retailPrice: obj.retailPrice,
                  brokerFee: (Number(obj.retailPrice) - Number(matchingProduct.wholePrice)).toFixed(2),
                  wholesalePrice: matchingProduct ? matchingProduct.wholePrice : null, // Use wholePrice from matching product or null if not found
                };
              });

            upload = await dealerPriceService.uploadPriceBook(newArray1);
          }
        }
      }
      else {
        if (results.length > 0) {
          results.map(product => {
            let csvData = {
              'priceBook': product.priceBook,
              'status': 'Failed',
              'reason': 'The product is not exist in the catalog',
            }
            csvStatus.push(csvData)
          })
        }
      }
      // Write the data to the CSV file
      const res12 = await csvWriter.writeRecords(csvStatus);


      // Construct the base URL link
      const base_url_link = 'http://15.207.221.207:3002/uploads/resultFile';

      // Get the CSV name from the csvWriter path
      const csvName1 = csvName;

      // Construct the complete URL
      const complete_url = `${base_url_link}/${csvName1}`;

      //console.log(csvStatus);return;

      let entriesData = {
        userName: checkDealer[0].name,
        totalEntries: Number(results.length),
        SuccessEntries: Number(passedEnteries.length),
        failedEntries: Number(results.length) - Number(passedEnteries.length),
        routeLink: complete_url
      }

      // Send email with the CSV file link
      const mailing = sgMail.send(emailConstant.sendCsvFile('yashasvi@codenomad.net', entriesData));
      if (mailing) {
        //  console.log('Email sent successfully');
        res.send({
          code: constant.successCode,
          data: upload
        });
      }

      res.send({
        code: constant.successCode,
        data: upload
      });


    }

  } catch (err) {
    // Handle errors and respond with an error message
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

exports.createDealerPriceBook = async (req, res) => {
  try {
    let data = req.body
    const count = await dealerPriceService.getDealerPriceCount();
    data.unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
    let checkDealer = await dealerService.getDealerById(data.dealerId)
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer"
      })
      return;
    }
    if (checkDealer.status == "Pending") {
      res.send({
        code: constant.errorCode,
        message: "Account not approved yet"
      })
      return;
    }
    let checkPriceBookMain = await priceBookService.getPriceBookById({ _id: data.priceBook }, {})
    if (!checkPriceBookMain) {
      res.send({
        code: constant.errorCode,
        message: "Invalid price book ID"
      })
      return;
    }
    let checkPriceBook = await dealerPriceService.getDealerPriceById({ priceBook: data.priceBook, dealerId: data.dealerId }, {})
    if (checkPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Dealer price book already created with this product name"
      })
      return;
    }
    let createDealerPrice = await dealerPriceService.createDealerPrice(data)
    if (!createDealerPrice) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the dealer price book"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Success",
        result: createDealerPrice
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.checkDealerPriceBook = async (req, res) => {
  try {
    let data = req.body
    let checkDealer = await dealerService.getDealerById(data.dealerId)
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer"
      })
      return;
    }
    let checkPriceBookMain = await priceBookService.getPriceBookById({ _id: data.priceBook }, {})
    if (!checkPriceBookMain) {
      res.send({
        code: constant.errorCode,
        message: "Invalid price book ID"
      })
      return;
    }
    let checkPriceBook = await dealerPriceService.getDealerPriceById({ priceBook: data.priceBook, dealerId: data.dealerId }, {})
    if (checkPriceBook) {
      res.send({
        code: constant.errorCode,
        message: "Dealer price book already created with this product name"
      })
      return;
    }

    res.send({
      code: constant.successCode,
      message: "Success!"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.rejectDealer = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    const singleDealer = await dealerService.getDealerById({ _id: req.params.dealerId });

    if (!singleDealer) {
      res.send({
        code: constant.errorCode,
        message: "Dealer not found"
      })
      return;
    }

    //if status is rejected
    if (req.body.status == 'Rejected') {
      //Delete the user
      const deleteUser = await userService.deleteUser({ accountId: req.params.dealerId })
      if (!deleteUser) {
        res.send({
          code: constant.errorCode,
          message: "Unable to delete the user"
        })
        return;
      }

      //Delete the dealer
      const deleteDealer = await dealerService.deleteDealer({ _id: req.params.dealerId })
      if (!deleteDealer) {
        res.send({
          code: constant.errorCode,
          message: "Unable to delete the dealer"
        })
        return;
      }
      res.send({
        code: constant.successCode,
        data: "Rejected Successful"
      })
      return;
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.updateDealerMeta = async (req, res) => {
  try {
    let data = req.body
    let checkDealer = await dealerService.getDealerById(data.dealerId, {})
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer ID"
      })
      return;
    }
    if (data.oldName != data.accountName) {
      let checkAccountName = await dealerService.getDealerByName({ name: data.accountName }, {})
      if (checkAccountName) {
        res.send({
          code: constant.errorCode,
          message: "Account name is not available"
        })
        return;
      };
    };
    let criteria1 = { _id: checkDealer._id }
    let option = { new: true }
    data.name = data.accountName
    data.accountStatus = true
    let updatedData = await dealerService.updateDealer(criteria1, data, option)
    if (!data.isAccountCreate) {
      await userService.updateUser({ metaId: checkDealer._id }, { status: false }, { new: true })
    }
    if (!updatedData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the data"
      })
    } else {
      let criteria = { dealerId: checkDealer._id }
      let option = { new: true }
      let updatedCustomer = await customerService.updateDealerName(criteria, { dealerName: data.accountName }, option)
      //Update dealer name in reseller
      let updateResellerDealer = await resellerService.updateMeta(criteria, { dealerName: data.accountName }, option)
      //Update Meta in servicer also 
      if (checkDealer.isServicer) {
        const updateServicerMeta = await servicerService.updateServiceProvider(criteria, data)
      }
      //update primary user to true
      await userService.updateUser({ metaId: checkDealer._id }, { status: true }, { new: true })
      res.send({
        code: constant.successCode,
        message: "Success",
        result: updatedData
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.addDealerUser = async (req, res) => {
  try {
    let data = req.body
    let checkDealer = await dealerService.getDealerByName({ _id: data.dealerId }, {})
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer ID"
      })
      return;
    };
    let checkEmail = await userService.findOneUser({ email: data.email }, {})
    if (checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User already exist with this email"
      })
      return;
    }
    data.accountId = checkDealer._id
    data.metaId = checkDealer._id
    data.roleId = '656f08041eb1acda244af8c6'
    let statusCheck;
    if (!checkDealer.accountStatus) {
      statusCheck = false
    } else {
      statusCheck = data.status
    }
    data.status = statusCheck
    let saveData = await userService.createUser(data)
    if (!saveData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to add the data"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Added successfully",
        result: saveData
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.uploadDealerPriceBook = async (req, res) => {
  try {
    uploadP(req, res, async (err) => {
      let file = req.file
      let data = req.body

      let checkDealer = await dealerService.getSingleDealerById({ _id: new mongoose.Types.ObjectId(req.body.dealerId) }, { isDeleted: false })

      // Your array of objects
      if (checkDealer.length == 0) {
        res.send({
          code: constant.errorCode,
          message: "Dealer Not found"
        })
        return;
      }

      if (!req.file) {
        res.send({
          code: constant.errorCode,
          message: "No file uploaded"
        })
        return;
      }

      let csvName = req.file.filename

      // from here copy
      const csvWriter = createCsvWriter({
        path: './uploads/resultFile/' + csvName,
        header: [
          { id: 'priceBook', title: 'Price Book' },
          { id: 'status', title: 'Status' },
          { id: 'reason', title: 'Reason' },
          // Add more headers as needed
        ],
      });
      const wb = XLSX.readFile(req.file.path);
      const sheets = wb.SheetNames;
      const ws = wb.Sheets[sheets[0]];
      let totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);

      totalDataComing1 = totalDataComing1.map(item => {
        if (!item.priceBook) {
          return { priceBook: '', 'RetailP rice': item['RetailP rice'] };
        }
        return item;
      });

      const headers = [];
      for (let cell in ws) {
        // Check if the cell is in the first row and has a non-empty value
        if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
          headers.push(ws[cell].v);
        }
      }

      if (headers.length !== 2) {
        res.send({
          code: constant.errorCode,
          message: "Invalid file format detected. The sheet should contain exactly two columns."
        })
        return
      }
      const totalDataComing = totalDataComing1.map(item => {
        const keys = Object.keys(item);
        return {
          priceBook: item[keys[0]],
          retailPrice: item[keys[1]],
          duplicates: [],
          exit: false
        };
      });
      //  return;
      // copy to here
      totalDataComing.forEach(data => {
        if (!data.retailPrice || typeof (data.retailPrice) != 'number' || data.retailPrice <= 0) {
          data.status = "Dealer catalog retail price is not valid";
          data.exit = true;
        }
        // else if(isNaN(parseFloat(data.retailPrice))){
        //   data.status = "Dealer catalog retail price is not valid";
        //   data.exit = true;
        // }
        // else if(parseFloat(data.retailPrice) <= 0){
        //   data.status = "Dealer catalog retail price should be greater than 0";
        //   data.exit = true;
        // }
        else {
          data.status = null
        }
      })

      //  console.log("check empty value", totalDataComing)
      if (totalDataComing.length > 0) {
        const repeatedMap = {};

        for (let i = totalDataComing.length - 1; i >= 0; i--) {
          //console.log("uniquw", i, totalDataComing[i]);
          if (totalDataComing[i].exit) {
            continue;
          }
          if (repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()] >= 0) {
            totalDataComing[i].status = "not unique";
            totalDataComing[i].exit = true;
            const index = repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()];
            totalDataComing[index].duplicates.push(i);
          } else {
            repeatedMap[totalDataComing[i].priceBook.toString().toUpperCase().replace(/\s+/g, ' ').trim()] = i;
            totalDataComing[i].status = null;
          }
        }

        const pricebookArrayPromise = totalDataComing.map(item => {
          if (!item.status) return priceBookService.findByName1({ name: item.priceBook ? new RegExp(`^${item.priceBook.replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true });
          return null;
        })

        const pricebooksArray = await Promise.all(pricebookArrayPromise);

        for (let i = 0; i < totalDataComing.length; i++) {
          if (!pricebooksArray[i]) {
            if (!totalDataComing[i].exit) {
              totalDataComing[i].status = "price catalog does not exist";
              totalDataComing[i].duplicates.forEach((index) => {
                totalDataComing[index].status = "price catalog does not exist";
              })
            }
            totalDataComing[i].priceBookDetail = null
          } else {
            totalDataComing[i].priceBookDetail = pricebooksArray[i];
          }
        }
        const dealerArrayPromise = totalDataComing.map(item => {

          if (item.priceBookDetail) return dealerPriceService.getDealerPriceById({ dealerId: new mongoose.Types.ObjectId(data.dealerId), priceBook: item.priceBookDetail._id }, {});
          return false;
        })
        const dealerArray = await Promise.all(dealerArrayPromise);

        for (let i = 0; i < totalDataComing.length; i++) {
          if (totalDataComing[i].priceBookDetail) {
            if (dealerArray[i]) {
              dealerArray[i].retailPrice = totalDataComing[i].retailPrice != undefined ? totalDataComing[i].retailPrice : dealerArray[i].retailPrice;
              dealerArray[i].brokerFee = dealerArray[i].retailPrice - dealerArray[i].wholesalePrice
              await dealerArray[i].save();

              totalDataComing[i].status = "Dealer catalog updated successully";
              totalDataComing[i].duplicates.forEach((index) => {
                totalDataComing[index].status = "Dealer catalog updated successully";
              })

            } else {
              const count = await dealerPriceService.getDealerPriceCount();
              let unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
              let wholesalePrice = totalDataComing[i].priceBookDetail.reserveFutureFee + totalDataComing[i].priceBookDetail.reinsuranceFee + totalDataComing[i].priceBookDetail.adminFee + totalDataComing[i].priceBookDetail.frontingFee;

              console.log('checks for unique key-------------------------------',
                {
                  dealerId: data.dealerId,
                  priceBook: totalDataComing[i].priceBookDetail._id,
                  unique_key: unique_key,
                  status: true,
                  retailPrice: totalDataComing[i].retailPrice != "" ? totalDataComing[i].retailPrice : 0,
                  brokerFee: totalDataComing[i].retailPrice - wholesalePrice,
                  wholesalePrice
                }
              )


              await dealerPriceService.createDealerPrice({
                dealerId: data.dealerId,
                priceBook: totalDataComing[i].priceBookDetail._id,
                unique_key: unique_key,
                status: true,
                retailPrice: totalDataComing[i].retailPrice != "" ? totalDataComing[i].retailPrice : 0,
                brokerFee: totalDataComing[i].retailPrice - wholesalePrice,
                wholesalePrice
              })
              totalDataComing[i].status = "Dealer catalog created successully"
              totalDataComing[i].duplicates.forEach((index, i) => {
                totalDataComing[index].status = i == 0 ? "Dealer catalog created successully" : "Dealer catalog updated successully";
              })
            }
          }
        }

        console.log("totalDataComing3", totalDataComing);
        const csvArray = totalDataComing.map((item) => {
          return {
            priceBook: item.priceBook ? item.priceBook : "",
            retailPrice: item.retailPrice ? item.retailPrice : "",
            status: item.status
          }
        })
        console.log('csv array-----------------------------', csvArray)
        function countStatus(array, status) {
          return array.filter(item => item.status === status).length;
        }

        const countNotExist = countStatus(csvArray, "price catalog does not exist");
        const countNotUnique = countStatus(csvArray, "not unique");
        const totalCount = csvArray.length

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

        const htmlTableString = convertArrayToHTMLTable(csvArray);
        const mailing = sgMail.send(emailConstant.sendCsvFile('yashasvi@codenomad.net', htmlTableString));
      }
      res.send({
        code: constant.successCode,
        message: "Added successfully"
      })

    })
  } catch (err) {
    console.log(err)
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.createDeleteRelation = async (req, res) => {
  try {
    let data = req.body
    let checkDealer = await dealerService.getDealerByName({ _id: req.params.dealerId })
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer ID"
      })
      return;
    }

    const trueArray = [];
    const falseArray = [];

    data.servicers.forEach(item => {
      if (item.status || item.status == "true") {
        trueArray.push(item);
      } else {
        falseArray.push(item);
      }
    });



    let uncheckId = falseArray.map(record => new mongoose.Types.ObjectId(record._id))
    let checkId = trueArray.map(record => record._id)
    const existingRecords = await dealerRelationService.getDealerRelations({
      dealerId: new mongoose.Types.ObjectId(req.params.dealerId),
      servicerId: { $in: checkId }
    });

    // Step 2: Separate existing and non-existing servicer IDs
    const existingServicerIds = existingRecords.map(record => record.servicerId.toString());

    const newServicerIds = checkId.filter(id => !existingServicerIds.includes(id));

    console.log(existingRecords, existingServicerIds, checkId, newServicerIds)
    // Step 3: Delete existing records
    let deleteData = await dealerRelationService.deleteRelations({
      dealerId: new mongoose.Types.ObjectId(req.params.dealerId),
      servicerId: { $in: uncheckId }
    });
    // return res.json(deleteData)
    // Step 4: Insert new records
    const newRecords = newServicerIds.map(servicerId => ({
      dealerId: req.params.dealerId,
      servicerId: servicerId
    }));
    if (newRecords.length > 0) {
      let saveData = await dealerRelationService.createRelationsWithServicer(newRecords);
      res.send({
        code: constant.successCode,
        message: "success"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "success"
      })
    }






    // for (let i = 0; i < data.servicers.length; i++) {
    //   let servicer = data.servicers[i]
    //   let checkRelation = await dealerRelationService.getDealerRelation({ servicerId: servicer[i], dealerId: req.params.dealerId })
    //   if (!checkRelation) {
    //     console.log('new------------')

    //   } else {
    //     console.log('delete------------')

    //   }
    // }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getDealerServicers = async (req, res) => {
  try {
    let data = req.body

    let checkDealer = await dealerService.getDealerByName({ _id: req.params.dealerId })
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer ID"
      })
      return;
    }
    let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: req.params.dealerId })
    if (!getServicersIds) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the servicer"
      })
      return;
    }
    let ids = getServicersIds.map((item) => item.servicerId)
    let servicer = await providerService.getAllServiceProvider({ _id: { $in: ids }, status: true }, {})
    if (!servicer) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the servicers"
      })
      return;
    }
    if (checkDealer.isServicer) {
      servicer.unshift(checkDealer);
    };

    const servicerIds = servicer.map(obj => obj._id);
    const query1 = { accountId: { $in: servicerIds }, isPrimary: true };

    let servicerUser = await userService.getMembers(query1, {});
    if (!servicerUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      });
      return;
    };

    const result_Array = servicer.map(item1 => {
      const matchingItem = servicerUser.find(item2 => item2.accountId.toString() === item1._id.toString());

      if (matchingItem) {
        return {
          ...matchingItem.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          servicerData: item1.toObject()
        };
      } else {
        return servicerUser.toObject();
      }
    });
    console.log("claim check+++++++4444444444444++++++++++++++", result_Array)

    for (let i = 0; i < result_Array.length; i++) {
      const servicerId = result_Array[i].servicerData._id;
      let getServicerFromDealer = await servicerService.getAllServiceProvider({ dealerId: { $in: servicerId } })
      console.log("claim check+++++++4444444444444++++++++++++++", getServicerFromDealer[0]._id)

      // Aggregate pipeline to join orders, contracts, and claims
      var aggregateResult = await orderService.getAllOrders1([
        {
          $match: {
            $and: [
              {
                $or: [
                  { servicerId: new mongoose.Types.ObjectId(servicerId) },
                  { servicerId: new mongoose.Types.ObjectId(getServicerFromDealer[0]._id) },
                ]
              },
              { dealerId: new mongoose.Types.ObjectId(req.params.dealerId) },
            ]
          }
        },
        {
          $lookup: {
            from: "contracts",
            localField: "_id",
            foreignField: "orderId",
            as: "contracts"
          }
        },
        { $unwind: "$contracts" },
        {
          $lookup: {
            from: "claims",
            localField: "contracts._id",
            foreignField: "contractId",
            as: "claims",
            // pipeline: [
            //   {
            //     $match: { claimFile: { $in: ["Open", "Completed"] } }
            //   }
            // ]
          }
        },
        {
          $project: {
            'claims': { $arrayElemAt: ["$claims", 0] },
            _id: 0,
            servicerId: 1
          }
        }
      ]);
      console.log("claim check+++++++++++++++++++++", aggregateResult)

      // If there are results for the current servicerId, update the result array
      aggregateResult = aggregateResult.filter(obj => Object.keys(obj).length !== 1);
      console.log("claim check+++++++++++++++++++++", aggregateResult)
      let totalClaimAmount = 0

      function calculateTotalAmountAndCount(arr) {
        let total = 0;
        let count = aggregateResult.length;
        for (let obj of arr) {
          total += obj.claims.totalAmount;
        }
        return { totalAmount: total, totalCount: count };
      }
      const { totalAmount, totalCount } = calculateTotalAmountAndCount(aggregateResult);
      console.log("Total amount:", totalAmount);
      console.log("Total count:", totalCount);

      result_Array[i].claimCount = totalCount;
      result_Array[i].totalClaimAmount = totalAmount;

    }

    const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.servicerData.name) &&
        emailRegex.test(entry.email) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });

    res.send({
      code: constant.successCode,
      message: "Success",
      data: filteredData
    });

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.unAssignServicer = async (req, res) => {
  try {
    let data = req.body
    let deleteRelation = await dealerRelation.findOneAndDelete({ servicerId: data.servicerId, dealerId: data.dealerId })
    if (!deleteRelation) {
      res.send({
        code: constant.errorCode,
        message: "Unable to unassign"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Unassigned successfully", deleteRelation
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getServicersList = async (req, res) => {
  try {
    let data = req.body
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let query = { isDeleted: false, accountStatus: "Approved", status: true, dealerId: null, resellerId: null }
    let projection = { __v: 0, isDeleted: 0 }
    let servicer = await providerService.getAllServiceProvider(query, projection);


    let getRelations = await dealerRelationService.getDealerRelations({ dealerId: req.params.dealerId })


    const resultArray = servicer.map(item => {
      const matchingServicer = getRelations.find(servicer => servicer.servicerId.toString() == item._id.toString());
      const documentData = item._doc;
      return { ...documentData, check: !!matchingServicer };
    });

    res.send({
      code: constant.successCode,
      message: "Success",
      result: resultArray
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.filterDealer = async (req, res) => {
  try {
    let data = req.body

    console.log(data)

    let response = await dealerService.getAllDealers1(data)

    res.send({
      code: constant.successCode,
      message: "Success",
      result: response
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getDealerResellers = async (req, res) => {
  try {
    let data = req.body
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    }
    let checkDealer = await dealerService.getDealerById(req.params.dealerId, {})
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: "Invalid dealer ID"
      })
      return;
    };

    let query = { isDeleted: false, dealerId: req.params.dealerId }
    let projection = { __v: 0 }
    const resellers = await resellerService.getResellers(query, projection);
    if (!resellers) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the resellers"
      });
      return;
    };


    const resellerId = resellers.map(obj => obj._id.toString());

    const orderResellerId = resellers.map(obj => obj._id);
    const queryUser = { accountId: { $in: resellerId }, isPrimary: true };

    let getPrimaryUser = await userService.findUserforCustomer(queryUser)

    //Get Dealer Customer Orders

    let project = {
      productsArray: 1,
      dealerId: 1,
      unique_key: 1,
      servicerId: 1,
      customerId: 1,
      resellerId: 1,
      paymentStatus: 1,
      status: 1,
      venderOrder: 1,
      orderAmount: 1,
    }

    let orderQuery = {
      $and: [
        { resellerId: { $in: orderResellerId }, status: "Active" },
      ]
    }
    let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, '$resellerId');

    const result_Array = getPrimaryUser.map(item1 => {
      const matchingItem = resellers.find(item2 => item2._id.toString() === item1.accountId.toString());
      const order = ordersResult.find(order => order._id.toString() === item1.accountId)

      if (matchingItem || order) {
        return {
          ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
          resellerData: matchingItem.toObject(),
          orderData: order ? order : {}
        };
      } else {
        return dealerData.toObject();
      }
    });

    const emailRegex = new RegExp(data.email ? data.email.replace(/\s+/g, ' ').trim() : '', 'i')
    const nameRegex = new RegExp(data.name ? data.name.replace(/\s+/g, ' ').trim() : '', 'i')
    const phoneRegex = new RegExp(data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', 'i')
    const dealerRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')

    const filteredData = result_Array.filter(entry => {
      return (
        nameRegex.test(entry.resellerData.name) &&
        emailRegex.test(entry.email) &&
        dealerRegex.test(entry.resellerData.dealerId) &&
        phoneRegex.test(entry.phoneNumber)
      );
    });
    res.send({
      code: constant.successCode,
      message: "Success",
      result: filteredData
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getDealerOrders = async (req, res) => {
  try {
    {
      let data = req.body;
      if (req.role != "Super Admin") {
        res.send({
          code: constant.errorCode,
          message: "Only super admin allow to do this action",
        });
        return;
      }

      let project = {
        productsArray: 1,
        dealerId: 1,
        unique_key: 1,
        unique_key_number: 1,
        unique_key_search: 1,
        servicerId: 1,
        customerId: 1,
        serviceCoverageType: 1,
        coverageType: 1,
        resellerId: 1,
        paymentStatus: 1,
        status: 1,
        createdAt: 1,
        venderOrder: 1,
        orderAmount: 1,
        contract: "$contract"
      };

      let query = { status: { $ne: "Archieved" }, dealerId: new mongoose.Types.ObjectId(req.params.dealerId) };

      let lookupQuery = [
        {
          $match: query
        },
        {
          $project: project,
        },
        {
          "$addFields": {
            "noOfProducts": {
              "$sum": "$productsArray.checkNumberProducts"
            },
            totalOrderAmount: { $sum: "$orderAmount" },
            flag: {
              $cond: {
                if: {
                  $and: [
                    // { $eq: ["$payment.status", "paid"] },
                    { $ne: ["$productsArray.orderFile.fileName", ''] },
                    { $ne: ["$customerId", null] },
                    { $ne: ["$paymentStatus", 'Paid'] },
                    { $ne: ["$productsArray.coverageStartDate", null] },
                  ]
                },
                then: true,
                else: false
              }
            }
          }
        },
        { $sort: { unique_key: -1 } }
      ]

      let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
      let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
      let limitData = Number(pageLimit)


      let ordersResult = await orderService.getOrderWithContract(lookupQuery, skipLimit, limitData);
      let dealerIdsArray = ordersResult.map((result) => result.dealerId);
      let userDealerIds = ordersResult.map((result) => result.dealerId.toString());
      let userResellerIds = ordersResult
        .filter(result => result.resellerId !== null)
        .map(result => result.resellerId.toString());

      let mergedArray = userDealerIds.concat(userResellerIds);

      const dealerCreateria = { _id: { $in: dealerIdsArray } };
      //Get Respective Dealers
      let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, {
        name: 1,
        isServicer: 1,
        city: 1,
        state: 1,
        country: 1,
        zip: 1,
        street: 1

      });
      let servicerIdArray = ordersResult.map((result) => result.servicerId);
      const servicerCreteria = {
        $or: [
          { _id: { $in: servicerIdArray } },
          { resellerId: { $in: servicerIdArray } },
          { dealerId: { $in: servicerIdArray } },
        ],
      };
      //Get Respective Servicer
      let respectiveServicer = await servicerService.getAllServiceProvider(
        servicerCreteria,
        {
          name: 1,
          city: 1,
          state: 1,
          country: 1,
          zip: 1,
          street: 1
        }
      );
      let customerIdsArray = ordersResult.map((result) => result.customerId);
      const customerCreteria = { _id: { $in: customerIdsArray } };

      let userCustomerIds = ordersResult
        .filter(result => result.customerId !== null)
        .map(result => result.customerId.toString());

      const allUserIds = mergedArray.concat(userCustomerIds);


      const queryUser = { accountId: { $in: allUserIds }, isPrimary: true };

      let getPrimaryUser = await userService.findUserforCustomer(queryUser)
      //Get Respective Customer
      let respectiveCustomer = await customerService.getAllCustomers(
        customerCreteria,
        {
          username: 1,
          city: 1,
          state: 1,
          country: 1,
          zip: 1,
          street: 1
        }
      );
      //Get all Reseller
      let resellerIdsArray = ordersResult.map((result) => result.resellerId);
      const resellerCreteria = { _id: { $in: resellerIdsArray } };
      let respectiveReseller = await resellerService.getResellers(
        resellerCreteria,
        {
          name: 1,
          isServicer: 1,
          city: 1,
          state: 1,
          country: 1,
          zip: 1,
          street: 1
        }
      );
      const result_Array = ordersResult.map((item1) => {
        const dealerName =
          item1.dealerId != ""
            ? respectiveDealers.find(
              (item2) => item2._id.toString() === item1.dealerId.toString()
            )
            : null;
        const servicerName =
          item1.servicerId != null
            ? respectiveServicer.find(
              (item2) =>
                item2._id.toString() === item1.servicerId.toString() ||
                item2.resellerId === item1.servicerId
            )
            : null;
        const customerName =
          item1.customerId != null
            ? respectiveCustomer.find(
              (item2) => item2._id.toString() === item1.customerId.toString()
            )
            : null;
        const resellerName =
          item1.resellerId != null
            ? respectiveReseller.find(
              (item2) => item2._id.toString() === item1.resellerId.toString()
            )
            : null;

        if (dealerName || customerName || servicerName || resellerName) {
          return {
            ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
            dealerName: dealerName ? dealerName.toObject() : dealerName,
            servicerName: servicerName ? servicerName.toObject() : {},
            customerName: customerName ? customerName.toObject() : {},
            resellerName: resellerName ? resellerName.toObject() : {},
          };
        } else {
          return {
            dealerName: dealerName.toObject(),
            servicerName: servicerName.toObject(),
            customerName: customerName.toObject(),
            resellerName: resellerName.toObject(),
          };
        }
      });

      const unique_keyRegex = new RegExp(
        data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : "",
        "i"
      );
      const venderOrderRegex = new RegExp(
        data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : "",
        "i"
      );
      const status = new RegExp(data.status ? data.status.replace(/\s+/g, ' ').trim() : "", "i");
      let filteredData = result_Array.filter((entry) => {
        return (
          unique_keyRegex.test(entry.unique_key) &&
          venderOrderRegex.test(entry.venderOrder) &&
          status.test(entry.status)
        );
      });

      // console.log(filteredData);

      // return;


      // const updatedArray = filteredData.map((item) => ({
      //     ...item,
      //     servicerName: item.dealerName.isServicer 
      //         ? item.dealerName
      //         : item.resellerName.isServicer
      //             ? item.resellerName
      //             : item.servicerName
      //         username:getPrimaryUser.find(user=>user.accountId.toString()===item.dealerName._id.toString())
      // }));

      const updatedArray = filteredData.map(item => {
        let username = null; // Initialize username as null
        let resellerUsername = null
        let customerUserData = null
        let isEmptyStartDate = item.productsArray.map(
          (item1) => item1.coverageStartDate === null
        );
        let isEmptyOrderFile = item.productsArray
          .map(
            (item1) =>
              item1.orderFile.fileName === ""
          )
        item.flag = false
        const coverageStartDate = isEmptyStartDate.includes(true) ? false : true
        const fileName = isEmptyOrderFile.includes(true) ? false : true
        // console.log("isEmptyStartDate===================",isEmptyStartDate)
        // console.log("isEmptyOrderFile=====================",isEmptyOrderFile)
        //console.log(hasNullCoverageStartDate)
        if (item.customerId != null && coverageStartDate && fileName && item.paymentStatus != 'Paid') {
          item.flag = true
        }
        if (item.dealerName) {
          username = getPrimaryUser.find(user => user.accountId.toString() === item.dealerName._id.toString());
        }
        if (item.resellerName) {
          resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.accountId.toString() === item.resellerName._id.toString()) : {};
        }
        if (item.customerName) {
          customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.accountId.toString() === item.customerName._id.toString()) : {};
        }
        return {
          ...item,
          servicerName: item.dealerName.isServicer && item.servicerId != null ? item.dealerName : item.resellerName.isServicer && item.servicerId != null ? item.resellerName : item.servicerName,
          username: username, // Set username based on the conditional checks
          resellerUsername: resellerUsername ? resellerUsername : {},
          customerUserData: customerUserData ? customerUserData : {}
        };
      });
      let orderIdSearch = data.orderId ? data.orderId : ''
      const stringWithoutHyphen = orderIdSearch.replace(/-/g, "")
      const orderIdRegex = new RegExp(stringWithoutHyphen ? stringWithoutHyphen.replace(/\s+/g, ' ').trim() : '', 'i')
      const venderRegex = new RegExp(data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', 'i')
      const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
      const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', 'i')
      const customerNameRegex = new RegExp(data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', 'i')
      const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')
      const statusRegex = new RegExp(data.status ? data.status : '', 'i')


      const filteredData1 = updatedArray.filter(entry => {
        return (
          venderRegex.test(entry.venderOrder) &&
          orderIdRegex.test(entry.unique_key_search) &&
          dealerNameRegex.test(entry.dealerName.name) &&
          servicerNameRegex.test(entry.servicerName.name) &&
          customerNameRegex.test(entry.customerName.name) &&
          resellerNameRegex.test(entry.resellerName.name) &&
          statusRegex.test(entry.status)
        );
      });
      res.send({
        code: constant.successCode,
        message: "Success",
        result: filteredData1,
      });
    };
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getDealerRequest = async (req, res) => {
  try {
    let data = req.body
    Promise.all([client1.connect(), client2.connect()])
      .then(async () => {
        console.log('Connected to both databases');

        // Specify the databases
        const db1 = client1.db();
        const db2 = client2.db();

        // Specify the collections
        const collection1 = db1.collection('dealers');
        const collection2 = db2.collection('users');
        console.log(collection2)

        // Perform a $lookup aggregation across databases
        console.log('Perform a $lookup aggregation across databases')
        let data1 = await dealer.aggregate([
          {
            $match: { _id: new mongoose.Types.ObjectId("6579815d97bf5c1bb11be1d9") } // Match documents with the common ID
          },
          {
            $lookup: {
              from: collection2.namespace,
              localField: '_id',
              foreignField: 'accountId', // Replace with the actual common field in collection2
              as: 'result'
            }
          }
        ])

        console.log('Result:__________-------------------------------------', data1);
        res.send({
          code: constant.errorCode,
          message: data1
        })
        // Close the connections
        client1.close();
        client2.close();
        // });
      })
      .catch(err => {
        console.error('Error connecting to databases:', err);
      });


  } catch (err) {
    console.log("Err in getDealerRequest : ", err);
  }
}

exports.getDealerContract = async (req, res) => {
  try {
    let data = req.body
    let getDealerOrder = await orderService.getOrders({ dealerId: req.params.dealerId, status: { $in: ["Active", "Pending"] } }, { _id: 1 })
    if (!getDealerOrder) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      })
      return
    }
    let orderIDs = getDealerOrder.map((ID) => ID._id)
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let newQuery = [];
    data.servicerName = data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : ''
    if (data.servicerName) {
      data.servicerName = data.servicerName.toString().replace(/\s+/g, ' ').trim()
      console.log("Servicer name----------------", data.servicerName);
      newQuery.push(
        {
          $lookup: {
            from: "serviceproviders",
            localField: "order.servicerId",
            foreignField: "_id",
            as: "order.servicer"
          }
        },
        {
          $match: {
            $and: [
              { "order.servicer.name": { '$regex': data.servicerName ? data.servicerName.toString().replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            ]
          },
        }
      );
    }
    data.resellerName = data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : ''
    // data.resellerName = data.resellerName.replace(/\s+/g, ' ').trim()
    if (data.resellerName) {
      newQuery.push(
        {
          $lookup: {
            from: "resellers",
            localField: "order.resellerId",
            foreignField: "_id",
            as: "order.reseller"
          }
        },
        {
          $match: {
            $and: [
              { "order.reseller.name": { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            ]
          },
        }
      );
    }
    newQuery.push(
      {
        $facet: {
          totalRecords: [
            {
              $count: "total"
            }
          ],
          data: [
            {
              $skip: skipLimit
            },
            {
              $limit: pageLimit
            },
            {
              $project: {
                productName: 1,
                model: 1,
                serial: 1,
                unique_key: 1,
                status: 1,
                manufacture: 1,
                eligibilty: 1,
                "order.unique_key": 1,
                "order.venderOrder": 1,
                "order.dealerId": 1,
              }
            }
          ],
        },

      })
    let query = [
      {
        $match:
        {
          $and: [
            // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          ]
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        }
      },
      {
        $unwind: {
          path: "$order",
          preserveNullAndEmptyArrays: true,
        }
      },
      {
        $match:
        {
          $and: [
            { "order.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { "order.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
            { "order.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "order.dealerId": new mongoose.Types.ObjectId(req.params.dealerId) },
          ]
        },

      },
      // {
      //   $lookup: {
      //     from: "dealers",
      //     localField: "order.dealerId",
      //     foreignField: "_id",
      //     as: "order.dealer"
      //   }
      // },
    ]
    if (newQuery.length > 0) {
      query = query.concat(newQuery);
    }

    let getContracts = await contractService.getAllContracts2(query)
    let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0].totalRecords[0].total : 0
    res.send({
      code: constant.successCode,
      message: "Success",
      result: getContracts[0]?.data ? getContracts[0]?.data : [],
      totalCount
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.getDealerClaims = async (req, res) => {
  try {
    if (req.role != 'Super Admin') {
      res.send({
        code: constant.errorCode,
        message: 'Only super admin allow to do this action'
      });
      return;
    }
    let data = req.body
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    const checkDealer = await dealerService.getDealerById(req.params.dealerId);
    if (!checkDealer) {
      res.send({
        code: constant.errorCode,
        message: 'Dealer not found!'
      });
      return
    }

    let newQuery = [];
    newQuery.push({
      $facet: {
        totalRecords: [
          {
            $count: "total"
          }
        ],
        data: [
          {
            $skip: skipLimit
          },
          {
            $limit: pageLimit
          },
          {
            $lookup: {
              from: "servicer_dealer_relations",
              localField: "contracts.orders.dealers._id",
              foreignField: "dealerId",
              as: "contracts.orders.dealers.dealerServicer",
            }
          },
          {
            $lookup: {
              from: "resellers",
              localField: "contracts.orders.resellerId",
              foreignField: "_id",
              as: "contracts.orders.resellers",
            }
          },
          {
            $lookup: {
              from: "serviceproviders",
              localField: "contracts.orders.servicerId",
              foreignField: "_id",
              as: "contracts.orders.servicers",
            }
          },
          {
            $project: {
              "contractId": 1,
              "claimFile": 1,
              "lossDate": 1,
              "receiptImage": 1,
              reason: 1,
              "unique_key": 1,
              totalAmount: 1,
              servicerId: 1,
              customerStatus: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              repairStatus: 1,
              // repairStatus: { $arrayElemAt: ['$repairStatus', -1] },
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.model": 1,
              "contracts.manufacture": 1,
              "contracts.serial": 1,
              "contracts.orders.dealerId": 1,
              "contracts.orders._id": 1,
              "contracts.orders.servicerId": 1,
              "contracts.orders.serviceCoverageType": 1,
              "contracts.orders.coverageType": 1,
              "contracts.orders.customerId": 1,
              "contracts.orders.dealers.isShippingAllowed": 1,
              "contracts.orders.resellerId": 1,
              "contracts.orders.dealers.name": 1,
              "contracts.orders.dealers.isServicer": 1,
              "contracts.orders.dealers._id": 1,
              "contracts.orders.customer.username": 1,
              // "contracts.orders.dealers.dealerServicer": 1,
              "contracts.orders.dealers.dealerServicer": {
                $map: {
                  input: "$contracts.orders.dealers.dealerServicer",
                  as: "dealerServicer",
                  in: {
                    "_id": "$$dealerServicer._id",
                    "servicerId": "$$dealerServicer.servicerId",
                  }
                }
              },
              "contracts.orders.servicers": {
                $map: {
                  input: "$contracts.orders.servicers",
                  as: "servicer",
                  in: {
                    "_id": "$$servicer._id",
                    "name": "$$servicer.name",
                  }
                }
              },
              "contracts.orders.resellers": {
                $map: {
                  input: "$contracts.orders.resellers",
                  as: "reseller",
                  in: {
                    "_id": "$$reseller._id",
                    "name": "$$reseller.name",
                    "isServicer": "$$reseller.isServicer"
                  }
                }
              }
            }
          },

        ]
      }
    })
    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            // { unique_key: { $regex: `^${data.claimId ? data.claimId : ''}` } },
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { isDeleted: false },
            { 'customerStatus.status': { '$regex': data.customerStatuValue ? data.customerStatuValue.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          ]
        },
      },
      {
        $lookup: {
          from: "contracts",
          localField: "contractId",
          foreignField: "_id",
          as: "contracts",
        }
      },
      {
        $unwind: "$contracts"
      },
      {
        $match:
        {
          $and: [
            // { "contracts.unique_key": { $regex: `^${data.contractId ? data.contractId : ''}` } },
            { 'contracts.unique_key': { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.serial": { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.productName": { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
          ]
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "contracts.orderId",
          foreignField: "_id",
          as: "contracts.orders",
        },
      },
      {
        $unwind: "$contracts.orders"
      },
      {
        $match:
        {
          $and: [
            // { "contracts.orders.unique_key": { $regex: `^${data.orderId ? data.orderId : ''}` } },
            { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { "contracts.orders.isDeleted": false },
            { "contracts.orders.dealerId": new mongoose.Types.ObjectId(req.params.dealerId) },
          ]
        },
      },
      {
        $lookup: {
          from: "dealers",
          localField: "contracts.orders.dealerId",
          foreignField: "_id",
          as: "contracts.orders.dealers",
          pipeline: [
            // {
            //   $match:
            //   {
            //     $and: [
            //       { name: { '$regex': data.dealerName ? data.dealerName : '', '$options': 'i' } },
            //       { isDeleted: false },
            //     ]
            //   },
            // },
            // {
            //   $lookup: {
            //     from: "servicer_dealer_relations",
            //     localField: "_id",
            //     foreignField: "dealerId",
            //     as: "dealerServicer",
            //   }
            // },
          ]
        }
      },
      {
        $unwind: "$contracts.orders.dealers"
      },
      {
        $lookup: {
          from: "customers",
          localField: "contracts.orders.customerId",
          foreignField: "_id",
          as: "contracts.orders.customer",

        }
      },
      {
        $unwind: "$contracts.orders.customer"
      },
      {
        $match:
        {
          $and: [
            { "contracts.orders.customer.username": { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            // { "contracts.orders.customer.isDeleted": false },
          ]
        },
      },

    ]
    if (newQuery.length > 0) {
      lookupQuery = lookupQuery.concat(newQuery);
    }

    let allClaims = await claimService.getAllClaims(lookupQuery);

    let resultFiter = allClaims[0]?.data ? allClaims[0]?.data : []

    let allServicerIds = [];
    // Iterate over the data array
    resultFiter.forEach(item => {
      // Iterate over the dealerServicer array in each item
      item.contracts.orders.dealers.dealerServicer.forEach(dealer => {
        // Push the servicerId to the allServicerIds array
        allServicerIds.push(dealer.servicerId);
      });
    });

    //Get Dealer and Reseller Servicers
    // const servicerIds = resultFiter.map(data => data.contracts.orders.dealers.dealerServicer[0]?.servicerId)
    let servicer;
    let servicerName = '';
    // console.log("servicerIds=================", allServicerIds);
    // res.json(resultFiter)
    // return
    allServicer = await servicerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );
    const result_Array = resultFiter.map((item1) => {
      servicer = []
      let servicerName = '';
      let selfServicer = false;
      let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
        const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId.toString());
        servicer.push(dealerOfServicer)
      });
      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }
      if (item1.contracts.orders.resellers?.isServicer) {
        servicer.unshift(item1.contracts.orders.resellers)
      }
      if (item1.contracts.orders.dealers.isServicer) {
        servicer.unshift(item1.contracts.orders.dealers)
      }
      if (item1.servicerId != null) {
        servicerName = servicer.find(servicer => servicer._id.toString() === item1.servicerId.toString());
        const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
        selfServicer = item1.servicerId.toString() === userId.toString() ? true : false
      }
      return {
        ...item1,
        servicerData: servicerName,
        selfServicer: selfServicer,
        contracts: {
          ...item1.contracts,
          allServicer: servicer
        }
      }
    })
    let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0
    res.send({
      code: constant.successCode,
      message: "Success",
      result: result_Array,
      totalCount
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


//-------------------------------------under developement section ----------------------------//

const MongoClient = require('mongodb').MongoClient;

// Connection URLs for the two databases
const url2 = `${process.env.DB_URL}User`;
const url1 = `${process.env.DB_URL}User`;

// Common ID

// Create MongoClient instances for each database
const client2 = new MongoClient(url2, { useNewUrlParser: true, useUnifiedTopology: true });
const client1 = new MongoClient(url1, { useNewUrlParser: true, useUnifiedTopology: true });

// Connect to the servers
// Promise.all([ client2.connect()])
// .then(() => {
// console.log('Connected to both databases');

// // Specify the databases
// const db2 = client2.db();

// // Specify the collections
// const collection2 = db2.collection('dealers');




// // Close the connections
// client2.close();
// });
// })
// .catch(err => {
// console.error('Error connecting to databases:', err);
// });


