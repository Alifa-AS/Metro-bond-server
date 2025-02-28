const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


//middleware
app.use(cors({
  origin: ['https://b10-a12-metro-server.vercel.app', 
    'https://b10a12-metro.web.app',
    'https://b10a12-metro.firebaseapp.com',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jhhpo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db('metro_bond').collection('users'); 
    const reviewCollection = client.db('metro_bond').collection('reviews'); 
    const bioCollection = client.db('metro_bond').collection('bioData'); 
    const favoriteCollection = client.db('metro_bond').collection('favorite'); 
    const paymentCollection = client.db('metro_bond').collection('payments'); 


    //jwt related api's
    app.post('/jwt', async(req,res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, 
        {expiresIn: '5h'});
      res.send({ token });
    })

    //middlewares
    const verifyToken = (req, res, next) =>{
      console.log("inside verify token", req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({ message: 'Unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err, decoded)=>{
        if(err){
          return res.status(401).send({ message: ' UnAuthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    //use verify admin after verify token
    const verifyAdmin = async(req,res,next) =>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({ message: 'Forbidden access' })
      }
      next();
    }

    //user related api
    app.get('/users', verifyToken, verifyAdmin, async(req,res)=>{
      const result = await userCollection.find().toArray();
      console.log(result);
      res.send(result);
    })

    app.get('/users/admin/:email', verifyToken, async(req,res) =>{
      const email = req.params.email;

      // if(email !== req.decoded.email){
      //   return res.status(403).send({ message: 'Forbidden access' })
      // }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === 'admin'
      }
      res.send({ admin });
    })

    app.post('/users', async(req,res) => {
      const user = req.body;
      console.log("Received User:", user); 
      const query = {email: user.email} 
      const existingUser = await userCollection.findOne(query);
      
      if(existingUser){
        return res.send({ message: 'user already exists', insertedId: null});
      }
      const result = await userCollection.insertOne(user);
      console.log("Inserted User:", result);
      res.send(result);
    })
  
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.delete('/users/:id',verifyToken, verifyAdmin, async(req,res) => {
      const id = req.params.id;
      console.log("Deleting user with ID:", id);
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })
    

    //reviews related apis
    app.get('/successReview', async(req,res)=>{
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })

    app.post('/successReview', async(req,res)=>{
      const story = req.body;
      const result = await reviewCollection.insertOne(story);
      res.send(result);
    })

    //review details 
    app.get('/successReview/:id', async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await reviewCollection.findOne(query);
      res.send(result);
    })


    //bioData related apis
    // app.get('/bioData', async(req,res)=>{
    //   const { minAge, maxAge, gender, division } = req.query;
    //   // Build filter object
    //   let filter = {};
    //   if (minAge) filter.age = { $gte: parseInt(minAge) };
    //   if (maxAge) filter.age = { ...filter.age, $lte: parseInt(maxAge) };
    //   if (gender) filter.gender = gender;
    //   if (division) filter.division = division;

    //   const result = await bioCollection.find(filter).toArray();
    //   res.send(result);
    // })


    app.get('/bioData', async (req, res) => {
      console.log('Fetching bioData...');
    
      const { minAge, maxAge, biodataType , permanentDivision } = req.query;
    
      // Filter Object
      let query = {};
      if (minAge && maxAge) {
        query.age = { $gte: parseInt(minAge), $lte: parseInt(maxAge) };
      }
     
      if (biodataType) query.biodataType = biodataType;
      if (permanentDivision) query.permanentDivision = permanentDivision;
      console.log("Query:", query);

      const result = await bioCollection.find(query).toArray();
      res.send(result);
    });


    // app.post('/bioData', async(req,res)=>{
    //   const biodata = req.body;
    //   const result = await bioCollection.insertOne(biodata);
    //   res.send(result);
    // })

    app.get('/bioData/:id', async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await bioCollection.findOne(query);
      res.send(result);
    })


    app.post('/bioData', async (req, res) => {
      try {
          const biodata = req.body;
          // New Biodata ID generate 
          const lastBiodata = await bioCollection.findOne().sort({ biodataId: -1 });
          const newId = lastBiodata ? lastBiodata.biodataId + 1 : 1; 
          biodata.biodataId = newId; 
  
          const result = await bioCollection.insertOne(biodata);
          res.send(result);
      } catch (error) {
          console.error(error);
          res.status(500).send({ message: 'Error creating biodata' });
      }
  });

  

  // Get last biodata ID
  app.get('/bioData/lastId', async (req, res) => {
    try {
        const lastBiodata = await bioCollection.find().sort({ biodataId: -1 }).limit(1).toArray();
        const lastId = lastBiodata.length > 0 ? lastBiodata[0].biodataId : 0;
        res.send({ lastId });
    } catch (error) {
        console.error("Error fetching last biodata ID:", error);
        res.status(500).send({ message: "Server error" });
    }
  });



    //favorite api's
    app.post('/favorite', async (req,res)=>{
      const person = req.body;
      const result = await favoriteCollection.insertOne(person);
      res.send(result);
    })

    app.get('/favorite', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = {email: email};
      const  result = await favoriteCollection.find(query).toArray();
      res.send(result);
    })

    // DELETE favorite item by ID
    app.delete('/favorite/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await favoriteCollection.deleteOne(query);
      res.send(result);     
    });

    //payment intent
    app.post('/create-payment-intent', async (req,res)=>{
      const {amount} = req.body;
     
      // Minimum amount check (5 dollars = 500 cents)
      if (isNaN(amount) || amount < 500) {
        return res.status(400).send({ message: 'Invalid amount' });
    }

      try{
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      }
      catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).send({ error: 'Error creating payment intent' });
    }
    })

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = {email: req.params.email}
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
  });

    // app.post('/payments', async(req,res)=>{
    //   const payment = req.body;
    //   const paymentResult = await paymentCollection.insertOne(payment);

    //   //delete each 
    //   console.log('payment info', payment);
    //   const query = {_id:{
    //     $in: payment?._id?.map(id=>new ObjectId(id))
    //   }};

    //   const deleteResult = await bioCollection.deleteMany(query);
    //   res.send({paymentResult, deleteResult});
    // })
   
    app.post('/payments', async(req,res)=>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send(paymentResult);

    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");


} finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req,res) =>{
    res.send('metro portal running!')
})

app.listen(port, () =>{
    console.log(`metro server: ${port}`)
})