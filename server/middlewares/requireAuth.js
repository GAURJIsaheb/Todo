import { verifyToken } from "../jwt.js";

export function requireAuth(req,res,next){
 const header = req.headers.authorization;

 if(!header){
  return res.status(401).json({error:"no token"});
 }

 const token = header.split(" ")[1];

 try{
  const user = verifyToken(token);
  req.user = user;
  next();
 }catch{
  res.status(401).json({error:"invalid token"});
 }
}
