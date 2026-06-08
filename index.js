const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');


const express = require('express')
const app = express()
require('dotenv').config()

app.use(cors()) // Middleware to enable CORS
app.use(express.json()) // Middleware to parse JSON bodies

const port = process.env.PORT || 5000

app.get('/', (req, res) => {
  res.send('Hello World!')
})



const uri = process.env.MONGODB_URI;

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

    const db = client.db("hireloop-db");
    const jobCollection = db.collection("jobs");
    const companyCollection = db.collection("companies");

    app.post('/api/jobs', async(req,res)=>{
        const job = req.body;
        const result = await jobCollection.insertOne(job);
        res.send(result);
    })

    app.get('/api/jobs', async(req,res)=>{
        const query = {};
        if (req.query.companyId) {
            query.companyId = req.query.companyId;
        }
        if(req.query.status){
             query.status = req.query.status; 
        }

        const cursor = jobCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
    })


    //companies api
    app.post('/api/companies', async(req,res)=>{
        const company = req.body;
        const result = await companyCollection.insertOne(company);
        res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})