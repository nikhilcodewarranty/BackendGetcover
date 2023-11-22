const express = require("express");
const router = express.Router();
const UserController = require("./controller");

router.get("/", UserController.getAllUsers);

module.exports = router;
