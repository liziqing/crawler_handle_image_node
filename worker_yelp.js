var winston = require('winston');

var logger = new (winston.Logger)({
    transports: [
      //new (winston.transports.Console)(),
      new (winston.transports.File)({ name: 'error-file', filename: 'error.log', level: 'error' }),
      //new (winston.transports.File)({ name: 'info-file', filename: 'info.log', level: 'info' })
    ]
});

var qiniu_base_url = "http://cdnqiniu01.qnmami.com/";

var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');

var qiniu = require('qiniu');

var configHandler = require("./confighandler");

var config = configHandler.getConfig();

var Queue = require('bee-queue');
var queue = Queue('crawler_handle_image', {
  prefix: 'yelp',
  stallInterval: 5000,
  redis: {
    host: config['redis']['host'],
    port: config['redis']['port'],
    options: config['redis']['options']
  },
  removeOnSuccess: true
});
var concurrency = config['concurrency'];

qiniu.conf.ACCESS_KEY = config['qiniu']['access_key'];
qiniu.conf.SECRET_KEY = config['qiniu']['secret_key'];

var client = new qiniu.rs.Client();

// var mongo_url = config["mongodb"]["yelp_url"];
//mongo_url need to be configed
var mongo_url = 'mongodb://127.0.0.1:27017/shiji_navigation'

// Use connect method to connect to the Server
MongoClient.connect(mongo_url, function(err, admin_db) {

  var db = admin_db.db('yelp');

  logger.info("Connected correctly to server");

  queue.process(concurrency, function(job, cb) 
  {
    // -> { "foo": { "bar": true }, "data": [10, 20] }
    var type = job.data.t 

    if(type == 'c'){
      
      var from_site = job.data.from_site;
      var s_id = job.data.s_id;

      uploadYelpImage(db, {'from_site': from_site, 'shop_id': s_id}, from_site + "_" + s_id+ "_" + "cover", cb);

    }

  });
});

var uploadYelpImage = function(db, params, key, queue_cb) {
 // Get the documents collection
  var collection = db.collection('yelp_shopping');
  // Find some documents
  collection.findOne(params, function(err, doc) {

    if (err) {
      return queue_cb(err)
    }

    url = doc.cover;

    if(url){

      qiniuUpload(url, "shiji-yelp", key, queue_cb, function(){
        collection.updateOne(params, {$set: {handle_image: 2, cover: qiniu_base_url + key}}, function(err, results){
          if (err)
          {
            return queue_cb(err);            
          }

          return queue_cb(null);
        });
      });  
    }
    
  });
}

var qiniuUpload = function(url, bucket, key, queue_cb, success_callback)
{
    client.fetch(url, bucket, key, function(err, ret){
      if (!err) {
          // 上传成功， 处理返回值
          //console.log(ret.key, ret.hash);
          // ret.key & ret.hash
          
          success_callback();
      } else {
          // 上传失败， 处理返回代码
          logger.error(key + "--" + url + "--" + err)
          //return queue_cb(err);
          // http://developer.qiniu.com/docs/v6/api/reference/codes.html
      }
    });
}