import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import _ from "lodash";
import axios from "axios";
//regulate the date form
import moment from "moment";
//help navigate vpn
import tunnel from "tunnel";
//to read .env file
import dotenv from 'dotenv';

const app=express();
const port=3000;
let posts=[];

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs');
app.locals.moment=moment;

//put your db's personal information in .env file
dotenv.config();
const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});
db.connect();

//posts part
app.get("/",(req, res)=>{
    res.render("home.ejs", { 
        posts: posts
    })
})

//write new post
app.get("/essay/compose",(req, res)=>{
    res.render("Essay/compose.ejs")
})


app.post("/essay/compose",(req, res)=>{
    const post={
        title: req.body.newTitle,
        content:req.body.newContent 
    }

    if(post.title && post.content){
        posts.push(post);
    }
    res.redirect("/");
})

app.get("/essay/posts/:postName", (req, res)=>{
    const reqTitle=_.lowerCase(req.params.postName);

    posts.forEach((post)=>{
        const postTitle=_.lowerCase(post.title)
        if(reqTitle===postTitle){
            res.render("Essay/post.ejs",{
                title:post.title,
                content:post.content
            })  
        }
    })
   
})

//delete posts
app.post("/essay/delete/:title", (req, res) => {
    const deleteTitle = req.params.title;
    posts = posts.filter((item) => (item.title !== deleteTitle)); 
    res.redirect("/");
});

//edit posts
app.get("/essay/edit/:postName", (req, res) => {
    const reqTitle = req.params.postName;
    let index = posts.findIndex(item => item.title === reqTitle);
   
    res.render("Essay/edit.ejs", {
        editTitle: posts[index].title,
        editContent: posts[index].content,
    });
  });
 
  app.post("/essay/edit/:postName", (req, res) => {
    const reqTitle = req.params.postName;
    let index = posts.findIndex(item => item.title === reqTitle);
    const edittedPost = {
        title: req.body.edittedTitle,
        content:req.body.edittedContent 
    };
   posts.splice(index, 1, edittedPost);
   res.render("Essay/post.ejs", {
    title: edittedPost.title,
    content: edittedPost.content  
  });
});


//Booknotes part
const OPEN_LIBRARY_ENDPOINT = 'https://openlibrary.org/api/books';  
//get book information from open library
async function getBookInfo(isbn){
    try{
        // Your VPN proxy details
        const vpnProxy = {
            host: process.env.VPN_HOST,
            port: parseInt(process.env.VPN_PORT, 10),
          };
      
        // Creat tunnel proxy
        const agent = tunnel.httpsOverHttp({
            proxy: {
              host: vpnProxy.host,
              port: vpnProxy.port,
            },
        });
          
        // Set axios configuration 
        const axiosConfig = {
            httpsAgent: agent, 
        };
    
        const queryParams = `?bibkeys=ISBN:${isbn}&jscmd=data&format=json`;  
        const response = await axios.get(`${OPEN_LIBRARY_ENDPOINT}${queryParams}`, axiosConfig);  
       
        //Based on the api doc.
        if (response.status === 200) {
            const result = response.data;
            return result;
        } else if (response.status === 403) {
            throw new Error('Forbidden. User does not have required permissions.');
        } else if (response.status === 404) {
            throw new Error('Book not found. Please check the ISBN and try again.');
        } else {
            throw new Error('Internal Server Error. Please try again later.');
        }
        } catch (error) {
            console.error('Error fetching book info:', error.message);
            return { error: 'Internal Server Error. Please try again later.' };
        }
}

//booknotes display page
app.get("/booknotes", async(req, res)=>{
    try{
        const response = await db.query("SELECT rating, summary, cover_path, date_read, title, isbn FROM booknotes ORDER BY rating DESC");
        const result = response.rows;
        res.render("Booknotes/bn-catalogue.ejs", {bookPreInfos: result});
    }catch(error){
        console.error(error.message);
    }
})

//sort booknotes by rating/read_date
app.post("/booknotes/sort", async(req, res)=>{
    const sortByValue=req.body.bnSortStandard;
    try{
        let query = "SELECT rating, summary, cover_path, date_read, title, isbn FROM booknotes ORDER BY ";
        if(sortByValue==="rating" || sortByValue==="date_read" ){
            query = `${query}${sortByValue} DESC`;
        }else{
            query = `${query}rating DESC`; 
        }
        const response = await db.query(query);
        const result = response.rows;
        res.render("Booknotes/bn-catalogue.ejs", {bookPreInfos: result});
    }catch(error){
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
}) 


//get notes of a specific book from db
async function checkOneBookNotes(isbn){
   const result = await db.query("SELECT * FROM booknotes WHERE isbn=$1", [isbn]);
   const bookInfo = result.rows[0];
   /* console.log(result.rows); */
   return bookInfo; 
}

app.get("/booknotes/:isbn", async(req, res)=>{
    try{
      const queryIsbn = req.params.isbn.replace(":", "");
      const bookInfo = await checkOneBookNotes(queryIsbn);
      res.render("Booknotes/bn-detail.ejs", {bookInfo: bookInfo});  
    }catch(error){
        console.error(`Error : ${error.message}.`);
    }
})

//add a new book on website
app.post("/booknotes/composeNewBn", async(req, res)=>{
    try{
        const newBookIsbn = req.body.queryIsbn.trim();
        // Validate ISBN format
        if (!/^\d{13}$/.test(newBookIsbn)) {
            return res.status(400).send("Invalid ISBN format. Please enter a 13-digit number.");
        }
        const bookAllInfo = await getBookInfo(newBookIsbn);

        if (Object.keys(bookAllInfo).length === 0) {
            console.log("Book not found.");
            return res.status(404).send("Book not found");
        }else{
            const bookInfo = bookAllInfo[`ISBN:${newBookIsbn}`];
            res.render("Booknotes/bn-compose.ejs", { bookInfo, isbn: newBookIsbn });
        }
            
    }catch(error){
        console.error(error.message);
        res.status(500).send("Internal server error. Try another one.");
    }
})


//save a new booknote to db
app.post("/booknotes/saveNewBn", async(req,res)=>{
    const title = req.body.title;
    const isbn = req.body.isbn;
    const publishing_year = req.body.publishing_year;
    const date_read = req.body.date_read;
    const rating = req.body.rating;  
    const summary = req.body.summary;
    const notes = req.body.notes;
    const cover_path = req.body.cover_path;
    try{
        await db.query("INSERT INTO booknotes (title, isbn, publishing_year, date_read, rating, summary, notes, cover_path) VALUES($1, $2, $3, TO_DATE($4, 'YYYY-MM-DD'), $5, $6, $7, $8)", 
        [title, isbn, publishing_year, date_read, rating, summary, notes, cover_path]);
        res.redirect(`/booknotes/${isbn}`);
    }catch(error){
        console.error(`Add booknotes failed: ${error.message}.`);
        res.status(500).send("Failed to add book notes. Please try again later.");
    }
})

//delete a book from db
app.post("/booknotes/delete/:isbn", async(req, res)=>{
    try{
      const queryIsbn = req.params.isbn;
      await db.query("DELETE FROM booknotes WHERE isbn=$1", [queryIsbn]);
      
      res.redirect("/booknotes");  
    }catch(error){
        console.error(`Error : ${error.message}.`);
        res.status(500).send("Internal Server Error");
    }
})

//edit booknotes
app.post("/booknotes/edit/:isbn", async(req, res)=>{
    try{
      const queryIsbn = req.params.isbn;  
      const bookInfo = await checkOneBookNotes(queryIsbn);
      res.render("Booknotes/bn-edit.ejs", {bookInfo: bookInfo});  
    }catch(error){
        console.error(`Error : ${error.message}.`);
        res.status(500).send("Internal Server Error");
    }
})


//save editted booknotes to db
app.post("/booknotes/saveEdittedBn/:isbn", async(req, res)=>{
    const queryIsbn = req.params.isbn;  
    const date_read = req.body.date_read;
    const rating = req.body.rating;
    const summary = req.body.summary;
    const notes = req.body.notes;
    const cover_path = req.body.cover_path;
    const publishing_year = req.body.publishing_year;

    try{
        await db.query("UPDATE booknotes SET publishing_year=$1, date_read=$2, rating=$3, summary=$4, notes=$5, cover_path=$6 WHERE isbn=$7",
         [publishing_year, date_read, rating, summary, notes, cover_path, queryIsbn]); 
        
        res.redirect(`/booknotes/${queryIsbn}`);
    }catch(error){
        console.error(`Edit booknotes failed: ${error.message}.`);
        res.status(500).send("Failed to edit book notes. Please try again later.");
    }
})

//personal information
app.get("/about",(req, res)=>{
    res.render("PI/about.ejs");
})
app.get("/contact",(req, res)=>{
    res.render("PI/contact.ejs");
})

app.get("/essay",(req, res)=>{
    res.render("Essay/essay_catalogue.ejs");
})

app.get("/novel",(req, res)=>{
    res.render("Novel/novel_catalogue.ejs");
})

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);
})