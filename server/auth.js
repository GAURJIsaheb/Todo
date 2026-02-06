import express from "express";
import { signToken, verifyToken } from "./jwt.js";

const router = express.Router();
const users = new Map();



/* LOGIN */
router.post("/login",(req,res)=>{
  const { name, email } = req.body;

  if(!email || !name){
    return res.status(400).json({error:"Name & email required"});
  }

  const existing = users.get(email);

  if(existing && existing.name !== name){
    return res.status(401).json({error:"Invalid details"});
  }

  if(!existing){
    users.set(email,{email,name});
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

