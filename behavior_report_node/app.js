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
var hostname = config['host'];
var port = config['port'];


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.set('trust proxy', function (ip) {
    if (ip === '10.105.57.202' || ip === '10.105.19.248')
        return true; // trusted IPs
    else
        return false;
});

app.get('/', function (req, res) {
    res.send('Hello world');
});
app.get('/:opid', function (req, res) {
    res.send('Success');
    var opid = req.params.opid;
    var index_name = 'logstash-report';
    var message_detail;
    var message_array = {};
    req_headers = req.headers;
    req_cookies = req.cookies;
    req_query =req.query;
    req_ips = req.ips;
    req_ip = req.ip;

    if (req_headers.hasOwnProperty('x-forwarded-for')){
        msg_ip = req_headers['x-forwarded-for']
    }
    else
        msg_ip = req_ip;

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

    message_array = JSON.parse(JSON.stringify(req_query));
    if (message_array.hasOwnProperty('type'))delete message_array['type'];
    message_array['ip'] = msg_ip;
    message_array['action_type'] = req_query['type'];
    message_array['message'] = message_detail;
    message_array['@metadata'] = {'index_name': index_name, 'document_type': req_query['type']};
    redis_client.rpush('logstash:list', JSON.stringify(message_array));

    function isEmpty(obj)
    {
        for (var name in obj)
        {
            return false;
        }
        return true;
    }
});


app.post('/:opid', function (req, res) {
    res.send('Success');
    var opid = req.params.opid;
    var index_name = 'logstash-report';
    var message_detail;
    var message_array = {};
    req_headers = req.headers;
    req_cookies = req.cookies;
    req_body = req.body;
    req_ips = req.ips;
    req_ip = req.ip;

    if (req_headers.hasOwnProperty('x-forwarded-for')){
        msg_ip = req_headers['x-forwarded-for']
    }
    else
        msg_ip = req_ip;

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

    message_array = JSON.parse(JSON.stringify(req_body));
    if (message_array.hasOwnProperty('type'))delete message_array['type'];
    message_array['ip'] = msg_ip;
    message_array['action_type'] = req_body['type'];
    message_array['message'] = message_detail;
    message_array['@metadata'] = {'index_name': index_name, 'document_type': req_body['type']};
    redis_client.rpush('logstash:list', JSON.stringify(message_array));

    function isEmpty(obj)
    {
        for (var name in obj)
        {
            return false;
        }
        return true;
    }
});

var server = app.listen(port, hostname, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('App listening at http://%s:%s', host, port);
});

