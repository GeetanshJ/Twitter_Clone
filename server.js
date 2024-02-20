const express = require("express");
const app = express();
const session = require("express-session");
const bodyParser = require("body-parser");
const db = require("./database");
app.use(session({ secret: "g#a%t&v%i#t%" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.get("/", (req, res) => {
  let msg = ""
  if (req.session.msg != "") {
    msg = req.session.msg;
  }
  res.render("login", { msg: msg });
});
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  let sql = "";
  if (isNaN(email)) {
    sql = `select * from user where  softdelete=0 and status=1 and email = '${email}' and password = '${password}' `;
  }
  else {
    sql = `select * from user where softdelete=0 and status=1 and mobile = '${email}' and password = '${password}'  `;
  }
  db.query(sql, (error, result, fields) => {
    if (error) throw err;
    if (result.length == 0) {
      res.render('login', { msg: "Invalid credentials!" })
    }
    else {
      req.session.uid = result[0].uid;
      req.session.un = result[0].username;
      res.redirect('/home');
    }
  })
})
app.get('/signup', (req, res) => {
  res.render('signup', { msg: "" })
})
app.post('/signup_success', (req, res) => {
  const { fname, mname, lname, email, password, cpass, dob, gender } = req.body;
  let sql_check = "";
  if (isNaN(email)) {
    sql_check = `select email from user where email = '${email}'`;
  } else {
    sql_check = `select mobile from user where mobile = '${email}'`
  }
  db.query(sql_check, (err, result, fields) => {
    if (err) throw err
    if (result.length == 1) {
      let error_messg = "";
      if (isNaN(email)) {
        error_messg = "Email id already in use!";
      } else {
        error_messg = "Mobile Number already in use!";
      }
      res.render('signup', { msg: error_messg });
    } // end of result.length function which checks whether email/mobile already in use or not 
    else {
      // now we will register here by entering the user details
      let sql = ""
      if (isNaN(email)) {
        sql = `insert into user (fname,mname,lname,email,password,dob,dor,gender) values (?,?,?,?,?,?,?,?)`;
      } else {
        sql = `insert into user (fname,mname,lname,mobile,password,dob,dor,gender) values (?,?,?,?,?,?,?,?)`;
      }
      let d = new Date();
      let m = d.getMonth() + 1;
      let dor = d.getFullYear() + "-" + m + "-" + d.getDate();
      db.query(sql, [fname, mname, lname, email, password, dob, dor, gender], (err, result, fields) => {
        if (err) throw err;
        if (result.insertId > 0) {
          req.session.msg = "Account created... Check email for verification link"
          res.redirect('/');
        } else {
          req.session.msg = "Registration Unsuccessfull! Please try again"
        }
      })
    }
  })
})
app.get('/home', (req, res) => {
  if (req.session.uid != "") {
    res.render('home', { data: "" })
  } else {
    req.session.msg = "Please login first to view home page!"
    res.redirect('/');
  }
})
app.get('/logout', (req, res) => {
  req.session.uid = "";
  res.redirect('/');
})
app.post('/tweet-submit', (req, res) => {
  const tweet = req.body.tweet;
  let d = new Date();
  let m = d.getMonth() + 1;
  let dt = d.getFullYear() + "-" + m + "-" + d.getDate() + " " + d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
  console.log(req.session.uid);
  let sql = "INSERT INTO tweet (uid ,content,datetime) VALUES (?, ?, ?)";
  db.query(sql, [req.session.uid, tweet, dt], (err, result) => {
    if (err) {
      console.error("Error inserting tweet:", err);
      res.render('home', { data: "Can't post tweet!" });
    } else {
      if (result && result.insertId > 0) {
        console.log("Tweet inserted successfully. ID:", result.insertId);
        res.render('home', { data: "Tweet successful!" });
      } else {
        console.error("Error: Tweet not inserted successfully.");
        res.render('home', { data: "Can't post tweet!" });
      }
    }
  });
});

app.get('/following', (req, res) => {
  let sql = "select * from user where uid in (select follow_uid from followers where uid = ?)"; // sql to print to whom am I following
  db.query(sql, [req.session.uid], (err, result) => {
    if (err) throw err;
    res.render("following_list", { following_result: result })
  })
})
app.get('/search', (req, res) => {
  const search_str = req.query['search'];
  let sql = "select * from user where username like '%" + search_str + "%'";
  db.query(sql, [search_str], (err, result, fields) => {
    res.render("search_result", { result: result })
  })
})
app.get('/home', (req, res) => {
  if (req.session.uid != "") {
    let msg = "";
    if (req.session.msg != "") {
      msg = req.session.msg;
    }
    let sql = "select * from tweet inner join user on user.uid=tweet.uid where tweet.uid=? or tweet.uid in (select fid from followers where uid = ?) or post like '%" + req.session.un + "%' order by tweet.datetime desc;"
    console.log(sql);
    db.query(sql, [req.session.uid, req.session.uid], (err, result, fields) => {
      res.render('home', { result: result, msg: msg });
    })
  }
  
  else {
    req.session.msg = "Please login first to view home page!"
    res.redirect('/');
  }
})

app.listen(8000, () => console.log("Server running at http://localhost:8000"));