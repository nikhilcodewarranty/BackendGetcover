require("dotenv").config();
const path = require("path");
const { claim } = require("../../models/Claim/claim");
const { comments } = require("../../models/Claim/comment");
const LOG = require('../../models/User/logs')
const claimService = require("../../services/Claim/claimService");
const orderService = require("../../services/Order/orderService");
const optionService = require("../../services/User/optionsService");
const userService = require("../../services/User/userService");
const contractService = require("../../services/Contract/contractService");
const servicerService = require("../../services/Provider/providerService");
const priceBookService = require("../../services/PriceBook/priceBookService");
const customerService = require("../../services/Customer/customerService");
const providerService = require("../../services/Provider/providerService");
const resellerService = require("../../services/Dealer/resellerService");
const dealerService = require("../../services/Dealer/dealerService");
const supportingFunction = require('../../config/supportingFunction')
const emailConstant = require('../../config/emailConstant');
const constant = require("../../config/constant");
const sgMail = require('@sendgrid/mail');
const moment = require("moment");
sgMail.setApiKey(process.env.sendgrid_key);
const multer = require("multer");
const { default: mongoose } = require("mongoose");
const XLSX = require("xlsx");
const fs = require("fs");
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multerS3 = require('multer-s3');
const { default: axios } = require("axios");

// s3 bucket connections
const s3 = new S3Client({
  region: process.env.region,
  credentials: {
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
  }
});
const folderName = 'claimFile'; // Replace with your specific folder name
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

var imageUpload = multer({
  storage: StorageP,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).single("file");
var uploadP = multer({
  storage: StorageP,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB limit
  },
}).array("file", 100);


// get all claims api
exports.getAllClaims = async (req, res, next) => {
  try {
    let data = req.body
    let query = { isDeleted: false };
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    let match = {};
    let servicerMatch = {}
    // checking the user type from token
    if (req.role == 'Dealer') {
      match = { 'contracts.orders.dealerId': new mongoose.Types.ObjectId(req.userId) }
    }
    if (req.role == 'Customer') {
      match = { 'contracts.orders.customerId': new mongoose.Types.ObjectId(req.userId) }
    }
    // Get Claim for servicer
    if (req.role == 'Servicer') {
      servicerMatch = { servicerId: new mongoose.Types.ObjectId(req.userId) }
    }
    // building the query for claims
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
            $project: {
              "contractId": 1,
              "claimFile": 1,
              "lossDate": 1,
              "receiptImage": 1,
              reason: 1,
              "unique_key": 1,
              note: 1,
              totalAmount: 1,
              servicerId: 1,
              dealerSku: 1,
              customerStatus: 1,
              trackingNumber: 1,
              trackingType: 1,
              getcoverOverAmount: 1,
              customerOverAmount: 1,
              customerClaimAmount: 1,
              getCoverClaimAmount: 1,
              claimType: 1,
              repairParts: 1,
              diagnosis: 1,
              claimStatus: 1,
              repairStatus: 1,
              "contracts.unique_key": 1,
              "contracts.productName": 1,
              "contracts.coverageType": 1,
              "contracts.model": 1,
              "contracts.pName": 1,
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
              "contracts.orders.dealers.accountStatus": 1,
              "contracts.orders.dealers._id": 1,
              "contracts.orders.customer.username": 1,
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
                    "isServicer": "$$reseller.isServicer",
                    "status": "$$reseller.status"
                  }
                }
              }
            }
          },
        ]
      }
    })

    if (data.servicerName != '' && data.servicerName != undefined) {
      const checkServicer = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
      if (checkServicer.length > 0) {
        let servicerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer._id))
        let dealerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.dealerId))
        let resellerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.resellerId))
        servicerMatch = {
          $or: [
            { "servicerId": { $in: servicerIds } },
            { "servicerId": { $in: dealerIds } },
            { "servicerId": { $in: resellerIds } }
          ]
        };
      }
      else {
        servicerMatch = { 'servicerId': new mongoose.Types.ObjectId('5fa1c587ae2ac23e9c46510f') }
      }
    }

    let claimPaidStatus = {}
    if (data.claimPaidStatus != '' && data.claimPaidStatus != undefined) {
      claimPaidStatus = { "claimPaymentStatus": data.claimPaidStatus }
    }
    else {
      claimPaidStatus = {
        $or: [
          { "claimPaymentStatus": "Paid" },
          { "claimPaymentStatus": "Unpaid" },
        ]
      }
    }
    let lookupQuery = [
      { $sort: { unique_key_number: -1 } },
      {
        $match:
        {
          $and: [
            { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            claimPaidStatus,
            { 'productName': { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'dealerSku': { '$regex': data.dealerSku ? data.dealerSku.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
            { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
            { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
            servicerMatch
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
            { "contracts.orders.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { "contracts.orders.isDeleted": false },
            match
          ]
        },
      },
      {
        $lookup: {
          from: "dealers",
          localField: "contracts.orders.dealerId",
          foreignField: "_id",
          as: "contracts.orders.dealers",
        }
      },
      {
        $unwind: "$contracts.orders.dealers"
      },
      {
        $match:
        {
          "contracts.orders.dealers.name": { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' },
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
          ]
        },
      },
    ]

    if (newQuery.length > 0) {
      lookupQuery = lookupQuery.concat(newQuery);
    }
    let allClaims = await claimService.getClaimWithAggregate(lookupQuery);
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
    let servicer;
    //service call from claim services
    let allServicer = await servicerService.getAllServiceProvider(
      { _id: { $in: allServicerIds }, status: true },
      {}
    );

    const dynamicOption = await userService.getOptions({ name: 'coverage_type' })

    const result_Array = resultFiter.map((item1) => {
      servicer = []
      let mergedData = []
      if (Array.isArray(item1.contracts?.coverageType) && item1.contracts?.coverageType) {
        mergedData = dynamicOption.value.filter(contract =>
          item1.contracts?.coverageType?.find(opt => opt.value === contract.value)
        );
      }

      let servicerName = ''
      let selfServicer = false;
      let selfResellerServicer = false;
      let matchedServicerDetails = item1.contracts.orders.dealers.dealerServicer.map(matched => {
        const dealerOfServicer = allServicer.find(servicer => servicer._id.toString() === matched.servicerId?.toString());
        if (dealerOfServicer) {
          servicer.push(dealerOfServicer)
        }
      });

      if (item1.contracts.orders.servicers[0]?.length > 0) {
        servicer.unshift(item1.contracts.orders.servicers[0])
      }

      if (item1.contracts.orders.resellers[0]?.isServicer && item1.contracts.orders.resellers[0]?.status) {
        servicer.unshift(item1.contracts.orders.resellers[0])
      }

      if (item1.contracts.orders.dealers.isServicer && item1.contracts.orders.dealers.accountStatus) {
        servicer.unshift(item1.contracts.orders.dealers)
      }

      if (item1.servicerId != null) {
        servicerName = servicer.find(servicer => servicer?._id?.toString() === item1.servicerId?.toString());
        selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() ? true : false
        selfResellerServicer = item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString()
      }

      return {
        ...item1,
        servicerData: servicerName,
        selfResellerServicer: selfResellerServicer,
        selfServicer: selfServicer,
        contracts: {
          ...item1.contracts,
          allServicer: servicer,
          mergedData: mergedData
        }
      }
    })

    let totalCount = allClaims[0].totalRecords[0]?.total ? allClaims[0].totalRecords[0].total : 0 // getting the total count 

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

// get claims api admin
exports.getClaims = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let dealerIds = [];
    let customerIds = [];
    let resellerIds = [];
    let servicerIds = [];
    let userSearchCheck = 0
    let contractIds = []
    let contractCheck = 0
    let orderIds = []
    let mainQuery = []

    if (data.customerName != "") {
      userSearchCheck = 1
      let getData = await customerService.getAllCustomers({ username: { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      if (getData.length > 0) {
        customerIds = await getData.map(customer => customer._id)
      } else {
        customerIds.push("1111121ccf9d400000000000")
      }
    };
    if (data.servicerName != "") {
      userSearchCheck = 1
      let getData = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })

      if (getData.length > 0) {
        servicerIds = await getData.map(servicer => servicer._id)
      } else {
        servicerIds.push("1111121ccf9d400000000000")
      }
    };

    let orderAndCondition = []


    //making the query on the bases of search query payload
    if (dealerIds.length > 0) {
      orderAndCondition.push({ dealerId: { $in: dealerIds } })
    }
    if (customerIds.length > 0) {
      orderAndCondition.push({ customerId: { $in: customerIds } })
    }
    if (servicerIds.length > 0) {
      orderAndCondition.push({ servicerId: { $in: servicerIds } })
    }
    if (resellerIds.length > 0) {
      orderAndCondition.push({ resellerId: { $in: resellerIds } })
    }
    if (orderAndCondition.length > 0) {
      let getOrders = await orderService.getOrders({
        $and: orderAndCondition
      })
      if (getOrders.length > 0) {
        orderIds = await getOrders.map(order => order.unique_key)
      }
    }

    let claimFilter = [
      { unique_key: { '$regex': data.claimId ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      { serial: { '$regex': data.serial ? data.claimId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
      { 'customerStatus.status': { '$regex': data.customerStatusValue ? data.customerStatusValue : '', '$options': 'i' } },
      { venderOrder: { '$regex': data.venderOrder ? data.venderOrder : '', '$options': 'i' } },
      { 'repairStatus.status': { '$regex': data.repairStatus ? data.repairStatus : '', '$options': 'i' } },
      { 'claimStatus.status': { '$regex': data.claimStatus ? data.claimStatus : '', '$options': 'i' } },
    ]

    if (data.contractId != "") {
      let getContractId = await contractService.findContracts({ unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
      contractCheck = 1
      if (getContractId.length > 0) {
        contractIds = getContractId.map(ID => ID._id)
      } else {
        contractIds.push("1111121ccf9d400000000000")
      }
    }
    if (userSearchCheck == 1) {
      claimFilter.push({ orderId: { $in: orderIds } })
    }
    if (contractCheck == 1) {
      claimFilter.push({ contractId: { $in: contractIds } })
    }

    // checking if the user is searching or just getting the data
    if (data.contractId === "" && data.productName === "" && data.pName === "" && data.serial === "" && data.customerStatusValue && data.repairStatus === "" && data.claimStatus === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0 && contractCheck == 0) {
      mainQuery = [
        { $sort: { unique_key_number: -1 } },
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
              }
            ],
          },

        },
      ]
    } else {
      mainQuery = [
        { $sort: { unique_key_number: -1 } },
        {
          $match:
          {
            $and: claimFilter
          },
        },
      ]
      mainQuery.push({
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

          ],
        },

      })
    }

    let getClaims = await claimService.getClaimWithAggregate(mainQuery)

    res.send({
      code: constant.successCode,
      message: "Success",
      result: getClaims,
      query: mainQuery
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message, err: err.stack
    })
  }
}

//Get Unpaid claim value -- not using
exports.getUnpaidAmount = async (req, res, next) => {
  try {
    const ids = req.body.claimIds;
    const claimId = ids.map(id => new mongoose.Types.ObjectId(id))
    let claimTotalQuery = [
      { $match: { _id: { $in: claimId } } },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]
    const response = await claimService.getClaimWithAggregate(claimTotalQuery);
    res.send({
      code: constant.successCode,
      message: "Success!",
      result: {
        totalClaims: ids.length,
        unpaidValue: response[0]?.amount
      }
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get contract by id
exports.getContractById = async (req, res) => {
  try {
    let data = req.body
    let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
    let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
    let limitData = Number(pageLimit)
    // Get Claim Total of the contract
    const totalCreteria = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotalQuery = [
      { $match: totalCreteria },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]

    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
    let query = [
      {
        $match: { _id: new mongoose.Types.ObjectId(req.params.contractId) },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
          pipeline: [
            {
              $lookup: {
                from: "dealers",
                localField: "dealerId",
                foreignField: "_id",
                as: "dealer",
              }
            },
            {
              $lookup: {
                from: "resellers",
                localField: "resellerId",
                foreignField: "_id",
                as: "reseller",
              }
            },
            {
              $lookup: {
                from: "customers",
                localField: "customerId",
                foreignField: "_id",
                as: "customer",
              }
            },
            {
              $lookup: {
                from: "serviceproviders",
                localField: "servicerId",
                foreignField: "_id",
                as: "servicer",
              }
            },

          ],

        }
      },
    ]
    let getData = await contractService.getContracts(query, skipLimit, pageLimit)
    getData[0].claimAmount = 0;
    if (claimTotal.length > 0) {
      getData[0].claimAmount = claimTotal[0]?.amount
    }

    let orderId = getData[0].orderProductId
    let order = getData[0].order

    for (let i = 0; i < order.length; i++) {
      let productsArray = order[i].productsArray.filter(product => product._id.toString() == orderId.toString())
      productsArray[0].priceBook = await priceBookService.getPriceBookById({ _id: new mongoose.Types.ObjectId(productsArray[0]?.priceBookId) })
      getData[0].order[i].productsArray = productsArray
    }
    getData.map((data, index) => {
      if (data.order[0]?.servicerId != null) {
        if (data.order[0]?.dealer[0]?.isServicer && data.order[0]?.dealerId.toString() === data.order[0]?.servicerId.toString()) {
          data.order[0]?.servicer.push(data.order[0]?.dealer[0])
          getData[index] = data
        }
        if (data.order[0]?.reseller.length > 0) {
          if (data.order[0]?.reseller[0]?.isServicer && data.order[0]?.resellerId.toString() === data.order[0]?.servicerId.toString()) {
            data.order[0]?.servicer.push(data.order[0]?.reseller[0])
            getData[index] = data
          }

        }
      }

    })
    //Get dynamic options
    const dynamicOption = await userService.getOptions({ name: "coverage_type" })
    getData[0].mergedData = [];
    getData[0].adhDays.forEach(adhItem => {
      const matchedOption = dynamicOption.value.find(option => option.value === adhItem.value);
      if (matchedOption) {
        getData[0].mergedData.push(
          {
            label: matchedOption.label,
            value: adhItem.value,
            waitingDays: adhItem.waitingDays,
            deductible: adhItem.deductible,
            amountType: adhItem.amountType
          }
        );
      }
    });
    if (!getData) {
      res.send({
        code: constant.errorCode,
        message: "Unable to get contract"
      })
      return;
    }

    res.send({
      code: constant.successCode,
      message: "Success",
      result: getData[0]
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

//Get messages
exports.getMessages = async (req, res) => {

  const checkClaim = await claimService.getClaimById({ _id: req.params.claimId }, { isDeleted: false })
  if (!checkClaim) {
    res.send({
      code: constant.errorCode,
      message: 'Invalid Claim id!'
    })
    return;
  }

  let lookupQuery = [
    {
      $match:
      {
        $and: [
          { claimId: new mongoose.Types.ObjectId(req.params.claimId) }
        ]
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "commentedTo",
        foreignField: "metaId",
        as: "commentTo",
        pipeline: [
          {
            $match:
            {
              $and: [
                { isPrimary: true },
                { metaId: { $ne: null } }
              ]
            },
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
            }
          }
        ]

      }
    },
    { $unwind: { path: "$commentTo", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "commentedByUser",
        foreignField: "_id",
        as: "commentBy",
        pipeline: [
          {
            $lookup: {
              from: 'roles',
              localField: 'roleId',
              foreignField: '_id',
              as: 'roles'
            }
          },
          {
            $unwind: "$roles"
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              "roles.role": 1,
            }
          }
        ]
      }
    },
    { $unwind: { path: "$commentBy", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        date: 1,
        type: 1,
        messageFile: 1,
        content: 1,
        "commentBy": 1,
        "commentTo": 1,
      }
    }
  ]

  let allMessages = await claimService.getAllMessages(lookupQuery);
  res.send({
    code: constant.successCode,
    messages: 'Success!',
    result: allMessages
  })
}

//get max claim amout to claimed
exports.getMaxClaimAmount = async (req, res) => {
  try {
    const query = { contractId: new mongoose.Types.ObjectId(req.params.contractId) }
    let claimTotalQuery = [
      { $match: query },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]
    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
    const contract = await contractService.getContractById({ _id: req.params.contractId }, { productValue: 1 })
    const claimAmount = claimTotal[0]?.amount ? claimTotal[0]?.amount : 0
    const product = contract ? contract.productValue : 0
    res.send({
      code: constant.successCode,
      message: 'Success!',
      result: product - claimAmount
    })
  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

// get coverage type in claim
exports.getCoverageType = async (req, res) => {
  try {
    const checkContract = await contractService.getContractById({ _id: req.params.contractId });
    if (!checkContract) {
      res.send({
        code: constant.errorCode,
        message: "Unable to find Contract!"
      });
      return
    }
    const query = { _id: new mongoose.Types.ObjectId(checkContract.orderId) }

    const orderData = await orderService.getOrder(query, { isDeleted: false })

    res.send({
      code: constant.successCode,
      message: "Success!",
      result: checkOrder
    })

  }
  catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.checkClaimAmount = async (req, res) => {
  try {
    let data = req.body
    let getClaim = await claimService.getClaimById({ _id: req.params.claimId })
    if (!getClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }
    let getContractDetail = await contractService.getContractById({ _id: getClaim.contractId })

    const query = { contractId: new mongoose.Types.ObjectId(getClaim.contractId), claimFile: "completed" }
    let claimTotalQuery = [
      { $match: query },
      { $group: { _id: null, amount: { $sum: "$totalAmount" } } }

    ]
    let claimTotal = await claimService.getClaimWithAggregate(claimTotalQuery);
    const contract = await contractService.getContractById({ _id: getClaim.contractId }, { productValue: 1 })
    const claimAmount = claimTotal[0] ? claimTotal[0]?.amount : 0
    const product = contract ? contract.productValue : 0
    let claimAmountTaken = getClaim.totalAmount


    if (getClaim.claimType != "" && getClaim.claimType != "New") {
      console.log(")))))))))))))))))))))))))))))))))))))))))))))")
      let coverageTypeDays = getContractDetail.adhDays
      let getDeductible = coverageTypeDays.filter(coverageType => {
        return coverageType.value === getClaim.claimType;
      });
      if (!getDeductible[0]) {
        res.send({
          code: constant.errorCode,
          message: "Invalid coverage type choosen "
        })
        return
      }
      let deductableAmount;
      let checkClaimNumber = await claimService.getClaims({ contractId: getClaim.contractId })

      let justToCheck = product - claimAmount

      if (getDeductible[0].amountType == "percentage") {
        if (justToCheck > getClaim.totalAmount) {
          deductableAmount = (getDeductible[0].deductible / 100) * getClaim.totalAmount
        } else {
          deductableAmount = (getDeductible[0].deductible / 100) * justToCheck

        }
      } else {
        deductableAmount = getDeductible[0].deductible
      }





      if (getClaim.totalAmount > Number(justToCheck)) {
        console.log("over amount conditions ak ")
        let serviceCoverageType = getContractDetail.serviceCoverageType
        // let customerClaimAmount = deductableAmount < justToCheck ? deductableAmount : justToCheck
        // let getCoverClaimAmount = justToCheck - customerClaimAmount
        let customerClaimAmount
        let customerOverAmount
        let getcoverOverAmount
        let getCoverClaimAmount
        console.log("++++++++++++++++++++++ condition +++++++++++++++++++++=", justToCheck, getClaim.totalAmount)


        if (getClaim.totalAmount > Number(justToCheck)) {
          if (getContractDetail.isMaxClaimAmount) {
            console.log("1st condition +++++++++++++++++++++=", deductableAmount, getContractDetail.isMaxClaimAmount)
            if (deductableAmount >= justToCheck) {
              customerClaimAmount = deductableAmount > getClaim.totalAmount ? getClaim.totalAmount : deductableAmount
              getCoverClaimAmount = 0
              customerOverAmount = getClaim.totalAmount - (getCoverClaimAmount + customerClaimAmount)
              getcoverOverAmount = 0
            } else {
              customerClaimAmount = deductableAmount > getClaim.totalAmount ? getClaim.totalAmount : deductableAmount
              getCoverClaimAmount = justToCheck - customerClaimAmount
              customerOverAmount = getClaim.totalAmount - (getCoverClaimAmount + customerClaimAmount)
              getcoverOverAmount = 0
            }

          } else {
            if (deductableAmount >= justToCheck) {
              customerClaimAmount = deductableAmount
              customerOverAmount = 0
              getCoverClaimAmount = 0
              getcoverOverAmount = getClaim.totalAmount - (getCoverClaimAmount + customerClaimAmount)
            } else {
              customerClaimAmount = deductableAmount
              customerOverAmount = 0
              getCoverClaimAmount = justToCheck - deductableAmount
              getcoverOverAmount = getClaim.totalAmount - (getCoverClaimAmount + customerClaimAmount)
            }
            console.log("2nd t condition +++++++++++++++++++++=", getContractDetail.isMaxClaimAmount)
            // customerClaimAmount = deductableAmount > getClaim.totalAmount ? getClaim.totalAmount : deductableAmount
            // customerOverAmount = 0
            // getCoverClaimAmount = justToCheck > 0 ? getClaim.totalAmount >= justToCheck ? justToCheck : getClaim.totalAmount : 0
            // getcoverOverAmount = getClaim.totalAmount - (getCoverClaimAmount + customerClaimAmount)
          }
          let updateContract = await contractService.updateContract({ _id: getContractDetail._id }, { eligibilty: false })
        } else {
          customerClaimAmount = deductableAmount > getClaim.totalAmount ? getClaim.totalAmount : deductableAmount
          getCoverClaimAmount = justToCheck > 0 ? getClaim.totalAmount >= justToCheck ? justToCheck : getClaim.totalAmount : 0
          customerOverAmount = getClaim.totalAmount - (getCoverClaimAmount + customerClaimAmount)
          getcoverOverAmount = 0
        }
        console.log("updatetheclaim+++++++++++++++++++++++", { customerClaimAmount, getCoverClaimAmount, customerOverAmount, getcoverOverAmount })
        let values = {
          $set: {
            customerClaimAmount: customerClaimAmount > 0 ? customerClaimAmount : 0,
            getCoverClaimAmount: getCoverClaimAmount > 0 ? getCoverClaimAmount : 0,
            customerOverAmount: customerOverAmount > 0 ? customerOverAmount : 0,
            getcoverOverAmount: getcoverOverAmount > 0 ? getcoverOverAmount : 0

          }
        }
        console.log("updatetheclaim+++++++++++++++++++++++", values)

        let updateTheClaim = await claimService.updateClaim({ _id: getClaim._id }, values, { new: true })
        if (!updateTheClaim) {
          res.send({
            code: constant.errorCode,
            message: "Unable to update the claim amounts"
          })
        } else {
          res.send({
            code: constant.successCode,
            message: "Updated"
          })
        }


      } else {
        console.log("under amount conditions ak ")

        let totalClaimAmount = getClaim.totalAmount
        let customerClaimAmount
        if (totalClaimAmount < deductableAmount) {
          customerClaimAmount = totalClaimAmount
          getCoverClaimAmount = 0
        } else {
          customerClaimAmount = deductableAmount
          getCoverClaimAmount = totalClaimAmount - customerClaimAmount
        }

        let values = {
          $set: {
            customerClaimAmount: customerClaimAmount > 0 ? customerClaimAmount : 0,
            getCoverClaimAmount: getCoverClaimAmount > 0 ? getCoverClaimAmount : 0,
            customerOverAmount: 0,
            getcoverOverAmount: 0

          }
        }
        let updateTheClaim = await claimService.updateClaim({ _id: getClaim._id }, values, { new: true })
        if (!updateTheClaim) {
          res.send({
            code: constant.errorCode,
            message: "Unable to update the claim amounts"
          })
        } else {
          res.send({
            code: constant.successCode,
            message: "Updated"
          })
        }

      }


    } else {
      console.log("))))))))))))))))))))))))))))))))))))))))))--------)))", getClaim)

      let values = {
        $set: {
          customerClaimAmount: 0,
          getCoverClaimAmount: 0,
          customerOverAmount: 0,
          getcoverOverAmount: 0

        }
      }
      let updateTheClaim = await claimService.updateClaim({ _id: getClaim._id }, values, { new: true })

      res.send({
        code: constant.successCode,
        message: "Updated"
      })
    }

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.checkCoverageTypeDate = async (req, res) => {
  try {
    let data = req.body

    let getClaim = await claimService.getClaimById({ _id: data.claimId })
    if (!getClaim) {
      res.send({
        code: constant.errorCode,
        message: "Invalid claim ID"
      })
      return
    }
    let getContractDetail = await contractService.getContractById({ _id: getClaim.contractId })
    let startDateToCheck = new Date(getContractDetail.coverageStartDate)
    let coverageTypeDays = getContractDetail.adhDays
    let serviceCoverageType = getContractDetail.serviceCoverageType
    let claimAmountTaken = getClaim.totalAmount
    if (data.coverageType) {
      let getDeductible = coverageTypeDays.filter(coverageType => coverageType.value == data.coverageType)

      let checkCoverageTypeDate = startDateToCheck.setDate(startDateToCheck.getDate() + Number(getDeductible[0].waitingDays))

      let getCoverageTypeFromOption = await optionService.getOption({ name: "coverage_type" })
      console.log("getCoverageTypeFromOption", getCoverageTypeFromOption)
      const result = getCoverageTypeFromOption.value.filter(item => item.value === data.coverageType).map(item => item.label);
      console.log(result[0]);

      if (checkCoverageTypeDate > getClaim.lossDate) {
        // claim not allowed for that coverageType
        res.send({
          code: 403,
          tittle: `${result[0]} Not Eligible for the claim`,
          // message: `Claim not allowed for that coverage type till date ${new Date(checkCoverageTypeDate).toLocaleDateString('en-US')}`
          message: `Your selected ${result[0]} is currently not eligible for the claim. You can file the claim for ${result[0]} on ${new Date(checkCoverageTypeDate).toLocaleDateString('en-US')}. Do you wish to proceed in rejecting this claim?`
        })
        return

      }
    }
    res.send({
      code: 200,
      message: "Allowed"
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

exports.checkCoverageTypeDateInContract = async (req, res) => {
  try {
    let data = req.body

    let getContractDetail = await contractService.getContractById({ _id: data.contractId })
    let startDateToCheck = new Date(getContractDetail.coverageStartDate)
    let coverageTypeDays = getContractDetail.adhDays
    let serviceCoverageType = getContractDetail.serviceCoverageType
    let claimAmountTaken = getClaim.totalAmount
    if (data.coverageType) {
      let getDeductible = coverageTypeDays.filter(coverageType => coverageType.value == data.coverageType)

      let checkCoverageTypeDate = startDateToCheck.setDate(startDateToCheck.getDate() + Number(getDeductible[0].waitingDays))

      if (checkCoverageTypeDate > data.lossDate) {
        // claim not allowed for that coverageType
        res.send({
          code: constant.errorCode,
          message: `Claim not allowed for that coverage type till date ${new Date(checkCoverageTypeDate).toLocaleDateString('en-US')}`
        })
        return

      }
    }
    res.send({
      code: 200,
      message: "Allowed"
    })

  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}

