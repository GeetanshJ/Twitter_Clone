const express = require("express");
const app = express();
const session = require("express-session");
const bodyParser = require("body-parser");
const db = require("./database");
const multer = require('multer');
const verify_Mail = require('./nodemailer');
var nodemailer = require("nodemailer");

// Session configuration
app.use(session({ secret: "g#a%t&v%i#t%" }));
 
// Body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Set view engine to EJS
app.set("view engine", "ejs");

// Serve static files from the 'public' directory
app.use(express.static(__dirname + "/public"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public');
  },
  filename: (req, file, cb) => {
    cb(null, "./uploads/" + file.originalname);
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
          let likeCounts = [];
          result.forEach(tweet => {
            const tid = tweet.tid;
            const sql2 = "SELECT COUNT(userLiked) as likeCount FROM tweet_likes WHERE tid = ?";
            db.query(sql2, [tid], (err, resultFromQuery) => {
              if (err) {
                console.log(err);
                res.status(500).send("Error occurred while processing your request.");
                return;
              }
              likeCounts.push(resultFromQuery[0]);
              if (likeCounts.length === result.length) {
                res.render("home", { result_tweets: result, result: rest, search: true, mssg: "", un: req.session.un, tlike: likeCounts });
              }
            });
          });
          // res.render("home", { result: rest, search: true, mssg: "", result_tweets: result ,un:req.session.un,tlike:[]});
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
      const sql1 = "SELECT tweet.*, user.username FROM tweet INNER JOIN user ON tweet.uid = user.uid WHERE tweet.uid = ? OR tweet.uid IN (SELECT following_user_id FROM following WHERE uid = ?)  OR tweet.content LIKE CONCAT('%@', ?, '%') ORDER BY tweet.datetime DESC;";
      db.query(sql1, [req.session.uid, req.session.uid, req.session.un], (error, result, fields) => {
        if (error) throw error;

      if (result.length > 0) {
          let likeCounts = [];
          result.forEach(tweet => {
            const tid = tweet.tid;

            const sql2 = "SELECT COUNT(userLiked) as likeCount FROM tweet_likes WHERE tid = ?";
            db.query(sql2, [tid], (err, resultFromQuery) => {
              if (err) {
                console.log(err);
                res.status(500).send("Error occurred while processing your request.");
                return;
              }
              likeCounts.push(resultFromQuery[0]);
              if (likeCounts.length === result.length) {
                res.render("home", { result_tweets: result, result: "", search: false, mssg: "", un: req.session.un, tlike: likeCounts });
              }
            });
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

app.get("/register", (req, res) => {
  res.render("signup", { msg: "" });
});
app.post("/signup_success", (req, res) => {
  const {
    username,
    fname,
    mname,
    lname,
    email,
    password,
    confirm_pass,
    dob,
    gender,
  } = req.body;
  let sql_check = "";
  if (isNaN(email)) {
    sql_check = `select email from user where email = '${email}'`;
  } else {
    sql_check = `select mobile from user where mobile = ${email}`;
  }
  db.query(sql_check, (err, result, fields) => {
    if (err) throw err;
    if (result.length == 1) {
      let error_msg = "";
      if (isNaN(email)) {
        error_msg = "Email id already in use..!";
      } else {
        error_msg = "Mobile number already in use..!";
      }
      res.render("signup", { msg: error_msg });
    } // end of result.length function which checks whether any  data is present or not
    else {
      let sql = "";
      if (isNaN(email)) {
        sql =
          "insert into user(username,fname,mname,lname,email,password,dob,gender,dor) values (?,?,?,?,?,?,?,?,?)";
      } else {
        sql =
          "insert into user(username,fname,mname,lname,mobile,password,dob,gender,dor) values (?,?,?,?,?,?,?,?,?)";
      }
      let d = new Date();
      let month = d.getMonth() + 1;
      let dor = d.getFullYear() + "-" + month + "-" + d.getDate();
      db.query(
        sql,
        [username, fname, mname, lname, email, password, dob, gender, dor],
        (err, result, fields) => {
          if (err) throw err;
          if (result.insertId > 0) {
            if (isNaN(email)) {
              verify_Mail(email);
            }
            req.session.msg =
              "Account created! Check email for verification link..!";
            res.redirect("/");
          } else {
            res.render("signup", { msg: "Can't register! Please try again" });
          }
        }
      );
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
  let filename = null;
  let mimetype = null;

  // Check if req.file exists and set filename and mimetype accordingly
  if (req.file) {
    filename = req.file.filename;
    mimetype = req.file.mimetype;
  }

  let sql = "INSERT INTO tweet (uid, content, datetime, imagevdo_name, type) VALUES (?, ?, ?, ?, ?)";
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
    const sql1 = "SELECT tweet.*, user.username FROM tweet INNER JOIN user ON tweet.uid = user.uid WHERE tweet.uid = ? OR tweet.uid IN (SELECT following_user_id FROM following WHERE uid = ?)  OR tweet.content LIKE CONCAT('%@', ?, '%') ORDER BY tweet.datetime DESC;";
    db.query(sql1, [req.session.uid, req.session.uid, req.session.un], (err, result, fields) => {
      if (err) {
        console.error(err);
        res.send("Internal Server Error");
      } else {
        if (result.length > 0) {
          // Array to store the like counts for each tweet
          let likeCounts = [];
          // Iterate through each tweet to fetch its like count
          result.forEach(tweet => {
            const tid = tweet.tid;

            const sql2 = "SELECT COUNT(userLiked) as likeCount FROM tweet_likes WHERE tid = ?";
            db.query(sql2, [tid], (err, resultFromQuery) => {
              if (err) {
                console.log(err);
                res.status(500).send("Error occurred while processing your request.");
                return;
              }
              likeCounts.push(resultFromQuery[0]);
              if (likeCounts.length === result.length) {
                res.render("home", { result_tweets: result, result: "", search: false, mssg: msg, un: req.session.un, tlike: likeCounts });
              }
            });
          });
        } else {
          // No tweets found
          res.render("home", { result_tweets: [], result: "", search: false, mssg: msg, un: req.session.un, tlike: [] });
        }
      }
    });
  } else {
    res.redirect("/");
  }
});




// update password route
app.get("/update-password", (req, res) => {
  res.render("updatePass",{update_pass_data:""});
});

app.post("/update-password-success", (req, res) => {
  const { email, password } = req.body;
  let sql = "";
  if (isNaN(email)) {
    sql = "update user set password = ? where email = ?";
  } else {
    sql = "update user set password = ? where mobile = ?";
  }
  db.query(sql, [password, email], (err, result, fields) => {
    if (err) throw err;
    if (result.affectedRows > 0) {
      // res.redirect('/profile');
      res.render('profile',{profile_data:"Password updated successfully..!"})
    } else {
      res.render("updatePass", { update_pass_data: "Error updating password..!" });
    }
  });
});


app.get("/profile", (req, res) => {
  db.query(
    "select * from user where uid = ?",
    [req.session.uid],
    (err, result) => {
      if (err) throw err;
      if (result.length == 1) {
        res.render("profile", {
          profile_data: result,
          username: req.session.username,
        });
      } else {
        res.render("profile",{profile_data:result});
      }
    }
  );
});



const multerMiddleware = multer({
  storage: storage,
}).fields([
  { name: "profile_image", maxCount: 1 },
  { name: "banner_image", maxCount: 1 },
]);

// Assuming profile_data is retrieved from the database


app.post("/update_profile", multerMiddleware, (req, res) => {
  const { fname, mname, lname, about } = req.body;

  let profileFilename = "";
  let bannerFilename = "";
  let profileMimetype = "";
  let bannerMimetype = "";

  try {
    if (req.files["profile_image"]) {
      profileFilename = req.files["profile_image"][0].filename;
      profileMimetype = req.files["profile_image"][0].mimetype;
    }

    if (req.files["banner_image"]) {
      bannerFilename = req.files["banner_image"][0].filename;
      bannerMimetype = req.files["banner_image"][0].mimetype;
    }
  } catch (error) {
    console.log(error);
  }

  let sql =
    "update user set fname = ?, mname = ?, lname = ?, about = ?, profilepic = ?, headerimg = ? where uid = ?";
  db.query(sql,[fname,mname,lname,about,profileFilename,bannerFilename,req.session.uid,],(err, result) => {
      if (err) throw err;

      if (result.affectedRows === 1) {
        res.redirect("profile");
      } else {
        res.redirect("profile");
      }
    }
  );
});



app.get('/likes/:tid', (req, res) => {
  const tid = req.params.tid;

  db.query('SELECT uid FROM tweet WHERE tid = ?', [tid], (err, result) => {
    if (err) {
      console.error(err);
      res.send("Error occurred while processing your request.");
      return;
    }

    if (result.length === 0) {
      res.send("Tweet not found.");
      return;
    }

    const tweetOwnerId = result[0].uid;

    let d = new Date();
    let month = d.getMonth() + 1;
    let dor = d.getFullYear() + "-" + month + "-" + d.getDate();

    const sql = "INSERT INTO tweet_likes (uid, tid, datetime, userLiked) VALUES (?, ?, ?, ?);";
    db.query(sql, [tweetOwnerId, tid, dor, req.session.uid], (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error occurred while processing your request.");
        return;
      }

      res.redirect("/home");
    });
  });
});






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
app.listen(8080, () => {
  console.log(`Server running on port 8080`);
});


 