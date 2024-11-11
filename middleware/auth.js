const { verify } = require('crypto');
const jwt = require('jsonwebtoken');
const users = require("../models/User/users")
verifyToken = async (req, res, next) => {
  let token = req.headers["x-access-token"];
  if (!token) {
    res.send({
      'status': 400,
      message: "something went wrong in token"
    })

  } else {
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        res.send({
          'status': 400,
          Message: "auth token verification failed"
        })
        return
      }

      let checkUser = await users.findOne({ _id: decoded.teammateId })
      if (!checkUser) {
        res.send({
          code: 400,
          message: "Please login again"
        })
        return
      }
      if (!checkUser.metaData[0].status) {
        res.send({
          code: 400,
          message: "Please login again"
        })
        return
      }

      req.userId = decoded.userId;
      req.email = decoded.email;
      req.role = decoded.role;
      req.status = decoded.status;
      req.teammateId = decoded.teammateId;
      next();
    })
  }
};
const authJwt = {
  verifyToken: verifyToken,
};
module.exports = authJwt