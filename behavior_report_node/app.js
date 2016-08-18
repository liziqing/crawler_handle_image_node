var express = require('express');
var app = express();
var redis = require('redis');
var winston = require('winston');
var bodyParser = require('body-parser');

var logger = new (winston.Logger)({
    transports: [
        //new (winston.transports.Console)(),
        new (winston.transports.File)({ name: 'error-file', filename: 'error.log', level: 'error' })
        //new (winston.transports.File)({ name: 'info-file', filename: 'info.log', level: 'info' })
    ]
});

var configHandler = require("./confighandler");

var config = configHandler.getConfig();

var redis_client = redis.createClient(
    config['redis']['port'],
    config['redis']['host'],
    config['redis']['options']);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/behavior_report', function (req, res) {
    if (!req.body.type) {
        logger.error("Request body type is empty");
        res.send("Error! Request body type is empty")
    }
    else{
        var action_type = req.body.type;
        var brand_id = req.body.brand_id;
        var user_id = req.body.user_id;
        var index_name = 'logstash_brand_recommend';
        upload_data = {'action_type': action_type, 'brand_id': brand_id, 'user_id': user_id, '@metadata': {'index_name': index_name, 'document_type': action_type}};
        redis_client.rpush('logstash:list', JSON.stringify(upload_data));
        res.send("Success")
    }
});

var server = app.listen(6000, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});

