require("dotenv").config();

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const randtoken = require('rand-token').generator()

const mongoose = require('mongoose')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');
const XLSX = require("xlsx");
const userResourceResponse = require("../utils/constant");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const userService = require("../services/userService");
const userMetaService = require("../services/userMetaService");
const dealerService = require('../../Dealer/services/dealerService')
const resellerService = require('../../Dealer/services/resellerService')
const dealerPriceService = require('../../Dealer/services/dealerPriceService')
const uploadMiddleware = require('../../Dealer/middleware/uploadMiddleware')
const priceBookService = require('../../PriceBook/services/priceBookService')
const providerService = require('../../Provider/services/providerService')
const users = require("../model/users");
const role = require("../model/role");
const constant = require('../../config/constant');
const emailConstant = require('../../config/emailConstant');
const mail = require("@sendgrid/mail");
const fs = require('fs');
const multer = require('multer');
const path = require('path');
// Promisify fs.createReadStream for asynchronous file reading
const logs = require('../../User/model/logs');

const csvParser = require('csv-parser');
const customerService = require("../../Customer/services/customerService");
const supportingFunction = require('../../config/supportingFunction')

const reportingController = require("./reportingController");
const orderService = require("../../Order/services/orderService");
const claimService = require("../../Claim/services/claimService");

var Storage = multer.diskStorage({
  destination: function (req, files, cb) {
    cb(null, path.join(__dirname, '../../uploads/'));
  },
  filename: function (req, files, cb) {
    cb(null, files.fieldname + '-' + Date.now() + path.extname(files.originalname))
  }
})

var upload = multer({
  storage: Storage,
}).any([
  { name: "file" },
  { name: "termCondition" },
])



//----------------------- api's function ---------------//

// create user 
exports.createUser = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    };
    let data = req.body

    const createdUser = await userService.createUser(data);
    if (!createdUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the user"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
    });
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  };
};

//Create new service provider By SA
exports.createServiceProvider = async (req, res) => {
  try {
    const data = req.body;
    const providerUserArray = data.providers;
    // Find data by email
    const emailValues = providerUserArray.map(value => value.email);

    const userData = await userService.findByEmail(emailValues);

    if (userData) {
      return res.send({
        code: constant.errorCode,
        message: 'Email Already Exists',
        data: userData
      });
    }

    // Hash the password
    //const hashedPassword = await bcrypt.hash(data.password, 10);

    // Check if the specified role exists
    const checkRole = await role.findOne({ role: { '$regex': new RegExp(`^${req.body.role}$`, 'i') } });
    if (!checkRole) {
      return res.send({
        code: constant.errorCode,
        message: 'Invalid role',
      });
    }

    // Create a new provider meta data
    const providerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      userAccount: req.body.customerAccountCreated,
      state: data.state,
      country: data.country,
      createdBy: data.createdBy,
    };

    // Create the service provider
    const createMetaData = await providerService.createServiceProvider(providerMeta);
    providerMeta.role = "Servicer"
    const createMetaData1 = await userMetaService.createMeta(providerMeta);
    if (!createMetaData) {
      return res.send({
        code: constant.errorCode,
        message: 'Unable to create servicer account',
      });
    }

    // Remove duplicates
    const resultProvider = providerUserArray.filter(obj => !userData.some(excludeObj => obj.email === excludeObj.email));
    const resultProviderData = accountCreationFlag
      ? await Promise.all(resultProvider.map(async (obj) => {
        const hashedPassword = await bcrypt.hash(obj.password, 10);
        return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, metaId: createMetaData._id, status: true, password: hashedPassword };
      }))
      : await Promise.all(resultProvider.map(async (obj) => {
        const hashedPassword = await bcrypt.hash(obj.password, 10);
        return { ...obj, roleId: checkRole._id, accountId: createMetaData._id, metaId: createMetaData._id, password: hashedPassword };
      }));

    // Map provider data


    // Create provider users
    const createProviderUsers = await userService.insertManyUser(resultProviderData);
    if (!createProviderUsers) {
      return res.send({
        code: constant.errorCode,
        message: 'Unable to create users',
      });
    }
    // let emailData = {
    //   dealerName: providerMeta.name,
    //   c1:"Thank you for",
    //   c2:"Registering! as a",
    //   c3:"Your account is currently pending approval from our admin.",
    //   c4:"Once approved, you will receive a confirmation emai",
    //   c5:"We appreciate your patience.",
    //   role: "Servicer"
    // }

    // // Send Email code here
    // let mailing = sgMail.send(emailConstant.dealerWelcomeMessage(data.email, emailData))


    return res.send({
      code: constant.successCode,
      message: 'Successfully Created',
    });

  } catch (err) {
    return res.send({
      code: constant.errorCode,
      message: err.message,
      data: createMetaData
    });
  }
};

// add new terms /// only for backend use
exports.createTerms = async (req, res) => {
  try {
    const monthTerms = generateMonthTerms(10); // You can specify the number of months as needed


    const createdTerms = await userService.createTerms(monthTerms);

    res.send({
      code: constant.successCode,
      message: "Created Successfully",
      data: createdTerms
    });
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the terms"
    });
  }
};

exports.tryUpload = async (req, res) => {
  try {
    // Check if a file is uploaded
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
  } catch (err) {
    // Handle errors and respond with an error message
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

//generate monthly terms /// only for backend use
const generateMonthTerms = (numberOfTerms) => {
  const monthTerms = [];

  for (let i = 1; i <= numberOfTerms; i++) {
    const months = i * 12;
    const monthObject = {
      terms: `${months}`,
      status: true
    };

    monthTerms.push(monthObject);
  }

  return monthTerms;
};

// validate dealer by super admin
exports.validateData = async (req, res) => {
  const data = req.body;
  // Check if the user has Super Admin role
  if (req.role !== "Super Admin") {
    res.send({
      code: constant.errorCode,
      message: "Only Super Admin is allowed to perform this action"
    });
    return
  }

  // Check if the specified role exists
  const checkRole = await role.findOne({ role: { '$regex': data.role, '$options': 'i' } });
  if (!checkRole) {
    res.send({
      code: constant.errorCode,
      message: "Invalid role"
    });
    return;
  }

  let priceBook = [];
  const primaryUserData = data.dealerPrimary ? data.dealerPrimary : [];
  const dealersUserData = data.dealers ? data.dealers : [];
  const allEmails = [...dealersUserData, ...primaryUserData].map((dealer) => dealer.email);
  let checkPriceBook = [];

  let dealerPriceArray = data.priceBook ? data.priceBook : [];
  const uniqueEmails = new Set(allEmails);


  if (allEmails.length !== uniqueEmails.size) {
    res.send({
      code: constant.errorCode,
      message: 'Multiple user cannot have same emails',
    });
    return
  }
  // const emailData = await userService.findByEmail(allEmails);
  // if (emailData.length > 0) {
  //   res.send({
  //     code: constant.errorCode,
  //     message: 'Email Already Exist',
  //     data: emailData
  //   });
  //   return;
  // }

  let savePriceBookType = req.body.savePriceBookType

  if (savePriceBookType == 'yes') {
    //check price book  exist or not
    priceBook = dealerPriceArray.map((dealer) => dealer.priceBookId);
    const priceBookCreateria = { _id: { $in: priceBook } }
    // console.log("priceBookCreateria=======================", priceBookCreateria)
    checkPriceBook = await priceBookService.getMultiplePriceBok(priceBookCreateria, { isDeleted: false })
    if (checkPriceBook.length == 0) {
      res.send({
        code: constant.errorCode,
        message: "Product does not exist.Please check the product"
      })
      return;
    }

    const missingProductNames = priceBook.filter(name => !checkPriceBook.some(product => product._id.equals(name)));
    if (missingProductNames.length > 0) {
      res.send({
        code: constant.errorCode,
        message: 'Some products is not created. Please check the product',
        missingProductNames: missingProductNames
      });
      return;
    }

  }
  if (data.dealerId != 'null' && data.dealerId != undefined) {
    const singleDealer = await dealerService.getDealerById({ _id: data.dealerId });
    if (!singleDealer) {
      res.send({
        code: constant.errorCode,
        message: "Dealer Not found"
      });
      return;
    }

    //check new name is not exist in the database

    const cleanStr1 = singleDealer.name.replace(/\s/g, '').toLowerCase();
    const cleanStr2 = data.name.replace(/\s/g, '').toLowerCase();


    if (cleanStr1 !== cleanStr2) {
      const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
      if (existingDealer) {
        res.send({
          code: constant.errorCode,
          message: 'Dealer name already exists',
        });
        return
      }
    }

    //check product is already exist for dealer this
    if (priceBook.length > 0) {
      let query = {
        $and: [
          { 'priceBook': { $in: priceBook } },
          { 'dealerId': data.dealerId }
        ]
      }

      const existingData = await dealerPriceService.findByIds(query);
      if (existingData.length > 0) {
        res.send({
          code: constant.errorCode,
          message: 'The product is already exist for this dealer! Duplicasy found. Please check again',
        });
        return;
      }

    }

  }

  else {
    // Check if the dealer already exists
    const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
    if (existingDealer) {
      res.send({
        code: constant.errorCode,
        message: 'Dealer name already exists',
      });
      return
    }
  }
  res.send({
    code: constant.successCode,
    message: 'Success',
  });
}

function uniqByKeepLast(data, key) {

  return [

    ...new Map(

      data.map(x => [key(x), x])

    ).values()

  ]

}

exports.createDealer = async (req, res) => {
  try {
    upload(req, res, async () => {
      const data = req.body;
      data.name = data.name.trim().replace(/\s+/g, ' ');
      let priceFile
      let termFile;
      let isAccountCreate = req.body.isAccountCreate
      let file = req.files
      for (i = 0; i < file.length; i++) {
        if (file[i].fieldname == 'termCondition') {
          termFile = file[i]
          // termFile.push(file[i].filename);
        } else if (file[i].fieldname == 'file') {
          priceFile = file[i]
        }
      }

      let termData = {
        fileName: termFile ? termFile.filename : '',
        name: termFile ? termFile.originalname : '',
        size: termFile ? termFile.size : '',
      }

      // Check if the specified role exists
      const checkRole = await role.findOne({ role: { '$regex': data.role, '$options': 'i' } });
      if (!checkRole) {
        res.send({
          code: constant.errorCode,
          message: "Invalid role"
        });
        return;
      }

      let priceBook = [];
      let priceBookIds = [];
      const primaryUserData = data.dealerPrimary ? data.dealerPrimary : [];
      const dealersUserData = data.dealers ? data.dealers : [];
      const allEmails = [...dealersUserData, ...primaryUserData].map((dealer) => dealer.email);
      let checkPriceBook = [];
      let dealerPriceArray = data.priceBook ? data.priceBook : [];
      const uniqueEmails = new Set(allEmails);
      if (allEmails.length !== uniqueEmails.size) {
        res.send({
          code: constant.errorCode,
          message: 'Multiple user cannot have same email',
        });
        return
      }

      let count = await dealerPriceService.getDealerPriceCount();

      let savePriceBookType = req.body.savePriceBookType
      const allUserData = [...dealersUserData, ...primaryUserData];

      if (data.dealerId != 'null' && data.dealerId != undefined) {
        let createUsers = [];

        if (data.email != data.oldEmail) {
          let emailCheck = await userService.findOneUser({ email: data.email }, {});
          if (emailCheck) {
            res.send({
              code: constant.errorCode,
              message: "Primary user email already exist"
            })
            return;
          }
        }

        if (data.name != data.oldName) {
          let nameCheck = await dealerService.getDealerByName({ name: data.name });
          if (nameCheck) {
            res.send({
              code: constant.errorCode,
              message: "Dealer name already exist"
            })
            return;
          }
        }

        const singleDealerUser = await userService.findOneUser({ accountId: data.dealerId }, {});
        const singleDealer = await dealerService.getDealerById({ _id: data.dealerId });
        if (!singleDealer) {
          res.send({
            code: constant.errorCode,
            message: "Dealer Not found"
          });
          return;
        }

        if (savePriceBookType == 'yes') {
          priceBook = dealerPriceArray.map((dealer) => dealer.priceBookId);
          const priceBookCreateria = { _id: { $in: priceBook } }
          checkPriceBook = await priceBookService.getMultiplePriceBok(priceBookCreateria, { isDeleted: false })

          if (checkPriceBook.length == 0) {
            res.send({
              code: constant.errorCode,
              message: "Product does not exist.Please check the product"
            })
            return;
          }

          const missingProductNames = priceBook.filter(name => !checkPriceBook.some(product => product._id.equals(name)));
          if (missingProductNames.length > 0) {
            res.send({
              code: constant.errorCode,
              message: 'Some products is not created. Please check the product',
              missingProductNames: missingProductNames
            });
            return;
          }

          const cleanStr1 = singleDealer.name.replace(/\s/g, '').toLowerCase();
          const cleanStr2 = data.name.replace(/\s/g, '').toLowerCase();

          if (cleanStr1 !== cleanStr2) {
            const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
            if (existingDealer) {
              res.send({
                code: constant.errorCode,
                message: 'Dealer name already exists',
              });
              return
            }
          }
          //check product is already exist for dealer this
          priceBookIds = dealerPriceArray.map((dealer) => new mongoose.Types.ObjectId(dealer.priceBookId));

          if (priceBook.length > 0) {
            let query = {
              $and: [
                { 'priceBook': { $in: priceBookIds } },
                { 'dealerId': new mongoose.Types.ObjectId(data.dealerId) }
              ]
            }

            const existingData = await dealerPriceService.findByIds(query);

            if (existingData.length > 0) {
              res.send({
                code: constant.errorCode,
                message: 'The product is already exist for this dealer! Duplicasy found. Please check again',
              });
              return;
            }
          }

          const resultPriceData = dealerPriceArray.map((obj, index) => ({
            'priceBook': obj.priceBookId,
            'dealerId': data.dealerId,
            'brokerFee': Number(obj.retailPrice) - Number(obj.wholesalePrice),
            'retailPrice': obj.retailPrice,
            "status": obj.status,
            'wholesalePrice': obj.wholesalePrice,
            'unique_key': Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + index + 1,
          }));
          //Primary information edit
          let userQuery = { accountId: { $in: [data.dealerId] }, isPrimary: true }
          let newValues1 = {
            $set: {
              email: allUserData[0].email,
              firstName: allUserData[0].firstName,
              lastName: allUserData[0].lastName,
              phoneNumber: allUserData[0].phoneNumber,
              position: allUserData[0].position,
              roleId: '656f08041eb1acda244af8c6',
              status: allUserData[0].status ? true : false,
            }
          }

          await userService.updateUser(userQuery, newValues1, { new: true })
          const createPriceBook = await dealerPriceService.insertManyPrices(resultPriceData);
          // Save Logs when price book created

          if (!createPriceBook) {
            let logData = {
              userId: req.teammateId,
              endpoint: "user/createDealer",
              body: req.body,
              response: {
                code: constant.errorCode,
                message: "Unable to save price book"
              }
            }
            await logs(logData).save()
            res.send({
              code: constant.errorCode,
              message: "Unable to save price book"
            });
            return;
          }

          // Save Logs
          let logData = {
            userId: req.teammateId,
            endpoint: "user/createDealer",
            body: req.body,
            response: {
              code: constant.successCode,
              message: "Saved Successfully!",
              result: createPriceBook
            }
          }
          await logs(logData).save()

          let allUsersData = allUserData.map((obj, index) => ({
            ...obj,
            roleId: '656f08041eb1acda244af8c6',
            accountId: data.dealerId,
            metaId: data.dealerId,
            isPrimary: index === 0 ? true : false,
            status: !req.body.isAccountCreate || req.body.isAccountCreate == 'false' ? false : obj.status
          }));

          if (allUsersData.length > 1) {
            allUsersData = [...allUsersData.slice(0, 0), ...allUsersData.slice(1)];
            createUsers = await userService.insertManyUser(allUsersData);
            if (!createUsers) {
              res.send({
                code: constant.errorCode,
                message: "Unable to save users"
              });
              return;
            }
          }
          let dealerQuery = { _id: data.dealerId }
          let newValues = {
            $set: {
              status: "Approved",
              serviceCoverageType: req.body.serviceCoverageType,
              isShippingAllowed: req.body.isShippingAllowed,
              isAccountCreate: isAccountCreate,
              coverageType: req.body.coverageType,
              termCondition: termData,
              accountStatus: true,
              isAccountCreate: isAccountCreate,
              isServicer: data.isServicer ? data.isServicer : false
            }
          }

          let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })

          if (!dealerStatus) {
            res.send({
              code: constant.errorCode,
              message: "Unable to approve dealer status"
            });
            return;
          }


          let statusUpdateCreateria = { accountId: { $in: [data.dealerId] } }
          let updateData = {
            $set: {
              approvedStatus: 'Approved'
            }
          }
          await userService.updateUser(statusUpdateCreateria, updateData, { new: true })

          // Send notification when approved
          let IDs = await supportingFunction.getUserIds()
          IDs.push(req.body.dealerId);
          let notificationData = {
            title: "Dealer Approval",
            description: req.body.name + " " + "has been successfully approved",
            userId: req.teammateId,
            flag: 'dealer',
            notificationFor: IDs
          };

          await userService.createNotification(notificationData);

          // Primary User Welcoime email
          let notificationEmails = await supportingFunction.getUserEmails();
          let emailData = {
            senderName: allUserData[0].firstName,
            content: "Dear " + allUserData[0].firstName + " we are delighted to inform you that your registration as an authorized dealer " + singleDealer.name + " has been approved",
            subject: "Welcome to Get-Cover Dealer Registration Approved"
          }
          // Send Email code here
          sgMail.send(emailConstant.sendEmailTemplate(allUserData[0].email, notificationEmails, emailData))

          if (req.body.isAccountCreate) {
            for (let i = 0; i < createUsers.length; i++) {
              // Send mail to all User except primary
              if (createUsers[i].status) {
                let resetPasswordCode = randtoken.generate(4, '123456789')
                let email = createUsers[i].email;
                let userId = createUsers[i]._id;
                let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                sgMail.send(emailConstant.dealerApproval(email, { link: resetLink, role: req.role, dealerName: createUsers[i].firstName }))
                await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
              }
            }
            // Send mail to  primary
            let resetPrimaryCode = randtoken.generate(4, '123456789')
            let resetPrimaryLink = `${process.env.SITE_URL}newPassword/${singleDealerUser._id}/${resetPrimaryCode}`
            sgMail.send(emailConstant.dealerApproval(singleDealerUser.email, { link: resetPrimaryLink, role: req.role, dealerName: singleDealerUser.firstName }))
            await userService.updateUser({ _id: singleDealerUser._id }, { resetPasswordCode: resetPrimaryCode, isResetPassword: true }, { new: true })

          }
          if (req.body.isServicer) {
            const CountServicer = await providerService.getServicerCount();

            let servicerObject = {
              name: data.name,
              street: data.street,
              city: data.city,
              zip: data.zip,
              dealerId: req.body.dealerId,
              state: data.state,
              country: data.country,
              status: data.status,
              accountStatus: "Approved",
              unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
            }

            let createData = await providerService.createServiceProvider(servicerObject)
          }
          // Save Logs
          logData = {
            userId: req.teammateId,
            endpoint: "user/createDealer",
            body: req.body,
            response: {
              code: constant.successCode,
              message: 'Successfully Created',
            }
          }
          await logs(logData).save()
          res.send({
            code: constant.successCode,
            message: 'Successfully Created',
          });

        }
        else if (savePriceBookType == 'no') {
          // uploadP(req, res, async (err) => {
          let file = req.file
          let data = req.body

          const cleanStr1 = singleDealer.name.replace(/\s/g, '').toLowerCase();
          const cleanStr2 = data.name.replace(/\s/g, '').toLowerCase();

          if (cleanStr1 !== cleanStr2) {
            const existingDealer = await dealerService.getDealerByName({ name: { '$regex': data.name, '$options': 'i' } }, { isDeleted: 0, __v: 0 });
            if (existingDealer) {
              res.send({
                code: constant.errorCode,
                message: 'Dealer name already exists',
              });
              return
            }
          }

          let csvName = priceFile.filename
          const csvWriter = createCsvWriter({
            path: './uploads/resultFile/' + csvName,
            header: [
              { id: 'priceBook', title: 'Price Book' },
              { id: 'status', title: 'Status' },
              { id: 'reason', title: 'Reason' },
              // Add more headers as needed
            ],
          });
          const wb = XLSX.readFile(priceFile.path);
          const sheets = wb.SheetNames;
          const ws = wb.Sheets[sheets[0]];
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
          let totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);
          totalDataComing1 = totalDataComing1.map(item => {
            if (!item['Product SKU']) {
              return { priceBook: '', 'RetailPrice': item['retailPrice'] };
            }
            return item;
          });
          const totalDataComing = totalDataComing1.map(item => {

            const keys = Object.keys(item);

            return {
              priceBook: item[keys[0]],
              retailPrice: item[keys[1]],
              duplicates: [],
              exit: false
            };
          });

          // copy to here
          totalDataComing.forEach((data, index) => {

            if (!data.retailPrice || typeof (data.retailPrice) != 'number' || data.retailPrice <= 0) {
              data.status = "Dealer catalog retail price is not valid";
              totalDataComing[index].retailPrice = data.retailPrice
              data.exit = true;
            }

            else {
              data.status = null
            }
          })
          if (totalDataComing.length > 0) {
            const repeatedMap = {};

            for (let i = totalDataComing.length - 1; i >= 0; i--) {
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
              let queryPrice;
              if (singleDealer?.coverageType == "Breakdown & Accidental") {
                queryPrice = { name: item.priceBook ? new RegExp(`^${item.priceBook.toString().replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true }
              } else {
                queryPrice = { name: item.priceBook ? new RegExp(`^${item.priceBook.toString().replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true, coverageType: singleDealer?.coverageType }
              }
              if (!item.status) return priceBookService.findByName1(queryPrice);
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

              if (item.priceBookDetail) return dealerPriceService.getDealerPriceById({ dealerId: new mongoose.Types.ObjectId(req.body.dealerId), priceBook: item.priceBookDetail._id }, {});
              return false;
            })
            const dealerArray = await Promise.all(dealerArrayPromise);

            for (let i = 0; i < totalDataComing.length; i++) {
              if (totalDataComing[i].priceBookDetail) {
                if (dealerArray[i]) {
                  dealerArray[i].retailPrice = totalDataComing[i].retailPrice != undefined ? totalDataComing[i].retailPrice : dealerArray[i].retailPrice;
                  dealerArray[i].brokerFee = dealerArray[i].retailPrice - dealerArray[i].wholesalePrice
                  await dealerArray[i].save();

                  totalDataComing[i].status = "Dealer catalog updated successully-";
                  totalDataComing[i].duplicates.forEach((index) => {
                    totalDataComing[index].status = "Dealer catalog updated successully_";
                  })

                } else {
                  const count = await dealerPriceService.getDealerPriceCount();
                  let unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
                  let wholesalePrice = totalDataComing[i].priceBookDetail.reserveFutureFee + totalDataComing[i].priceBookDetail.reinsuranceFee + totalDataComing[i].priceBookDetail.adminFee + totalDataComing[i].priceBookDetail.frontingFee;
                  await dealerPriceService.createDealerPrice({
                    dealerId: req.body.dealerId,
                    priceBook: totalDataComing[i].priceBookDetail._id,
                    unique_key: unique_key,
                    status: true,
                    retailPrice: totalDataComing[i].retailPrice != "" ? totalDataComing[i].retailPrice : 0,
                    brokerFee: totalDataComing[i].retailPrice - wholesalePrice,
                    wholesalePrice
                  })
                  totalDataComing[i].status = "Dealer catalog created successully!"

                  totalDataComing[i].duplicates.forEach((index, i) => {
                    let msg = index === 0 ? "Dealer catalog created successully)" : "Dealer catalog updated successully%"
                    totalDataComing[index].status = msg;
                  })
                }
              }
            }

            const csvArray = totalDataComing.map((item) => {
              return {
                priceBook: item.priceBook ? item.priceBook : "",
                retailPrice: item.retailPrice ? item.retailPrice : "",
                status: item.status
              }
            })
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
            const mailing = sgMail.send(emailConstant.sendCsvFile('yashasvi@codenomad.net', [], htmlTableString));
          }
          let userQuery = { accountId: { $in: [req.body.dealerId] }, isPrimary: true }
          let newValues1 = {
            $set: {
              email: allUserData[0].email,
              firstName: allUserData[0].firstName,
              lastName: allUserData[0].lastName,
              roleId: '656f08041eb1acda244af8c6',
              phoneNumber: allUserData[0].phoneNumber,
              position: allUserData[0].position,
              status: allUserData[0].status ? true : false,
            }
          }
          let updateStatus1 = await userService.updateUser(userQuery, newValues1, { new: true })

          let allUsersData = allUserData.map((obj, index) => ({
            ...obj,
            roleId: '656f08041eb1acda244af8c6',
            accountId: req.body.dealerId,
            metaId: req.body.dealerId,
            isPrimary: index === 0 ? true : false,
            status: !req.body.isAccountCreate || req.body.isAccountCreate == 'false' ? false : obj.status
          }));

          if (allUsersData.length > 1) {
            allUsersData = [...allUsersData.slice(0, 0), ...allUsersData.slice(1)];
            createUsers = await userService.insertManyUser(allUsersData);
            if (!createUsers) {
              let logData = {
                userId: req.teammateId,
                endpoint: "user/createDealer",
                body: req.body,
                response: {
                  code: constant.errorCode,
                  message: "Unable to save users"
                }
              }
              await logs(logData).save()
              res.send({
                code: constant.errorCode,
                message: "Unable to save users"
              });
              return;
            }

            //Save Logs
            let logData = {
              userId: req.teammateId,
              endpoint: "user/createDealer",
              body: req.body,
              response: {
                code: constant.successCode,
                message: "Saved Successfully"
              }
            }
            await logs(logData).save()
          }

          let dealerQuery = { _id: req.body.dealerId }

          let newValues = {
            $set: {
              status: "Approved",
              accountStatus: true,
              serviceCoverageType: req.body.serviceCoverageType,
              isShippingAllowed: req.body.isShippingAllowed,
              isAccountCreate: isAccountCreate,
              coverageType: req.body.coverageType,
              termCondition: termData,
              isServicer: data.isServicer ? data.isServicer : false
            }
          }

          let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })

          if (!dealerStatus) {
            res.send({
              code: constant.errorCode,
              message: "Unable to approve dealer status"
            });
            return;
          }

          // Send notification when approved
          let IDs = await supportingFunction.getUserIds()
          IDs.push(req.body.dealerId);
          let notificationData = {
            title: "Dealer Approved",
            description: req.body.name + " " + "has been successfully approved",
            userId: req.teammateId,
            flag: 'dealer',
            notificationFor: IDs
          };
          let createNotification = await userService.createNotification(notificationData);
          let statusUpdateCreateria = { accountId: { $in: [req.body.dealerId] } }
          let updateData = {
            $set: {
              approvedStatus: 'Approved'
            }
          }
          let updateUserStatus = await userService.updateUser(statusUpdateCreateria, updateData, { new: true })

          // Primary User Welcoime email
          let notificationEmails = await supportingFunction.getUserEmails();
          let emailData = {
            senderName: allUserData[0].firstName,
            content: "Dear " + allUserData[0].firstName + " we are delighted to inform you that your registration as an authorized dealer " + singleDealer.name + " has been approved",
            subject: "Welcome to Get-Cover Dealer Registration Approved"
          }

          // Send Email code here
          let mailing = sgMail.send(emailConstant.sendEmailTemplate(allUserData[0].email, notificationEmails, emailData))

          if (req.body.isAccountCreate) {
            for (let i = 0; i < createUsers.length; i++) {
              // Send mail to all User except primary
              if (createUsers[i].status) {
                let resetPasswordCode = randtoken.generate(4, '123456789')
                let email = createUsers[i].email;
                let userId = createUsers[i]._id;
                let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                let mailing = sgMail.send(emailConstant.dealerApproval(email, { link: resetLink, dealerName: createUsers[i].firstName }))
                let updateStatus = await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
              }
            }
            // Send mail to  primary
            let resetPrimaryCode = randtoken.generate(4, '123456789')
            let resetPrimaryLink = `${process.env.SITE_URL}newPassword/${singleDealerUser._id}/${resetPrimaryCode}`
            let mailingPrimary = sgMail.send(emailConstant.dealerApproval(singleDealerUser.email, { link: resetPrimaryLink, dealerName: singleDealerUser.firstName }))
            let updatePrimaryStatus = await userService.updateUser({ _id: singleDealerUser._id }, { resetPasswordCode: resetPrimaryCode, isResetPassword: true }, { new: true })

          }

          if (req.body.isServicer) {
            const CountServicer = await providerService.getServicerCount();

            let servicerObject = {
              name: data.name,
              street: data.street,
              city: data.city,
              zip: data.zip,
              dealerId: req.body.dealerId,
              state: data.state,
              country: data.country,
              status: data.status,
              accountStatus: "Approved",
              unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
            }

            let createData = await providerService.createServiceProvider(servicerObject)
          }
          res.send({
            code: constant.successCode,
            message: 'Successfully Created',
          });
          return;

        }

        return;
      }
      else {
        const existingDealer = await dealerService.getDealerByName({ name: data.name }, { isDeleted: 0, __v: 0 });

        if (existingDealer) {
          res.send({
            code: constant.errorCode,
            message: 'Dealer name already exists',
          });
          return
        }

        let emailCheck = await userService.findOneUser({ email: data.email }, {});
        if (emailCheck) {
          res.send({
            code: constant.errorCode,
            message: "Primary user email already exist"
          })
          return;
        }

        if (savePriceBookType == 'yes') {
          priceBook = dealerPriceArray.map((dealer) => dealer.priceBookId);
          const priceBookCreateria = { _id: { $in: priceBook } }
          checkPriceBook = await priceBookService.getMultiplePriceBok(priceBookCreateria, { isDeleted: false })
          if (checkPriceBook.length == 0) {
            res.send({
              code: constant.errorCode,
              message: "Product does not exist.Please check the product"
            })
            return;
          }

          const missingProductNames = priceBook.filter(name => !checkPriceBook.some(product => product._id.equals(name)));
          if (missingProductNames.length > 0) {
            res.send({
              code: constant.errorCode,
              message: 'Some products is not created. Please check the product',
              missingProductNames: missingProductNames
            });
            return;
          }


          let count = await dealerService.getDealerCount();

          const dealerMeta = {
            name: data.name,
            street: data.street,
            userAccount: req.body.customerAccountCreated,
            city: data.city,
            serviceCoverageType: req.body.serviceCoverageType,
            isShippingAllowed: req.body.isShippingAllowed,
            coverageType: req.body.coverageType,
            isAccountCreate: req.body.isAccountCreate,
            termCondition: termData,
            zip: data.zip,
            state: data.state,
            isServicer: data.isServicer ? data.isServicer : false,
            country: data.country,
            status: 'Approved',
            accountStatus: true,
            createdBy: data.createdBy,
            unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
          };
          // Create Dealer Meta Data
          const createMetaData = await dealerService.createDealer(dealerMeta);
          if (!createMetaData) {
            //Save Logs
            let logData = {
              userId: req.teammateId,
              endpoint: "user/createDealer",
              body: req.body,
              response: {
                code: constant.errorCode,
                message: "Unable to create dealer"
              }
            }
            await logs(logData).save()
            res.send({
              code: constant.errorCode,
              message: "Unable to create dealer"
            });
            return;
          }
          //Save Logs
          let logData = {
            userId: req.teammateId,
            endpoint: "user/createDealer",
            body: req.body,
            response: {
              code: constant.errorCode,
              message: "Created Successfully"
            }
          }
          await logs(logData).save()

          //Send Notification to dealer 

          let IDs = await supportingFunction.getUserIds()

          let notificationData = {
            title: "Dealer Creation",
            description: createMetaData.name + " " + "has been successfully created",
            userId: req.teammateId,
            flag: 'dealer',
            notificationFor: IDs
          };
          let createNotification = await userService.createNotification(notificationData);

          // Create the user

          if (data.isServicer) {
            const CountServicer = await providerService.getServicerCount();
            let servicerObject = {
              name: data.name,
              street: data.street,
              city: data.city,
              zip: data.zip,
              dealerId: createMetaData._id,
              state: data.state,
              country: data.country,
              status: data.status,
              accountStatus: "Approved",
              unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
            }

            let createData = await providerService.createServiceProvider(servicerObject)
          }

          let allUsersData = allUserData.map((obj, index) => ({
            ...obj,
            roleId: '656f08041eb1acda244af8c6',
            accountId: createMetaData._id,
            metaId: createMetaData._id,
            position: obj.position || '', // Using the shorthand for conditional (obj.position ? obj.position : '')
            isPrimary: index === 0 ? true : false,
            status: !req.body.isAccountCreate || req.body.isAccountCreate == 'false' ? false : obj.status,
            approvedStatus: 'Approved'
          }));
          // console.log("allUsersData--------------------------",allUsersData);
          const createUsers = await userService.insertManyUser(allUsersData);
          if (!createUsers) {
            res.send({
              code: constant.errorCode,
              message: "Unable to save users"
            });
            return;
          }
          //save Price Books for this dealer
          count = await dealerPriceService.getDealerPriceCount();
          const resultPriceData = dealerPriceArray.map((obj, index) => ({
            'priceBook': obj.priceBookId,
            'dealerId': createMetaData._id,
            'brokerFee': Number(obj.retailPrice) - Number(obj.wholesalePrice),
            'retailPrice': obj.retailPrice,
            'wholesalePrice': obj.wholesalePrice,
            "status": obj.status,
            'unique_key': Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + index + 1,
          }));

          const createPriceBook = await dealerPriceService.insertManyPrices(resultPriceData);
          if (!createPriceBook) {
            //Save Logs
            let logData = {
              userId: req.teammateId,
              endpoint: "user/createDealer",
              body: req.body,
              response: {
                code: constant.errorCode,
                message: "Unable to save price book"
              }
            }
            await logs(logData).save()
            res.send({
              code: constant.errorCode,
              message: "Unable to save price book"
            });
            return;
          }
          //Approve status 
          // Primary User Welcoime email
          let notificationEmails = await supportingFunction.getUserEmails();
          let emailData = {
            senderName: createUsers[0].firstName,
            content: "Dear " + createUsers[0].firstName + " we are delighted to inform you that your registration as an authorized dealer " + createMetaData.name + " has been approved",
            subject: "Welcome to Get-Cover Dealer Registration Approved"
          }

          // Send Email code here
          let mailing = sgMail.send(emailConstant.sendEmailTemplate(createUsers[0].email, notificationEmails, emailData))
          if (req.body.isAccountCreate) {
            for (let i = 0; i < createUsers.length; i++) {
              if (createUsers[i].status) {
                let resetPasswordCode = randtoken.generate(4, '123456789')
                let email = createUsers[i].email;
                let userId = createUsers[i]._id;
                let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                let mailing = sgMail.send(emailConstant.dealerApproval(email, { link: resetLink, role: req.role, dealerName: createUsers[i].firstName }))
                let updateStatus = await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
              }

            }
            //  resetPasswordCode = randtoken.generate(4, '123456789')
            //  resetLink = `http://15.207.221.207/newPassword/${createUsers[0]._id}/${resetPasswordCode}`
            //  mailing = sgMail.send(emailConstant.dealerApproval(createUsers[0].email, { link: resetLink }))
            //  updateStatus = await userService.updateUser({ _id: createUsers[0]._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
            // if (mailing) {
            //   let updateStatus = await userService.updateUser({ _id: createUsers[0]._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
            //   res.send({
            //     code: constant.successCode,
            //     message: 'Successfully Created',
            //   });
            //   return;
            // }
          }
          res.send({
            code: constant.successCode,
            message: 'Successfully Created',
          });

          return;

        }

        else if (savePriceBookType == 'no') {

          let csvName = priceFile.filename
          const csvWriter = createCsvWriter({
            path: './uploads/resultFile/' + csvName,
            header: [
              { id: 'priceBook', title: 'Price Book' },
              { id: 'status', title: 'Status' },
              { id: 'reason', title: 'Reason' },
              // Add more headers as needed
            ],
          });

          const count = await dealerService.getDealerCount();
          const results = [];
          const wb = XLSX.readFile(priceFile.path);
          const sheets = wb.SheetNames;
          const ws = wb.Sheets[sheets[0]];
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

          let totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);
          totalDataComing1 = totalDataComing1.map(item => {
            if (!item['Product SKU']) {
              return { priceBook: '', 'RetailPrice': item['retailPrice'] };
            }
            return item;
          });

          const totalDataComing = totalDataComing1.map(item => {
            const keys = Object.keys(item);
            return {
              priceBook: item[keys[0]],
              retailPrice: item[keys[1]],
              duplicates: [],
              exit: false
            };
          });
          // copy to here
          totalDataComing.forEach((data, index) => {
            if (!data.retailPrice || typeof (data.retailPrice) != 'number' || data.retailPrice <= 0) {
              data.status = "Dealer catalog retail price is not valid";
              totalDataComing[index].retailPrice = data.retailPrice
              data.exit = true;
            }
            else {
              data.status = null
            }
          })
          const dealerMeta = {
            name: data.name,
            street: data.street,
            userAccount: req.body.customerAccountCreated,
            city: data.city,
            zip: data.zip,
            serviceCoverageType: req.body.serviceCoverageType,
            isShippingAllowed: req.body.isShippingAllowed,
            coverageType: req.body.coverageType,
            isAccountCreate: isAccountCreate,
            termCondition: termData,
            state: data.state,
            country: data.country,
            isServicer: data.isServicer ? data.isServicer : false,
            status: 'Approved',
            accountStatus: true,
            createdBy: data.createdBy,
            unique_key: Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
          };
          // Create Dealer Meta Data

          const createMetaData = await dealerService.createDealer(dealerMeta);

          if (!createMetaData) {
            res.send({
              code: constant.errorCode,
              message: "Unable to create dealer"
            });
            return;
          }

          // Send notification 
          let IDs = await supportingFunction.getUserIds()

          let notificationData = {
            title: "Dealer Creation",
            description: createMetaData.name + " " + "has been successfully created",
            userId: req.teammateId,
            flag: 'dealer',
            notificationFor: IDs
          };
          let createNotification = await userService.createNotification(notificationData);

          if (data.isServicer) {
            const CountServicer = await providerService.getServicerCount();

            let servicerObject = {
              name: data.name,
              street: data.street,
              city: data.city,
              zip: data.zip,
              dealerId: createMetaData._id,
              state: data.state,
              country: data.country,
              status: data.status,
              accountStatus: "Approved",
              unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
            }

            let createData = await providerService.createServiceProvider(servicerObject)
          }

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
              let queryPrice;
              if (createMetaData?.coverageType == "Breakdown & Accidental") {
                queryPrice = { name: item.priceBook ? new RegExp(`^${item.priceBook.toString().replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true }
              } else {
                queryPrice = { name: item.priceBook ? new RegExp(`^${item.priceBook.toString().replace(/\s+/g, ' ').trim()}$`, 'i') : '', status: true, coverageType: createMetaData?.coverageType }
              }
              if (!item.status) return priceBookService.findByName1(queryPrice);
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

              if (item.priceBookDetail) return dealerPriceService.getDealerPriceById({ dealerId: new mongoose.Types.ObjectId(createMetaData._id), priceBook: item.priceBookDetail._id }, {});
              return false;
            })
            const dealerArray = await Promise.all(dealerArrayPromise);

            for (let i = 0; i < totalDataComing.length; i++) {
              if (totalDataComing[i].priceBookDetail) {
                if (dealerArray[i]) {
                  dealerArray[i].retailPrice = totalDataComing[i].retailPrice != undefined ? totalDataComing[i].retailPrice : dealerArray[i].retailPrice;
                  dealerArray[i].brokerFee = dealerArray[i].retailPrice - dealerArray[i].wholesalePrice
                  await dealerArray[i].save();

                  totalDataComing[i].status = "Dealer catalog updated successully-";
                  totalDataComing[i].duplicates.forEach((index) => {
                    totalDataComing[index].status = "Dealer catalog updated successully_";
                  })

                } else {
                  const count = await dealerPriceService.getDealerPriceCount();
                  let unique_key = Number(count.length > 0 && count[0].unique_key ? count[0].unique_key : 0) + 1
                  let wholesalePrice = totalDataComing[i].priceBookDetail.reserveFutureFee + totalDataComing[i].priceBookDetail.reinsuranceFee + totalDataComing[i].priceBookDetail.adminFee + totalDataComing[i].priceBookDetail.frontingFee;

                  await dealerPriceService.createDealerPrice({
                    dealerId: createMetaData._id,
                    priceBook: totalDataComing[i].priceBookDetail._id,
                    unique_key: unique_key,
                    status: true,
                    retailPrice: totalDataComing[i].retailPrice != "" ? totalDataComing[i].retailPrice : 0,
                    brokerFee: totalDataComing[i].retailPrice - wholesalePrice,
                    wholesalePrice
                  })
                  totalDataComing[i].status = "Dealer catalog created successully!"

                  totalDataComing[i].duplicates.forEach((index, i) => {
                    let msg = index === 0 ? "Dealer catalog created successully)" : "Dealer catalog updated successully%"
                    totalDataComing[index].status = msg;
                  })
                }
              }
            }

            const csvArray = totalDataComing.map((item) => {
              return {
                priceBook: item.priceBook ? item.priceBook : "",
                retailPrice: item.retailPrice ? item.retailPrice : "",
                status: item.status
              }
            })
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
            const mailing = sgMail.send(emailConstant.sendCsvFile('yashasvi@codenomad.net', [], htmlTableString));
          }

          let allUsersData = allUserData.map((obj, index) => ({
            ...obj,
            roleId: '656f08041eb1acda244af8c6',
            accountId: createMetaData._id,
            metaId: createMetaData._id,
            position: obj.position || '', // Using the shorthand for conditional (obj.position ? obj.position : '')
            isPrimary: index === 0 ? true : false,
            status: !req.body.isAccountCreate || req.body.isAccountCreate == 'false' ? false : obj.status,
            approvedStatus: 'Approved'
          }));

          const createUsers = await userService.insertManyUser(allUsersData);
          if (!createUsers) {
            res.send({
              code: constant.errorCode,
              message: "Unable to save users"
            });
            return;
          }
          let dealerQuery = { _id: createMetaData._id }
          let newValues = {
            $set: {
              status: "Approved",
            }
          }
          let dealerStatus = await dealerService.updateDealer(dealerQuery, newValues, { new: true })
          if (!dealerStatus) {
            res.send({
              code: constant.errorCode,
              message: "Unable to approve dealer status"
            });
            return;
          }

          let statusUpdateCreateria = { accountId: { $in: [createMetaData._id] } }
          let updateData = {
            $set: {
              approvedStatus: 'Approved'
            }
          }
          let updateUserStatus = await userService.updateUser(statusUpdateCreateria, updateData, { new: true })

          // Primary User Welcoime email
          let notificationEmails = await supportingFunction.getUserEmails();
          let emailData = {
            senderName: createUsers[0].firstName,
            content: "Dear " + createUsers[0].firstName + " we are delighted to inform you that your registration as an authorized dealer " + createMetaData.name + " has been approved",
            subject: "Welcome to Get-Cover Dealer Registration Approved"
          }

          // Send Email code here
          let mailing = sgMail.send(emailConstant.sendEmailTemplate(createUsers[0].email, notificationEmails, emailData))

          if (req.body.isAccountCreate) {
            for (let i = 0; i < createUsers.length; i++) {
              if (createUsers[i].status) {
                let resetPasswordCode = randtoken.generate(4, '123456789')
                let email = createUsers[i].email;
                let userId = createUsers[i]._id;
                let resetLink = `${process.env.SITE_URL}newPassword/${userId}/${resetPasswordCode}`
                let mailing = sgMail.send(emailConstant.dealerApproval(email, { link: resetLink, role: req.role, dealerName: createUsers[i].firstName }))
                let updateStatus = await userService.updateUser({ _id: userId }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
              }

            }
          }
          res.send({
            code: constant.successCode,
            message: 'Successfully Created',
          });

        }
      }

    })
  } catch (err) {
    //Save Logs
    let logData = {
      userId: req.teammateId,
      endpoint: "user/createDealer catch",
      body: req.body,
      response: {
        code: constant.errorCode,
        message: err.message
      }
    }
    await logs(logData).save()
    return res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

//save Dealer Meta Data
//---------------------------------------------------- refined code ----------------------------------------//

// Login route
exports.login = async (req, res) => {
  try {
    // Check if the user with the provided email exists
    const user = await userService.findOneUser({ email: req.body.email.toLowerCase() }, {});
    if (!user) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Credentials"
      })
      return;
    }
    let roleQuery = { _id: user.roleId }
    let roleProjection = { __v: 0 }
    let getRole = await userService.getRoleById(roleQuery, roleProjection)

    if (getRole.role == "Dealer") {
      let checkDealer = await dealerService.getDealerById(user.accountId)
      if (!checkDealer?.accountStatus) {
        res.send({
          code: constant.errorCode,
          message: "Dear User, We are still waiting for your approval from the GetCover Team. Please hang on for a while."
        })
        return
      }
    }

    if (getRole.role == "Reseller") {
      let checkReseller = await resellerService.getReseller({ _id: user.accountId })
      if (!checkReseller?.status) {
        res.send({
          code: constant.errorCode,
          message: "Dear User, We are still waiting for your approval from the GetCover Team. Please hang on for a while."
        })
        return
      }
    }

    if (getRole.role == "Servicer") {
      let checkServicer = await providerService.getServiceProviderById({ _id: user.accountId })
      if (!checkServicer?.status) {
        res.send({
          code: constant.errorCode,
          message: "Dear User, We are still waiting for your approval from the GetCover Team. Please hang on for a while."
        })
        return
      }
    }

    if (user.status == false) {
      res.send({
        code: constant.errorCode,
        message: "Your account is not active, please contact to the administration"
      })
      return;
    }

    // Compare the provided password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(req.body.password, user.password);
    if (!passwordMatch) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Credentials"
      })
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.accountId ? user.accountId : user._id, teammateId: user._id, email: user.email, role: getRole.role, status: user.status },
      process.env.JWT_SECRET, // Replace with your secret key
      { expiresIn: "1d" }
    );

    res.send({
      code: constant.successCode,
      message: "Login Successful",
      result: {
        token: token,
        email: user.email,
        userInfo: {
          firstName: user.firstName,
          lastName: user.lastName
        },
        role: getRole.role
      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

// create super admin credentials
exports.createSuperAdmin = async (req, res) => {
  try {
    let data = req.body
    // Check if the user with the provided email already exists
    const existingUser = await userService.findOneUser({ email: data.email }, {});
    if (existingUser) {
      res.send({
        code: constant.errorCode,
        message: "Email already exist"
      })
      return;
    }

    // Check if the provided role is 'super'
    const superRole = await role.findOne({ role: "Super Admin" });
    if (!superRole) {
      res.send({
        code: constant.errorCode,
        message: "Role not found"
      })
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    let userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      phoneNumber: data.phoneNumber,
      roleId: superRole._id, //Assign super role
      isPrimary: true,
      status: data.status,
    }

    // Create a new user with the provided data
    const savedUser = await userService.createUser(userData);

    let updateUser = {
      accountId: savedUser._id,
      metaId: savedUser._id,
    }

    const updateData = await userService.updateSingleUser({ _id: savedUser._id }, updateUser, { new: true })

    // Generate JWT token 
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    //success response 
    res.send({
      code: constant.successCode,
      message: "Account created successfully",
      data: updateData
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    });
  }
};

// get all users 
exports.getAllUsers = async (req, res) => {
  try {
    if (req.role != "Super Admin") {
      res.send({
        code: constant.errorCode,
        message: "Only super admin allow to do this action"
      })
      return;
    };

    const checkRole = await role.findOne({ role: { '$regex': req.params.role, '$options': 'i' } });
    let query = { roleId: new mongoose.Types.ObjectId(checkRole ? checkRole._id : '000000000000000000000000'), isDeleted: false }
    let projection = { isDeleted: 0, __v: 0 }
    const users = await userService.getAllUsers(query, projection);

    if (!users) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the data"
      })
      return
    }

    res.send({
      code: constant.successCode,
      message: "Success",
      result: {
        users: users
      }
    })
  } catch (error) {
    res
      .status(constant.errorCode)
      .json({ error: "Internal server error" });
  }
};

//get user detail with ID
exports.getUserById = async (req, res) => {
  try {
    let projection = { __v: 0 }
    let userId = req.params.userId ? req.params.userId : '000000000000000000000000'
    const singleUser = await userService.findOneUser({ _id: userId, }, projection);
    if (!singleUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the user detail"
      })
      return;
    };

    let mainStatus;
    let criteria = { _id: singleUser.accountId }
    let checkStatus = await providerService.getServiceProviderById(criteria)
    let checkDealer = await dealerService.getDealerById(criteria)
    let checkReseller = await resellerService.getReseller(criteria, {})
    let checkCustomer = await customerService.getCustomerByName(criteria)
    mainStatus = checkStatus ? checkStatus.status : checkDealer ? checkDealer.accountStatus : checkReseller ? checkReseller.status : checkCustomer ? checkCustomer.status : false
    res.send({
      code: constant.successCode,
      message: "Success",
      result: singleUser,
      mainStatus: mainStatus
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

// update user details with ID
exports.updateUser = async (req, res) => {
  try {
    let criteria = { _id: req.teammateId };
    let option = { new: true };
    const updateUser = await userService.updateUser(criteria, req.body, option);
    if (!updateUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the user data"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
    });
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  };
};

exports.updateUserData = async (req, res) => {
  try {
    let data = req.body
    let criteria = { _id: req.params.userId ? req.params.userId : req.teammateId };
    let option = { new: true };
    const updateUser = await userService.updateSingleUser(criteria, data, option);

    if (!updateUser) {
      //Save Logs updateUserData
      let logData = {
        endpoint: "user/updateUserData",
        userId: req.userId,
        body: data,
        response: {
          code: constant.errorCode,
          message: "Unable to update the user data"
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to update the user data"
      });
      return;
    };

    //Get role by id
    const checkRole = await userService.getRoleById({ _id: updateUser.roleId }, {});

    //send notification to dealer when status change
    let IDs = await supportingFunction.getUserIds()
    let getPrimary = await supportingFunction.getPrimaryUser({ accountId: updateUser.accountId, isPrimary: true })

    IDs.push(getPrimary._id)
    let notificationData = {
      title: checkRole.role + " " + "user has been change",
      description: "The  user has been changed!",
      userId: req.teammateId,
      flag: checkRole.role,
      notificationFor: [getPrimary._id]
    };

    let createNotification = await userService.createNotification(notificationData);
    // Send Email code here
    let notificationEmails = await supportingFunction.getUserEmails();
    notificationEmails.push(getPrimary.email);
    notificationEmails.push(updateUser.email);
    let emailData;

    if (data.firstName) {
      emailData = {
        senderName: updateUser.firstName,
        content: "The user information has been updated successfully!.",
        subject: "Update User Info"
      }
    }

    else {
      const status_content = req.body.status ? 'Active' : 'Inactive';
      emailData = {
        senderName: updateUser.firstName,
        content: "Status has been changed to " + status_content + " " + ", effective immediately.",
        subject: "Update Status"
      }
    }

    let mailing = sgMail.send(emailConstant.sendEmailTemplate(updateUser.email, getPrimary.email, emailData))

    //Save Logs updateUserData
    let logData = {
      endpoint: "user/updateUserData",
      userId: req.userId,
      body: data,
      response: {
        code: constant.successCode,
        message: "Updated Successfully",
        result: updateUser
      }
    }

    await logs(logData).save()

    res.send({
      code: constant.successCode,
      message: "Updated Successfully",
      result: updateUser
    });
  } catch (err) {
    //Save Logs updateUserData
    let logData = {
      endpoint: "user/updateUserData catch",
      userId: req.userId,
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
  };
};

// get all roles
exports.getAllTerms = async (req, res) => {
  try {
    let query = { isDeleted: false }
    let projection = { __v: 0 }
    const terms = await userService.getAllTerms(query, projection);
    if (!terms) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the terms "
      });
      return;
    };
    //success response
    res.send({
      code: constant.successCode,
      message: "Successful",
      result: {
        terms: terms
      }
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

// add new roles
exports.addRole = async (req, res) => {
  try {
    let checkRole = await userService.getRoleById({ role: { '$regex': new RegExp(`^${req.body.role}$`, 'i') } })
    if (checkRole) {
      res.send({
        code: constant.errorCode,
        message: "Role already exist"
      })
      return;
    }

    const createdUser = await userService.addRole(req.body);

    if (!createdUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the role"
      })
    }

    res.send({
      code: constant.successCode,
      message: "Created Successfully",
      data: createdUser
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

//send reset password link to email
exports.sendLinkToEmail = async (req, res) => {
  try {
    let data = req.body
    let resetPasswordCode = randtoken.generate(4, '123456789')
    let checkEmail = await userService.findOneUser({ email: data.email.toLowerCase() }, {})
    if (!checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User does not exist"
      })
    } else {
      if (checkEmail.status == false || checkEmail.isDeleted == true) {
        res.send({
          code: constant.errorCode,
          message: "This account is currently awaiting approval from the administrator"
        })
        return;
      }
      const mailing = sgMail.send(emailConstant.resetpassword(checkEmail._id, resetPasswordCode, checkEmail.email))

      if (mailing) {
        let updateStatus = await userService.updateUser({ _id: checkEmail._id }, { resetPasswordCode: resetPasswordCode, isResetPassword: true }, { new: true })
        res.send({
          code: constant.successCode,
          message: "Email has been sent",
          codes: resetPasswordCode
        })
      }
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//reset password with link
exports.resetPassword = async (req, res) => {
  try {
    let data = req.body
    let checkUser = await userService.findOneUser({ _id: req.params.userId }, {})
    if (!checkUser) {
      res.send({
        code: constant.errorCode,
        message: "Invalid link"
      })
      return;
    };
    if (checkUser.resetPasswordCode != req.params.code) {
      res.send({
        code: constant.errorCode,
        message: "Link has been expired"
      })
      return;
    };
    let hash = await bcrypt.hashSync(data.password, 10);
    let newValues = {
      $set: {
        password: hash,
        resetPasswordCode: null,
        isResetPassword: false,
        approvedStatus: 'Approved',
        status: true
      }
    }
    let option = { new: true }
    let criteria = { _id: checkUser._id }
    let updatePassword = await userService.updateUser(criteria, newValues, option)
    if (updatePassword) {
      res.send({
        code: constant.successCode,
        message: "Password updated successfully"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//delete user api
exports.deleteUser = async (req, res) => {
  try {
    let criteria = { _id: req.params.userId };
    let newValue = {
      $set: {
        isDeleted: true
      }
    };
    let option = { new: true }
    const checkUser = await userService.getUserById1({ _id: req.params.userId }, {});
    const deleteUser = await userService.deleteUser(criteria, newValue, option);

    if (!deleteUser) {
      //Save Logs delete user
      let logData = {
        endpoint: "user/deleteUser",
        userId: req.userId,
        body: criteria,
        response: {
          code: constant.errorCode,
          message: "Unable to delete the user"
        }
      }
      await logs(logData).save()
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the user"
      });
      return;
    };
    const checkRole = await userService.getRoleById({ _id: checkUser.roleId }, {});

    let primaryUser = await supportingFunction.getPrimaryUser({ accountId: checkUser.accountId, isPrimary: true })

    //send notification to dealer when deleted
    let IDs = await supportingFunction.getUserIds()

    let notificationData = {
      title: "User Deletion",
      description: checkUser.firstName + " user has been deleted!",
      userId: req.teammateId,
      flag: checkRole.role,
      notificationFor: [primaryUser._id]
    };

    let createNotification = await userService.createNotification(notificationData);

    // Send Email code here
    let notificationEmails = await supportingFunction.getUserEmails();
    notificationEmails.push(primaryUser.email);
    notificationEmails.push(checkUser.email);

    let emailData = {
      senderName: checkUser.firstName,
      content: "The user " + checkUser.firstName + "" + " " + "has been deleted successfully.",
      subject: "Delete User"
    }
    let mailing = sgMail.send(emailConstant.sendEmailTemplate(checkUser.email, primaryUser.email, emailData))

    //Save Logs delete user
    let logData = {
      endpoint: "user/deleteUser",
      userId: req.userId,
      body: criteria,
      response: {
        code: constant.successCode,
        message: "Deleted Successfully"
      }
    }
    await logs(logData).save()
    res.send({
      code: constant.successCode,
      message: "Deleted Successfully"
    })
  } catch (err) {
    //Save Logs delete user
    let logData = {
      endpoint: "user/deleteUser catch",
      userId: req.userId,
      body: { type: "catch" },
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


// get all roles
exports.getAllRoles = async (req, res) => {
  try {
    let query = { isDeleted: false }
    let projection = { __v: 0 }
    const roles = await userService.getAllRoles(query, projection);
    if (!users) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the roles "
      });
      return;
    };
    //success response
    res.send({
      code: constant.successCode,
      message: "Successful",
      result: {
        roles: roles
      }
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

// get all notifications
exports.getAllNotifications = async (req, res) => {
  try {
    let Query = { isDeleted: false, title: 'New Dealer Registration' }
    let Query1 = { isDeleted: false, title: 'New Servicer Registration' }
    let projection = { __v: 0 }
    const dealerNotification = await userService.getAllNotifications(Query, projection);
    const servicerNotification = await userService.getAllNotifications(Query1, projection);
    const dealerIds = dealerNotification.map(value => value.userId);
    const servicerIds = servicerNotification.map(value => value.userId);
    // const query1 = { accountId: { $in: accountIds }, isPrimary: true };
    const query1 = { _id: { $in: dealerIds } };
    const query2 = { _id: { $in: servicerIds } };

    let dealerData = [];
    let allNotification = [];

    allNotification = [...dealerNotification, ...servicerNotification];

    let dealerMeta = await dealerService.getAllDealers(query1, projection)
    let servicerMeta = await providerService.getAllServiceProvider(query2, projection)
    dealerData = [...dealerMeta, ...servicerMeta];

    const result_Array = dealerData.map(item1 => {
      const matchingItem = allNotification.find(item2 => item2.userId.toString() == item1._id.toString());
      if (matchingItem) {
        return {
          ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
          notificationData: matchingItem.toObject()
        };
      } else {
        return dealerData.toObject();
      }
    });

    const sortedResultArray = result_Array.sort((a, b) => {
      const createdAtA = new Date(a.notificationData.createdAt);
      const createdAtB = new Date(b.notificationData.createdAt);

      return createdAtB - createdAtA;
    });


    res.send({
      code: constant.successCode,
      message: "Successful",
      result: {
        notification: sortedResultArray
      }
    });

    return;
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

exports.getAllNotifications1 = async (req, res) => {
  try {
    let data = req.body

    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let getNotifications = await userService.getAllNotifications({ notificationFor: new mongoose.Types.ObjectId(req.teammateId) }, skipLimit, limitData)
    let updateNotification = await userService.updateNotification({ notificationFor: new mongoose.Types.ObjectId(req.teammateId) }, { $addToSet: { openBy: new mongoose.Types.ObjectId(req.teammateId) } }, { new: true })

    let updatedNotifications = getNotifications.map(notification => {
      const isRead = notification.readBy.includes(new mongoose.Types.ObjectId(req.teammateId));
      const isOpen = notification.openBy.includes(new mongoose.Types.ObjectId(req.teammateId));
      return {
        ...notification._doc,
        isRead,
        isOpen
      };
    });

    if (data.readFlag || data.readFlag == false) {
      if (data.readFlag != "") {
        if (data.readFlag == "true" || data.readFlag == true || data.readFlag != "false") {
          updatedNotifications = updatedNotifications.filter(item => item.isRead === true)
        } else {

          updatedNotifications = updatedNotifications.filter(item => item.isRead === false)

        }
      }
    }



    res.send({
      code: constant.successCode,
      message: "Success",
      result: updatedNotifications,
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

exports.readNotification = async (req, res) => {
  try {
    let data = req.body
    let checkId = await userService.updateNotification({ _id: req.params.notificationId }, { $addToSet: { readBy: req.teammateId } }, { new: true })
    if (!checkId) {
      res.send({
        code: constant.errorCode,
        message: "Invalid notification ID"
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
}

exports.readAllNotification = async (req, res) => {
  try {
    let data = req.body
    let checkId = await userService.updateNotification({ notificationFor: new mongoose.Types.ObjectId(req.teammateId) }, { $addToSet: { readBy: req.teammateId } }, { new: true })

    if (!checkId) {
      res.send({
        code: constant.errorCode,
        message: "Invalid notification ID"
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
}

exports.checkEmail = async (req, res) => {
  try {
    // Check if the email already exists
    const existingUser = await userService.findOneUser({ 'email': req.body.email }, {});

    if (existingUser && existingUser.approvedStatus == 'Approved') {
      res.send({
        code: constant.errorCode,
        message: "Email is already exist!",

      })
      return;
    }

    res.send({
      code: constant.successCode,
      message: "Success",
      status: 'Pending'
    })

  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

//Get Count of Notification
exports.getCountNotification = async (req, res) => {
  try {
    let checkId = new mongoose.Types.ObjectId(req.teammateId)
    const allNotification = await userService.getCountNotification({ notificationFor: checkId, openBy: { $ne: checkId } });

    res.send({
      code: constant.successCode,
      message: "Successful",
      count: allNotification
    });

    return;
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    })
  }
};

exports.checkEmailForSingle = async (req, res) => {
  try {
    let checkEmail = await userService.findOneUser({ email: req.body.email }, {})
    if (checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User already exist with this email ID"
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

//Update Profile
exports.updateProfile = async (req, res) => {
  try {
    if (req.role != 'Super Admin') {
      res.send({
        code: constant.errorCode,
        message: 'Only super admin allow to do this action!'
      });
      return
    }
    const data = req.body
    let email = data.email
    let updateProfile = await userService.updateSingleUser({ email: email }, data, { new: true })

    if (!updateProfile) {
      res.send({
        code: constant.errorCode,
        message: 'Unabe to update profile!'
      })
      return
    }

    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: updateProfile
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};
// Update Password
exports.updatePassword = async (req, res) => {
  try {
    let data = req.body
    const id = req.teammateId
    let checkId = await userService.getSingleUserByEmail({ _id: id })

    if (!checkId) {
      res.send({
        code: constant.errorCode,
        message: "Invalid user ID"
      })
      return;
    };

    let comparePassword = await bcrypt.compare(data.oldPassword, checkId.password)
    if (!comparePassword) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Old Password"
      })
      return
    };

    data.password = bcrypt.hashSync(data.newPassword, 10)
    let updatePassword = await userService.updateSingleUser({ _id: checkId._id }, data, { new: true })

    if (!updatePassword) {
      res.send({
        code: constant.errorCode,
        message: "Unable to update the password"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Successfully updated the password",
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};
//Get User by jwt token
exports.getUserByToken = async (req, res) => {
  try {
    let projection = { __v: 0 }
    let userId = req.userId
    const singleUser = await userService.findOneUser({ _id: userId, }, projection);
    if (!singleUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the user detail"
      })
      return;
    };

    let mainStatus;
    let criteria = { _id: singleUser.accountId }
    let checkStatus = await providerService.getServiceProviderById(criteria)
    let checkDealer = await dealerService.getDealerById(criteria)
    let checkReseller = await resellerService.getReseller(criteria, {})
    let checkCustomer = await customerService.getCustomerByName(criteria)
    mainStatus = checkStatus ? checkStatus.status : checkDealer ? checkDealer.accountStatus : checkReseller ? checkReseller.status : checkCustomer ? checkCustomer.status : false
    res.send({
      code: constant.successCode,
      message: "Success",
      result: singleUser,
      mainStatus: mainStatus
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};
//Add members
exports.addMembers = async (req, res) => {
  try {
    let data = req.body
    let checkEmail = await userService.getSingleUserByEmail({ email: data.email })
    if (checkEmail) {
      res.send({
        code: constant.errorCode,
        message: "User already exists with this email"
      })
      return;
    };
    data.isPrimary = false;
    let getRole = await userService.getRoleById({ role: req.role })
    data.metaId = req.userId
    data.accountId = req.userId
    data.roleId = getRole._id
    let saveData = await userService.createUser(data)

    if (!saveData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the member"
      })
      return;
    };

    let notificationEmails = await supportingFunction.getUserEmails();

    let emailData = {
      senderName: data.firstName,
      content: "Dear " + data.firstName + " we are delighted to inform you that your admin account has been created by super admin. Please reset the password for the system login",
      subject: "Admin Account Creation"
    }

    let mailing = sgMail.send(emailConstant.sendEmailTemplate(data.email, notificationEmails, emailData))

    let resetPasswordCode = randtoken.generate(4, '123456789')
    let checkPrimaryEmail2 = await userService.updateSingleUser({ email: data.email }, { resetPasswordCode: resetPasswordCode }, { new: true });
    let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
    const resetPassword = sgMail.send(emailConstant.servicerApproval(data.email, { link: resetLink, role: "Admin", servicerName: data.firstName }))
    // // Create the user
    res.send({
      code: constant.successCode,
      message: "Created Successfully"
    })

  } catch (err) {
    const lineNumber = err.stack.split('\n')[1].split(':')[1];
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};
//Get Members
exports.getMembers = async (req, res) => {
  try {
    let data = req.body
    data.isPrimary = false;
    let query = {
      $and: [
        {
          $or: [
            { accountId: req.userId },
            { _id: req.userId },
          ]
        },
        { firstName: { '$regex': data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { lastName: { '$regex': data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { phone: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      ]
    }
    let userMembers = await userService.getMembers({
      $and: [
        { firstName: { '$regex': data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { lastName: { '$regex': data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        { phoneNumber: { '$regex': data.phone ? data.phone.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
        {
          $or: [
            { accountId: req.userId },
            { _id: req.userId },
          ]
        },

      ]
    }, { isDeleted: false })

    let userMember = await userService.getUserById1({ _id: req.teammateId }, { isDeleted: false })

    res.send({
      code: constant.successCode,
      message: "Success!",
      result: userMembers ? userMembers : [],
      loginMember: userMember
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};
//Get account information
exports.getAccountInfo = async (req, res) => {
  try {
    let accountInfo;
    if (req.role == 'Dealer') {
      accountInfo = await dealerService.getDealerById(req.userId, { name: 1, city: 1, state: 1, zip: 1, street: 1, country: 1, userAccount: 1, isServicer: 1 })
    }
    if (req.role == 'Customer') {
      accountInfo = await customerService.getCustomerById({ _id: req.userId }, { username: 1, city: 1, state: 1, zip: 1, street: 1, country: 1 })
    }
    if (req.role == 'Reseller') {
      accountInfo = await resellerService.getReseller({ _id: req.userId }, { name: 1, city: 1, state: 1, zip: 1, street: 1, country: 1, isServicer: 1 })
    }
    if (req.role == 'Servicer') {
      accountInfo = await providerService.getServiceProviderById({ _id: req.userId }, { name: 1, city: 1, state: 1, zip: 1, street: 1, country: 1 })
    }

    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: accountInfo
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};
//Change Primary User 
exports.changePrimaryUser = async (req, res) => {
  try {
    let data = req.body
    let checkUser = await userService.findOneUser({ _id: req.params.userId }, {})
    if (!checkUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to find the user"
      })
      return;
    };

    let updateLastPrimary = await userService.updateSingleUser({ accountId: checkUser.accountId, isPrimary: true }, { isPrimary: false }, { new: true })
    let updatePrimary = await userService.updateSingleUser({ _id: checkUser._id }, { isPrimary: true }, { new: true })

    if (!updatePrimary) {
      res.send({
        code: constant.errorCode,
        message: "Something went wrong"
      })
    } else {
      res.send({
        code: constant.successCode,
        message: "Updated successfully",
        result: updatePrimary
      })
    }

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

exports.checkToken = async (req, res) => {
  try {
    let data = req.body
    let getUserDetails = await userService.getSingleUserByEmail({ _id: req.teammateId })

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
}

//Get Sales Reporting

exports.saleReporting = async (req, res) => {
  try {

    let bodyData = req.body
    bodyData.role = req.role

    bodyData.returnValue = {
      total_broker_fee: 1,
      total_admin_fee: 1,
      total_fronting_fee: 1,
      total_reserve_future_fee: 1,
      total_contracts: 1,
      total_reinsurance_fee: 1,
      // total_retail_price: match ? match.total_retail_price : item.total_retail_price,
      wholesale_price: 1
    };

    if (bodyData.flag == "daily") {
      let sales = await reportingController.dailySales1(bodyData)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else if (bodyData.flag == "weekly") {
      let sales = await reportingController.weeklySales(bodyData)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else if (bodyData.flag == "day") {
      let sales = await reportingController.daySale(bodyData)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else {
      res.send({
        code: constant.successCode,
        result: [],
        message: "Invalid flag value"
      })
    }

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get dashboard info
exports.getDashboardInfo = async (req, res) => {
  if (req.role != 'Super Admin') {
    res.send({
      code: constant.errorCode,
      message: "Only Super admin allow to do this action"
    })
    return;
  }

  let orderQuery = [
    {
      $match: { status: "Active" }
    },
    {
      "$addFields": {
        "noOfProducts": {
          "$sum": "$productsArray.checkNumberProducts"
        },
        totalOrderAmount: { $sum: "$orderAmount" },

      }
    },
   
    { $sort: { unique_key_number: -1 }  },
    {
      $limit:5
    },
  ]

  const lastFiveOrder = await orderService.getOrderWithContract1(orderQuery, 1, 5)

  const claimQuery = [
    {
      $match: {
        claimFile: "Completed"
      }
    },
    {
      $sort: {
        unique_key_number: -1
      }
    },
    {
      $limit: 5
    },
    {
      $lookup: {
        from: "contracts",
        localField: "contractId",
        foreignField: "_id",
        as: "contract"
      }
    },
    {
      $unwind: "$contract"
    },
    {
      $project: {
        unique_key: 1,
        "contract.unique_key": 1,
        unique_key_number: 1,
        totalAmount: 1
      }
    },
  ]

  const getLastNumberOfClaims = await claimService.getClaimWithAggregate(claimQuery, {})

  let lookupQuery = [
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "metaId",
        as: "users",
        pipeline: [
          {
            $match: {
              isPrimary: true
            }
          }
        ]
      }
    },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "dealerId",
        as: "order",
        pipeline: [
          {
            $match: { status: "Active" }
          },
          {
            "$group": {
              _id: "$order.dealerId",
              "totalOrder": { "$sum": 1 },
              "totalAmount": {
                "$sum": "$orderAmount"
              }
            }
          },
        ]
      }
    },

    {
      $project: {
        name: 1,
        totalAmount: {
          $cond: {
            if: { $gte: [{ $arrayElemAt: ["$order.totalAmount", 0] }, 0] },
            then: { $arrayElemAt: ["$order.totalAmount", 0] },
            else: 0
          }
        },
        totalOrder: {
          $cond: {
            if: { $gt: [{ $arrayElemAt: ["$order.totalOrder", 0] }, 0] },
            then: { $arrayElemAt: ["$order.totalOrder", 0] },
            else: 0
          }
        },
        'phone': { $arrayElemAt: ["$users.phoneNumber", 0] },

      }
    },

    { "$sort": { totalAmount: -1 } },
    { "$limit": 5 }  // Apply limit again after sorting
  ]

  const topFiveDealer = await dealerService.getTopFiveDealers(lookupQuery);

  let lookupClaim = [
    {
      $match: {
        dealerId: null,
        resellerId: null
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "metaId",
        as: "users",
        pipeline: [
          {
            $match: {
              isPrimary: true
            }
          }
        ]
      }
    },

    {
      $lookup: {
        from: "claims",
        localField: "_id",
        foreignField: "servicerId",
        as: "claims",
        pipeline: [
          {
            $match: { claimFile: "Completed" }
          },
          {
            "$group": {
              _id: "$servicerId",
              "totalClaim": { "$sum": 1 },
              "totalClaimAmount": {
                "$sum": "$totalAmount"
              }
            }
          },
        ]
      }
    },
    {
      $project: {
        name: 1,
        totalClaimAmount: {
          $cond: {
            if: { $gte: [{ $arrayElemAt: ["$claims.totalClaimAmount", 0] }, 0] },
            then: { $arrayElemAt: ["$claims.totalClaimAmount", 0] },
            else: 0
          }
        },
        totalClaim: {
          $cond: {
            if: { $gt: [{ $arrayElemAt: ["$claims.totalClaim", 0] }, 0] },
            then: { $arrayElemAt: ["$claims.totalClaim", 0] },
            else: 0
          }
        },
        'phone': { $arrayElemAt: ["$users.phoneNumber", 0] },

      }
    },
    { "$sort": { totalClaimAmount: -1 } },
    { "$limit": 5 }  // Apply limit again after sorting
  ]

  const topFiveServicer = await providerService.getTopFiveServicer(lookupClaim);

  const result = {
    lastFiveOrder: lastFiveOrder,
    lastFiveClaims: getLastNumberOfClaims,
    topFiveDealer: topFiveDealer,
    topFiveServicer: topFiveServicer

  }
  res.send({
    code: constant.successCode,
    result: result
  })
}

//Get dashboard graph data
exports.getDashboardGraph = async (req, res) => {
  try {
    let data = req.body
    // sku data query ++++++++

    let endOfMonth1s = new Date();
    let startOfMonth2s = new Date(new Date().setDate(new Date().getDate() - 30));

    let startOfYear2s = new Date(new Date().setFullYear(startOfMonth2s.getFullYear() - 1));


    let startOfMonths = new Date(startOfMonth2s.getFullYear(), startOfMonth2s.getMonth(), startOfMonth2s.getDate());
    let startOfMonth1s = new Date(startOfYear2s.getFullYear(), startOfYear2s.getMonth(), startOfYear2s.getDate());


    let endOfMonths = new Date(endOfMonth1s.getFullYear(), endOfMonth1s.getMonth(), endOfMonth1s.getDate() + 1);

    let orderQuery = [
      {
        $match: {
          updatedAt: { $gte: startOfMonths, $lte: endOfMonths },
          status: "Active"

        }
      },
      {
        $unwind: "$productsArray"
      },
      {
        $group: {
          _id: "$productsArray.priceBookDetails.name",
          totalPrice: { $sum: "$productsArray.price" },
        }
      },
      {
        $project: {
          _id: 0,
          priceBookName: "$_id",
          totalPrice: 1,
          term: 1,

        }
      },
      {
        $sort: { totalPrice: -1 }
      }

    ]

    let orderQuery1 = [
      {
        $match: {
          updatedAt: { $gte: startOfMonth1s, $lte: endOfMonths },
          status: "Active"
        }
      },
      {
        $unwind: "$productsArray"
      },
      {
        $group: {
          _id: "$productsArray.priceBookDetails.name",
          totalPrice: { $sum: "$productsArray.price" }
        }
      },
      {
        $project: {
          _id: 0,
          priceBookName: "$_id",
          totalPrice: 1
        }
      },
      {
        $sort: { totalPrice: -1 }
      }

    ]

    // let data = req.body
    let endOfMonth1 = new Date();
    let startOfMonth2 = new Date(new Date().setDate(new Date().getDate() - 30));

    let startOfMonth = new Date(startOfMonth2.getFullYear(), startOfMonth2.getMonth(), startOfMonth2.getDate());


    let endOfMonth = new Date(endOfMonth1.getFullYear(), endOfMonth1.getMonth(), endOfMonth1.getDate() + 1);

    if (isNaN(startOfMonth) || isNaN(endOfMonth)) {
      return { code: 401, message: "invalid date" };
    }

    let datesArray = [];
    let currentDate = new Date(startOfMonth);
    while (currentDate <= endOfMonth) {
      datesArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    let dailyQuery = [
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lt: endOfMonth },
          claimStatus: {
            $elemMatch: { status: "Completed" }
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          total_amount: { $sum: "$totalAmount" },
          total_claim: { $sum: 1 },
        }
      },
      {
        $sort: { _id: 1 } // Sort by date in ascending order
      }
    ];

    let dailyQuery1 = [
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lt: endOfMonth },
          status: "Active"
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          order_amount: { $sum: "$orderAmount" },
          total_order: { $sum: 1 },
        }
      },
      {
        $sort: { _id: 1 } // Sort by date in ascending order
      }
    ];

    let getData = await claimService.getClaimWithAggregate(dailyQuery)
    let getData2 = await orderService.getAllOrders1(dailyQuery1)
    let getOrders = await orderService.getAllOrders1(orderQuery)
    let getOrders1 = await orderService.getAllOrders1(orderQuery1)
    let priceBookNames = getOrders.map(ID => ID.priceBookName)
    let priceBookName1 = getOrders1.map(ID => ID.priceBookName)

    let priceQuery = {
      name: { $in: priceBookNames }
    }

    let priceQuery1 = {
      name: { $in: priceBookName1 }
    }

    let getPriceBooks = await priceBookService.getAllActivePriceBook(priceQuery)
    let getPriceBooks1 = await priceBookService.getAllActivePriceBook(priceQuery1)

    const result = datesArray.map(date => {
      const dateString = date.toISOString().slice(0, 10);
      const order = getData.find(item => item._id === dateString);
      return {
        weekStart: dateString,
        total_amount: order ? order.total_amount : 0,
        total_claim: order ? order.total_claim : 0,

      };
    });
    const result1 = datesArray.map(date => {
      const dateString = date.toISOString().slice(0, 10);
      const order = getData2.find(item => item._id === dateString);

      return {
        weekStart: dateString,
        order_amount: order ? order.order_amount : 0,
        total_order: order ? order.total_order : 0,
      };
    });

    res.send({
      code: constant.successCode,
      message: "Success",
      claim_result: result,
      order_result: result1,
      monthly_sku: getPriceBooks,
      yealy_sku: getPriceBooks1
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};


exports.saleReporting1 = async (req, res) => {
  try {
    const pathToAttachment = process.env.MAIN_FILE_PATH + "uploads/" + "file-1718782172826.xlsx"
    fs.readFile(pathToAttachment, async (err, fileData) => {
      //Email to Customer
      try {
        var send = await sgMail.send(
          {
            to: 'amit@codenomad.net',
            from: process.env.from_email,
            subject: 'Report',
            text: "sssssssssssssssss",
            attachments: [
              {
                content: "fileData",
                filename: "file-1718782172826.xlsx",
                type: 'application/pdf',
                disposition: 'attachment',
                contentId: 'mytext'
              },
            ],
          }
        )

      } catch (error) {

        if (error.response) {
          console.error('Error response:', error.response.body);
        }
      }
    })

    if (req.body.flag == "daily") {
      let sales = await reportingController.dailySales1(req.body)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else if (req.body.flag == "weekly") {
      let sales = await reportingController.weeklySalesOrder(req.body)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else if (req.body.flag == "day") {
      let sales = await reportingController.daySale(req.body)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: sales
      })
    } else {
      res.send({
        code: constant.successCode,
        result: [],
        message: "Invalid flag value"
      })
    }

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.claimReporting = async (req, res) => {
  try {
    let data = req.body

    let returnValue = {
      weekStart: 1,
      total_amount: 1,
      total_claim: 1,
      total_unpaid_amount: 1,
      total_unpaid_claim: 1,
      total_paid_amount: 1,
      total_paid_claim: 1,
      total_rejected_claim: 1
    };


    data.returnValue = returnValue
    data.role = req.role

    if (data.flag == "daily") {
      let claim = await reportingController.claimDailyReporting(data)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: claim
      })
    } else if (data.flag == "weekly") {
      let claim = await reportingController.claimWeeklyReporting(data)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: claim
      })
    } else if (data.flag == "day") {
      let claim = await reportingController.claimDayReporting(data)
      res.send({
        code: constant.successCode,
        message: "Success",
        result: claim
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


exports.getSkuData = async (req, res) => {
  try {
    let endOfMonth1s = new Date();
    let startOfMonth2s = new Date(new Date().setDate(new Date().getDate() - 30));
    let startOfYear2s = new Date(new Date().setFullYear(startOfMonth2s.getFullYear() - 1));
    let startOfMonths = new Date(startOfMonth2s.getFullYear(), startOfMonth2s.getMonth(), startOfMonth2s.getDate());
    let startOfMonth1s = new Date(startOfYear2s.getFullYear(), startOfYear2s.getMonth(), startOfYear2s.getDate());
    let endOfMonths = new Date(endOfMonth1s.getFullYear(), endOfMonth1s.getMonth(), endOfMonth1s.getDate() + 1);
    let orderQuery = [
      {
        $match: {
          updatedAt: { $gte: startOfMonths, $lte: endOfMonths }
        }
      },
      {
        $unwind: "$productsArray"
      },
      {
        $group: {
          _id: "$productsArray.priceBookDetails.name",
          totalPrice: { $sum: "$productsArray.price" }
        }
      },
      {
        $project: {
          _id: 0,
          priceBookName: "$_id",
          totalPrice: 1
        }
      },
      {
        $sort: { totalPrice: -1 }
      }

    ]

    let orderQuery1 = [
      {
        $match: {
          updatedAt: { $gte: startOfMonth1s, $lte: endOfMonths }
        }
      },
      {
        $unwind: "$productsArray"
      },
      {
        $group: {
          _id: "$productsArray.priceBookDetails.name",
          totalPrice: { $sum: "$productsArray.price" }
        }
      },
      {
        $project: {
          _id: 0,
          priceBookName: "$_id",
          totalPrice: 1
        }
      },
      {
        $sort: { totalPrice: -1 }
      }
    ]

    let getOrders = await orderService.getAllOrders1(orderQuery)
    let getOrders1 = await orderService.getAllOrders1(orderQuery1)
    res.send({
      code: constant.successCode,
      message: "Success",
      result1: getOrders,
      result2: getOrders1,
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}