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
var ops = configHandler.getops();
var redis_client = redis.createClient(
    config['redis']['port'],
    config['redis']['host'],
    config['redis']['options']);
var rs = Object.keys(ops['operations']);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/:r', function (req, res) {
    var r = req.params.r;
    var is_correct_rout = false;
    for (var i = 0; i < rs.length; i++) {
        if (rs[i] == r) {
            is_correct_rout = true;
            if (!req.body.type) {
                logger.error("Request type is empty");
                res.send("Error! Request type is empty")
            }
            else {
                var is_correct_operations = false;
                for (var j = 0; j < ops['operations'][r].length; j++){
                    if (ops['operations'][r][j]['action_type'] == req.body.type) {
                        is_correct_operations = true;
                        var fields = ops['operations'][r][j]['fields'];
                        var message_detail = {};
                        for (var k = 0; k < fields.length; k++){
                            message_detail[fields[k]] = req.body[fields[k]]
                        }
                        var index_name = 'logstash-' + rs[i];
                        upload_data = {
                            'action_type': ops['operations'][r][j]['action_type'],
                            'message': message_detail,
                            '@metadata': {'index_name': index_name, 'document_type': ops['operations'][r][j]['action_type']}
                        };
                        redis_client.rpush('logstash:list', JSON.stringify(upload_data));
                        res.send("Success")
                    }
                }
                if (is_correct_operations == false){
                    logger.error("Operation %s is not correct", req.body.type);
                    res.send("Error! Operation is not correct");
                }
            }
        }
    }
    if (is_correct_rout == false){
        logger.error("Route %s is not correct", r);
        res.send("Error! Route is not correct");
    }
});

var server = app.listen(6000, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});

