const { default: mongoose } = require("mongoose");
const dealerPrice = require("../../models/Dealer/dealerPrice");

module.exports = class dealerPriceService {
  // Get all dealer prices with additional lookups and calculations
  static async getAllDealerPrice() {
    try {
      const AllDealerPrice = await dealerPrice.aggregate([
        {
          $lookup: {
            from: "pricebooks",
            localField: "priceBook",
            foreignField: "_id",
            as: "priceBooks",
          },
        },
        {
          $unwind: "$priceBooks", // Unwind to access individual priceBooks
        },
        {
          $lookup: {
            from: "pricecategories",
            localField: "priceBooks.category",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $lookup: {
            from: "dealers",
            localField: "dealerId",
            foreignField: "_id",
            as: "dealer",
          },
        },
        {
          $project: {

            _id: 1,
            name: 1,
            wholesalePrice: {
              $sum: [
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
            category: 1,
            dealer: 1

          },
        },
        {
          $addFields: {
            brokerFee: { $subtract: ["$retailPrice", "$wholesalePrice"] },
          },
        },
        {
          $sort: { "createdAt": -1 },
        },
      ]);

      // const AllDealerPrice = await dealerPrice.find().sort({"createdAt":-1});
      return AllDealerPrice;
    } catch (error) {
      return `Could not fetch dealer price ${error}`;
    }
  }

  // Find all dealer prices based on a query
  static async findAllDealerPrice(query) {
    try {
      const AllDealerPrice = await dealerPrice.find(query)
      return AllDealerPrice;
    } catch (error) {
      return `Could not fetch dealer price ${error}`;
    }
  }
  // Aggregate dealer prices based on a query
  static async aggregateAllDealerPrice(query) {
    try {
      const AllDealerPrice = await dealerPrice.aggregate(query)
      return AllDealerPrice;
    } catch (error) {
      return `Could not fetch dealer prices: ${error}`;
    }
  }
  // Get dealer price book by ID with additional lookups
  static async getDealerPriceBookById(query, projection) {
    try {
      const SingleDealerPrice = await dealerPrice.aggregate([
        {
          $match: query
        },
        {
          $lookup: {
            from: "pricebooks",
            localField: "priceBook",
            foreignField: "_id",
            as: "priceBooks",
            pipeline: [
              {
                $lookup: {
                  from: "pricecategories",
                  localField: "category",
                  foreignField: "_id",
                  as: "category"
                }
              },
              {
                $lookup: {
                  from: "options",
                  localField: "coverageType.value",
                  foreignField: "value.value",
                  as: "options",
                }
              },
            ]
          }
        },
        { $unwind: "$priceBooks" },
        {
          $lookup: {
            from: "dealers",
            localField: "dealerId",
            foreignField: "_id",
            as: "dealer",
          },
        },
        { $unwind: "$dealer" },
        {
          $project: projection
        },
        {
          $addFields: {
            brokerFee: { $subtract: ["$retailPrice", "$wholesalePrice"] },
          },
        },


      ]).sort({ "createdAt": -1 });
      return SingleDealerPrice;
    } catch (error) {
      return `Could not fetch dealer price book: ${error}`;
    }
  }
  // Get dealer price book by ID with a custom query
  static async getDealerPriceBookById1(query, projection) {
    try {
      const SingleDealerPrice = await dealerPrice.aggregate(query).sort({ "createdAt": -1 });
      return SingleDealerPrice;
    } catch (error) {
      return `Could not fetch dealer price book: ${error}`;
    }
  }
  // Get all price books by filter
  static async getAllPriceBooksByFilter(query, projection) {
    try {
      const result = await dealerPrice.aggregate([
        {
          $lookup: {
            from: "pricebooks",
            localField: "priceBook",
            foreignField: "_id",
            as: "priceBooks",
          },
        },
        {
          $unwind: '$priceBooks',
        },
        {
          $lookup: {
            from: "pricecategories",
            localField: "priceBooks.category",
            foreignField: "_id",
            as: "priceBooks.category",
          },
        },
        {
          $match: query
        },

        {
          $lookup: {
            from: "dealers",
            localField: "dealerId",
            foreignField: "_id",
            as: "dealer",
          },
        },
        {
          $unwind: '$dealer',
        },
        // Additional stages or project as needed
      ]).sort({ "createdAt": -1 });

      return result;
    } catch (error) {
      return `Could not fetch price books by filter: ${error}`;
    }
  }
  // Get all dealer price books by filter with additional details
  static async getAllDealerPriceBooksByFilter(query, projection) {

    try {
      const result = await dealerPrice.aggregate([
        {
          $lookup: {
            from: "pricebooks",
            localField: "priceBook",
            foreignField: "_id",
            as: "priceBooks",
            pipeline: [
              {
                $lookup: {
                  from: "pricecategories",
                  localField: "category",
                  foreignField: "_id",
                  as: "category"
                }
              }
            ]
          }
        },
        {
          $lookup: {
            from: "dealers",
            localField: "dealerId",
            foreignField: "_id",
            as: "dealer",
          },
        },
        {
          $project: {

            _id: 1,
            name: 1,
            wholesalePrice: {
              $sum: [
                { $arrayElemAt: ["$priceBooks.reserveFutureFee", 0] },
                { $arrayElemAt: ["$priceBooks.reinsuranceFee", 0] },
                { $arrayElemAt: ["$priceBooks.adminFee", 0] },
                { $arrayElemAt: ["$priceBooks.frontingFee", 0] }
              ],
            },
            "priceBook": 1,
            "dealerSku": 1,
            "dealerId": 1,
            "status": 1,
            "retailPrice": 1,
            "description": 1,
            "isDeleted": 1,
            "unique_key": 1,
            "__v": 1,
            "createdAt": 1,
            "updatedAt": 1,
            priceBooks: 1,
            dealer: 1

          },
        },
        {
          $addFields: {
            brokerFee: { $subtract: ["$retailPrice", "$wholesalePrice"] },
          },
        },
        query,

        // Additional stages or project as needed
      ]).sort({ "createdAt": -1 });

      return result;
    } catch (error) {
      return `Could not fetch dealer price books by filter: ${error}`;
    }
  }
  // Get the count of dealer prices
  static async getDealerPriceCount() {
    try {
      const count = await dealerPrice.find().sort({ "unique_key": -1 });
      return count.sort((a, b) => b.unique_key - a.unique_key);;
    } catch (error) {
      return `Could not fetch dealer price count: ${error}`;
    }
  }

  // create new dealer price 
  static async createDealerPrice(data) {
    try {
      const response = await new dealerPrice(data).save();
      return response;
    } catch (error) {
      return `Could not create dealer price: ${error}`;
    }
  }
  // Insert multiple dealer prices
  static async insertManyPrices(data) {
    try {
      const response = await dealerPrice.insertMany(data);
      return response;
      return response;
    } catch (error) {
      return `Could not insert multiple dealer prices: ${error}`;
    }
  }
  // get dealer price detail with ID
  static async getDealerPriceById(ID, projection) {
    try {
      const singleDealerPriceResponse = await dealerPrice.findOne(ID, projection);
      return singleDealerPriceResponse;
    } catch (error) {
      return `Dealer price not found: ${error}`;
    }
  }
  // Update dealer prices based on criteria
  static async updateDealerPrice(criteria, newValue, option) {
    try {
      const updatedResponse = await dealerPrice.updateMany(criteria, newValue, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update dealer price: ${error}`;
    }
  }

  // delete dealer price with ID
  static async deleteDealerPrice(dealerPriceId) {
    try {
      const deletedResponse = await dealerPrice.findOneAndDelete(dealerPriceId);
      return deletedResponse;
    } catch (error) {
      return `Could not delete dealer price: ${error}`;
    }
  }

  // upload csv
  static async uploadPriceBook(dealerPriceId) {
    try {
      const uploadPriceBook = await dealerPrice.insertMany(dealerPriceId);
      return uploadPriceBook;
    } catch (error) {
      return `Could not upload price book: ${error}`;
    }
  }

  // Find By Multiple Ids
  static async findByIds(query) {
    try {
      // return;
      const response = await dealerPrice.aggregate([
        {
          $match: query
        },
        {
          $lookup: {
            from: "pricebooks",
            localField: "priceBook",
            foreignField: "_id",
            as: "priceBooks",
          }
        },
      ])

      return response;
    } catch (error) {
      return `Could not find dealer prices by IDs: ${error}`;
    }
  }

  //Script old dealer sku update
  static async allUpdate(query) {
    try {
      const getResponse = await dealerPrice.bulkWrite(query);
      return getResponse;
    } catch (error) {
      return `Could not update sku: ${error}`;
    }
  }
};