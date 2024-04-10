const reseller = require("../model/reseller")
const user = require('../../User/model/users')

module.exports = class resellerService {
    static async createReseller(data) {
        try {
            let createReseller = await new reseller(data).save();
            return createReseller;
        } catch (err) {
            console.log(`Unable to create the reseller ${err}`)
        }
    }

    static async getResellers(query, projection) {
        try {
            let getResellers = await reseller.find(query, projection)
            return getResellers;
        } catch (err) {
            console.log(`Unable to get the resellers err: ${err}`)
        }
    }

    static async getReseller(query, projection) {
        try {
            let getResellers = await reseller.findOne(query, projection)
            return getResellers;
        } catch (err) {
            console.log(`Unable to get the resellers err: ${err}`)
        }
    }

    static async getResellersCount(query) {
        try {
            const allReselers = await reseller.find(query).sort({ 'unique_key': -1 });
            return allReselers.sort((a, b) => b.unique_key - a.unique_key);
        } catch (error) {
            console.log(`Could not fetch customer ${error}`);
        }
    }

    static async getResellerByAggregate(query) {
        try {
            const singleResellerResponse = await reseller.aggregate(query);
            return singleResellerResponse;
        } catch (error) {
            console.log(`Customer not found. ${error}`);
        }

    }
    static async updateMeta(query, projection) {
        try {
            let updateMeta = await reseller.updateMany(query, projection);
            return updateMeta
        }
        catch (err) {
            console.log(`Unable to update the name ${err}`)
        }
    }

    static async updateReseller(criteria, data) {
        try {
            let updateMeta = await reseller.findOneAndUpdate(criteria, data, { new: true });
            return updateMeta
        } catch (err) {
            console.log(`Unable to update the name ${err}`)
        }
    }

}