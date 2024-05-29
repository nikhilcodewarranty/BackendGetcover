require('dotenv').config()
const USER = require('../../User/model/users')
const dealerResourceResponse = require("../utils/constant");
const dealerService = require("../services/dealerService");
const orderService = require("../../Order/services/orderService");
const contractService = require("../../Contract/services/contractService");
const resellerService = require("../services/resellerService");
let claimService = require('../../Claim/services/claimService')
const randtoken = require('rand-token').generator()
const LOG = require('../../User/model/logs')

const dealerRelationService = require("../services/dealerRelationService");
const customerService = require("../../Customer/services/customerService");
const dealerPriceService = require("../services/dealerPriceService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const dealerRelation = require("../../Provider/model/dealerServicer")
const providerService = require("../../Provider/services/providerService")
const userService = require("../../User/services/userService");
const role = require("../../User/model/role");
const dealer = require("../model/dealer");
const constant = require('../../config/constant')
const bcrypt = require("bcrypt");
const XLSX = require("xlsx");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const emailConstant = require('../../config/emailConstant');
const mongoose = require('mongoose');
const fs = require('fs');
const json2csv = require('json-2-csv').json2csv;
const connection = require('../../db')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.sendgrid_key);
const supportingFunction = require('../../config/supportingFunction')


exports.createReseller = async (req, res) => {
    try {
        let data = req.body
        let getCount = await resellerService.getResellersCount({})
        data.unique_key = getCount[0] ? getCount[0].unique_key + 1 : 1
        data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
        // check dealer for existing 
        let checkDealer = await dealerService.getDealerByName({ _id: data.dealerName }, {});
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer"
            })
            return;
        };
        let checkName = await resellerService.getReseller({ name: new RegExp(`^${data.accountName}$`, 'i'), dealerId: data.dealerName }, {})
        if (checkName) {
            res.send({
                code: constant.errorCode,
                message: "Reseller already exist with this account name"
            })
            return;
        };
        let checkCustomerEmail = await userService.findOneUser({ email: data.email });
        if (checkCustomerEmail) {
            res.send({
                code: constant.errorCode,
                message: "Primary user email already exist"
            })
            return;
        }
        let isAccountCreate = data.status
        let resellerObject = {
            name: data.accountName,
            street: data.street,
            city: data.city,
            dealerId: checkDealer._id,
            zip: data.zip,
            state: data.state,
            country: data.country,
            isServicer: data.isServicer ? data.isServicer : false,
            status: true,
            isAccountCreate: isAccountCreate,
            unique_key: data.unique_key,
            accountStatus: "Approved",
            dealerName: checkDealer.name,
        }
        // data.members[0].status = true
        let teamMembers = data.members
        // let emailsToCheck = teamMembers.map(member => member.email);
        // let queryEmails = { email: { $in: emailsToCheck } };
        // let checkEmails = await customerService.getAllCustomers(queryEmails, {});
        // if (checkEmails.length > 0) {
        //     res.send({
        //         code: constant.errorCode,
        //         message: "Some email ids already exist"
        //     })
        // }

        const createdReseler = await resellerService.createReseller(resellerObject);
        if (!createdReseler) {
            res.send({
                code: constant.errorCode,
                message: "Unable to create the reseller"
            })
            return;
        };
        //Send Notification to reseller and admin

        let IDs = await supportingFunction.getUserIds()
        IDs.push(checkDealer._id)
        IDs.push(createdReseler._id)

        let notificationData = {
            title: "Reseller Account Creation",
            description: data.accountName + " " + "reseller account has been created successfully!",
            userId: createdReseler._id,
            flag: 'reseller',
            notificationFor: IDs
        };

        let createNotification = await userService.createNotification(notificationData);

        // Create the user
        teamMembers = teamMembers.map(member => ({ ...member, accountId: createdReseler._id, metaId: createdReseler._id, roleId: '65bb94b4b68e5a4a62a0b563' }));
        // create members account 
        let saveMembers = await userService.insertManyUser(teamMembers)
        if (data.status) {
            for (let i = 0; i < saveMembers.length; i++) {
                if (saveMembers[i].status) {
                    let email = saveMembers[i].email
                    let userId = saveMembers[i]._id
                    let resetPasswordCode = randtoken.generate(4, '123456789')
                    let checkPrimaryEmail2 = await userService.updateSingleUser({ email: email }, { resetPasswordCode: resetPasswordCode }, { new: true });
                    let resetLink = `${process.env.SITE_URL}newPassword/${checkPrimaryEmail2._id}/${resetPasswordCode}`
                    const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail2.email, { link: resetLink, role: req.role, servicerName: data?.accountName }))
                }

            }
            // let resetPrimaryCode = randtoken.generate(4, '123456789')
            // let checkPrimaryEmail1 = await userService.updateSingleUser({ email: data.email, isPrimary: true }, { resetPasswordCode: resetPrimaryCode }, { new: true });

            // let resetLink = `http://15.207.221.207/newPassword/${checkPrimaryEmail1._id}/${resetPrimaryCode}`
            // const mailing = sgMail.send(emailConstant.servicerApproval(checkPrimaryEmail1.email, { link: resetLink }))
        }

        if (data.isServicer) {
            const CountServicer = await providerService.getServicerCount();
            let servicerObject = {
                name: data.accountName,
                street: data.street,
                city: data.city,
                zip: data.zip,
                resellerId: createdReseler._id,
                state: data.state,
                country: data.country,
                status: data.status,
                accountStatus: "Approved",
                unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
            }
            let createData = await providerService.createServiceProvider(servicerObject)
        }
        //Save Logs create reseller
        let logData = {
            userId: req.userId,
            endpoint: "reseller/createReseller",
            body: data,
            response: {
                code: constant.successCode,
                message: "Reseller created successfully",
                result: createdReseler
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.successCode,
            message: "Reseller created successfully",
            result: data
        })


    } catch (err) {
        //Save Logs create reseller
        let logData = {
            userId: req.userId,
            endpoint: "reseller/createReseller catch",
            body: req.body ? req.body : { "type": "Catch Error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getAllResellers = async (req, res) => {
    try {
        let data = req.body
        let query = { isDeleted: false }
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
        const resellerOrderIds = resellers.map(obj => obj._id);
        const queryUser = { accountId: { $in: resellerId }, isPrimary: true };

        let getPrimaryUser = await userService.findUserforCustomer(queryUser)

        //Get Reseller Orders

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

        let orderQuery = { resellerId: { $in: resellerOrderIds }, status: "Active" };

        let ordersData = await orderService.getAllOrderInCustomers(orderQuery, project, "$resellerId")

        //console.log("ordersData=================",ordersData);

        const result_Array = getPrimaryUser.map(item1 => {
            const matchingItem = resellers.find(item2 => item2._id.toString() === item1.accountId.toString());
            const orders = ordersData.find(order => order._id.toString() === item1.accountId.toString())
            if (matchingItem || orders) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    resellerData: matchingItem.toObject(),
                    orders: orders ? orders : {}
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
            console.log('search check ++++++++++++', entry)
            return (
                nameRegex.test(entry.resellerData.name) &&
                emailRegex.test(entry.email) &&
                dealerRegex.test(entry.resellerData.dealerName) &&
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

exports.getResellerByDealerId = async (req, res) => {
    if (req.role != "Super Admin") {
        res.send({
            code: constant.errorCode,
            message: "Only super admin allow to do this action"
        })
        return;
    }
    const dealers = await dealerService.getSingleDealerById({ _id: req.params.dealerId }, { accountStatus: 1 });

    //result.metaData = singleDealer
    if (!dealers) {
        res.send({
            code: constant.errorCode,
            message: "Dealer not found"
        });
        return;
    };
    let resellerData = await resellerService.getResellers({ dealerId: req.params.dealerId }, { isDeleted: 0 })
    const resellerIds = resellerData.map(reseller => reseller._id.toString())
    const queryUser = { accountId: { $in: resellerIds }, isPrimary: true };
    let getPrimaryUser = await userService.findUserforCustomer(queryUser)
    const result_Array = getPrimaryUser.map(item1 => {
        const matchingItem = resellerData.find(item2 => item2._id.toString() === item1.accountId.toString());

        if (matchingItem) {
            return {
                ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                resellerData: matchingItem.toObject()
            };
        } else {
            return resellerData.toObject();
        }
    });
    res.send({
        code: constant.successCode,
        message: "Success",
        result: result_Array
    });
}

exports.getResellerById = async (req, res) => {
    // if (req.role != "Super Admin") {
    //     res.send({
    //         code: constant.errorCode,
    //         message: "Only super admin allow to do this action"
    //     })
    //     return;
    // }
    let checkReseller = await resellerService.getResellers({ _id: req.params.resellerId }, { isDeleted: 0 });

    if (!checkReseller[0]) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found'
        })
        return;
    }
    let checkDealerStatus = await dealerService.getDealerByName({ _id: checkReseller[0].dealerId })
    const query1 = { accountId: { $in: [checkReseller[0]._id] }, isPrimary: true };
    let resellerUser = await userService.getMembers(query1, { isDeleted: false })
    if (!resellerUser) {
        res.send({
            code: constant.errorCode,
            message: 'Primary user not found of this reseller'
        })
        return;
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

    let orderQuery = {
        $and: [
            { resellerId: { $in: [checkReseller[0]._id] }, status: "Active" },
        ]
    }
    let ordersResult = await orderService.getAllOrderInCustomers(orderQuery, project, "$resellerId");

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
                    { "contracts.orders.resellerId": new mongoose.Types.ObjectId(req.params.resellerId) },
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
                    { "contracts.orders.resellerId": new mongoose.Types.ObjectId(req.params.resellerId) },
                ]
            },
        },
    ]
    let numberOfClaims = await claimService.getAllClaims(numberOfCompleletedClaims);
    const claimData = {
        numberOfClaims: numberOfClaims.length,
        valueClaim: valueClaim[0]?.totalAmount
    }
    const result_Array = resellerUser.map(user => {
        let matchItem = checkReseller.find(reseller => reseller._id.toString() == user.accountId.toString());
        let order = ordersResult.find(order => order._id.toString() === user.accountId.toString())
        if (matchItem || order) {
            return {
                ...user.toObject(),
                resellerData: matchItem.toObject(),
                orderData: order ? order : {},
                claimData: claimData
            }
        }
        else {
            return {
                ...user.toObject(),
                resellerData: {}
            }
        }
    })

    res.send({
        code: constant.successCode,
        message: "Success",
        reseller: result_Array,
        dealerStatus: checkDealerStatus.accountStatus
    })


}

exports.getResellerUsers = async (req, res) => {
    // if (req.role != "Super Admin") {
    //     res.send({
    //         code: constant.errorCode,
    //         message: "Only super admin allow to do this action"
    //     })
    //     return;
    // }

    let data = req.body

    let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 })
    if (!checkReseller) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found!'
        });
        return;
    }
    const queryUser = {
        $and: [
            { accountId: { $in: checkReseller._id } },
            { firstName: { '$regex': data.firstName ? data.firstName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { lastName: { '$regex': data.lastName ? data.lastName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { email: { '$regex': data.email ? data.email.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            { phoneNumber: { '$regex': data.phone ? data.phone : '', '$options': 'i' } },
        ]
    }
    console.log('skdsdjsdk---------------', queryUser, data)
    let users = await userService.getMembers(queryUser, { isDeleted: 0 });
    res.send({
        code: constant.successCode,
        data: users,
        resellerStatus: checkReseller.status,
        isAccountCreate: checkReseller.isAccountCreate
    });
    return;
}

exports.getResellerPriceBook = async (req, res) => {
    if (req.role != "Super Admin") {
        res.send({
            code: constant.errorCode,
            message: "Only super admin allow to do this action"
        })
        return;
    }
    let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 })
    if (!checkReseller) {
        res.send({
            code: constant.errorCode,
            message: 'Reseller not found!'
        });
        return;
    }

    let checkDealer = await dealerService.getDealerById(checkReseller.dealerId, { isDeleted: false });
    if (!checkDealer) {
        res.send({
            code: constant.errorCode,
            message: 'Dealer not found of this reseller!'
        });
        return;
    }

    let queryCategories = {
        $and: [
            { isDeleted: false },
            { 'name': { '$regex': req.body.category ? req.body.category.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } }
        ]
    };
    const data = req.body
    let getCatIds = await priceBookService.getAllPriceCat(queryCategories, {})
    let catIdsArray = getCatIds.map(category => category._id)
    let searchName = req.body.name ? req.body.name : ''
    let projection = { isDeleted: 0, __v: 0 }
    let query
    //  = {
    //     $and: [
    //         { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
    //         { 'priceBooks.category._id': { $in: catIdsArray } },
    //         { 'status': true },
    //         {
    //             dealerId: new mongoose.Types.ObjectId(checkDealer._id)
    //         },
    //         {
    //             isDeleted: false
    //         }
    //     ]
    // }


    if (checkDealer.coverageType == "Breakdown & Accidental") {
        query = {
            $and: [
                { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                { 'priceBooks.category._id': { $in: catIdsArray } },
                { 'status': true },
                {
                    dealerId: new mongoose.Types.ObjectId(checkDealer._id)
                },
                {
                    isDeleted: false
                }
            ]
        }
    } else {
        query = {
            $and: [
                { 'priceBooks.name': { '$regex': searchName, '$options': 'i' } },
                { 'priceBooks.coverageType': checkDealer.coverageType },
                { 'priceBooks.category._id': { $in: catIdsArray } },
                { 'status': true },
                {
                    dealerId: new mongoose.Types.ObjectId(checkDealer._id)
                },
                {
                    isDeleted: false
                }
            ]
        }
    }


    if (data.term != '') {
        query.$and.push({ 'priceBooks.term': Number(data.term) });
    }

    if (data.priceType != '') {
        query.$and.push({ 'priceBooks.priceType': data.priceType });
        if (data.priceType == 'Flat Pricing') {
            if (data.range != '') {
                query.$and.push({ 'priceBooks.rangeStart': { $lte: Number(data.range) } });
                query.$and.push({ 'priceBooks.rangeEnd': { $gte: Number(data.range) } });
            }

            // const flatQuery = {
            //   $and: [
            //     { 'rangeStart': { $lte: Number(data.range) } },
            //     { 'rangeEnd': { $gte: Number(data.range) } }, 
            //   ]
            // } 
            // query.$and.push(flatQuery);
        }
    }
    //  let query = { isDeleted: false, dealerId: new mongoose.Types.ObjectId(checkDealer._id), status: true }
    let getResellerPriceBook = await dealerPriceService.getAllPriceBooksByFilter(query, projection)
    if (!getResellerPriceBook) {
        res.send({
            code: constant.errorCode,
            message: 'Unable to find price books!'
        });
        return;
    }

    res.send({
        code: constant.successCode,
        message: "Success",
        result: getResellerPriceBook
    })


}

exports.editResellers = async (req, res) => {
    try {
        let data = req.body
        let criteria = { _id: req.params.resellerId }
        data.accountName = data.accountName.trim().replace(/\s+/g, ' ');
        data.oldName = data.oldName.trim().replace(/\s+/g, ' ');
        let option = { new: true }
        let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 });
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid reseller ID"
            })
            return;
        }
        if (data.oldName != data.accountName) {
            let checkName = await resellerService.getReseller({ name: new RegExp(`^${data.accountName}$`, 'i'), dealerId: data.dealerName }, {})
            if (checkName) {
                res.send({
                    code: constant.errorCode,
                    message: "Reseller already exist with this account name"
                })
                return;
            };
        }
        data.name = data.accountName
        let updateReseller = await resellerService.updateReseller(criteria, data)
        if (!updateReseller) {
            //Save Logs update reseller
            let logData = {
                userId: req.userId,
                endpoint: "/reseller/editResellers",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to update the data"
                }
            }
            await LOG(logData).save()

            res.send({
                code: constant.errorCode,
                message: "Unable to update the data"
            })
            return;
        }
        const servicerMeta = {
            name: data.accountName,
            city: data.city,
            country: data.country,
            street: data.street,
            zip: data.zip
        }
        const updateServicerMeta = await providerService.updateServiceProvider({ resellerId: req.params.resellerId }, servicerMeta)
        // if (checkReseller.isServicer) {
        //     const updateServicerMeta = await providerService.updateServiceProvider({ resellerId: req.params.resellerId }, data)
        // }
        if (data.isServicer && !checkReseller.isServicer) {
            const CountServicer = await providerService.getServicerCount();
            let servicerObject = {
                name: data.accountName,
                street: data.street,
                city: data.city,
                zip: data.zip,
                resellerId: req.params.resellerId,
                state: data.state,
                country: data.country,
                status: data.status,
                accountStatus: "Approved",
                unique_key: Number(CountServicer.length > 0 && CountServicer[0].unique_key ? CountServicer[0].unique_key : 0) + 1
            }
            let createData = await providerService.createServiceProvider(servicerObject)

        }
        let resellerUserCreateria = { accountId: req.params.resellerId };
        let newValue = {
            status: false
        };
        if (data.isAccountCreate && checkReseller.status) {
            console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$",)
            resellerUserCreateria = { accountId: req.params.resellerId, isPrimary: true };
            newValue = {
                status: true
            };
        }

        console.log("$$$------------------------------------------", resellerUserCreateria, newValue)
        const changeResellerUser = await userService.updateUser(resellerUserCreateria, newValue, { new: true });

        //Send notification to admin,dealer,reseller

        let IDs = await supportingFunction.getUserIds()

        let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkReseller.dealerId, isPrimary: true })

        let resellerPrimary = await supportingFunction.getPrimaryUser({ accountId: checkReseller._id, isPrimary: true })

        IDs.push(dealerPrimary._id)

        IDs.push(resellerPrimary._id)

        let notificationData = {
            title: "Reseller updated",
            description: checkReseller.name + " , " + "details has been updated",
            userId: checkReseller._id,
            flag: 'reseller',
            notificationFor: IDs
        };
        // save notification
        let createNotification = await userService.createNotification(notificationData);

        // Send Email code here
        let notificationEmails = await supportingFunction.getUserEmails();
        notificationEmails.push(resellerPrimary.email);
        notificationEmails.push(dealerPrimary.email);
        // const notificationContent = {
        //   content: "The dealer" + checkDealer.name + " "+ " has been updated succeefully!"
        // }    
        // let emailData = {
        //     dealerName: checkReseller.name,
        //     c1: "The Reseller",
        //     c2: checkReseller.name,
        //     c3: "has been updated successfully!.",
        //     c4: "",
        //     c5: "",
        //     role: "Servicer"
        // }

        let emailData = {
            senderName: checkReseller.name,
            content: "Information has been updated successfully! effective immediately."
        }

        let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, "Update Info", emailData))

        //Save Logs update reseller
        let logData = {
            userId: req.userId,
            endpoint: "/reseller/editResellers",
            body: data,
            response: {
                code: constant.successCode,
                message: "Success",
                result: updateReseller
            }
        }
        await LOG(logData).save()

        res.send({
            code: constant.successCode,
            message: "Success",
            result: updateReseller
        })

    }
    catch (err) {
        //Save Logs update reseller
        let logData = {
            userId: req.userId,
            endpoint: "/reseller/editResellers catch",
            body: req.body,
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()

        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.addResellerUser = async (req, res) => {
    try {
        let data = req.body
        let checkReseller = await resellerService.getReseller({ _id: data.resellerId }, {})
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid Reseller ID"
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
        let checkUser = await userService.getUserById1({ accountId: data.resellerId, isPrimary: true }, { isDeleted: false })
        data.status = checkUser.status == 'no' || !checkUser.status || checkUser.status == 'false' ? false : true;
        data.accountId = checkReseller._id
        data.metaId = checkReseller._id
        data.roleId = '65bb94b4b68e5a4a62a0b563'
        let statusCheck;
        if (!checkReseller.status) {
            statusCheck = false
        } else {
            statusCheck = data.status
        }
        data.status = statusCheck
        let saveData = await userService.createUser(data)
        if (!saveData) {
            //Save Logs add reseller user
            let logData = {
                userId: req.userId,
                endpoint: "reseller/addResellerUser",
                body: data,
                response: {
                    code: constant.errorCode,
                    message: "Unable to add the data",
                    result: saveData
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: "Unable to add the data"
            })
        } else {
            //Save Logs add reseller user
            let logData = {
                userId: req.userId,
                endpoint: "reseller/addResellerUser",
                body: data,
                response: {
                    code: constant.successCode,
                    message: "Added successfully",
                    result: saveData
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.successCode,
                message: "Added successfully",
                result: saveData
            })
        }
    } catch (err) {
        //Save Logs add reseller user
        let logData = {
            userId: req.userId,
            endpoint: "reseller/addResellerUser catch",
            body: req.body ? req.body : { "type": "Catch Error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}
//Get Reseller Servicer
exports.getResellerServicers = async (req, res) => {
    try {
        let data = req.body

        let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId })
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: "Invalid Reseller ID"
            })
            return;
        }
        let checkDealer = await dealerService.getDealerByName({ _id: checkReseller.dealerId })
        if (!checkDealer) {
            res.send({
                code: constant.errorCode,
                message: "Invalid dealer ID"
            })
            return;
        }
        let result_Array = []
        //Get Dealer Servicer
        let getServicersIds = await dealerRelationService.getDealerRelations({ dealerId: checkReseller.dealerId })
        if (!getServicersIds) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicer"
            })
            return;
        }
        let ids = getServicersIds.map((item) => item.servicerId)
        var servicer = await providerService.getAllServiceProvider({ _id: { $in: ids } }, {})
        if (!servicer) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the servicers"
            })
            return;
        }
        if (checkDealer.isServicer) {
            servicer.unshift(checkDealer);
        }

        if (checkReseller.isServicer) {
            //servicer = await providerService.getAllServiceProvider({ resellerId: checkReseller._id }, { isDeleted: 0 })
            servicer.unshift(checkReseller);
        }

        const servicerIds = servicer.map(obj => obj._id);

        // Get servicer with claim
        const servicerClaimsIds = { servicerId: { $in: servicerIds }, claimFile: { $ne: "Rejected" } };

        const servicerCompleted = { servicerId: { $in: servicerIds }, claimFile: "Completed" };

        let valueClaim = await claimService.getServicerClaimsValue(servicerCompleted, "$servicerId");
        let numberOfClaims = await claimService.getServicerClaimsNumber(servicerClaimsIds, "$servicerId");

        const query1 = { accountId: { $in: servicerIds }, isPrimary: true };
        let servicerUser = await userService.getMembers(query1, {})
        if (!servicerUser) {
            res.send({
                code: constant.errorCode,
                message: "Unable to fetch the data"
            });
            return;
        };

        result_Array = servicer.map(servicer => {
            const matchingItem = servicerUser.find(user => user.accountId.toString() === servicer._id.toString())
            const claimValue = valueClaim.find(claim => claim._id.toString() === servicer._id.toString())
            const claimNumber = numberOfClaims.find(claim => claim._id.toString() === servicer._id.toString())
            if (matchingItem) {
                return {
                    ...matchingItem.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerData: servicer.toObject(),
                    claimValue: claimValue ? claimValue : {
                        totalAmount: 0
                    },
                    claimNumber: claimNumber ? claimNumber : { noOfOrders: 0 }
                };
            } else {
                return servicer.toObject();
            }
        })

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
            data: filteredData,
            resellerStatus: checkReseller.status
        });
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }



    // result_Array = servicerUser.map(item1 => {
    //     const matchingItem = servicer.find(item2 => item2._id.toString() === item1.accountId.toString());

    //     if (matchingItem) {
    //         return {
    //             ...item1.toObject(), // Use toObject() to convert Mongoose document to plain JavaScript object
    //             servicerData: matchingItem.toObject()
    //         };
    //     } else {
    //         return servicerUser.toObject();
    //     }
    // });





}

exports.getResselerByCustomer = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }
        let checkCustomer = await customerService.getCustomerById({ _id: req.params.customerId }, { isDeleted: 0 })
        if (!checkCustomer) {
            res.send({
                code: constant.errorCode,
                message: 'Customer not found!'
            });
            return;
        }

        let checkReseller = await resellerService.getReseller({ _id: checkCustomer.resellerId });

        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: 'Reseller not found of this customer!'
            })
        }

        res.send({
            code: constant.successCode,
            data: checkReseller
        })
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }


}

exports.getDealerByReseller = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }

        let checkReseller = await resellerService.getReseller({ _id: req.params.resellerId }, { isDeleted: 0 });
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: 'Reseller not found'
            });
            return;
        }

        let dealer = await dealerService.getDealerById(checkReseller.dealerId, { isDeleted: 0 });

        res.send({
            code: constant.successCode,
            result: dealer
        })
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }

}

exports.getResellerOrders = async (req, res) => {
    try {
        // if (req.role != 'Super Admin') {
        //     res.send({
        //         code: constant.errorCode,
        //         message: 'Only super admin allow to do this action!'

        //     })
        //     return;
        // }
        let query = { _id: req.params.resellerId };
        let data = req.body
        let projection = { isDeleted: 0 }
        let checkReseller = await resellerService.getReseller(query, projection)
        if (!checkReseller) {
            res.send({
                code: constant.errorCode,
                message: 'Reseller not found!'
            })
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
        // let project = {
        //     productsArray: 1,
        //     dealerId: 1,
        //     unique_key: 1,
        //     servicerId: 1,
        //     customerId: 1,
        //     resellerId: 1,
        //     paymentStatus: 1,
        //     status: 1,
        //     venderOrder: 1,
        //     orderAmount: 1,
        // }

        // let orderQuery = { resellerId: new mongoose.Types.ObjectId(req.params.resellerId), status: { $ne: "Archieved" } }
        // let ordersResult = await orderService.getAllOrders(orderQuery, project)

        let query1 = { status: { $ne: "Archieved" }, resellerId: new mongoose.Types.ObjectId(req.params.resellerId) };

        let lookupQuery = [
            {
                $match: query1
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
        //Get Respective dealer
        let dealerIdsArray = ordersResult.map((result) => result.dealerId);
        const dealerCreateria = { _id: { $in: dealerIdsArray } };
        let userDealerIds = ordersResult.map((result) => result.dealerId?.toString());
        let userResellerIds = ordersResult
            .filter(result => result.resellerId !== null)
            .map(result => result.resellerId?.toString());

        let mergedArray = userDealerIds.concat(userResellerIds);
        //Get Respective Dealers
        let respectiveDealers = await dealerService.getAllDealers(dealerCreateria, {
            name: 1,
            isServicer: 1,
        });
        //Get Order Customer
        let customerIdsArray = ordersResult.map((result) => result.customerId);
        const customerCreteria = { _id: { $in: customerIdsArray } };
        let respectiveCustomer = await customerService.getAllCustomers(
            customerCreteria,
            { username: 1 }
        );
        //Get Respective Reseller

        let resellerIdsArray = ordersResult.map((result) => result.resellerId);
        const resellerCreteria = { _id: { $in: resellerIdsArray } };
        let respectiveReseller = await resellerService.getResellers(
            resellerCreteria,
            { name: 1, isServicer: 1 }
        );

        let servicerIdArray = ordersResult.map((result) => result.servicerId);
        const servicerCreteria = {
            $or: [
                { _id: { $in: servicerIdArray } },
                { resellerId: { $in: servicerIdArray } },
                { dealerId: { $in: servicerIdArray } },
            ],
        };
        //Get Respective Servicer
        let respectiveServicer = await providerService.getAllServiceProvider(
            servicerCreteria,
            { name: 1 }
        );

        let userCustomerIds = ordersResult
            .filter(result => result.customerId !== null)
            .map(result => result.customerId?.toString());

        const allUserIds = mergedArray.concat(userCustomerIds);


        const queryUser = { accountId: { $in: allUserIds }, isPrimary: true };

        let getPrimaryUser = await userService.findUserforCustomer(queryUser)
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
                            item2._id.toString() === item1.servicerId?.toString() ||
                            item2.resellerId === item1.servicerId
                    )
                    : null;
            const customerName =
                item1.customerId != null
                    ? respectiveCustomer.find(
                        (item2) => item2._id.toString() === item1.customerId?.toString()
                    )
                    : null;
            const resellerName =
                item1.resellerId != null
                    ? respectiveReseller.find(
                        (item2) => item2._id.toString() === item1.resellerId?.toString()
                    )
                    : null;
            if (dealerName || customerName || servicerName || resellerName) {
                return {
                    ...item1, // Use toObject() to convert Mongoose document to plain JavaScript object
                    servicerName: servicerName ? servicerName.toObject() : {},
                    dealerName: dealerName ? dealerName.toObject() : dealerName,
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
            data.unique_key ? data.unique_key.trim() : "",
            "i"
        );
        const venderOrderRegex = new RegExp(
            data.venderOrder ? data.venderOrder.trim() : "",
            "i"
        );
        const status = new RegExp(data.status ? data.status.trim() : "", "i");

        let filteredData = result_Array.filter((entry) => {
            return (
                unique_keyRegex.test(entry.unique_key) &&
                venderOrderRegex.test(entry.venderOrder) &&
                status.test(entry.status)
            );
        });
        // const updatedArray = filteredData.map((item) => ({
        //     ...item,
        //     servicerName: item.dealerName.isServicer
        //         ? item.dealerName
        //         : item.resellerName.isServicer
        //             ? item.resellerName
        //             : item.servicerName,
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
            if (item.customerId != null && coverageStartDate && fileName && item.paymentStatus != 'Paid') {
                item.flag = true
            }
            if (item.dealerName) {
                username = getPrimaryUser.find(user => user.accountId.toString() === item.dealerName._id.toString());
            }
            if (item.resellerName) {
                resellerUsername = item.resellerName._id != null ? getPrimaryUser.find(user => user.accountId?.toString() === item.resellerName._id?.toString()) : {};
            }
            if (item.customerName) {
                customerUserData = item.customerName._id != null ? getPrimaryUser.find(user => user.accountId?.toString() === item.customerName._id?.toString()) : {};
            }
            return {
                ...item,
                servicerName: item.dealerName.isServicer && item.servicerId != null ? item.dealerName : item.resellerName.isServicer && item.servicerId != null ? item.resellerName : item.servicerName,
                username: username, // Set username based on the conditional checks
                resellerUsername: resellerUsername ? resellerUsername : {},
                customerUserData: customerUserData ? customerUserData : {}
            };
        });

        const orderIdRegex = new RegExp(data.orderId ? data.orderId : '', 'i')
        const venderRegex = new RegExp(data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', 'i')
        const dealerNameRegex = new RegExp(data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const servicerNameRegex = new RegExp(data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const customerNameRegex = new RegExp(data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const resellerNameRegex = new RegExp(data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', 'i')
        const statusRegex = new RegExp(data.status ? data.status : '', 'i')

        const filteredData1 = updatedArray.filter(entry => {
            return (
                venderRegex.test(entry.venderOrder) &&
                orderIdRegex.test(entry.unique_key) &&
                dealerNameRegex.test(entry.dealerName.name) &&
                servicerNameRegex.test(entry.servicerName.name) &&
                customerNameRegex.test(entry.customerName.name) &&
                resellerNameRegex.test(entry.resellerName.name) &&
                statusRegex.test(entry.status)
            );
        });


        res.send({
            code: constant.successCode,
            message: 'Success',
            result: filteredData1
        })
    }
    catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })

    }
}

// exports.getResellerContract = async (req, res) => {
//     try {
//         let data = req.body
//         let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
//         let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
//         let limitData = Number(pageLimit)
//         let dealerIds = [];
//         let customerIds = [];
//         let resellerIds = [];
//         let servicerIds = [];
//         let userSearchCheck = 0
//         console.log('tesinggi------------')
//         if (data.dealerName != "") {
//             userSearchCheck = 1
//             let getData = await dealerService.getAllDealers({ name: { '$regex': data.dealerName ? data.dealerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
//             if (getData.length > 0) {
//                 dealerIds = await getData.map(dealer => dealer._id)
//             } else {
//                 dealerIds.push("1111121ccf9d400000000000")
//             }
//         };
//         if (data.customerName != "") {
//             userSearchCheck = 1
//             let getData = await customerService.getAllCustomers({ username: { '$regex': data.customerName ? data.customerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
//             if (getData.length > 0) {
//                 customerIds = await getData.map(customer => customer._id)
//             } else {
//                 customerIds.push("1111121ccf9d400000000000")
//             }
//         };
//         if (data.servicerName != "") {
//             userSearchCheck = 1
//             let getData = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
//             if (getData.length > 0) {
//                 servicerIds = await getData.map(servicer => servicer._id)
//             } else {
//                 servicerIds.push("1111121ccf9d400000000000")
//             }
//         };
//         if (data.resellerName != "") {
//             userSearchCheck = 1
//             let getData = await resellerService.getResellers({ name: { '$regex': data.resellerName ? data.resellerName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } })
//             if (getData.length > 0) {
//                 resellerIds = await getData.map(servicer => servicer._id)
//             } else {
//                 resellerIds.push("1111121ccf9d400000000000")
//             }
//         };

//         console.log('tesinggi------------')

//         let orderAndCondition = []

//         if (dealerIds.length > 0) {
//             orderAndCondition.push({ dealerId: { $in: dealerIds } })
//         }
//         if (customerIds.length > 0) {
//             orderAndCondition.push({ customerId: { $in: customerIds } })

//         }
//         if (servicerIds.length > 0) {
//             orderAndCondition.push({ servicerId: { $in: servicerIds } })

//         }
//         if (resellerIds.length > 0) {
//             orderAndCondition.push({ resellerId: { $in: resellerIds } })
//         }
//         let orderIds = []
//         if (orderAndCondition.length > 0) {
//             let getOrders = await orderService.getOrders({
//                 $and: orderAndCondition
//             })
//             if (getOrders.length > 0) {
//                 orderIds = await getOrders.map(order => order._id)
//             }
//         }
//         let getResellerOrder = await orderService.getOrders({ resellerId: req.params.resellerId, status: { $in: ["Active", "Pending"] } }, { _id: 1 })
//         if (!getResellerOrder) {
//             res.send({
//                 code: constant.errorCode,
//                 message: "Unable to fetch the data"
//             })
//             return
//         }
//         let orderIDs = getResellerOrder.map((ID) => ID._id)

//         let newQuery = [];
//         newQuery.push(
//             {
//                 $facet: {
//                     totalRecords: [
//                         {
//                             $count: "total"
//                         }
//                     ],
//                     data: [
//                         {
//                             $skip: skipLimit
//                         },
//                         {
//                             $limit: pageLimit
//                         },
//                         {
//                             $project: {
//                                 productName: 1,
//                                 model: 1,
//                                 serial: 1,
//                                 unique_key: 1,
//                                 status: 1,
//                                 manufacture: 1,
//                                 eligibilty: 1,
//                                 // "order.unique_key": 1,
//                                 // "order.venderOrder": 1,
//                                 // "order.resellerId": 1,
//                                 order_unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
//                                 order_venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
//                                 resellerId: { $arrayElemAt: ["$order.resellerId", 0] },
//                                 order: {
//                                     unique_key: { $arrayElemAt: ["$order.unique_key", 0] },
//                                     venderOrder: { $arrayElemAt: ["$order.venderOrder", 0] },
//                                     resellerId: { $arrayElemAt: ["$order.resellerId", 0] },
//                                 },
//                                 totalRecords: 1
//                             }
//                         }
//                     ],
//                 },

//             })

//         let contractFilter = []
//         if (data.eligibilty != '') {
//             contractFilter = [
//                 // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
//                 { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { eligibilty: data.eligibilty === "true" ? true : false },
//             ]
//         } else {
//             contractFilter = [
//                 // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
//                 { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                 { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//             ]
//         }


//         let query = [
//             {
//                 $match:
//                 {
//                     $and: contractFilter
//                 },
//             },
//             {
//                 $lookup: {
//                     from: "orders",
//                     localField: "orderId",
//                     foreignField: "_id",
//                     as: "order",
//                 }
//             },
//             // {
//             //     $unwind: {
//             //         path: "$order",
//             //         preserveNullAndEmptyArrays: true,
//             //     }
//             // },
//             {
//                 $match:
//                 {
//                     $and: [
//                         { "order.venderOrder": { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                         { "order.unique_key": { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
//                         { "order.resellerId": new mongoose.Types.ObjectId(req.params.resellerId) },
//                     ]
//                 },

//             },
//             // {
//             //     $lookup: {
//             //         from: "resellers",
//             //         localField: "order.resellerId",
//             //         foreignField: "_id",
//             //         as: "order.reseller"
//             //     }
//             // },
//             // {
//             //     $match: {
//             //         $and: [
//             //             { "order.reseller._id": new mongoose.Types.ObjectId(req.params.resellerId) },
//             //         ]
//             //     },
//             // },
//             // {
//             //     $facet: {
//             //         totalRecords: [
//             //             {
//             //                 $count: "total"
//             //             }
//             //         ],
//             //         data: [
//             //             {
//             //                 $skip: skipLimit
//             //             },
//             //             {
//             //                 $limit: pageLimit
//             //             },
//             //             {
//             //                 $project: {
//             //                     productName: 1,
//             //                     model: 1,
//             //                     serial: 1,
//             //                     unique_key: 1,
//             //                     status: 1,
//             //                     manufacture: 1,
//             //                     eligibilty: 1,
//             //                     "order.unique_key": 1,
//             //                     "order.venderOrder": 1
//             //                 }
//             //             }
//             //         ],
//             //     },

//             // }
//         ]
//         if (newQuery.length > 0) {
//             query = query.concat(newQuery);
//         }

//         let getContracts = await contractService.getAllContracts2(mainQuery, { allowDiskUse: true })
//         let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0

//         // if (!getContract) {
//         //     res.send({
//         //         code: constants.errorCode,
//         //         message: err.message
//         //     })
//         //     return;
//         // }
//         res.send({
//             code: constant.successCode,
//             message: "Success",
//             result: getContracts[0]?.data ? getContracts[0]?.data : [],
//             totalCount
//         })

//         console.log(orderIDs)
//     } catch (err) {
//         res.send({
//             code: constant.errorCode,
//             message: err.message
//         })
//     }
// }

exports.getResellerContract = async (req, res) => {
    try {
        let data = req.body
        console.log("data------------------", data)
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
        let dealerIds = [];
        let customerIds = [];
        let resellerIds = [];
        let servicerIds = [];
        let userSearchCheck = 0
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
        if (customerIds.length > 0) {
            orderAndCondition.push({ customerId: { $in: customerIds } })

        }
        if (servicerIds.length > 0) {
            orderAndCondition.push({ servicerId: { $in: servicerIds } })

        }
        if (req.params.resellerId) {
            userSearchCheck = 1
            orderAndCondition.push({ resellerId: { $in: [req.params.resellerId] } })
        };
        console.log("orderAndCondition-------------------", orderAndCondition)
        let orderIds = []
        if (orderAndCondition.length > 0) {
            let getOrders = await orderService.getOrders({
                $and: orderAndCondition
            })
            if (getOrders.length > 0) {
                orderIds = await getOrders.map(order => order._id)
            }
        }
        console.log("getOrders-------------------", orderIds)
        let contractFilterWithEligibilty = []
        if (data.eligibilty != '') {
            contractFilterWithEligibilty = [
                // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                // { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { eligibilty: data.eligibilty === "true" ? true : false },
                { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            ]
        } else {
            contractFilterWithEligibilty = [
                // { unique_key: { $regex: `^${data.contractId ? data.contractId : ''}` } },
                { unique_key: { '$regex': data.contractId ? data.contractId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { productName: { '$regex': data.productName ? data.productName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                // { pName: { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { serial: { '$regex': data.serial ? data.serial.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { manufacture: { '$regex': data.manufacture ? data.manufacture.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { model: { '$regex': data.model ? data.model.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { status: { '$regex': data.status ? data.status.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { venderOrder: { '$regex': data.venderOrder ? data.venderOrder.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
                { orderUniqueKey: { '$regex': data.orderId ? data.orderId.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
            ]
        }

        if (userSearchCheck == 1) {
            contractFilterWithEligibilty.push({ orderId: { $in: orderIds } })
        }
        let mainQuery = []
        if (data.contractId === "" && data.productName === "" && data.serial === "" && data.manufacture === "" && data.model === "" && data.status === "" && data.eligibilty === "" && data.venderOrder === "" && data.orderId === "" && userSearchCheck == 0) {
            console.log('check_--------dssssssssssssssssssssss--------')
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
                            },
                            {
                                $project: {
                                    productName: 1,
                                    model: 1,
                                    serial: 1,
                                    unique_key: 1,
                                    minDate: 1,
                                    status: 1,
                                    manufacture: 1,
                                    eligibilty: 1,
                                    orderUniqueKey: 1,
                                    venderOrder: 1,
                                    totalRecords: 1
                                }
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
                        $and: contractFilterWithEligibilty
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
                        {
                            $project: {
                                productName: 1,
                                model: 1,
                                serial: 1,
                                unique_key: 1,
                                status: 1,
                                minDate: 1,
                                manufacture: 1,
                                eligibilty: 1,
                                orderUniqueKey: 1,
                                venderOrder: 1,
                                totalRecords: 1
                            }
                        }
                    ],
                },

            })
        }


        // console.log("sssssss", contractFilterWithPaging)

        let getContracts = await contractService.getAllContracts2(mainQuery, { allowDiskUse: true })
        let totalCount = getContracts[0]?.totalRecords[0]?.total ? getContracts[0]?.totalRecords[0].total : 0

        res.send({
            code: constant.successCode,
            message: "Success",
            result: getContracts[0]?.data ? getContracts[0]?.data : [],
            totalCount,
        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}
exports.changeResellerStatus = async (req, res) => {
    try {

        const singleReseller = await resellerService.getReseller({ _id: req.params.resellerId });

        if (!singleReseller) {
            res.send({
                code: constant.errorCode,
                message: "Reseller not found"
            })
            return;
        }
        //Update Reseller User Status if inactive
        if (!req.body.status) {
            let resellerUserCreateria = { accountId: req.params.resellerId };
            let newValue = {
                $set: {
                    status: req.body.status
                }
            };
            let option = { new: true };
            const changeResellerUser = await userService.updateUser(resellerUserCreateria, newValue, option);

        }

        else if (singleReseller.isAccountCreate && req.body.status) {
            let resellerUserCreateria = { accountId: req.params.resellerId, isPrimary: true };
            let newValue = {
                $set: {
                    status: req.body.status
                }
            };
            let option = { new: true };
            const changeResellerUser = await userService.updateUser(resellerUserCreateria, newValue, option);
        }
        option = { new: true };
        //Update Reseller Status
        newValue = {
            $set: {
                status: req.body.status
            }
        };
        const changedResellerStatus = await resellerService.updateReseller({ _id: req.params.resellerId }, newValue);
        if (changedResellerStatus) {
            //Send notification to reseller,dealer and admin
            let IDs = await supportingFunction.getUserIds()
            let dealerPrimary = await supportingFunction.getPrimaryUser({ accountId: singleReseller.dealerId, isPrimary: true })
            let getPrimary = await supportingFunction.getPrimaryUser({ accountId: req.params.resellerId, isPrimary: true })
            IDs.push(dealerPrimary._id)
            IDs.push(getPrimary._id)
            let notificationData = {
                title: "Reseller status update",
                description: singleReseller.name + " , " + "your status has been updated",
                userId: req.params.resellerId,
                flag: 'reseller',
                notificationFor: IDs
            };

            let createNotification = await userService.createNotification(notificationData);

            // Send Email code here
            let notificationEmails = await supportingFunction.getUserEmails();
            notificationEmails.push(getPrimary.email);
            console.log("notificationEmails---------------", notificationEmails)
            // const notificationContent = {
            //     content: singleReseller.name + " " + "status has been updated successfully!"
            // }

            const status_content = req.body.status ? 'Active' : 'Inactive';
            let emailData = {
                senderName: singleReseller.name,
                content: "Status has been changed to " + status_content + " " + ", effective immediately."
            }

            let mailing = sgMail.send(emailConstant.sendEmailTemplate(notificationEmails, "Update Status", emailData))
            //Save Logs change reseller status
            let logData = {
                userId: req.userId,
                endpoint: "reseller/changeResellerStatus/:resellerId",
                body: req.body,
                response: {
                    code: constant.successCode,
                    message: 'Updated Successfully!',
                    data: changedResellerStatus
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.successCode,
                message: 'Updated Successfully!',
                data: changedResellerStatus
            })
        }
        else {
            //Save Logs change reseller status
            let logData = {
                userId: req.userId,
                endpoint: "reseller/changeResellerStatus/:resellerId",
                body: req.body,
                response: {
                    code: constant.errorCode,
                    message: 'Unable to update reseller status!',
                    result: changedResellerStatus
                }
            }
            await LOG(logData).save()
            res.send({
                code: constant.errorCode,
                message: 'Unable to update reseller status!',
            })
        }
    } catch (err) {
        //Save Logs change reseller status
        let logData = {
            userId: req.userId,
            endpoint: "reseller/changeResellerStatus/:resellerId catch",
            body: req.body ? req.body : { "type": "Catch Error" },
            response: {
                code: constant.errorCode,
                message: err.message
            }
        }
        await LOG(logData).save()
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

exports.getResellerClaims = async (req, res) => {
    try {

        const resellerId = req.params.resellerId ? req.params.resellerId : req.userId

        const singleReseller = await resellerService.getReseller({ _id: resellerId });

        if (!singleReseller) {
            res.send({
                code: constant.errorCode,
                message: "Reseller not found"
            })
            return;
        }
        let data = req.body
        let query = { isDeleted: false };
        let pageLimit = data.pageLimit ? Number(data.pageLimit) : 100
        let skipLimit = data.page > 0 ? ((Number(req.body.page) - 1) * Number(pageLimit)) : 0
        let limitData = Number(pageLimit)
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
                            note: 1,
                            pName: 1,
                            totalAmount: 1,
                            servicerId: 1,
                            claimType: 1,
                            customerStatus: 1,
                            trackingNumber: 1,
                            trackingType: 1,
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
        let servicerMatch = {}
        if (data.servicerName != '' && data.servicerName != undefined) {
            const checkServicer = await providerService.getAllServiceProvider({ name: { '$regex': data.servicerName ? data.servicerName : '', '$options': 'i' } });
            if (checkServicer.length > 0) {
                let servicerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer._id))
                let dealerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.dealerId))
                let resellerIds = await checkServicer.map(servicer => new mongoose.Types.ObjectId(servicer.resellerId))
                //  servicerMatch = { 'servicerId': { $in: servicerIds } }
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
                        // { 'pName': { '$regex': data.pName ? data.pName.replace(/\s+/g, ' ').trim() : '', '$options': 'i' } },
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
                        { "contracts.orders.resellerId": new mongoose.Types.ObjectId(resellerId) },
                        // { "contracts.orders.isDeleted": false },
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
        allServicer = await providerService.getAllServiceProvider(
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
            if (item1.contracts.orders.resellers[0]?.isServicer) {
                servicer.unshift(item1.contracts.orders.resellers[0])
            }
            if (item1.contracts.orders.dealers.isServicer) {
                servicer.unshift(item1.contracts.orders.dealers)
            }
            if (item1.servicerId != null) {
                servicerName = servicer.find(servicer => servicer._id.toString() === item1.servicerId.toString());
                const userId = req.userId ? req.userId : '65f01eed2f048cac854daaa5'
                //selfServicer = item1.servicerId.toString() === userId.toString() ? true : false
                selfServicer = item1.servicerId?.toString() === item1.contracts?.orders?.dealerId.toString() || item1.servicerId?.toString() === item1.contracts?.orders?.resellerId?.toString() ? true : false

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



    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}

