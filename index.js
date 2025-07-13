const express = require('express');
const router = express.Router();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


//middleware
app.use(cors({
  origin: ['http://localhost:5000', 
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
    await client.connect();

    const userCollection = client.db('metro_bond').collection('users'); 
    const reviewCollection = client.db('metro_bond').collection('reviews'); 
    const bioCollection = client.db('metro_bond').collection('bioData'); 
    const favoriteCollection = client.db('metro_bond').collection('favorite'); 
    const paymentCollection = client.db('metro_bond').collection('payments'); 
    const premiumCollection = client.db('metro_bond').collection('premium'); 
   


    //jwt related api's
    app.post('/jwt', async(req,res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, 
        {expiresIn: '5h'});
      res.send({ token });
    })

    //middlewares
    const verifyToken = (req, res, next) =>{
      // console.log("inside verify token", req.headers.authorization);
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
      // console.log(result);
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
      // console.log("Received User:", user); 
      const query = {email: user.email} 
      const existingUser = await userCollection.findOne(query);
      
      if(existingUser){
        return res.send({ message: 'user already exists', insertedId: null});
      }
      const result = await userCollection.insertOne(user);
      // console.log("Inserted User:", result);
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
    app.patch('/users/premium/:id', verifyToken, verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'premium'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.delete('/users/:id',verifyToken, verifyAdmin, async(req,res) => {
      const id = req.params.id;
      // console.log("Deleting user with ID:", id);
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


   //bioData related api's
    app.get('/bioData', async (req, res) => {
      // console.log('Fetching bioData...');
    
      const email = req.query.email;
      const { minAge, maxAge, biodataType , permanentDivision } = req.query;
      
      let query ={};

      if(email){
        query.email = email
      }
    
      // Filter Object
      // let query = {};
      if (minAge && maxAge) {
        query.age = { $gte: parseInt(minAge), $lte: parseInt(maxAge) };
      }
     
      if (biodataType) query.biodataType = biodataType;
      if (permanentDivision) query.permanentDivision = permanentDivision;
      // console.log("Query:", query);

      const result = await bioCollection.find(query).toArray();
      res.send(result);
    });


    app.get('/bioData/:id', async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await bioCollection.findOne(query);
      res.send(result);
    })

    
    app.get('/bioDataCount', async(req,res)=>{
      const count = await bioCollection.estimatedDocumentCount();;
      res.send({count});
    })


    //create or update bioData
    app.post('/bioData', async (req, res) => {
      try {
          const biodata = req.body;
          const userEmail = biodata.email;
  
          // Check if the biodata already exists
          const existingBiodata = await bioCollection.findOne({ email: userEmail });
  
          if (!existingBiodata) {
              // Find the last inserted biodata ID only if inserting a new record
              const lastBiodata = await bioCollection.find().sort({ biodataId: -1 }).limit(1).toArray();
              const newId = lastBiodata.length > 0 ? lastBiodata[0].biodataId + 1 : 1;
              
              // Assign new ID
              biodata.biodataId = newId;
  
              // Insert the new biodata
              const result = await bioCollection.insertOne(biodata);
              return res.send({ message: 'Biodata created successfully', result });
          }
  
          // If biodata exists, update it
          const result = await bioCollection.updateOne(
              { email: userEmail },
              { $set: biodata }
          );
  
          res.send({ message: 'Biodata updated successfully', result });
  
      } catch (error) {
          console.error(error);
          res.status(500).send({ message: 'Error creating/updating biodata' });
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
      // console.log(query)
      const  result = await favoriteCollection.find(query).toArray();
      res.send(result);
    })

    // DELETE favorite item by ID
    app.delete('/favorite/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await favoriteCollection.deleteOne(query);
      res.setHeader("Cache-Control", "no-cache"); 
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

    app.get('/payment/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };  
      const result = await paymentCollection.findOne(query);
      
      if (!result) {
          return res.status(404).send({ message: 'Payment not found' });
      }
  
      res.send(result);
  });

  
  //   app.get('/payments/:email', verifyToken, async (req, res) => {
  //     const query = {email: req.params.email}
  //     if(req.params.email !== req.decoded.email){
  //       return res.status(403).send({message: 'forbidden access'})
  //     }
  //     const result = await paymentCollection.find(query).toArray();
  //     res.send(result);
  // });


    app.post('/payments', async(req,res)=>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      // console.log('payment info', payment);
      res.send(paymentResult);

    })

     //to see contact info




app.get("/contact/:email", async (req, res) => {
  const email = req.params.email;
  // console.log(email);

  try {
    const result = await paymentCollection.find({ email: email }).toArray(); 

    if (result.length === 0) {
      return res.status(404).json({ message: "No contact requests found!" });
    }

    // console.log(result);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});



app.delete("/contact/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await paymentCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Contact request not found!" });
    }
    res.json({ message: "Contact request deleted successfully!" });
  } catch (error) {
    console.error("Error deleting contact request:", error);
    res.status(500).json({ message: "Server error", error });
  }
});


app.get('/admin/payments', async (req, res) => {
  try {
    const payments = await paymentCollection.find().toArray(); // Get all payments
    res.status(200).json(payments); // Send all payment data to the admin
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get('/payments/:email', verifyToken, async (req, res) => {
  const query = { email: req.params.email };

  // Verify token to make sure the user is accessing their own data
  if (req.params.email !== req.decoded.email) {
    return res.status(403).send({ message: 'Forbidden access' });
  }

  try {
    const result = await paymentCollection.find(query).toArray(); // Get payments of specific user
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching user payments:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch('/payment-data/:id', async (req, res) => {
  const id = req.params.id;
  const updateData = { status: req.body.status };

  const result = await paymentCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData }
  );

  if (result.modifiedCount === 0) {
    return res.status(404).send({ message: "Payment data not found or no change made" });
  }

  res.send({ message: "Payment status updated successfully" });
});


app.delete("/payments/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await paymentCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Payment not found!" });
    }

    res.status(200).json({ message: "Payment record deleted successfully!" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ message: "Server error" });
  }
});




//premium request
app.post("/premiumRequest", async (req, res) => {
  const { biodataId, name, email } = req.body;

  try {
    const existingRequest = await premiumCollection.findOne({ biodataId });

    if (existingRequest) {
      return res.status(400).json({ message: "Request already sent!" });
    }

    const result = await premiumCollection.insertOne({ biodataId, name, email, status: "pending" });

    res.status(200).json({ message: "Request sent successfully", result });
  } catch (error) {
    console.error("Error processing premium request:", error);
    res.status(500).json({ message: "Server error" });
  }
})


app.get("/premiumRequest", async (req, res) => {
  try {
    const premiumRequests = await premiumCollection.find().toArray();
    res.status(200).json(premiumRequests);
  } catch (error) {
    console.error("Error fetching premium requests:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch('/premiumRequest/:id', async (req, res) => {
  const id = req.params.id;
  const updateData = { status: req.body.status };

  try {
    const result = await premiumCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).send({ message: "Premium request not found or no change made" });
    }

    res.send({ message: "Premium request status updated successfully" });
  } catch (error) {
    console.error("Error updating premium request:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});


app.patch('/payment-data/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const updateData = { status: req.body.status };

  try {
    // Update the status in the payment collection
    const paymentResult = await paymentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (paymentResult.modifiedCount === 0) {
      return res.status(404).send({ message: "Payment data not found or no change made" });
    }

    // Update the isPremium status in the bioCollection 
    const userEmail = req.body.email; 
    const bioUpdateResult = await bioCollection.updateOne(
      { email: userEmail },
      { $set: { isPremium: true } }  
    );

    if (bioUpdateResult.modifiedCount === 0) {
      return res.status(404).send({ message: "User not found in bioCollection or no change made" });
    }

    res.send({ message: "Payment and premium status updated successfully" });
  } catch (error) {
    console.error("Error updating payment and premium status:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});



app.delete("/premium/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await premiumCollection.deleteOne({ _id: new ObjectId(id) });  

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "User not found!" });  
    }

    res.status(200).json({ message: "User deleted successfully" });  
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });  
  }
});


    

//stats or analytics
app.get('/admin-stats', verifyToken, verifyAdmin, async(req,res)=>{
  const users = await userCollection.estimatedDocumentCount();
  const biodatas = await bioCollection.estimatedDocumentCount();
  const premiumPay = await paymentCollection.estimatedDocumentCount();
  
  const result = await paymentCollection.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: {
          $sum: '$price'
        }
      }
    }
  ]).toArray();
  const revenue = result.length > 0? result[0].totalRevenue : 0;

    // Male & Female biodata count 
  const genderStats = await bioCollection.aggregate([
    {
      $group: {
        _id: { $toLower: "$biodataType" }, 
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  // Male & Female count 
  let maleCount = 0;
  let femaleCount = 0;
  
  genderStats.forEach(stat => {
    if (stat._id === "male") {
      maleCount = stat.count;
    } else if (stat._id === "female") {
      femaleCount = stat.count;
    }
  });

  res.send({
    users,
    biodatas,
    premiumPay,
    revenue, 
    maleCount, 
    femaleCount
  })
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