const express = require("express");
const app = express();
const session = require("express-session");
const bodyParser = require("body-parser");
const db = require("./database");
var multer = require('multer');
app.use(session({ secret: "g#a%t&v%i#t%" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
const verify_Mail = require('./nodemailer');

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads')
  }
})
app.get("/", (req, res) => {
  let msg = "";
  if (req.session.msg != "") {
    msg = req.session.msg;
  }
  res.render("login", { msg: msg });
});





app.get("/search", (req, res) => {
  const search_str = req.query["search"];
  console.log("Search string:", search_str);
  let sql = "SELECT username FROM user WHERE uid IN (SELECT uid FROM tweet WHERE content LIKE '%" + search_str + "%' OR username LIKE '%" + search_str + "%')";
  db.query(sql, [search_str], (err, rest, fields) => {
    if (err) {
      console.error("Error executing search query:", err); // Log any errors
      res.status(500).send("Internal Server Error"); // Respond with an error status
    } else {
      console.log("Search results:", rest); // Log the search results
      res.render("home", { result: rest, search: true }); // Render the home view with the search results
    }
  });
});



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
      let sql1 = "SELECT tweet.*, user.* FROM tweet INNER JOIN user ON tweet.uid = user.uid WHERE tweet.uid = ? OR tweet.content LIKE CONCAT('%', ?, '%') OR tweet.uid IN (SELECT follow_uid FROM followers WHERE follow_uid = ?) ORDER BY tweet.datetime DESC;";
      db.query(sql1, [req.session.uid, req.session.un, req.session.uid], (error, result, fields) => {
        if (error) throw error;

        else{
          const search_str = req.query["search"];
          let sql2 = "SELECT tweet.*,user.* FROM user WHERE uid IN (SELECT uid FROM tweet WHERE content LIKE '%" + search_str + "%' OR username LIKE '%" + search_str + "%')";
          db.query(sql2, [search_str], (err, rest, fields) => {
            res.render("home", {result: rest,search: true,mssg: "", result_tweets: result});
          });
        }
      });
    }
  });
});

app.get("/signup", (req, res) => {
  res.render("signup", { msg: "" });
});


app.post("/signup_success", (req, res) => {
  const { username, fname, mname, lname, email, password, cpass, dob, gender } =
    req.body;
  let sql_check = "";
  if (isNaN(email)) {
    sql_check = `select email from user where email = '${email}'`;
  } else {
    sql_check = `select mobile from user where mobile = ${email}`;
  }
  db.query(sql_check, (err, result, fields) => {
    if (err) throw err;
    if (result.length == 1) {
      let error_messg = "";
      if (isNaN(email)) {
        error_messg = "Email id already in use!";
      } else {
        error_messg = "Mobile Number already in use!";
      }
      res.render("signup", { msg: error_messg });
    } // end of result.length function which checks whether email/mobile already in use or not
    else {
      // now we will register here by entering the user details
      let sql = "";
      if (isNaN(email)) {
        sql =
          "insert into user (username,fname,mname,lname,email,password,dob,dor,gender) values (?,?,?,?,?,?,?,?,?)";
      } else {
        sql =
          "insert into user (username,fname,mname,lname,mobile,password,dob,dor,gender) values (?,?,?,?,?,?,?,?,?)";
      }
      let d = new Date();
      let m = d.getMonth() + 1;
      let dor = d.getFullYear() + "-" + m + "-" + d.getDate();
      db.query(
        sql,
        [username, fname, mname, lname, email, password, dob, dor, gender],
        (err, result, fields) => {
          if (err) throw err;
          if (result.insertId > 0) {
            verify_Mail(email)
            req.session.msg =
              "Account created... Check email for verification link";
            res.redirect("/");
          } else {
            req.session.msg = "Registration Unsuccessful! Please try again";
          }
        }
      );
    }
  });
});

app.get("/logout", (req, res) => {
  req.session.uid = "";
  res.redirect("/");
});





app.post('/tweet-submit', (req, res) => {
  const tweet = req.body.tweet;
  let sql = "insert into tweet (uid,content,datetime) values(?,?,?)"
  let date = new Date();
  let month = date.getMonth() + 1;
  let date_time = date.getFullYear() + "-" + month + "-" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
  db.query(sql, [req.session.uid, tweet, date_time], (err, result) => {
    if (err) {
      console.log(err);
    }

    else {
      if (result.insertId > 0) {
        res.redirect("/home");
      }
      
      else {
        res.render('home', { mssg: "Unable to post tweet!" });
      }
    }
  });
})

app.get("/home", (req, res) => {
  if (req.session.uid != "") {
    let msg = "";
    msg = req.session.msg;

    let sql = "SELECT tweet.*, user.username FROM tweet INNER JOIN user ON tweet.uid = user.uid WHERE tweet.uid = ? OR user.uid = ? ORDER BY tweet.datetime DESC";
    db.query(sql, [req.session.uid, req.session.uid], (err, result, fields) => {
      if(err) throw err;
      else{
        const search_str = req.query["search"];
        let sql = "SELECT username FROM user WHERE uid IN (SELECT uid FROM tweet WHERE content LIKE '%" + search_str + "%' OR username LIKE '%" + search_str + "%')";
        db.query(sql, [search_str], (err, rest, fields) => {
          res.render("home", {result: rest,search: true,mssg: "Tweet Posted", result_tweets: result});
        });
      }
    }
    );
  }

  else {
    req.session.msg = "Please login first to view home page!";
    res.redirect("/");
  }
});

app.get("/following", (req, res) => {
  let sql =
    "select * from user where uid in (select follow_uid from followers where uid = ?)"; // sql to print to whom am I following
  db.query(sql, [req.session.uid], (err, result) => {
    if (err) throw err;
    res.render("following_list", { following_result: result });
  });
});





app.listen(9000, () => console.log("Server running at http://localhost:9000"));
