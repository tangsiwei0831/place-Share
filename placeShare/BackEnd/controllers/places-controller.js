const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
 
const fs = require('fs');
// const path = require('path');
 
const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Place = require('../models/place');
const User = require('../models/user');
const fileDelete = require('../middleware/file-delete');
 
const getPlaceById = async (req, res, next) => {
    const placeId = req.params.pid;
 
    let place;
    try {
        place = await Place.findById(placeId);
    } catch (err) {
        return next(
            new HttpError('Could not fetch place for the provided ID', 500)
        );
    }
 
    if (!place) {
        return next(
            new HttpError('Could not find a place for the provided ID', 404)
        );
        // use the throw (new) error only for synchronous code. When working with databases ( asynchronous), use next(error) to throw the error
    }
 
    res.json({ place: place.toObject({ getters: true }) });
    // toObject to convert to a real js object instead of the mongodb object  and getters : true to get rid of the _id and use id instead
};
 
const getPlacesByUserId = async (req, res, next) => {
    const userId = req.params.uid;
 
    // let places;
    let userWithPlaces;
    try {
        // places = await Place.find({ creator: userId });
        userWithPlaces = await User.findById(userId).populate('places');
    } catch (err) {
        return next(
            new HttpError(
                'Could not fetch places for the provided user ID',
                500
            )
        );
    }
 
    // if (!places || places.length === 0) {
    if (!userWithPlaces) {
        return next(
            new HttpError('Could not find places for the provided user ID', 404)
        );
        //use next(error) with asynchronous code ( working with Databases) to throw the error
    }
 
    res.json({
        // places: places.map((place) => place.toObject({ getters: true })),
        places: userWithPlaces.places.map((place) =>
            place.toObject({ getters: true })
        ),
    });
};
 
const createPlace = async (req, res, next) => {
    const errors = validationResult(req);
 
    if (!errors.isEmpty()) {
        // console.log(errors);
        return next(
            new HttpError('Invalid inputs passed, please check your data.', 422)
        );
    }
 
    const { title, description, address } = req.body;
 
    let coordinates;
    try {
        coordinates = await getCoordsForAddress(address);
    } catch (error) {
        return next(error);
    }
 
    const placeToCreate = new Place({
        title,
        description,
        address,
        location: coordinates,
        image: req.file.location,
        creator: req.userData.userId,
    });
 
    let user;
 
    try {
        user = await User.findById(req.userData.userId);
    } catch (err) {
        return next(
            new HttpError('Creating place failed, please try again', 500)
        );
    }
 
    if (!user) {
        return next(new HttpError('Could not find user for provided id', 404));
    }
 
    // console.log(user);
 
    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await placeToCreate.save({ session: sess });
        user.places.push(placeToCreate);
        await user.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        return next(
            new HttpError('Creating place failed, please try again', 500)
        );
    }
 
    res.status(201).json({ place: placeToCreate });
};
 
const updatePlace = async (req, res, next) => {
    const errors = validationResult(req);
 
    if (!errors.isEmpty()) {
        // console.log(errors);
        return next(
            new HttpError('Invalid inputs passed, please check your data.', 422)
        );
    }
 
    const { title, description } = req.body;
 
    const placeId = req.params.pid;
 
    // const placeToUpdate = { ...DUMMY_PLACES.find((p) => p.id === placeId) };
    // const placeToUpdateIndex = DUMMY_PLACES.findIndex((p) => p.id === placeId);
 
    let place;
    try {
        place = await Place.findById(placeId);
    } catch (err) {
        return next(
            new HttpError('Could not update place with the provided ID', 500)
        );
    }
 
    console.log('place creator: ', place.creator);
    console.log('place creator: ', typeof place.creator);
    console.log('req.userData.userId : ', req.userData.userId);
    console.log('req.userData.userId : ', typeof req.userData.userId);
 
    if (place.creator.toString() !== req.userData.userId) {
        return next(
            new HttpError('You are not allowed to edit this place', 401)
        );
    }
 
    place.title = title;
    place.description = description;
 
    try {
        await place.save();
    } catch (err) {
        return next(
            new HttpError('Could not update place with the provided ID', 500)
        );
    }
 
    res.status(200).json({ place: place.toObject({ getters: true }) });
};
 
const deletePlace = async (req, res, next) => {
    const placeId = req.params.pid;
 
    let place;
    try {
        place = await Place.findById(placeId).populate('creator');
        // populate method allows you to access the related document through the creator property and to work within that document as if it was an object
    } catch (err) {
        return next(
            new HttpError('Could not delete place with the provided ID', 500)
        );
    }
 
    if (!place) {
        return next(
            new HttpError('Could not find a place with the provided ID', 404)
        );
    }
 
    if (place.creator.id !== req.userData.userId) {
        return next(
            new HttpError('You are not allowed to delete this place', 401)
        );
    }
 
    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await place.remove({ session: sess });
        place.creator.places.pull(place);
        await place.creator.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        return next(
            new HttpError('Could not update place with the provided ID', 500)
        );
    }
 
    const imagePath = place.image;
    fileDelete(imagePath);
    // fs.unlink(imagePath, (err) => {
    //     console.log(err);
    // });
 
    res.status(200).json({ message: 'Deleted place' });
};
 
exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;