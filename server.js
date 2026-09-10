const express=require("express");
const session=require("express-session");
const bcrypt=require("bcryptjs");
const Database=require("better-sqlite3");
const path=require("path");

const app=express();
const PORT=process.env.PORT||3000;

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret:process.env.SESSION_SECRET||"sdrive-secret",
  resave:false,
  saveUninitialized:false
}));

const db=new Database(path.join(__dirname,"sdrive.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 phone TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 badge TEXT DEFAULT 'Membre S-Drive',
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

function phone(v){
  let p=String(v||"").replace(/\D/g,"");
  if(p.startsWith("225"))return p;
  if(p.startsWith("0"))return "225"+p.slice(1);
  return p;
}

function currentUser(req){
  if(!req.session.userId)return null;
  return db.prepare(
    "SELECT id,name,phone,badge FROM users WHERE id=?"
  ).get(req.session.userId);
}

app.post("/api/register",async(req,res)=>{
  try{
    const name=String(req.body.name||"").trim();
    const phoneNumber=phone(req.body.phone);
    const password=String(req.body.password||"");

    if(!name||!phoneNumber||password.length<6){
      return res.status(400).json({error:"Informations invalides"});
    }

    const exists=db.prepare(
      "SELECT id FROM users WHERE phone=?"
    ).get(phoneNumber);

    if(exists){
      return res.status(409).json({error:"Ce numéro existe déjà"});
    }

    const hash=await bcrypt.hash(password,10);

    const result=db.prepare(
      "INSERT INTO users(name,phone,password_hash) VALUES(?,?,?)"
    ).run(name,phoneNumber,hash);

    req.session.userId=result.lastInsertRowid;

    res.json({
      success:true,
      message:"Compte créé",
      user:currentUser(req)
    });
  }catch(e){
    console.error(e);
    res.status(500).json({error:"Erreur serveur"});
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const phoneNumber = phone(req.body.phone);
    const password = String(req.body.password || "");

    const u = db.prepare(
      "SELECT * FROM users WHERE phone=?"
    ).get(phoneNumber);

    if (!u) {
      return res.status(401).json({
        error: "Numéro ou mot de passe incorrect"
      });
    }

    const ok = await bcrypt.compare(password, u.password_hash);

    if (!ok) {
      return res.status(401).json({
        error: "Mot de passe incorrect"
      });
    }

    req.session.userId = u.id;

    res.json({
      success: true,
      message: "Connexion réussie",
      user: currentUser(req)
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: "Erreur serveur"
    });
  }
});
app.get("/api/me",(req,res)=>{
  const u=currentUser(req);
  res.json({connected:!!u,user:u});
});

app.post("/api/logout",(req,res)=>{
  req.session.destroy(()=>{
    res.json({success:true});
  });
});

app.get("/api/health",(req,res)=>{
  res.json({success:true,app:"S-Drive"});
});

app.use(express.static(path.join(__dirname,"public")));

app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT,"0.0.0.0",()=>{
  console.log("S-Drive démarré sur le port "+PORT);
});
