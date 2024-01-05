

Start by installing all the necessary npm packages using the command "npm i".

Run the homepage with the command "nodemon index.js".

My website is organized into distinct sections: "Novel," "Essay," "Booknotes," and "About."
The data for these sections is stored in my local SQL database.

The Booknotes section is meticulously designed, allowing you to add, edit, delete, and review booknotes at your convenience.

Some may need a VPN to access the Open Library API.
Confidential information such as my database details and VPN proxy are stored in a local .env file with the following format:
DB_USER=postgres  
DB_HOST=localhost  
DB_NAME=personal_website   
DB_PASSWORD=aaaaaa    
DB_PORT=1234   

VPN_HOST=111.1.1.1   
VPN_PORT=1234   
