// const fs = require('fs');
const path = require('path');
 
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
 
const placesRoutes = require('./routes/places-routes');
const HttpError = require('./models/http-error');
const usersRoutes = require('./routes/users-routes');
const fileDelete = require('./middleware/file-delete');
 
const app = express();
 
app.use(bodyParser.json()); // parse any incoming request body, and extract any json, convert to regular js, and calls next automatically with the body being filled
 
app.use(express.static(path.join('public')));
 
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
 
    next();
});
 
app.use('/api/places/', placesRoutes); // /api/places is the initial filter for placesRoutes, then you append the different paths present in the placesRoutes
 
app.use('/api/users/', usersRoutes);
 
app.use((req, res, next) => {
    return next(new HttpError('Could not find this route', 404));
});
 
app.use((error, req, res, next) => {
    // this middleware is the general error handler.
 
    if (req.file) {
        fileDelete(req.file.location);
 
        // fs.unlink(req.file.path, (err) => {
        //     console.log(err);
        // });
    }
    if (res.headersSent) {
        return next(error);
    }
    // Basically, this check is necessary for scenarios where a response header has already been sent but you encounter an error while streaming the response to a client for example. Then, you forward the error encountered to the default express error handler that will handle it for you !
 
    res.status(error.code || 500);
    res.json({ message: error.message || 'An unknown error occurred!' });
    // res.json({ message : 'An unknown error occurred!' });
});
 
mongoose
    .connect(
        `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ll392ux.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`
    )
    .then(() => {
        app.listen(process.env.PORT || 5000);
    })
    .catch((err) => {
        console.log(err);
    });
 
module.exports = app;
