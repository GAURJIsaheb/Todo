import express from "express";
import { signToken, verifyToken } from "./jwt.js";
import {db} from './mongo/mongo.js'

const router = express.Router();



/* LOGIN */
router.post("/login", async (req,res)=>{
  const { name, email } = req.body;

  if(!email || !name){
    return res.status(400).json({error:"Name & email required"});
  }

  const usersCol = db.collection("users");

  let user = await usersCol.findOne({email});

  if(user && user.name !== name){
    return res.status(401).json({error:"Invalid details"});
  }

  // new user create
  if(!user){
    user = {
      email,
      name,
      createdAt: Date.now()
    };
    await usersCol.insertOne(user);
  }

  /* ---------- workspace auto create ---------- */

  const wsCol = db.collection("workspaces");

const personal = await wsCol.findOne({owner:email,type:"personal"});
if(!personal){
  await wsCol.insertOne({
    workspaceId:crypto.randomUUID(),
    type:"personal",
    owner:email,
    members:[email],
    createdAt:Date.now()
  });
}

const pro = await wsCol.findOne({owner:email,type:"professional"});
if(!pro){
  await wsCol.insertOne({
    workspaceId:crypto.randomUUID(),
    type:"professional",
    owner:email,
    members:[email],
    createdAt:Date.now()
  });
}




  const token = signToken({email,name});

  res.json({
    token,
    user:{email,name}
  });
});








/* LOGOUT dummy */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('todo.sid');
    res.json({ ok: true });
  });
});



/* ME */
router.get("/me",(req,res)=>{
 const header = req.headers.authorization;
 if(!header) return res.json({user:null});

 try{
  const token = header.split(" ")[1];
  const decoded = verifyToken(token);
  res.json({user:decoded});
 }catch{
  res.json({user:null});
 }
});

export default router;

