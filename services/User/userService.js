const user = require("../../models/User/users");
const contact = require("../../models/User/contact");
const role = require("../../models/User/role");
const setting = require("../../models/User/setting");
const notification = require("../../models/User/notification");
const terms = require("../../models/User/terms");
const dealerModel = require("../../models/Dealer/dealer");
const { userConnection } = require("../../db");

//-------------------------- user's services ------------------------------//

module.exports = class userService {
  // get all users
  static async getAllUsers(query, projection) {
    try {
      const allUsers = await user.aggregate([
        {
          $match: {
            roleId: query.roleId
          }
        },
        // Join with user_role table
        {
          $lookup: {
            from: "roles",
            localField: "roleId",
            foreignField: "_id",
            as: "user_role"
          }
        },
        { $unwind: "$user_role" },
        {
          $project: {
            _id: 1,
            email: 1,
            firstName: 1,
            lastName: 1,
            role: "$user_role.role",
            accountId: 1
          }
        }
      ]).sort({ "createdAt": -1 });

      return allUsers;
    } catch (error) {
      return `Could not fetch users ${error}`;
    }
  }

  //find user
  static async findUser(query, sorting) {
    try {
      const allUsers = await user.find(query).sort(sorting);
      return allUsers;
    } catch (error) {
      return `Could not fetch users: ${error}`;
    }
  }

  //create user 
  static async createUser(data) {
    try {
      const response = await new user(data).save();
      return response;
    } catch (error) {
      return `Could not create users: ${error}`;
    }
  };
  // Save bulk users
  static async insertManyUser(data) {
    try {
      const response = await user.insertMany(data);
      return response;
    } catch (error) {
      return `Could not create users: ${error}`;
    }
  };

  // get user detail with id
  static async getUserById(userId, projection) {
    try {
      const singleUserResponse = await user.findById({ _id: userId, }, { projection });
      return singleUserResponse;
    } catch (error) {
      return `Could not find user: ${error}`;
    }
  };

  static async getUserById1(userId, projection) {
    try {
      const singleUserResponse = await user.findOne(userId, projection);
      return singleUserResponse;
    } catch (error) {
      return `Could not find users: ${error}`;
    }
  };

  //update user details with ID
  static async updateUser(criteria, data, option) {
    try {
      const updatedResponse = await user.updateMany(criteria, data, option);

      return updatedResponse;
    } catch (error) {
      return `Could not update user: ${error}`;
    }
  };

  //delete user with ID
  static async deleteUser(criteria) {
    try {
      const deletedResponse = await user.deleteMany(criteria);
      return deletedResponse;
    } catch (error) {
      return `Could not delete user: ${error}`;
    }
  };

  //get all roles
  static async getAllRoles(query, projection) {
    try {
      const roles = await role.find(query, projection).sort({ "createdAt": -1 });
      return roles;
    } catch (error) {
      return `Could not find role: ${error}`;
    }
  };


  //get all TERMS
  static async getAllTerms(query, projection) {
    try {
      const allTerms = await terms.find(query, projection).sort({ "terms": 1 });
      return allTerms;
    } catch (error) {
      return `Could not find terms: ${error}`;
    }
  };

  //add role
  static async addRole(data) {
    try {
      const response = await new role(data).save();
      return response;
    } catch (error) {
      return `Could not add role: ${error}`;
    }
  };

  //create term
  static async createTerms(data) {
    try {
      const response = await terms.insertMany(data);
      return response;
    } catch (error) {
      return `Could not create term: ${error}`;
    }
  };

  //get role by id
  static async getRoleById(query, projection) {
    try {
      const response = await role.findOne(query, projection)
      return response
    } catch (err) {
      return `Could not get role: ${err}`;
    }
  }

  //find user by email
  static async findByEmail(query) {
    try {
      const response = await user.aggregate([
        {
          $match: {
            email: { $in: query }
          }
        },
        {
          $addFields: {
            flag: true
          }
        },
        {
          $project: {
            _id: 0,
            email: 1,
            flag: 1
          }
        }
      ]);

      return response;
    } catch (err) {
      return `Could not find user: ${err}`;

    }
  }

  // get dealers user
  static async getDealersUser(query, projection) {
    try {
      const response = await user.find(query, projection).sort({ "createdAt": -1 });
      return response
    } catch (err) {
      return `Could not get dealer user: ${err}`;

    }
  }

  // get servicer user
  static async getServicerUser(query, projection) {
    try {
      const response = await user.find(query, projection).sort({ "createdAt": -1 });
      return response
    } catch (err) {
      return `Could not get servicer user: ${err}`;
    }
  }

  //create notification 
  static async createNotification(data) {
    try {
      const response = await new notification(data).save();
      return response;
    } catch (error) {
      return `Could not create notification: ${error}`;
    }
  };


  // get all notifications
  static async getAllNotifications(query, skipLimit, limitData) {
    try {
      const roles = await notification.find(query).populate("userId").sort({ "createdAt": -1 }).skip(skipLimit).limit(limitData);
      return roles;
    } catch (error) {
      return `Could not find notifications: ${error}`;
    }
  };
  // get count notification
  static async getCountNotification(query) {
    try {
      const roles = await notification.countDocuments(query)
      return roles;
    } catch (error) {
      return `Could not find notification count: ${error}`;
    }
  };
  // update notification
  static async updateNotification(criteria, newValue, option) {
    try {
      const updatedResponse = await notification.updateMany(criteria, newValue, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update notification: ${error}`;
    }
  }
  // find user for customer
  static async findUserforCustomer(query) {
    try {
      const fetchUser = await user.aggregate([
        {
          $match: query
        }
      ]).sort({ createdAt: -1 });
      return fetchUser;
    } catch (error) {
      return `Could not get user: ${error}`;
    }
  }
  // find customer members new
  static async findUserforCustomer1(query) {
    try {
      const fetchUser = await user.aggregate(query).sort({ createdAt: -1 });
      return fetchUser;
    } catch (error) {
      return `Could not get user: ${error}`;
    }
  }
  // update only single data
  static async updateSingleUser(criteria, newValue, option) {
    try {
      const updatedResponse = await user.findOneAndUpdate(criteria, newValue, option);
      return updatedResponse;
    } catch (error) {
      return `Could not update user: ${error}`;
    }
  }
  // get user by email
  static async getSingleUserByEmail(query, project) {
    try {
      let getUser = await user.findOne(query)
      return getUser;
    } catch (err) {
      return `Could not get user: ${err}`;
    }
  }

  //save setting information
  static async saveSetting(data) {
    try {
      const saveSetting = await new setting(data).save();
      return saveSetting;
    }
    catch (error) {
      console.log(`Could not fetch users ${error}`);
    }
  }

  //update setting information
  static async updateSetting(creteria, data, option) {
    try {
      const saveSetting = await setting.findOneAndUpdate(creteria, data, option);
      return saveSetting;
    }
    catch (error) {
      console.log(`Could not fetch users ${error}`);
    }
  }
  //-------------------------------------------------------------New Services-----------------------------------------------------------------------------------//
  //find user for unique checks
  // find user for unique checks 
  static async findOneUser(query, projection) {
    try {
      projection = projection ? projection : {}
      const loggedInUser = await user.findOne(query, projection);
      return loggedInUser;
    } catch (error) {
      return `Could not fetch user: ${error}`;
    }
  }

  // find member
  static async getMembers(query, projection) {
    try {
      const response = await user.find(query, projection).sort({ isPrimary: -1, "createdAt": -1 });
      return response
    } catch (err) {
      return `Could not fetch members: ${err}`;
    }
  }

  static async getSetting(query) {
    try {
      const settingData = await setting.find(query);
      return settingData;
    }
    catch (error) {
      return `Could not fetch setting: ${err}`;
    }
  }

  //save setting information
  static async saveSetting(data) {
    try {
      const saveSetting = await new setting(data).save();
      return saveSetting;
    }
    catch (error) {
      console.log(`Could not save setting ${error}`);
    }
  }

  //update setting information
  static async updateSetting(creteria, data, option) {
    try {
      const saveSetting = await setting.findOneAndUpdate(creteria, data, option);
      return saveSetting;
    }
    catch (error) {
      console.log(`Could not update setting ${error}`);
    }
  }

  static async contactUs(data) {
    try {
      const response = await new contact(data).save();
      return response;
    } catch (error) {
      return `Could not save contact us: ${error}`;
    }
  }

};