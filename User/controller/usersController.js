require("dotenv").config();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");


const userResourceResponse = require("../utils/constant");
const userService = require("../services/userService");
const dealerService = require('../../Dealer/services/dealerService')
const dealerPriceService = require('../../Dealer/services/dealerPriceService')
const providerService = require('../../Provider/services/providerService')
const users = require("../model/users");
const role = require("../model/role");
const constant = require('../../config/constant');


//----------------------- api's function ---------------//

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
    const users = await userService.getAllUsers();
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
    const createdUser = await userService.createUser(req.body);
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

//get user detail with ID
exports.getUserById = async (req, res) => {
  try {
    let projection = { __v: 0, status: 0 }
    const singleUser = await userService.getUserById(userId, projection);
    if (!singleUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to fetch the user detail"
      })
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Success",
      result: singleUser
    })
  } catch (error) {
    res
      .status(userResourceResponse.serverError.statusCode)
      .json({ error: "Internal server error" });
  }
};

// update user details with ID
exports.updateUser = async (req, res) => {
  try {
    let criteria = { _id: req.params.userId };
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
    const deleteUser = await userService.deleteUser(criteria, newValue, option);
    if (!deleteUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to delete the user"
      });
      return;
    };
    res.send({
      code: constant.successCode,
      message: "Deleted Successfully"
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    });
  }
};

// create super admin credentials
exports.createSuperAdmin = async (req, res) => {
  try {
    let data = req.body
    // Check if the user with the provided email already exists
    const existingUser = await userService.findOneUser({ email: data.email });
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
      accountId: data.accountId,
      phoneNumber: data.phoneNumber,
      roleId: superRole._id, //Assign super role
      isPrimary: data.isPrimary,
      status: data.status,
    }

    // Create a new user with the provided data
    const savedUser = userService.createUser(userData);

    // Generate JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    //success response 
    res.send({
      code: constant.successCode,
      message: "Account created successfully"
    })
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: error.message
    });
  }
};

//create a new dealer from SA 
exports.createDealer = async (req, res) => {
  try {
    let data = req.body;

    console.log(data);
    // Create a new dealer meta data
    let dealerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      createdBy: data.createdBy
    };
    // check role is exist or not 
    let checkRole = await role.findOne({ role: data.role });
    if (!checkRole) {
      res.send({
        code: constant.errorCode,
        message: "Invalid role"
      });
      return;
    };

    let createMetaData = await dealerService.createDealer(dealerMeta)
    if (!createMetaData) {
      res.send({
        code: constant.errorCode,
        message: "Something went wrong"
      });
      return;
    };
    // dealer user data 
    let dealerUserArray = data.dealers
    for (let i = 0; i < dealerUserArray.length; i++) {
      // Hash the password
      const hashedPassword = await bcrypt.hash(dealerUserArray[i].password, 10);
      const existingUser = await userService.findOneUser({ email: dealerUserArray[i].email });
      if (!existingUser) {
        let dealerData = {
          firstName: dealerUserArray[i].firstName,
          lastName: dealerUserArray[i].lastName,
          email: dealerUserArray[i].email,
          password: hashedPassword,
          accountId: createMetaData._id,
          phoneNumber: dealerUserArray[i].phoneNumber,
          roleId: checkRole._id, // Assign super role
          isPrimary: dealerUserArray[i].isPrimary,
        }
        let createDealer = await userService.createUser(dealerData)
      }
      console.log('-------------------------', i)   
     }

      // dealer Price Book data 

      let dealerPriceArray = data.priceBook
      for (let i = 0; i < dealerPriceArray.length; i++) {
          let dealerPriceData = {
            priceBook: "657028a5ea99c1493f53c9b6",
            dealerId:createMetaData._id,
            brokerFee: dealerPriceArray[i].brokerFee
        }
        let createPriceBook = await dealerPriceService.createDealerPrice(dealerPriceData)
      }
    res.send({
      code: constant.successCode,
      message: 'Successfully Created',
    })

    //----------------------- these codes may be used in future --------------------//
    /*
        if (createDealer) {
          let result = createDealer.toObject()
          result.role = data.role //adding role to the response
          result.meta = createMetaData // merging the dealer data with user data
          const token = jwt.sign(
            { userId: createDealer._id, email: createDealer.email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
          );
          //success response
          res.send({
            code: constant.successCode,
            message: 'Successfully Created',
            result: result,
            jwtToken: token
          })
        } else {
          res.send({
            code: constant.errorCode,
            message: "Unable to create the dealer"
          })
        }
        */
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
};

//Create new service provider
exports.createServiceProvider = async (req, res) => {
  try {
    let data = req.body
    const existingUser = await userService.findOneUser({ email: data.email });
    if (existingUser) {
      res.send({
        code: constant.errorCode,
        message: "Email already exist"
      })
      return;
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    // Create a new dealer meta data
    let providerMeta = {
      name: data.name,
      street: data.street,
      city: data.city,
      zip: data.zip,
      state: data.state,
      country: data.country,
      createdBy: data.createdBy
    };
    // check role is exist or not 
    let checkRole = await role.findOne({ role: data.role });
    if (!checkRole) {
      res.send({
        code: constant.errorCode,
        message: "Invalid role"
      });
      return;
    };

    let createMetaData = await providerService.createServiceProvider(providerMeta)
    if (!createMetaData) {
      res.send({
        code: constant.errorCode,
        message: "Something went wrong"
      });
      return;
    };
    let providerData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      accountId: createMetaData._id,
      phoneNumber: data.phoneNumber,
      roleId: checkRole._id, // Assign  role
      isPrimary: data.isPrimary,
    }

    let createDealer = await userService.createUser(providerData)
    if (createDealer) {
      let result = createDealer.toObject()
      result.role = data.role //adding role to the response
      result.meta = createMetaData // merging the provider data with user data
      const token = jwt.sign(
        { userId: createDealer._id, email: createDealer.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      //success response
      res.send({
        code: constant.successCode,
        message: 'Successfully Created',
        result: result,
        jwtToken: token
      })
    } else {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the service provider"
      })
    }
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
  }
}


// Login route
exports.login = async (req, res) => {
  try {
    // Check if the user with the provided email exists
    const user = await userService.findOneUser({email: req.body.email});
    if (!user) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Credentials"
      })
      return;
    }

    console.log(req.body.password);
    console.log(user.password);

    // Compare the provided password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(req.body.password, user.password);

    if (!passwordMatch) {
      res.send({
        code: constant.errorCode,
        message: "Invalid Credentials"
      })
      return;
    }
    let roleQuery = { _id: user.roleId }
    let roleProjection = { __v: 0 }
    let getRole = await userService.getRoleById(roleQuery, roleProjection)

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: getRole.role },
      process.env.JWT_SECRET, // Replace with your secret key
      { expiresIn: "1h" }
    );

    res.send({
      code: constant.successCode,
      message: "Login Successful",
      result: {
        token: token,
        email: user.email
      }
    })
  } catch (err) {
    res.send({
      code: constant.errorCode,
      message: err.message
    })
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

// add new roles
exports.addRole = async (req, res) => {
  try {
    const createdUser = await userService.addRole(req.body);
    if (!createdUser) {
      res.send({
        code: constant.errorCode,
        message: "Unable to create the role"
      })
    }
    res.json(createdUser);
  } catch (error) {
    res.send({
      code: constant.errorCode,
      message: "Unable to create the dealer"
    })
  }
};

// exports.sendLinkToEmail = async(req,res)=>{
//   try{
//     let data = req.body
//     let checkEmail = await userService.findOneUser({email:data.email})
//     if(!checkEmail){
//       res.send({
//         code:constant.errorCode,
//         message:"Invalid email"
//       })
//     }else{

//     }
//   }catch(err){
//     res.send({
//       code:constant.errorCode,
//       message:err.message
//     })
//   }
// }