const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const usersCollection = db.collection("user");
    const companyCollection = db.collection("companies");
    const applicationCollection = db.collection("applications");
    const plansCollection = db.collection("plans")
    const subscriptionCollection = db.collection("subscriptions")

    app.post('/api/jobs', async(req,res)=>{
        const job = req.body;
        const newJob = {
          ...job,
          createAt: new Date()
        }
        const result = await jobCollection.insertOne(newJob);
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

    app.get('/api/jobs/:id', async(req,res)=>{
        const id = req.params.id;
        const query = {
          _id: new ObjectId(id)
        };
        const result = await jobCollection.findOne(query);
        res.send(result);
    })


    //companies api

    // app.get('/api/companies', async(req,res)=>{
    //   const cursor = companyCollection.find();
    //   const result = await cursor.toArray();
    //   res.send(result)
    // })


    // inefficient way to join collection/aggregate
    app.get('/api/companies', async(req,res)=>{
      const cursor = companyCollection.find();
      const companies = await cursor.toArray();


      for(const company of companies){
        const filter ={
          companyId: company._id.toString()
        }
        const jobCount = await jobCollection.countDocuments(filter);
        company.jobCount = jobCount
      }

      res.send(companies)
    })

    app.post('/api/companies', async(req,res)=>{
        const company = req.body;
        const newCompany = {
          ...company,
          createAt: new Date()
        }
        const result = await companyCollection.insertOne(newCompany);
        res.send(result);
    })

    app.get('/api/my/companies', async(req,res)=>{
        const query = {};
        if(req.query.recruiter_id){
            query.recruiter_id = req.query.recruiter_id;
        }
        const result = await companyCollection.findOne(query);
        res.send(result || {});
    })

    app.patch('/api/companies/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { company_name, logo, website_url, location, employee_count, description, status } = req.body;
      const updatedDoc = { $set: {} };
      
      if (company_name !== undefined) updatedDoc.$set.company_name = company_name;
      if (logo !== undefined) updatedDoc.$set.logo = logo;
      if (website_url !== undefined) updatedDoc.$set.website_url = website_url;
      if (location !== undefined) updatedDoc.$set.location = location;
      if (employee_count !== undefined) updatedDoc.$set.employee_count = employee_count;
      if (description !== undefined) updatedDoc.$set.description = description;
      
      if (status !== undefined) {
        updatedDoc.$set.status = status;
      } else {
        updatedDoc.$set.status = 'pending';
      }
      
      const result = await companyCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });


    // application related api

    app.get('/api/applications', async(req,res)=>{
        const query = {};
        if(req.query.applicantId){
            query.applicantId = req.query.applicantId;
        }
        if(req.query.jobId){
            query.jobId = req.query.jobId;
        }
        const cursor = applicationCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
    })

    app.post('/api/applications', async(req,res)=>{
        const application = req.body;
        const newApplication = {
          ...application,
          createAt: new Date()
        }
        const result = await applicationCollection.insertOne(newApplication);
        res.send(result);
    })

    // plans
    app.get('/api/plans', async(req,res)=>{
      const query = {};
      if(req.query.plan_id){
        query.id = req.query.plan_id
      }
      const plan = await plansCollection.findOne(query)
      res.send(plan)
    })

    // subscription
    app.post('/api/subscriptions', async(req,res)=>{
      const data = req.body
      const subsInfo ={
        ...data,
        createdAt: new Date()
      }
      const result = await subscriptionCollection.insertOne(subsInfo)

      //  update information
      const filter = {email: data.email};
      const updateDocument ={
        $set:{  
          plan: data.planId
        },
      };
      const updateResult = await usersCollection.updateOne(filter, updateDocument);
      res.send(updateResult)
    })

    app.get('/api/my/subscriptions', async (req, res) => {
      const { email } = req.query;
      if (!email) return res.status(400).send({ error: 'email is required' });
      const result = await subscriptionCollection.find({ email }).toArray();
      res.send(result);
    })

    // bookmarks (saved jobs) api
    const bookmarkCollection = db.collection("bookmarks")

    app.post('/api/bookmarks', async (req, res) => {
      const { userId, jobId } = req.body;
      if (!userId || !jobId) {
        return res.status(400).send({ error: "userId and jobId are required" });
      }
      const existing = await bookmarkCollection.findOne({ userId, jobId });
      if (existing) {
        return res.send({ message: "Job already bookmarked", insertedId: existing._id });
      }
      const result = await bookmarkCollection.insertOne({
        userId,
        jobId,
        createdAt: new Date()
      });
      res.send(result);
    });

    app.get('/api/bookmarks', async (req, res) => {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).send({ error: "userId is required" });
      }
      const bookmarks = await bookmarkCollection.find({ userId }).toArray();
      const jobIds = bookmarks.map(b => {
        try { return new ObjectId(b.jobId); } catch { return null; }
      }).filter(Boolean);
      const jobs = await jobCollection.find({ _id: { $in: jobIds } }).toArray();
      res.send(jobs);
    });

    app.delete('/api/bookmarks', async (req, res) => {
      const { userId, jobId } = req.query;
      if (!userId || !jobId) {
        return res.status(400).send({ error: "userId and jobId are required" });
      }
      const result = await bookmarkCollection.deleteOne({ userId, jobId });
      res.send(result);
    });

    // job actions (patch and delete)
    app.patch('/api/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateData = { ...req.body };
      delete updateData._id;
      const result = await jobCollection.updateOne(filter, { $set: updateData });
      res.send(result);
    });

    app.delete('/api/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await jobCollection.deleteOne(filter);
      res.send(result);
    });

    // application status updates
    app.patch('/api/applications/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const { status } = req.body;
      const result = await applicationCollection.updateOne(filter, { $set: { status } });

      // Mock email log
      const appDoc = await applicationCollection.findOne(filter);
      if (appDoc) {
        console.log(`[MOCK EMAIL SENT] To: ${appDoc.email}, Subject: Application Update for ${appDoc.jobTitle}, Body: Hi ${appDoc.applicantName}, your application status for ${appDoc.jobTitle} at ${appDoc.companyName} has been updated to "${status}".`);
      }
      res.send(result);
    });

    // stats endpoints
    app.get('/api/stats/seeker', async (req, res) => {
      const { userId } = req.query;
      if (!userId) return res.status(400).send({ error: 'userId is required' });

      const savedCount = await bookmarkCollection.countDocuments({ userId });
      const applications = await applicationCollection.find({ applicantId: userId }).toArray();

      const submitted = applications.length;
      const interviews = applications.filter(a => a.status === 'shortlisted').length;
      const offers = applications.filter(a => a.status === 'offered').length;

      const distribution = {
        applied: applications.filter(a => a.status === 'applied').length,
        under_review: applications.filter(a => a.status === 'under_review').length,
        shortlisted: interviews,
        rejected: applications.filter(a => a.status === 'rejected').length,
        offered: offers
      };

      res.send({ savedCount, submitted, interviews, offers, distribution });
    });

    app.get('/api/stats/recruiter', async (req, res) => {
      const { recruiterId } = req.query;
      if (!recruiterId) return res.status(400).send({ error: 'recruiterId is required' });

      const company = await companyCollection.findOne({ recruiter_id: recruiterId });
      if (!company) {
        return res.send({ company: null, totalJobs: 0, totalApplicants: 0, activeJobs: 0, closedJobs: 0, chartData: [], recentApplicants: [] });
      }

      const companyId = company._id.toString();

      const totalJobs = await jobCollection.countDocuments({ companyId });
      const activeJobs = await jobCollection.countDocuments({ companyId, status: 'active' });
      const closedJobs = await jobCollection.countDocuments({ companyId, status: 'closed' });

      const jobs = await jobCollection.find({ companyId }).toArray();
      const jobIds = jobs.map(j => j._id.toString());

      const applications = await applicationCollection.find({ jobId: { $in: jobIds } }).toArray();
      const totalApplicants = applications.length;

      const chartData = jobs.map(j => {
        const count = applications.filter(a => a.jobId === j._id.toString()).length;
        return { name: j.job_title, applicants: count };
      });

      const recentApplicants = [...applications]
        .sort((a, b) => new Date(b.createAt || b.createdAt) - new Date(a.createAt || a.createdAt))
        .slice(0, 5);

      res.send({
        company,
        totalJobs,
        totalApplicants,
        activeJobs,
        closedJobs,
        chartData,
        recentApplicants
      });
    });

    app.get('/api/stats/admin', async (req, res) => {
      const totalUsers = await usersCollection.countDocuments();
      const totalRecruiters = await usersCollection.countDocuments({ role: 'recruiter' });
      const totalCompanies = await companyCollection.countDocuments();
      const totalJobs = await jobCollection.countDocuments();

      const payments = await subscriptionCollection.find().toArray();
      const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const jobs = await jobCollection.find().toArray();
      const categoryCounts = {};
      jobs.forEach(j => {
        const cat = j.job_category || 'General';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      const categoryChart = Object.keys(categoryCounts).map(cat => ({
        name: cat,
        count: categoryCounts[cat]
      }));

      const users = await usersCollection.find().toArray();
      const regByDate = {};
      users.forEach(u => {
        const date = u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : 'Unknown';
        regByDate[date] = (regByDate[date] || 0) + 1;
      });
      const registrationChart = Object.keys(regByDate)
        .filter(d => d !== 'Unknown')
        .sort()
        .slice(-30)
        .map(d => ({ date: d, count: regByDate[d] }));

      res.send({
        totalUsers,
        totalRecruiters,
        totalCompanies,
        totalJobs,
        totalRevenue,
        categoryChart,
        registrationChart
      });
    });

    // admin user controls
    app.get('/api/admin/users', async (req, res) => {
      const query = {};
      if (req.query.email) {
        query.email = { $regex: req.query.email, $options: 'i' };
      }
      if (req.query.role) {
        query.role = req.query.role;
      }
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.patch('/api/admin/users/:id', async (req, res) => {
      const id = req.params.id;
      const updateData = { ...req.body };
      delete updateData._id;

      let userFilter = { _id: id };
      const userCount = await usersCollection.countDocuments({ _id: id });
      if (userCount === 0) {
        try { userFilter = { _id: new ObjectId(id) }; } catch(e) {}
      }

      const result = await usersCollection.updateOne(userFilter, { $set: updateData });
      res.send(result);
    });

    // admin payments & subscriptions summary
    app.get('/api/admin/payments', async (req, res) => {
      const payments = await subscriptionCollection.find().toArray();
      const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthlyRevenue = payments
        .filter(p => new Date(p.createdAt || p.createAt) >= thirtyDaysAgo)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const activeSeekers = await usersCollection.countDocuments({ role: 'job_seeker', plan: { $in: ['seeker_pro', 'seeker_premium'] } });
      const activeRecruiters = await usersCollection.countDocuments({ role: 'recruiter', plan: { $in: ['recruiter_growth', 'recruiter_enterprise'] } });

      res.send({
        payments,
        totalRevenue,
        monthlyRevenue,
        activeSeekers,
        activeRecruiters
      });
    });

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