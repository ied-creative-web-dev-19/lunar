var express = require('express');
var app = express();

app.use(express.static('.'))

try{
    app.listen(8082, console.log('Server started.\n Open: http://localhost:808'));
}catch(e){
    app.listen(8081, console.log('Server started.\n Open: http://localhost:8081'));
}
