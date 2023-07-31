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
console.log(uri)
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true, } });



async function run() {

    //verify token after getting token from local storage
    function verifyJWT(req, res, next) {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        const token = authHeader.split(' ')[1]
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
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        })

        //get parlour services
        app.get('/categories', async (req, res) => {
            const query = {}
            const options = await categoriesCollection.find(query).toArray()
            res.send(options)
        })

        //get single 
        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const service = await parlourServicesCollection.findOne(query)
            res.send(service)
        })

        //store users information from sign up page
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })


        //get buyer or seller if has any request for buyer or seller otherwise show all users
        app.get('/users', async (req, res) => {
            const query = {}
            const role = req.query.role;
            const userQuery = { role: role };
            const options = await usersCollection.find(query).toArray()
            if (role) {
                const result = await usersCollection.find(userQuery).toArray()
                return res.send(result);
            }
            res.send(options)
        })

        /*   //create payment intent give client secret
          app.post('/create-payment-intent', async (req, res) => {
              const booking = req.body;
              const price = booking.price;
              const amount = price * 100;
     
              const paymentIntent = await stripe.paymentIntents.create({
                  currency: 'usd',
                  amount: amount,
                  "payment_method_types": [
                      "card"
                  ]
              });
              res.send({
                  clientSecret: paymentIntent.client_secret,
              });
     
          }) */

        /* //store payment information and update bookings 
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const query = {
                name: payment.treatName,
                email: payment.email
            }
            const alreadyBooked = await paymentsCollection.find(query).toArray()
            if (alreadyBooked.length) {
                const message = `You already have booking on ${payment.name}`
                return res.send({ acknowledged: false, message })
            }
            const result = await paymentsCollection.insertOne(payment)
            //send email about appointment confirmation
            sendBookingEmail(payment)
            res.send(result)
        }) */



        /*   //add review in database
          app.post('/review', async (req, res) => {
              const review = req.body;
              const result = await reviewsCollection.insertOne(review);
              res.send(result)
     
          }) */

        /*   //get parlour booking and payment services
          app.get('/payments', verifyJWT, async (req, res) => {
              const email = req.query.email;
              const decodedEmail = req.decoded.email;
              if (decodedEmail !== email) {
                  return res.status(403).send({ message: 'forbidden access' })
              }
              const query = { email: email }
              const options = await paymentsCollection.find(query).toArray()
              res.send(options)
          }) */



        //store products in database
        app.post('/dashboard/addproduct', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result)
        })

        /*   //get the added services from data database
          app.get('/addservice', async (req, res) => {
              const query = {}
              const options = await servicesCollection.find(query).toArray()
              res.send(options)
          }) */

        /*  //delete service from database
         app.delete('/service/:id', verifyJWT, verifyAdmin, async (req, res) => {
             const id = req.params.id;
             const filter = { _id: new ObjectId(id) }
             const result = await servicesCollection.deleteOne(filter)
             res.send(result)
         }) */

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

        /*  //make admin if user's role is admin then user can make admin 
         app.put('/approve/admin/:id', async (req, res) => {
             const id = req.params.id;
             const filter = { _id: new ObjectId(id) }
             const options = { upsert: true };
             const updatedDoc = {
                 $set: {
                     approve: 'true'
                 }
             }
             const result = await paymentsCollection.updateOne(filter, updatedDoc, options)
             res.send(result)
         }) */

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