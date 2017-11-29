
var express = require('express');
var app = express();

var exphbs = require('express-handlebars');
// Set Handlebars as the default templating engine.
app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

var path = require('path');

// Body Parser - provides json-ized form data
var bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));


app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});


app.use('/assets', express.static(path.join(__dirname, '/public/assets')));

// Routes =============================================================

require('./routes/api-routes.js')(app);


app.set('port', (process.env.PORT || 3000));


app.get('*',function (req, res) {
    console.log('Server - redirecting ['+req.route.path+'] to /index');
    res.redirect('/index');
});

var db = require('./models');


db.sequelize.sync({}).then(function() {
    app.listen(app.get('port'), function () {
        console.log('Server - listening on port '+app.get('port'));
    });
});