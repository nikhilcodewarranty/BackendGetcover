const { Order } = require("../model/order");
const orderResourceResponse = require("../utils/constant");
const orderService = require("../services/orderService");
const dealerService = require("../../Dealer/services/dealerService");
const servicerService = require("../../Provider/services/providerService");
const customerService = require("../../Customer/services/customerService");
const priceBookService = require("../../PriceBook/services/priceBookService");
const constant = require("../../config/constant");
const multer = require('multer');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const XLSX = require("xlsx");


var StorageP = multer.diskStorage({
    destination: function (req, files, cb) {
        cb(null, path.join(__dirname, '../../uploads/orderFile'));
    },
    filename: function (req, files, cb) {
        cb(null, files.fieldname + '-' + Date.now() + path.extname(files.originalname))
    }
})

var uploadP = multer({
    storage: StorageP,
}).single('file');



exports.createOrder = async (req, res) => {
    try {
        if (req.role != "Super Admin") {
            res.send({
                code: constant.errorCode,
                message: "Only super admin allow to do this action"
            })
            return;
        }
        let data = req.body
        if (data.dealerId) {
            let projection = { isDeleted: 0 }
            let checkDealer = await dealerService.getDealerById(data.dealerId, projection);
            if (!checkDealer) {
                res.send({
                    code: constant.errorCode,
                    message: "Dealer not found"
                })
                return;
            }
        }
        if (data.servicerId) {
            let query = { _id: data.servicerId }
            let checkServicer = await servicerService.getServiceProviderById(query)
            if (!checkServicer) {
                res.send({
                    code: constant.errorCode,
                    message: "Servicer not found"
                })
                return;
            }
        }
        if (data.customerId) {
            let query = { _id: data.customerId }
            let checkCustomer = await customerService.getCustomerById(query);
            if (!checkCustomer) {
                res.send({
                    code: constant.errorCode,
                    message: "Customer not found"
                })
                return;
            }
        }
        if (data.categoryId) {
            let query = { _id: data.categoryId }
            let checkCategory = await priceBookService.getPriceCatById(query, { isDeleted: 0 })
            if (!checkCategory) {
                res.send({
                    code: constant.errorCode,
                    message: "Category not found"
                })
                return;
            }
        }
        if (data.priceBookId) {
            let query = { _id: data.priceBookId }
            let checkPriceBook = await priceBookService.findByName1(query)
            if (!checkPriceBook) {
                res.send({
                    code: constant.errorCode,
                    message: "PriceBook not found"
                })
                return;
            }
        }
        data.createdBy = req.userId
        let savedResponse = await orderService.addOrder(data);
        if (!savedResponse) {
            res.send({
                code: constant.errorCode,
                message: "unable to create order"
            });
            return;
        }
        res.send({
            code: constant.successCode,
            message: "Success",
            result: savedResponse
        })
    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
};

exports.checkFileValidation = async (req, res) => {
    try {
        uploadP(req, res, async (err) => {
            let data = req.body
            let file = req.file

            let csvName = req.file.filename
            const csvWriter = createCsvWriter({
                path: './uploads/resultFile/' + csvName,
                header: [
                    { id: 'Brand', title: 'Brand' },
                    { id: 'Model', title: 'Model' },
                    { id: 'Serial', title: 'Serial' },
                    { id: 'Class', title: 'Class' },
                    { id: 'Condition', title: 'Condition' },
                    { id: 'Retail Value', title: 'Retail Value' },
                    // Add more headers as needed
                ],
            });
            const wb = XLSX.readFile(req.file.path);
            const sheets = wb.SheetNames;
            const ws = wb.Sheets[sheets[0]];
            const totalDataComing1 = XLSX.utils.sheet_to_json(wb.Sheets[sheets[0]]);

            const headers = [];
            for (let cell in ws) {
              // Check if the cell is in the first row and has a non-empty value
              if (/^[A-Z]1$/.test(cell) && ws[cell].v !== undefined && ws[cell].v !== null && ws[cell].v.trim() !== '') {
                headers.push(ws[cell].v);
              }
            }
      
            if (headers.length !== 6) {
              res.send({
                code: constant.errorCode,
                message: "Invalid file format detected. The sheet should contain exactly six columns."
              })
              return
            }

            const isValidLength = totalDataComing1.every(obj => Object.keys(obj).length === 6);
            if(isValidLength){
                console.log('valid length ---------------')
            }else{
                console.log('not valid length ---------------')
            }
            console.log('check+++++++++++++++++++++++++++',totalDataComing1,totalDataComing1.length,isValidLength)



        })

    } catch (err) {
        res.send({
            code: constant.errorCode,
            message: err.message
        })
    }
}