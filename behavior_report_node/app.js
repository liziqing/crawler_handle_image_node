var express = require('express');
var app = express();
var redis = require('redis');
var winston = require('winston');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

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
app.use(cookieParser());

// app.set('trust proxy', function (ip) {
//     if (ip === '10.105.57.202' || ip === '10.105.19.248')
//         return true; // trusted IPs
//     else
//         return false;
// });
// app.set('trust proxy', function (ip) {
//     if (ip === '127.0.0.1' || ip === '123.123.123.123') return true; // trusted IPs
//     else return false;
// })

app.post('/:opid', function (req, res) {
    var opid = req.params.opid;
    var index_name = 'logstash-report';
    var message_detail;
    var message_array = {};
    req_headers = req.headers;
    req_cookies = req.cookies;
    req_body = req.body;
    req_ip = req.ips;

    var device = req.body['device'];
    if (!device){
        if (!isEmpty(req_headers)){
            if (req_headers.hasOwnProperty('device')){
                device = req_headers['device']
            }
        }
    }
    if (!device){
        if (!isEmpty(req_cookies)){
            if (req_cookies.hasOwnProperty('device')){
                device = req_cookies['device']
            }
        }
    }
    if (device){
        var b = new Buffer(device, 'base64');
        device = b.toString();
        device = JSON.stringify(device);
        for (var index in device){
            message_array[index] = device[index]
        }
    }

    message_array = req_body;
    message_array['ip'] = req_ip;
    message_array['action_type'] = req_body['type'];
    message_array['message'] = message_detail;
    message_array['@metadata'] = {'index_name': index_name, 'document_type': req_body['type']};
    redis_client.rpush('logstash:list', JSON.stringify(message_array));
    res.send("Success");

    function isEmpty(obj)
    {
        for (var name in obj)
        {
            return false;
        }
        return true;
    }
});

var server = app.listen(6000, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});

