// const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');
const User = require('../models/user');

const getUsers = async (req, res, next) => {
    let users;
    try {
        users = await User.find({}, '-password'); // can also be find({}, 'email name image etc')
    } catch (err) {
        return next(
            new HttpError('Fetching users failed, please try again later.', 500)
        );
    }
    res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        // console.log(errors);
        return next(
            new HttpError('Invalid inputs passed, please check your data.', 422)
        );
    }

    const { name, email, password } = req.body;

    let existingUser;
    try {
        existingUser = await User.findOne({ email });
    } catch (err) {
        return next(
            new HttpError('Signing up failed, please try again later', 422)
        );
    }

    if (existingUser) {
        return next(
            new HttpError('User exists, already, please login instead', 422)
        );
    }

    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, 12);
    } catch (err) {
        return next(
            new HttpError('Could not create user, please try again.', 500)
        );
    }

    const userToCreate = new User({
        name,
        email,
        image: req.file.location,
        password: hashedPassword,
        places: [],
    });

    try {
        await userToCreate.save();
    } catch (err) {
        return next(new HttpError('Signing up failed, please try again', 500));
    }

    // Once the user is saved in the db, there is a new property "id" that is provided on the "userToCreate" object
    let token;

    try {
        token = jwt.sign(
            { userId: userToCreate.id, email: userToCreate.email },
            process.env.JWT_KEY,
            { expiresIn: '1h' }
        );
    } catch (err) {
        return next(new HttpError('Signing up failed, please try again', 500));
    }

    // res.status(201).json({ user: userToCreate.toObject({ getters: true }) });
    res.status(201).json({
        userId: userToCreate.id,
        email: userToCreate.email,
        token,
    });
};

const login = async (req, res, next) => {
    const { email, password } = req.body;

    // const userToIdentify = DUMMY_USERS.find((u) => u.email === email);

    // if (!userToIdentify || userToIdentify.password !== password) {
    //   return next(
    //     new HttpError(
    //       'Could not identify user, credentials seem to be wrong',
    //       401
    //     )
    //   );
    // }

    let existingUser;

    try {
        existingUser = await User.findOne({ email });
    } catch (err) {
        return next(
            new HttpError('Logging in failed, please try again later', 500)
        );
    }

    if (!existingUser) {
        return next(
            new HttpError('Invalid credentials, could not log you in.', 403)
        );
    }

    let isValidPassword = false;

    try {
        isValidPassword = await bcrypt.compare(password, existingUser.password);
    } catch (err) {
        return next(
            new HttpError(
                'Something went wrong when trying to log you in, please check your credentials and try again.',
                500
            )
        );
    }

    if (!isValidPassword) {
        return next(
            new HttpError('Invalid credentials, could not log you in.', 403)
        );
    }


    let token;

    try {
        token = jwt.sign(
            { userId: existingUser.id, email: existingUser.email },
            process.env.JWT_KEY,
            { expiresIn: '1h' }
        );
    } catch (err) {
        return next(new HttpError('Logging in failed, please try again', 500));
    }

    // res.json({
    //     message: 'Logged in !',
    //     user: existingUser.toObject({ getters: true }),
    // });

    res.json({
        userId: existingUser.id,
        email: existingUser.email,
        token,
    });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;