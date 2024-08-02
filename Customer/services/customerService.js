const customer = require("../model/customer");

module.exports = class customerService {
  // Get all customer  
  static async getAllCustomers(query, projection) {
    try {
      const allCustomers = await customer.find(query, projection).sort({ 'createdAt': -1 });
      return allCustomers;
    } catch (error) {
      return `Could not fetch customer ${error}`;
    }
  }

  // Get latest customer information based on query 
  static async getCustomersCount(query) {
    try {
      const allCustomers = await customer.find(query).sort({ 'unique_key': -1 });
      return allCustomers.sort((a, b) => b.unique_key - a.unique_key);
    } catch (error) {
      return `Could not fetch customer ${error}`;
    }
  }

  // Create customer 
  static async createCustomer(data) {
    try {
      const response = await new customer(data).save();
      return response;
    } catch (error) {
      return error;
    }
  }

  // Get customer by name or any query  
  static async getCustomerByName(query) {
    try {
      const singleCustomerResponse = await customer.findOne(query);
      return singleCustomerResponse;
    } catch (error) {
      return `Customer not found. ${error}`;
    }
  }

  // Get customer by id 
  static async getCustomerById(customerId) {
    try {
      const singleCustomerResponse = await customer.findOne(customerId);
      return singleCustomerResponse;
    } catch (error) {
      return `Customer not found. ${error}`;
    }
  }

  // Get customer information with its related information  
  static async getCustomerByAggregate(query) {
    try {
      const singleCustomerResponse = await customer.aggregate(query);
      return singleCustomerResponse;
    } catch (error) {
      return `Customer not found. ${error}`;
    }
  }

  // Update customer 
  static async updateCustomer(criteria, data, option) {
    try {
      const updatedResponse = await customer.updateOne(criteria, data, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update customer ${error}`;
    }
  }

  // Update dealer  of the customer
  static async updateDealerName(criteria, data, option) {
    try {
      const updatedResponse = await customer.updateMany(criteria, data, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update dealer ${error}`;
    }
  }

  // Delete Customer 
  static async deleteCustomer(customerId) {
    try {
      const deletedResponse = await customer.findOneAndDelete(customerId);
      return deletedResponse;
    } catch (error) {
      return `Could not delete customer ${error}`;
    }
  }

  // Update customer data in bulk 
  static async updateCustomerData(criteria, data, option) {
    try {
      const updatedResponse = await customer.updateMany(criteria, data, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update customer ${error}`;
    }
  }
};
