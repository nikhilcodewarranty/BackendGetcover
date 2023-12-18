const dealer = require("../model/dealer");
const dealerPrice = require("../model/dealerPrice");

module.exports = class dealerService {
  // Get all dealers
  static async getAllDealers(query,projection) {
    try {
      const AllDealers = await dealer.find(query,projection).sort({"createdAt":-1});
      return AllDealers;
    } catch (error) {
      console.log(`Could not fetch dealers ${error}`);
    }
  }

  // Create new dealer
  static async createDealer(data) {
    try {
      console.log('data meta---------', data)
      const response = await new dealer(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  // Get dealer detail with ID
  static async getDealerById(dealerId) {
    try {
      const singleDealerResponse = await dealer.findOne( dealerId);
      return singleDealerResponse;
    } catch (error) {
      console.log(`Dealer not found. ${error}`);
    }
  }

  // Get dealer detail with Name
  static async getDealerByName(query,projection) {
    try {
      const singleDealerResponse = await dealer.findOne(query,projection);
      return singleDealerResponse;
    } catch (error) {
      console.log(`Dealer not found. ${error}`);
    }
  }

  // Update dealer detail with ID
  static async updateDealer(criteria,newValue,option) {
    try {
      const updatedResponse = await dealer.updateOne(criteria,newValue,option);
      return updatedResponse;
    } catch (error) {
      console.log(`Could not update dealer ${error}`);
    }
  }

  // Delete dealer by id
  static async deleteDealer(criteria) {
    try {
      const deletedResponse = await dealer.deleteOne(criteria);
      return deletedResponse;
    } catch (error) {
      console.log(`Could  not delete dealer ${error}`);
    }
  }

  static async createPriceBook(data) {
      try {
        console.log('data meta Price---------', data)
        const response = await new dealerPrice(data).save();
        return response;
      } catch (error) {
        console.log(error);
      }
  }


  //--------------------------------------Register Dealer---------------------------------------  
  static async registerDealer(data) {
    try {
      const response = await new dealer(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  static async statusUpdate(criteria, newValue, option) {

    try {
      const updatedResult = await dealerPrice.findByIdAndUpdate(
        criteria,
        newValue,
        option
      );
      return updatedResult;
    } catch (error) {
      console.log(error);
    }
  }

  static async isApprovedOrDisapproved(criteria, newValue, option) {

    try {
      const updatedResult = await dealer.findByIdAndUpdate(
        criteria,
        newValue,
        option
      );
      return updatedResult;
    } catch (error) {
      console.log(error);
    }
  } 
  
};


