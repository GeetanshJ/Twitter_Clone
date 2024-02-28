const express = require("express");
const app = express();
const session = require("express-session");
const bodyParser = require("body-parser");
const db = require("./database");
const multer = require('multer');
const verify_Mail = require('./nodemailer');

// Session configuration
app.use(session({ secret: "g#a%t&v%i#t%" }));

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Set view engine to EJS
app.set("view engine", "ejs");

// Serve static files from the 'public' directory
app.use(express.static(__dirname + "/public"));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public'); // Upload files to the 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, "./uploads/" + file.originalname); // Use the original filename for uploaded files
  }
});
const upload = multer({ storage: storage });

// Routes

// Homepage
app.get("/", (req, res) => {
  let msg = req.session.msg || "";
  res.render("login", { msg: msg });
});

// Search route
app.get("/search", (req, res) => {
  const search_str = req.query["search"];
  const sql = "SELECT * FROM user WHERE username LIKE ?";
  db.query(sql, [`%${search_str}%`], (err, rest) => {
    if (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    } else {

      let sql1 = "SELECT tweet.*, user.* FROM tweet INNER JOIN user ON tweet.uid = user.uid WHERE tweet.uid = ? OR tweet.content LIKE CONCAT('%', ?, '%') OR tweet.uid IN (SELECT following_user_id FROM following WHERE following_user_id = ?) ORDER BY tweet.datetime DESC;";
      db.query(sql1, [req.session.uid, req.session.un, req.session.uid], (error, result, fields) => {

        res.render("home", { result: rest, search: true, mssg: "", result_tweets: result });
      });
    }
  });
});

// Login route 
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  let sql = "";
  if (isNaN(email)) {
    sql = `SELECT * FROM user WHERE email = '${email}' AND password = '${password}' AND status = 1 AND softdelete = 0`;
  } else {
    sql = `SELECT * FROM user WHERE mobile = ${email} AND password = '${password}' AND status = 1 AND softdelete = 0`;
  }
  db.query(sql, (error, result, fields) => {
    if (error) throw error;
    if (result.length == 0) {
      res.render("login", { msg: "Invalid credentials!" });
    }

    else {
      req.session.uid = result[0].uid;
      req.session.un = result[0].username;
      let sql1 = "SELECT tweet.*, user.* FROM tweet INNER JOIN user ON tweet.uid = user.uid WHERE tweet.uid = ? OR tweet.content LIKE CONCAT('%', ?, '%') OR tweet.uid IN (SELECT following_user_id FROM following WHERE following_user_id = ?) ORDER BY tweet.datetime DESC;";
      db.query(sql1, [req.session.uid, req.session.un, req.session.uid], (error, result, fields) => {
        if (error) throw error;

        else {
          const search_str = req.query["search"];
          let sql2 = "SELECT tweet.*,user.* FROM user WHERE uid IN (SELECT uid FROM tweet WHERE content LIKE '%" + search_str + "%' OR username LIKE '%" + search_str + "%')";
          db.query(sql2, [search_str], (err, rest, fields) => {
            res.render("home", { result: rest, search: true, mssg: "", result_tweets: result });
          });
        }
      });
    }
  });
});

// Signup route
app.get("/signup", (req, res) => {
  res.render("signup", { msg: "" });
});

app.post("/signup_success", (req, res) => {
  const { username, fname, mname, lname, email, password, cpass, dob, gender } = req.body;
  let sql_check = isNaN(email) ? `SELECT email FROM user WHERE email = ?` : `SELECT mobile FROM user WHERE mobile = ?`;

  db.query(sql_check, [email], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    } else {
      if (result.length === 1) {
        let error_messg = isNaN(email) ? "Email id already in use!" : "Mobile Number already in use!";
        res.render("signup", { msg: error_messg });
      } else {
        let sql = isNaN(email) ?
          "INSERT INTO user (username,fname,mname,lname,email,password,dob,dor,gender) VALUES (?,?,?,?,?,?,?,?,?)" :
          "INSERT INTO user (username,fname,mname,lname,mobile,password,dob,dor,gender) VALUES (?,?,?,?,?,?,?,?,?)";

        let d = new Date();
        let m = d.getMonth() + 1;
        let dor = d.getFullYear() + "-" + m + "-" + d.getDate();
        db.query(sql, [username, fname, mname, lname, email, password, dob, dor, gender], (err, result) => {
          if (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
          } else {
            if (result.insertId > 0) {
              verify_Mail(email);
              req.session.msg = "Account created... Check email for verification link";
              res.redirect("/");
            } else {
              req.session.msg = "Registration Unsuccessful! Please try again";
              res.redirect("/signup");
            }
          }
        });
      }
    }
  });
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Tweet submit route
app.post("/tweet-submit", upload.single("tweet_img"), (req, res) => {
  const { tweet } = req.body;
    const { filename, mimetype } = req.file;

    let sql = "INSERT INTO tweet (uid,content,datetime,imagevdo_name,type) VALUES(?,?,?,?,?)";
    let date = new Date();
    let month = date.getMonth() + 1;
    let date_time = `${date.getFullYear()}-${month}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    db.query(sql, [req.session.uid, tweet, date_time, filename, mimetype], (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
      } else {
        if (result.insertId > 0) {
          res.redirect("/home");
        } else {
          res.render('home', { mssg: "Unable to post tweet!" });
        }
      }
    });
  

});

// Homepage route
app.get("/home", (req, res) => {
  if (req.session.uid) {
    let msg = req.session.msg || "";
    const sql = "SELECT tweet.*, user.username FROM tweet INNER JOIN user ON tweet.uid = user.uid WHERE tweet.uid = ? OR tweet.content LIKE CONCAT('%', ?, '%') OR tweet.uid IN (SELECT following_user_id FROM following WHERE following_user_id = ?) ORDER BY tweet.datetime DESC";
    db.query(sql, [req.session.uid, req.session.un, req.session.uid], (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
      } else {
        res.render("home", { result_tweets: result, result: [], search: false, mssg: msg });
      }
    });
  } else {
    res.redirect("/");
  }
});








app.get('/profile',(req,res) => {
  db.query("select fname,mname,lname,about from user where uid = ?",[req.session.uid],(err,result) => {
      if(result.length == 1) {
          res.render('profile',{profile_Data:result});
      } else {
          res.redirect('/');
      }
  })
})

app.post('/update_profile',(req,res) => {
  const {fname,mname,lname,about_user} = req.body
  let sql = "update user set fname = ?, mname = ?, lname = ?, about = ? where uid = ?"
  db.query(sql,[fname,mname,lname,about_user,req.session.uid],(err,result) => {
      if (err) throw err;
      if (result.affectedRows == 1) {
          req.session.msg = "Profile Updated!";
          res.redirect('/home');
      } else {
          req.session.msg = "Error updating profile! Try again later.";
          res.redirect('/home');
      }
    })
})





app.get("/follow/:followedUserId", (req, res) => {
  const userId = req.session.uid;
  const followedUserId = req.params.followedUserId;

  const insertFollowingQuery = "INSERT INTO following (uid, following_user_id) VALUES (?, ?)";
  db.query(insertFollowingQuery, [userId, followedUserId], (err, result) => {
      if (err) {
          res.send("Internal Server Error");
          return;
      }
    
      const insertFollowerQuery = "INSERT INTO followers (uid, follower_uid) VALUES (?, ?)";
      db.query(insertFollowerQuery, [followedUserId, userId], (err, result) => {
          if (err) {
              res.send("Internal Server Error");
              return;
          }

          res.redirect("/home");
      });
  });
});

app.get("/followers", (req, res) => {
  const userId = req.session.uid;
  const sql = "SELECT u.username FROM followers f JOIN user u ON f.follower_uid = u.uid WHERE f.uid = ?";
  db.query(sql, [userId], (err, result) => {
      if (err) {
          res.send("Internal Server Error");
          return;
      }
      res.render("followers", { followersList: result });
  });
});

app.get("/following", (req, res) => {
  const userId = req.session.uid;
  const sql = "SELECT u.username FROM following f JOIN user u ON f.following_user_id = u.uid WHERE f.uid = ?";
  db.query(sql, [userId], (err, result) => {
      if (err) {
          res.send("Internal Server Error");
          return;
      }
      res.render("following", { followingList: result });
  });
});




// Server listening
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
