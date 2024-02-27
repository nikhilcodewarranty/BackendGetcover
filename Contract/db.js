require("dotenv").config()


const mongoose = require('mongoose')

const dbUrl = process.env.DB_URL + 'User'


const connection = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // allowDiskUse:true 
}

mongoose
    .connect(dbUrl, connection)
    .then((res) => {
        console.info('Connected to db Contracts')
    })
    .catch((e) => {
        console.log('Unable to connect to the db', e)
    })