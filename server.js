var express = require('express');
var app = express();

app.use(express.static('.'))

app.listen(8081, console.log('Server started.\n Open: http://localhost:8081'));
