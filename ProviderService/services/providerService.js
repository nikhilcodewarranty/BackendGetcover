const serviceProvider = require("../model/serviceProvider");

module.exports = class providerService {
  static async getAllServiceProvider() {
    try {
      const allServiceProvider = await serviceProvider.find();
      return allServiceProvider;
    } catch (error) {
      console.log(`Could not fetch service provider ${error}`);
    }
  }

  static async createServiceProvider(data) {
    try {
      const response = await new serviceProvider(data).save();
      return response;
    } catch (error) {
      console.log(error);
    }
  }
  static async getServiceProviderById(serviceProviderId) {
    try {
      const singleServiceProviderResponse = await serviceProvider.findById({
        _id: serviceProviderId,
      });
      return singleServiceProviderResponse;
    } catch (error) {
      console.log(`Service provider not found. ${error}`);
    }
  }

  static async updateServiceProvider(data) {
    try {
      const updateResponse = await serviceProvider.updateOne(
        { data },
        { $set: { date: new Date.now() } }
      );

      return updateResponse;
    } catch (error) {
      console.log(`Could not update service provider ${error}`);
    }
  }

  static async deleteServiceProvider(orderId) {
    try {
      const deletedResponse = await serviceProvider.findOneAndDelete(orderId);
      return deletedResponse;
    } catch (error) {
      console.log(`Could not delete service provider ${error}`);
    }
  }
};
