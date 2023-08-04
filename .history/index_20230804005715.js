const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express()

//middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.gfg0jvx.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true, } });



async function run() {

    //verify token after getting token from local storage
    function verifyJWT(req, res, next) {
        const authHeader = req.headers.authorization;
        console.log(authHeader)
        if (!authHeader) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        const token = authHeader.split(' ')[1]
        console.log(token)
        jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
            if (err) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            req.decoded = decoded;
            next();
        })

    }

    try {
        const categoriesCollection = client.db('resaleMarket').collection('category');
        const usersCollection = client.db('resaleMarket').collection('users');
        const productsCollection = client.db('resaleMarket').collection('products');
        const bookingsCollection = client.db('resaleMarket').collection('bookings');


        //make sure you use verifyAdmin after verifyJWT
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Only admin Access!' })
            }
            next();
        }

        //give token for a user, at first check that the user have in usersCollection
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN)
                return res.send({ accessToken: token })
            }
            console.log(process.env.ACCESS_TOKEN)
            res.status(403).send({ accessToken: '' })
        })

        //get services
        app.get('/categories', verifyJWT, async (req, res) => {
            const query = {}
            const options = await categoriesCollection.find(query).toArray()
            res.send(options)
        })

        //get single service
        app.get('/category/:type', async (req, res) => {
            const type = req.params.type;
            const categoryQuery = { type: type }
            const categoryProducts = await productsCollection.find(categoryQuery).toArray()
            res.send(categoryProducts)
        })


        //store users information from sign up page
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })


        //get buyer or seller if has any request for buyer or seller otherwise show all users
        app.get('/users', verifyJWT, async (req, res) => {
            const query = {}
            const email = req.query.email;
            const role = req.query.role;
            const emailQuery = { email: email }
            if (email) {
                const emailOption = await usersCollection.findOne(emailQuery);
                return res.send(emailOption);
            }
            const userQuery = { role: role };
            const options = await usersCollection.find(query).toArray()
            if (role) {
                const result = await usersCollection.find(userQuery).toArray()
                return res.send(result);
            }
            res.send(options)
        })


        //store payment information and update bookings 
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                productName: booking.productName,
                email: booking.email
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray()
            if (alreadyBooked.length) {
                const message = `You already have booking on ${booking.productName}`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })


        //get store product by email address
        app.get('/dashboard/myorders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result)
        })

        //delete booking from database
        app.delete('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await bookingsCollection.deleteOne(filter)
            res.send(result)
        })

        //get product by email id from addproduct collection
        app.get('/dashboard/myproduct', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await productsCollection.find(query).toArray()
            res.send(result)
        })


        //store products in database
        app.post('/dashboard/addproduct', async (req, res) => {
            //insert product
            const product = req.body;
            const result = await productsCollection.insertOne(product);

            //get user info
            const query = { email: product.email }
            const usersOption = await usersCollection.findOne(query)

            const email = product.email;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    userName: usersOption.name,
                    userType: usersOption.type
                }
            }
            const finalResult = await productsCollection.updateMany(filter, updatedDoc, options)
            res.send(finalResult)
        })

        //delete booking from database
        app.delete('/dashboard/addproduct/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await bookingsCollection.deleteOne(filter)
            res.send(result)
        })


        //delete user from database
        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(filter)
            res.send(result)
        })

        //make admin 
        app.put('/users/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: "admin"
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result);
        })

        //verify admin
        app.put('/users/verify/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    type: "verified"
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result);
        })

        //from the users list check that the user is admin or not
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send({ isAdmin: user?.role === 'admin' })
        })

        //from the users list check that the user is seller
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send({ isSeller: user?.role === 'seller' })
        })

        //from the users list check that the user is buyer
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send({ isBuyer: user?.role === 'buyer' })
        })

    }
    finally {

    }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
    res.send('Resale market running')
})

app.listen(port, () => {
    console.log(`Resale market running on ${port}`)
})